use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use serde::Serialize;

const INGEST_URL: &str = "http://127.0.0.1:3001/api/assistant/activity/ingest";
const POLL_INTERVAL_SECS: u64 = 5;
const SLEEP_SLICE: Duration = Duration::from_millis(250);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivityIngestPayload {
    process_name: String,
    window_title: String,
    idle_seconds: u64,
    duration_seconds: u64,
    source: &'static str,
}

#[derive(Debug)]
struct ForegroundSample {
    process_name: String,
    window_title: String,
    idle_seconds: u64,
}

/// Handle controlling the background native Win32 foreground activity tracker thread.
pub struct WinTrackerHandle {
    stop_flag: Arc<AtomicBool>,
    _thread: Option<JoinHandle<()>>,
}

impl WinTrackerHandle {
    pub fn stop(&self) {
        self.stop_flag.store(true, Ordering::Relaxed);
    }
}

impl Drop for WinTrackerHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Spawns a lightweight background thread polling active Windows foreground apps
/// every 5 seconds using pure Win32 APIs and pushing samples to the local backend
/// with `source: "tauri-rust"` (which pauses PowerShell polling automatically).
pub fn start_win_tracker() -> WinTrackerHandle {
    let stop_flag = Arc::new(AtomicBool::new(false));

    #[cfg(not(windows))]
    {
        return WinTrackerHandle {
            stop_flag,
            _thread: None,
        };
    }

    #[cfg(windows)]
    {
        let thread_stop = Arc::clone(&stop_flag);
        let handle = thread::Builder::new()
            .name("rpg-win32-tracker".to_string())
            .spawn(move || {
                run_tracker_loop(thread_stop);
            })
            .ok();

        WinTrackerHandle {
            stop_flag,
            _thread: handle,
        }
    }
}

#[cfg(windows)]
fn run_tracker_loop(stop_flag: Arc<AtomicBool>) {
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_millis(1000))
        .timeout_read(Duration::from_millis(2000))
        .timeout_write(Duration::from_millis(2000))
        .build();

    let mut last_tick = Instant::now();

    while !stop_flag.load(Ordering::Relaxed) {
        let elapsed = last_tick.elapsed().as_secs();
        let duration_seconds = if elapsed == 0 {
            POLL_INTERVAL_SECS
        } else {
            elapsed.clamp(1, 30)
        };
        last_tick = Instant::now();

        let sample = win32_native::capture_foreground_sample();
        let payload = ActivityIngestPayload {
            process_name: sample.process_name,
            window_title: sample.window_title,
            idle_seconds: sample.idle_seconds,
            duration_seconds,
            source: "tauri-rust",
        };

        // Ignore transient connection errors while backend is restarting/offline.
        let _ = agent.post(INGEST_URL).send_json(&payload);

        let target = Instant::now() + Duration::from_secs(POLL_INTERVAL_SECS);
        while Instant::now() < target {
            if stop_flag.load(Ordering::Relaxed) {
                return;
            }
            thread::sleep(SLEEP_SLICE);
        }
    }
}

#[cfg(windows)]
mod win32_native {
    use std::mem::size_of;
    use std::path::Path;

    use windows_sys::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM};
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
        GetWindowThreadProcessId,
    };

    use super::ForegroundSample;

    struct UwpChildSearch {
        host_pid: u32,
        resolved_pid: u32,
    }

    unsafe extern "system" fn enum_uwp_child_proc(child_hwnd: HWND, lparam: LPARAM) -> BOOL {
        let state = &mut *(lparam as *mut UwpChildSearch);
        let mut child_pid: u32 = 0;
        GetWindowThreadProcessId(child_hwnd, &mut child_pid);
        if child_pid != 0 && child_pid != state.host_pid {
            state.resolved_pid = child_pid;
            return 0; // FALSE: stop enumerating once real UWP child PID is found
        }
        1 // TRUE: continue enumerating child windows
    }

    fn read_window_title(hwnd: HWND) -> String {
        unsafe {
            let len = GetWindowTextLengthW(hwnd);
            if len <= 0 {
                return String::new();
            }
            let mut buffer = vec![0u16; (len as usize) + 1];
            let written = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
            if written <= 0 {
                return String::new();
            }
            String::from_utf16_lossy(&buffer[..written as usize])
                .trim()
                .to_string()
        }
    }

    fn query_process_stem(pid: u32) -> Option<String> {
        if pid == 0 {
            return None;
        }
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return None;
            }

            let mut buffer = [0u16; 1024];
            let mut size = buffer.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut size);
            CloseHandle(handle);

            if ok == 0 || size == 0 {
                return None;
            }

            let full_path = String::from_utf16_lossy(&buffer[..size as usize]);
            let stem = Path::new(&full_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .map(|s| s.trim().to_string())?;

            if stem.is_empty() {
                None
            } else {
                Some(stem)
            }
        }
    }

    fn resolve_process_name(hwnd: HWND, pid: u32) -> String {
        let Some(name) = query_process_stem(pid) else {
            return "Idle".to_string();
        };

        // Unwrap UWP / Microsoft Store apps hosted inside ApplicationFrameHost.exe
        if name.eq_ignore_ascii_case("ApplicationFrameHost") {
            let mut search = UwpChildSearch {
                host_pid: pid,
                resolved_pid: 0,
            };
            unsafe {
                EnumChildWindows(
                    hwnd,
                    Some(enum_uwp_child_proc),
                    &mut search as *mut UwpChildSearch as LPARAM,
                );
            }
            if search.resolved_pid != 0 {
                if let Some(uwp_name) = query_process_stem(search.resolved_pid) {
                    return uwp_name;
                }
            }
        }

        name
    }

    fn get_idle_seconds() -> u64 {
        unsafe {
            let mut lii = LASTINPUTINFO {
                cbSize: size_of::<LASTINPUTINFO>() as u32,
                dwTime: 0,
            };
            if GetLastInputInfo(&mut lii) == 0 {
                return 0;
            }
            let now_tick = GetTickCount();
            let elapsed_ms = now_tick.wrapping_sub(lii.dwTime);
            (elapsed_ms / 1000) as u64
        }
    }

    pub fn capture_foreground_sample() -> ForegroundSample {
        let idle_seconds = get_idle_seconds();

        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return ForegroundSample {
                    process_name: "Idle".to_string(),
                    window_title: String::new(),
                    idle_seconds,
                };
            }

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);

            let process_name = resolve_process_name(hwnd, pid);
            let window_title = read_window_title(hwnd);

            ForegroundSample {
                process_name,
                window_title,
                idle_seconds,
            }
        }
    }
}
