use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::startup_log;

pub const BACKEND_BASE_URL: &str = "http://127.0.0.1:3001";
const HEALTH_URL: &str = "http://127.0.0.1:3001/api/health";
const STARTUP_WAIT_TIMEOUT: Duration = Duration::from_secs(8);
const STARTUP_POLL_INTERVAL: Duration = Duration::from_millis(200);

#[cfg(windows)]
mod win_job {
    use std::ffi::c_void;
    use std::mem::{size_of, zeroed};
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;
    use std::ptr::{null, null_mut};

    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    /// Win32 process creation flag to suppress any visible console window.
    pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    /// Owned wrapper around a Win32 Job Object handle configured with
    /// `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. Closing this handle—or crashing the
    /// parent Tauri process—causes the Windows kernel to terminate the entire
    /// child Node/tsx process tree with zero zombie processes.
    pub struct JobHandle(HANDLE);

    // SAFETY: Win32 HANDLE values can be moved across threads and closed safely
    // when synchronized behind a Mutex.
    unsafe impl Send for JobHandle {}

    impl Drop for JobHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    CloseHandle(self.0);
                }
                self.0 = null_mut();
            }
        }
    }

    pub fn create_kill_on_close_job() -> Result<JobHandle, std::io::Error> {
        unsafe {
            let job = CreateJobObjectW(null(), null());
            if job.is_null() {
                return Err(std::io::Error::last_os_error());
            }

            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let ok = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION as *const c_void,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );

            if ok == 0 {
                let err = std::io::Error::last_os_error();
                CloseHandle(job);
                return Err(err);
            }

            Ok(JobHandle(job))
        }
    }

    pub fn assign_child(job: &JobHandle, child: &Child) -> Result<(), std::io::Error> {
        unsafe {
            let process_handle = child.as_raw_handle() as HANDLE;
            let ok = AssignProcessToJobObject(job.0, process_handle);
            if ok == 0 {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        }
    }
}

/// Manages the lifecycle of the local Express/SQLite Node backend (`server/index.ts`).
/// Includes an automatic self-healing watchdog so if an external backend stops or
/// the child process exits, Tauri immediately respawns its own embedded Node backend.
pub struct BackendGuard {
    child: Mutex<Option<Child>>,
    #[cfg(windows)]
    job: Mutex<Option<win_job::JobHandle>>,
    respawn_lock: Mutex<()>,
    spawned_by_tauri: AtomicBool,
    healthy: AtomicBool,
    shutting_down: AtomicBool,
    workspace_root: PathBuf,
}

impl BackendGuard {
    /// Checks if `http://127.0.0.1:3001/api/health` is already serving.
    /// If not, spawns the local Node/tsx server silently in the resolved workspace root
    /// and binds it to a Windows Kill-on-Close Job Object.
    pub fn ensure_started() -> Self {
        let workspace_root = resolve_workspace_root();
        let guard = Self {
            child: Mutex::new(None),
            #[cfg(windows)]
            job: Mutex::new(None),
            respawn_lock: Mutex::new(()),
            spawned_by_tauri: AtomicBool::new(false),
            healthy: AtomicBool::new(false),
            shutting_down: AtomicBool::new(false),
            workspace_root,
        };

        if is_backend_healthy() {
            guard.healthy.store(true, Ordering::SeqCst);
            startup_log::log(&format!(
                "backend_ready: already_running=true spawned_by_tauri=false root='{}'",
                guard.workspace_root.display()
            ));
            return guard;
        }

        let healthy = guard.ensure_alive();
        startup_log::log(&format!(
            "backend_ready: already_running=false spawned_by_tauri={} healthy={healthy} root='{}'",
            guard.spawned_by_tauri(),
            guard.workspace_root.display()
        ));
        guard
    }

    /// Ensures the local backend is alive and responding on `/api/health`.
    /// Thread-safe: concurrent callers share a single respawn attempt.
    pub fn ensure_alive(&self) -> bool {
        if self.shutting_down.load(Ordering::SeqCst) {
            return false;
        }
        if is_backend_healthy() {
            self.healthy.store(true, Ordering::SeqCst);
            return true;
        }

        let _lock = match self.respawn_lock.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };

        if self.shutting_down.load(Ordering::SeqCst) {
            return false;
        }
        if is_backend_healthy() {
            self.healthy.store(true, Ordering::SeqCst);
            return true;
        }

        // Clean up any previous dead or hung child process before respawning.
        if let Ok(mut slot) = self.child.lock() {
            if let Some(mut prev_child) = slot.take() {
                let _ = prev_child.kill();
                let _ = prev_child.wait();
            }
        }

        startup_log::log(&format!(
            "backend: spawning local Node/tsx server in root='{}'",
            self.workspace_root.display()
        ));

        match spawn_backend_child(&self.workspace_root) {
            Ok(spawned) => {
                if let Ok(mut slot) = self.child.lock() {
                    *slot = Some(spawned.child);
                }
                #[cfg(windows)]
                if let Ok(mut job_slot) = self.job.lock() {
                    *job_slot = Some(spawned.job);
                }
                self.spawned_by_tauri.store(true, Ordering::SeqCst);
                let healthy = wait_until_healthy(STARTUP_WAIT_TIMEOUT);
                self.healthy.store(healthy, Ordering::SeqCst);
                startup_log::log(&format!(
                    "backend_spawned: healthy={healthy} root='{}'",
                    self.workspace_root.display()
                ));
                healthy
            }
            Err(err) => {
                self.healthy.store(false, Ordering::SeqCst);
                startup_log::log(&format!(
                    "backend_error: failed to spawn Node backend in '{}': {err}",
                    self.workspace_root.display()
                ));
                false
            }
        }
    }

    pub fn spawned_by_tauri(&self) -> bool {
        self.spawned_by_tauri.load(Ordering::SeqCst)
    }

    pub fn is_healthy_on_start(&self) -> bool {
        self.healthy.load(Ordering::SeqCst)
    }

    pub fn is_shutting_down(&self) -> bool {
        self.shutting_down.load(Ordering::SeqCst)
    }

    /// Deterministically terminates the managed backend child process and closes
    /// the Windows Job Object handle (reaping the entire Node/tsx process tree).
    pub fn shutdown(&self) {
        self.shutting_down.store(true, Ordering::SeqCst);
        if let Ok(mut slot) = self.child.lock() {
            if let Some(mut child) = slot.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        #[cfg(windows)]
        {
            if let Ok(mut job_slot) = self.job.lock() {
                let _ = job_slot.take();
            }
        }
    }
}

impl Drop for BackendGuard {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// Returns `true` when the local Express backend responds with HTTP 2xx on `/api/health`.
pub fn is_backend_healthy() -> bool {
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_millis(750))
        .timeout_read(Duration::from_millis(1200))
        .build();

    match agent.get(HEALTH_URL).call() {
        Ok(resp) => (200..300).contains(&resp.status()),
        Err(_) => false,
    }
}

fn wait_until_healthy(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if is_backend_healthy() {
            return true;
        }
        std::thread::sleep(STARTUP_POLL_INTERVAL);
    }
    is_backend_healthy()
}

fn has_server_entry(dir: &Path) -> bool {
    dir.join("server").join("index.ts").is_file()
}

fn find_root_in_ancestors(start: &Path) -> Option<PathBuf> {
    let mut cursor = Some(start);
    while let Some(dir) = cursor {
        if has_server_entry(dir) {
            return Some(dir.to_path_buf());
        }
        cursor = dir.parent();
    }
    None
}

/// Resolves the project workspace root containing `server/index.ts`,
/// even when launched from `src-tauri\target\release` or via a Desktop shortcut.
pub fn resolve_workspace_root() -> PathBuf {
    if let Ok(explicit) = std::env::var("RPG_LIFE_TRACKER_ROOT") {
        let candidate = PathBuf::from(explicit);
        if has_server_entry(&candidate) {
            return candidate;
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        if let Some(found) = find_root_in_ancestors(&cwd) {
            return found;
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if let Some(found) = find_root_in_ancestors(exe_dir) {
                return found;
            }
        }
    }

    // Compile-time fallback: parent directory of `src-tauri/` during local builds.
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    if let Some(parent) = manifest_dir.parent() {
        if has_server_entry(parent) {
            return parent.to_path_buf();
        }
    }

    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[cfg(windows)]
fn resolve_node_executable() -> PathBuf {
    let candidates = [
        PathBuf::from(r"D:\node\node.exe"),
        PathBuf::from(r"C:\Program Files\nodejs\node.exe"),
    ];
    for c in &candidates {
        if c.is_file() {
            return c.clone();
        }
    }
    PathBuf::from("node.exe")
}

#[cfg(windows)]
fn build_augmented_path() -> String {
    let current = std::env::var("PATH").unwrap_or_default();
    format!(r"D:\node;C:\Program Files\nodejs;{current}")
}

struct SpawnedBackend {
    child: Child,
    #[cfg(windows)]
    job: win_job::JobHandle,
}

#[cfg(windows)]
fn spawn_backend_child(workspace_root: &Path) -> Result<SpawnedBackend, std::io::Error> {
    use std::os::windows::process::CommandExt;

    let job = win_job::create_kill_on_close_job()?;
    let augmented_path = build_augmented_path();
    let node_exe = resolve_node_executable();
    let tsx_cli_mjs = workspace_root
        .join("node_modules")
        .join("tsx")
        .join("dist")
        .join("cli.mjs");
    let local_tsx_cmd = workspace_root
        .join("node_modules")
        .join(".bin")
        .join("tsx.cmd");

    let try_spawn = |program: &Path, args: &[&str]| -> Result<Child, std::io::Error> {
        let mut cmd = Command::new(program);
        cmd.args(args)
            .current_dir(workspace_root)
            .env("PATH", &augmented_path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(win_job::CREATE_NO_WINDOW);
        cmd.spawn()
    };

    // Prefer direct `node.exe node_modules/tsx/dist/cli.mjs server/index.ts` (zero cmd.exe wrapper)
    let child = if tsx_cli_mjs.is_file() {
        let cli_str = tsx_cli_mjs.to_string_lossy().to_string();
        try_spawn(&node_exe, &[cli_str.as_str(), "server/index.ts"])
            .or_else(|_| try_spawn(&local_tsx_cmd, &["server/index.ts"]))
            .or_else(|_| try_spawn(Path::new(r"D:\node\npx.cmd"), &["tsx", "server/index.ts"]))
            .or_else(|_| try_spawn(Path::new("npx.cmd"), &["tsx", "server/index.ts"]))?
    } else if local_tsx_cmd.is_file() {
        try_spawn(&local_tsx_cmd, &["server/index.ts"])
            .or_else(|_| try_spawn(Path::new(r"D:\node\npx.cmd"), &["tsx", "server/index.ts"]))
            .or_else(|_| try_spawn(Path::new("npx.cmd"), &["tsx", "server/index.ts"]))?
    } else {
        try_spawn(Path::new(r"D:\node\npx.cmd"), &["tsx", "server/index.ts"])
            .or_else(|_| try_spawn(Path::new("npx.cmd"), &["tsx", "server/index.ts"]))?
    };

    if let Err(err) = win_job::assign_child(&job, &child) {
        startup_log::log(&format!(
            "backend_warn: AssignProcessToJobObject failed: {err}"
        ));
    }

    Ok(SpawnedBackend { child, job })
}

#[cfg(not(windows))]
fn spawn_backend_child(workspace_root: &Path) -> Result<SpawnedBackend, std::io::Error> {
    let mut cmd = Command::new("npx");
    cmd.args(["tsx", "server/index.ts"])
        .current_dir(workspace_root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = cmd.spawn()?;
    Ok(SpawnedBackend { child })
}
