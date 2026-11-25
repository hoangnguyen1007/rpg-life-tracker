use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::startup_log;

pub const BACKEND_BASE_URL: &str = "http://127.0.0.1:3001";
const HEALTH_URL: &str = "http://127.0.0.1:3001/api/health";
const STARTUP_WAIT_TIMEOUT: Duration = Duration::from_secs(6);
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
/// Stored in Tauri managed state for the entire application lifetime.
pub struct BackendGuard {
    child: Mutex<Option<Child>>,
    #[cfg(windows)]
    job: Mutex<Option<win_job::JobHandle>>,
    spawned_by_tauri: bool,
    workspace_root: PathBuf,
    healthy: bool,
}

impl BackendGuard {
    /// Checks if `http://127.0.0.1:3001/api/health` is already serving.
    /// If not, spawns `npx.cmd tsx server/index.ts` (or local `tsx.cmd`) silently in the
    /// resolved workspace root and binds it to a Windows Kill-on-Close Job Object.
    pub fn ensure_started() -> Self {
        let workspace_root = resolve_workspace_root();
        if is_backend_healthy() {
            startup_log::log(&format!(
                "backend_ready: already_running=true spawned_by_tauri=false root='{}'",
                workspace_root.display()
            ));
            return Self {
                child: Mutex::new(None),
                #[cfg(windows)]
                job: Mutex::new(None),
                spawned_by_tauri: false,
                workspace_root,
                healthy: true,
            };
        }

        startup_log::log(&format!(
            "backend: spawning local Node/tsx server in root='{}'",
            workspace_root.display()
        ));

        match spawn_backend_process(&workspace_root) {
            Ok(mut guard) => {
                let healthy = wait_until_healthy(STARTUP_WAIT_TIMEOUT);
                guard.healthy = healthy;
                startup_log::log(&format!(
                    "backend_ready: already_running=false spawned_by_tauri=true healthy={healthy} root='{}'",
                    guard.workspace_root.display()
                ));
                guard
            }
            Err(err) => {
                startup_log::log(&format!(
                    "backend_error: failed to spawn Node backend in '{}': {err}",
                    workspace_root.display()
                ));
                Self {
                    child: Mutex::new(None),
                    #[cfg(windows)]
                    job: Mutex::new(None),
                    spawned_by_tauri: false,
                    workspace_root,
                    healthy: false,
                }
            }
        }
    }

    pub fn spawned_by_tauri(&self) -> bool {
        self.spawned_by_tauri
    }

    pub fn is_healthy_on_start(&self) -> bool {
        self.healthy
    }

    /// Deterministically terminates the managed backend child process and closes
    /// the Windows Job Object handle (reaping the entire Node/tsx process tree).
    pub fn shutdown(&self) {
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
fn spawn_backend_process(workspace_root: &Path) -> Result<BackendGuard, std::io::Error> {
    use std::os::windows::process::CommandExt;

    let job = win_job::create_kill_on_close_job()?;

    let local_tsx = workspace_root
        .join("node_modules")
        .join(".bin")
        .join("tsx.cmd");

    let try_spawn = |program: &Path, args: &[&str]| -> Result<Child, std::io::Error> {
        let mut cmd = Command::new(program);
        cmd.args(args)
            .current_dir(workspace_root)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(win_job::CREATE_NO_WINDOW);
        cmd.spawn()
    };

    let child = if local_tsx.is_file() {
        try_spawn(&local_tsx, &["server/index.ts"])
            .or_else(|_| try_spawn(Path::new("npx.cmd"), &["tsx", "server/index.ts"]))
            .or_else(|_| try_spawn(Path::new(r"D:\node\npx.cmd"), &["tsx", "server/index.ts"]))?
    } else {
        try_spawn(Path::new("npx.cmd"), &["tsx", "server/index.ts"])
            .or_else(|_| try_spawn(Path::new(r"D:\node\npx.cmd"), &["tsx", "server/index.ts"]))?
    };

    if let Err(err) = win_job::assign_child(&job, &child) {
        startup_log::log(&format!(
            "backend_warn: AssignProcessToJobObject failed: {err}"
        ));
    }

    Ok(BackendGuard {
        child: Mutex::new(Some(child)),
        job: Mutex::new(Some(job)),
        spawned_by_tauri: true,
        workspace_root: workspace_root.to_path_buf(),
        healthy: false,
    })
}

#[cfg(not(windows))]
fn spawn_backend_process(workspace_root: &Path) -> Result<BackendGuard, std::io::Error> {
    let mut cmd = Command::new("npx");
    cmd.args(["tsx", "server/index.ts"])
        .current_dir(workspace_root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = cmd.spawn()?;

    Ok(BackendGuard {
        child: Mutex::new(Some(child)),
        spawned_by_tauri: true,
        workspace_root: workspace_root.to_path_buf(),
        healthy: false,
    })
}
