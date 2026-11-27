use std::time::Duration;

use crate::startup_log;

pub const SINGLE_INSTANCE_MUTEX_PREFIX: &str = "Local\\RPG_Life_Tracker_Tauri_SingleInstance";
const HUD_CONTROL_ENDPOINT: &str = "http://127.0.0.1:3001/api/hud/control";

fn scoped_mutex_name() -> String {
    let raw_desktop = startup_log::current_desktop_name();
    let sanitized: String = raw_desktop
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    if sanitized.is_empty() || sanitized.eq_ignore_ascii_case("Default") {
        SINGLE_INSTANCE_MUTEX_PREFIX.to_string()
    } else {
        format!("{SINGLE_INSTANCE_MUTEX_PREFIX}_{sanitized}")
    }
}

#[cfg(windows)]
mod win_mutex {
    use std::ptr::null;
    use std::sync::Mutex;

    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HANDLE,
    };
    use windows_sys::Win32::System::Threading::CreateMutexW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        FindWindowW, SetForegroundWindow, SetWindowPos, ShowWindow, HWND_TOPMOST, SWP_FRAMECHANGED,
        SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, SW_RESTORE, SW_SHOW,
    };

    use super::scoped_mutex_name;
    use crate::startup_log;

    pub struct SingleInstanceGuard(Mutex<Option<HANDLE>>);

    // SAFETY: Win32 mutex HANDLE is synchronized via Mutex and closed on Drop.
    unsafe impl Send for SingleInstanceGuard {}
    unsafe impl Sync for SingleInstanceGuard {}

    impl Drop for SingleInstanceGuard {
        fn drop(&mut self) {
            if let Ok(mut slot) = self.0.lock() {
                if let Some(handle) = slot.take() {
                    if !handle.is_null() {
                        unsafe {
                            CloseHandle(handle);
                        }
                    }
                }
            }
        }
    }

    fn to_wide_null(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub enum AcquireStatus {
        Acquired(SingleInstanceGuard),
        AlreadyRunning,
    }

    pub fn try_acquire() -> AcquireStatus {
        let mutex_name = scoped_mutex_name();
        let wide_name = to_wide_null(&mutex_name);
        unsafe {
            let handle = CreateMutexW(null(), 0, wide_name.as_ptr());
            let err = GetLastError();
            if handle.is_null() {
                startup_log::log(&format!(
                    "mutex: CreateMutexW failed (err={err}); continuing without lock"
                ));
                return AcquireStatus::Acquired(SingleInstanceGuard(Mutex::new(None)));
            }
            if err == ERROR_ALREADY_EXISTS {
                CloseHandle(handle);
                return AcquireStatus::AlreadyRunning;
            }
            AcquireStatus::Acquired(SingleInstanceGuard(Mutex::new(Some(handle))))
        }
    }

    pub fn fallback_show_existing_window() -> bool {
        let titles = ["RPG Life Tracker — The System", "RPG Life Tracker HUD"];
        for t in titles {
            let wide = to_wide_null(t);
            unsafe {
                let hwnd = FindWindowW(null(), wide.as_ptr());
                if hwnd.is_null() {
                    continue;
                }
                ShowWindow(hwnd, SW_RESTORE);
                ShowWindow(hwnd, SW_SHOW);
                if t.ends_with("HUD") {
                    SetWindowPos(
                        hwnd,
                        HWND_TOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
                    );
                }
                SetForegroundWindow(hwnd);
                return true;
            }
        }
        false
    }
}

#[cfg(not(windows))]
mod win_mutex {
    pub struct SingleInstanceGuard;

    pub enum AcquireStatus {
        Acquired(SingleInstanceGuard),
        AlreadyRunning,
    }

    pub fn try_acquire() -> AcquireStatus {
        AcquireStatus::Acquired(SingleInstanceGuard)
    }

    pub fn fallback_show_existing_window() -> bool {
        false
    }
}

pub use win_mutex::SingleInstanceGuard;

/// Acquires the Win32 desktop-scoped single-instance mutex before WebView2 initializes.
/// If another instance is already running on the SAME desktop, wakes its Main Dashboard (or HUD
/// on `--autostart`) via `POST http://127.0.0.1:3001/api/hud/control` and exits cleanly (0).
pub fn acquire_or_wake_existing() -> SingleInstanceGuard {
    let mutex_name = scoped_mutex_name();
    let is_autostart = std::env::args().any(|a| a == "--autostart");
    match win_mutex::try_acquire() {
        win_mutex::AcquireStatus::Acquired(guard) => {
            startup_log::log(&format!("mutex: acquired ({mutex_name})"));
            guard
        }
        win_mutex::AcquireStatus::AlreadyRunning => {
            let wake_action = if is_autostart { "dock" } else { "open_dashboard" };
            startup_log::log(&format!(
                "mutex: already_exists ({mutex_name}) — waking existing instance via action={wake_action}"
            ));
            let agent = ureq::AgentBuilder::new()
                .timeout_connect(Duration::from_secs(2))
                .timeout_read(Duration::from_secs(3))
                .timeout_write(Duration::from_secs(2))
                .build();

            let http_ok = match agent
                .post(HUD_CONTROL_ENDPOINT)
                .send_json(serde_json::json!({ "action": wake_action }))
            {
                Ok(resp) => {
                    let status = resp.status();
                    let body = resp.into_string().unwrap_or_default();
                    startup_log::log(&format!(
                        "mutex: wake_http ok status={status} body={body}"
                    ));
                    (200..300).contains(&status)
                }
                Err(err) => {
                    startup_log::log(&format!("mutex: wake_http failed: {err}"));
                    false
                }
            };

            if !http_ok {
                let win_found = win_mutex::fallback_show_existing_window();
                startup_log::log(&format!("mutex: fallback_find_window={win_found}"));
            }

            startup_log::log("mutex: second_instance_exit_0");
            std::process::exit(0);
        }
    }
}
