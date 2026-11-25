use std::time::Duration;

use crate::startup_log;

pub const SINGLE_INSTANCE_MUTEX_NAME: &str = "Local\\RPG_Life_Tracker_Tauri_SingleInstance";
const HUD_CONTROL_ENDPOINT: &str = "http://127.0.0.1:3001/api/hud/control";

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

    use super::SINGLE_INSTANCE_MUTEX_NAME;
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
        let wide_name = to_wide_null(SINGLE_INSTANCE_MUTEX_NAME);
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

    pub fn fallback_show_existing_hud_window() -> bool {
        let title = to_wide_null("RPG Life Tracker HUD");
        unsafe {
            let hwnd = FindWindowW(null(), title.as_ptr());
            if hwnd.is_null() {
                return false;
            }
            ShowWindow(hwnd, SW_RESTORE);
            ShowWindow(hwnd, SW_SHOW);
            SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
            );
            SetForegroundWindow(hwnd);
            true
        }
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

    pub fn fallback_show_existing_hud_window() -> bool {
        false
    }
}

pub use win_mutex::SingleInstanceGuard;

/// Acquires the Win32 named single-instance mutex before WebView2 initializes.
/// If another instance is already running, immediately wakes and docks its Mini HUD
/// via `POST http://127.0.0.1:3001/api/hud/control {"action":"dock"}` and exits cleanly (0).
pub fn acquire_or_wake_existing() -> SingleInstanceGuard {
    match win_mutex::try_acquire() {
        win_mutex::AcquireStatus::Acquired(guard) => {
            startup_log::log(&format!("mutex: acquired ({SINGLE_INSTANCE_MUTEX_NAME})"));
            guard
        }
        win_mutex::AcquireStatus::AlreadyRunning => {
            startup_log::log(&format!(
                "mutex: already_exists ({SINGLE_INSTANCE_MUTEX_NAME}) — waking existing HUD via POST {HUD_CONTROL_ENDPOINT}"
            ));
            let agent = ureq::AgentBuilder::new()
                .timeout_connect(Duration::from_secs(2))
                .timeout_read(Duration::from_secs(3))
                .timeout_write(Duration::from_secs(2))
                .build();

            let http_ok = match agent
                .post(HUD_CONTROL_ENDPOINT)
                .send_json(serde_json::json!({ "action": "dock" }))
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
                let win_found = win_mutex::fallback_show_existing_hud_window();
                startup_log::log(&format!("mutex: fallback_find_window={win_found}"));
            }

            startup_log::log("mutex: second_instance_exit_0");
            std::process::exit(0);
        }
    }
}
