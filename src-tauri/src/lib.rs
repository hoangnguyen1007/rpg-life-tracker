mod backend_manager;
mod hud_state;
mod single_instance;
mod startup_log;
mod win_tracker;

use std::time::Duration;

use serde::Serialize;
use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::window::Color;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Position, RunEvent, Size,
    WebviewWindow, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const HUD_MINI_WIDTH: f64 = 292.0;
const HUD_MINI_HEIGHT: f64 = 76.0;
const HUD_NORMAL_WIDTH: f64 = 404.0;
const HUD_NORMAL_HEIGHT: f64 = 186.0;
const HUD_EXPANDED_WIDTH: f64 = 404.0;
const HUD_EXPANDED_HEIGHT: f64 = 236.0;

const HUD_DOCK_MARGIN_RIGHT_LOGICAL: f64 = 16.0;
const HUD_DOCK_MARGIN_BOTTOM_LOGICAL: f64 = 6.0;

const DND_ENDPOINT: &str = "http://127.0.0.1:3001/api/assistant/dnd";
const OVERVIEW_ENDPOINT: &str = "http://127.0.0.1:3001/api/assistant/overview";
const HUD_WAIT_COMMAND_ENDPOINT: &str = "http://127.0.0.1:3001/api/hud/wait-command";
const HUD_SYNC_STATE_ENDPOINT: &str = "http://127.0.0.1:3001/api/hud/sync-state";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TauriEnvInfo {
    pub is_tauri: bool,
    pub platform: &'static str,
    pub app_version: &'static str,
    pub autostart_launched: bool,
    pub backend_url: &'static str,
    pub backend_managed_by_tauri: bool,
    pub native_win_tracker: bool,
}

fn is_autostart_launch() -> bool {
    std::env::args().any(|arg| arg == "--autostart")
}

fn wants_hud_only_on_launch() -> bool {
    std::env::args().any(|arg| arg == "--hud-only")
}

fn hud_dimensions_for_mode(mode: &str) -> (f64, f64) {
    match mode {
        "mini" => (HUD_MINI_WIDTH, HUD_MINI_HEIGHT),
        "expanded" => (HUD_EXPANDED_WIDTH, HUD_EXPANDED_HEIGHT),
        _ => (HUD_NORMAL_WIDTH, HUD_NORMAL_HEIGHT),
    }
}

/// Forces Windows 11 DWM / WebView2 transparent window to refresh its topmost Z-order
/// and composited surface immediately after showing or docking.
#[cfg(windows)]
fn force_win32_topmost_refresh(window: &WebviewWindow, activate: bool) {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        SWP_SHOWWINDOW,
    };

    if let Ok(raw_hwnd) = window.hwnd() {
        let hwnd = raw_hwnd.0 as HWND;
        let mut flags = SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW | SWP_FRAMECHANGED;
        if !activate {
            flags |= SWP_NOACTIVATE;
        }
        unsafe {
            SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, flags);
        }
    }
}

#[cfg(not(windows))]
fn force_win32_topmost_refresh(_window: &WebviewWindow, _activate: bool) {}

/// Docks the floating 2D Pixel HUD cleanly at the bottom-right corner directly above
/// the Windows taskbar using `primary_monitor().work_area()` and DPI `scale_factor()`.
fn dock_hud_bottom_right(
    window: &WebviewWindow,
    logical_w: f64,
    logical_h: f64,
) -> Option<hud_state::HudPosition> {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())?;

    let scale = monitor.scale_factor();
    let wa = monitor.work_area();

    let hud_w = (logical_w * scale).round() as i32;
    let hud_h = (logical_h * scale).round() as i32;
    let margin_r = (HUD_DOCK_MARGIN_RIGHT_LOGICAL * scale).round() as i32;
    let margin_b = (HUD_DOCK_MARGIN_BOTTOM_LOGICAL * scale).round() as i32;

    let min_x = wa.position.x;
    let min_y = wa.position.y;
    let x = (wa.position.x + (wa.size.width as i32) - hud_w - margin_r).max(min_x);
    let y = (wa.position.y + (wa.size.height as i32) - hud_h - margin_b).max(min_y);

    let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
    Some(hud_state::HudPosition { x, y })
}

fn dock_hud_preserving_valid_size(hud: &WebviewWindow) -> Option<hud_state::HudPosition> {
    let scale = hud.scale_factor().unwrap_or(1.0);
    let (mut w, mut h) = hud
        .outer_size()
        .map(|s| ((s.width as f64) / scale, (s.height as f64) / scale))
        .unwrap_or((HUD_NORMAL_WIDTH, HUD_NORMAL_HEIGHT));

    if w < 120.0 || h < 48.0 {
        w = HUD_NORMAL_WIDTH;
        h = HUD_NORMAL_HEIGHT;
        let _ = hud.set_size(Size::Logical(LogicalSize::new(w, h)));
    }
    dock_hud_bottom_right(hud, w, h)
}

fn dock_and_save_hud(app: &AppHandle) -> Result<(), String> {
    let hud = app
        .get_webview_window("hud")
        .ok_or_else(|| "HUD window not found".to_string())?;
    if let Some(pos) = dock_hud_preserving_valid_size(&hud) {
        if let Some(saver) = app.try_state::<hud_state::HudPositionSaver>() {
            saver.save_immediately(pos);
        } else {
            hud_state::save_position_now(pos);
        }
        startup_log::log(&format!(
            "hud_docked: pos=({}, {}) saved_to='{}'",
            pos.x,
            pos.y,
            hud_state::position_file_path().display()
        ));
    }
    let _ = set_hud_visible_inner(app, true);
    Ok(())
}

fn show_main_window_inner(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    let _ = window.unminimize();
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    let _ = app.emit("tauri-state-refresh", true);
    Ok(())
}

fn should_show_hud_on_start() -> bool {
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(1))
        .timeout_read(Duration::from_secs(2))
        .build();

    if let Ok(resp) = agent.get(OVERVIEW_ENDPOINT).call() {
        if let Ok(val) = resp.into_json::<serde_json::Value>() {
            if let Some(flag) = val
                .get("settings")
                .and_then(|s| s.get("hudVisibleOnStart"))
                .and_then(|v| v.as_bool())
            {
                return flag;
            }
        }
    }
    true
}

fn sync_hud_visible_to_backend_async(visible: bool) {
    std::thread::spawn(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(1))
            .timeout_read(Duration::from_secs(2))
            .timeout_write(Duration::from_secs(1))
            .build();
        let _ = agent
            .post(HUD_SYNC_STATE_ENDPOINT)
            .send_json(serde_json::json!({ "visible": visible }));
    });
}

fn set_hud_visible_inner(app: &AppHandle, visible: bool) -> Result<bool, String> {
    let window = app
        .get_webview_window("hud")
        .ok_or_else(|| "HUD window not found".to_string())?;
    if visible {
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
        let _ = window.unminimize();
        let _ = window.set_always_on_top(true);
        window.show().map_err(|e| e.to_string())?;
        force_win32_topmost_refresh(&window, true);
        let _ = window.set_focus();
        let _ = app.emit("tauri-hud-visibility", true);
        let _ = app.emit("tauri-state-refresh", true);
        sync_hud_visible_to_backend_async(true);
        Ok(true)
    } else {
        window.hide().map_err(|e| e.to_string())?;
        let _ = app.emit("tauri-hud-visibility", false);
        let _ = app.emit("tauri-state-refresh", false);
        sync_hud_visible_to_backend_async(false);
        Ok(false)
    }
}

fn start_hud_bridge_listener(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(2))
            .timeout_read(Duration::from_secs(26))
            .build();

        loop {
            let is_vis = app_handle
                .get_webview_window("hud")
                .and_then(|w| w.is_visible().ok())
                .unwrap_or(false);
            let url = format!("{HUD_WAIT_COMMAND_ENDPOINT}?visible={is_vis}");
            match agent.get(&url).call() {
                Ok(resp) => {
                    if let Ok(json) = resp.into_json::<serde_json::Value>() {
                        if let Some(action) = json.get("action").and_then(|v| v.as_str()) {
                            let handle = app_handle.clone();
                            let action_owned = action.to_string();
                            let _ = app_handle.run_on_main_thread(move || {
                                match action_owned.as_str() {
                                    "show" => {
                                        let _ = set_hud_visible_inner(&handle, true);
                                    }
                                    "hide" => {
                                        let _ = set_hud_visible_inner(&handle, false);
                                    }
                                    "toggle" => {
                                        let _ = toggle_hud_window_inner(&handle);
                                    }
                                    "dock" => {
                                        let _ = dock_and_save_hud(&handle);
                                    }
                                    "open_dashboard" => {
                                        let _ = show_main_window_inner(&handle);
                                    }
                                    _ => {}
                                }
                            });
                        }
                    }
                }
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(1200));
                }
            }
        }
    });
}

fn toggle_hud_window_inner(app: &AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("hud")
        .ok_or_else(|| "HUD window not found".to_string())?;
    let currently_visible = window.is_visible().unwrap_or(false);
    set_hud_visible_inner(app, !currently_visible)
}

fn trigger_dnd_async(app: AppHandle, minutes: u32) {
    std::thread::spawn(move || {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(2))
            .timeout_read(Duration::from_secs(3))
            .timeout_write(Duration::from_secs(2))
            .build();

        let payload = serde_json::json!({ "minutes": minutes });
        match agent.post(DND_ENDPOINT).send_json(payload) {
            Ok(_) => {
                let _ = app.emit("tauri-dnd-updated", minutes);
            }
            Err(err) => {
                startup_log::log(&format!("tray_dnd_warn ({minutes}m): {err}"));
            }
        }
    });
}

/// Resizes the 2D Pixel Discipline HUD between `"mini"` (`292×76`), `"normal"` (`404×186`),
/// and `"expanded"` (`404×236`) — also accepting legacy `expanded: bool` — while keeping
/// the bottom edge anchored directly above the taskbar (and clamping inside monitor work_area).
#[tauri::command]
fn resize_hud(
    app: AppHandle,
    mode: Option<String>,
    expanded: Option<bool>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("hud")
        .ok_or_else(|| "HUD window not found".to_string())?;

    let resolved_mode = match mode.as_deref() {
        Some(m) => m,
        None => match expanded {
            Some(true) => "expanded",
            _ => "normal",
        },
    };
    let (target_w, target_h) = hud_dimensions_for_mode(resolved_mode);

    let prev_pos = window.outer_position().ok();
    let prev_size = window.outer_size().ok();
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());
    let scale = monitor
        .as_ref()
        .map(|m| m.scale_factor())
        .or_else(|| window.scale_factor().ok())
        .unwrap_or(1.0);

    window
        .set_size(Size::Logical(LogicalSize::new(target_w, target_h)))
        .map_err(|e| e.to_string())?;

    if let (Some(pos), Some(size)) = (prev_pos, prev_size) {
        let new_w_phys = (target_w * scale).round() as i32;
        let new_h_phys = (target_h * scale).round() as i32;

        // Keep bottom edge anchored right above the taskbar as height grows/shrinks.
        let old_bottom = pos.y + (size.height as i32);
        let mut new_y = old_bottom - new_h_phys;

        // Keep right edge anchored when HUD sits on the right half of the screen;
        // keep left edge anchored if user dragged it to the left half.
        let mut new_x = pos.x;
        if let Some(mon) = monitor.as_ref() {
            let wa = mon.work_area();
            let center_x = pos.x + (size.width as i32) / 2;
            let wa_mid_x = wa.position.x + (wa.size.width as i32) / 2;
            if center_x >= wa_mid_x {
                let old_right = pos.x + (size.width as i32);
                new_x = old_right - new_w_phys;
            }

            let max_x = (wa.position.x + (wa.size.width as i32) - new_w_phys).max(wa.position.x);
            let max_y = (wa.position.y + (wa.size.height as i32) - new_h_phys).max(wa.position.y);
            new_x = new_x.clamp(wa.position.x, max_x);
            new_y = new_y.clamp(wa.position.y, max_y);
        }

        if let Some(saver) = app.try_state::<hud_state::HudPositionSaver>() {
            saver.suppress_briefly(Duration::from_millis(250));
        }
        let _ = window.set_position(Position::Physical(PhysicalPosition::new(new_x, new_y)));
    }

    Ok(())
}

#[tauri::command]
fn open_main_dashboard(app: AppHandle) -> Result<(), String> {
    show_main_window_inner(&app)
}

#[tauri::command]
fn toggle_hud_window(app: AppHandle) -> Result<bool, String> {
    toggle_hud_window_inner(&app)
}

#[tauri::command]
fn get_hud_visible(app: AppHandle) -> bool {
    app.get_webview_window("hud")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

#[tauri::command]
fn set_hud_visible(app: AppHandle, visible: bool) -> Result<bool, String> {
    set_hud_visible_inner(&app, visible)
}

#[tauri::command]
fn dock_hud_corner(app: AppHandle) -> Result<(), String> {
    dock_and_save_hud(&app)
}

#[tauri::command]
fn get_tauri_env(app: AppHandle) -> TauriEnvInfo {
    let backend_managed_by_tauri = app
        .try_state::<backend_manager::BackendGuard>()
        .map(|guard| guard.spawned_by_tauri())
        .unwrap_or(false);

    TauriEnvInfo {
        is_tauri: true,
        platform: std::env::consts::OS,
        app_version: env!("CARGO_PKG_VERSION"),
        autostart_launched: is_autostart_launch(),
        backend_url: backend_manager::BACKEND_BASE_URL,
        backend_managed_by_tauri,
        native_win_tracker: cfg!(windows),
    }
}

/// Pure-Rust 32×32 RGBA pixel-shield fallback icon so tray icon creation can never panic.
fn fallback_pixel_shield_icon() -> Image<'static> {
    const W: u32 = 32;
    const H: u32 = 32;
    let mut rgba = vec![0u8; (W * H * 4) as usize];
    for y in 0..H {
        for x in 0..W {
            let idx = ((y * W + x) * 4) as usize;
            let in_shield = (4..28).contains(&x) && (3..26).contains(&y);
            let is_border = in_shield && (x <= 5 || x >= 26 || y <= 4 || y >= 24);
            let is_gem = (13..19).contains(&x) && (9..20).contains(&y);
            if is_gem {
                rgba[idx..idx + 4].copy_from_slice(&[56, 189, 248, 255]);
            } else if is_border {
                rgba[idx..idx + 4].copy_from_slice(&[245, 158, 11, 255]);
            } else if in_shield {
                rgba[idx..idx + 4].copy_from_slice(&[18, 22, 36, 255]);
            }
        }
    }
    Image::new_owned(rgba, W, H)
}

fn load_tray_icon(app: &tauri::App) -> Image<'static> {
    if let Ok(img) = Image::from_bytes(include_bytes!("../icons/icon.png")) {
        return img.to_owned();
    }
    if let Some(default_icon) = app.default_window_icon() {
        return Image::new_owned(
            default_icon.rgba().to_vec(),
            default_icon.width(),
            default_icon.height(),
        );
    }
    startup_log::log("tray_warn: falling back to synthesized pixel shield icon");
    fallback_pixel_shield_icon()
}

fn build_system_tray_once(app: &tauri::App) -> tauri::Result<()> {
    let toggle_hud =
        MenuItemBuilder::with_id("toggle_hud", "Hiện / Ẩn Mini HUD (Ctrl+Shift+Space)").build(app)?;
    let toggle_hud_size =
        MenuItemBuilder::with_id("toggle_hud_size", "Chuyển chế độ Mini / Đầy đủ").build(app)?;
    let dock_hud =
        MenuItemBuilder::with_id("dock_hud", "Đưa Mini HUD về góc Taskbar").build(app)?;
    let open_dashboard =
        MenuItemBuilder::with_id("open_dashboard", "Mở Bảng điều khiển chính").build(app)?;
    let dnd_1h = MenuItemBuilder::with_id("dnd_1h", "Tạm im 1 giờ (DND)").build(app)?;
    let connect_mobile =
        MenuItemBuilder::with_id("connect_mobile", "Kết nối Điện thoại (QR)").build(app)?;
    let quit_all = MenuItemBuilder::with_id("quit", "Thoát hoàn toàn").build(app)?;

    let tray_menu = MenuBuilder::new(app)
        .item(&toggle_hud)
        .item(&toggle_hud_size)
        .item(&dock_hud)
        .item(&open_dashboard)
        .separator()
        .item(&dnd_1h)
        .item(&connect_mobile)
        .separator()
        .item(&quit_all)
        .build()?;

    let icon = load_tray_icon(app);

    TrayIconBuilder::with_id("rpg-life-tracker-tray")
        .icon(icon)
        .tooltip("RPG Life Tracker — Bấm chuột trái để Hiện/Ẩn Mini HUD")
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app_handle, event| match event.id().as_ref() {
            "open_dashboard" => {
                let _ = show_main_window_inner(app_handle);
            }
            "toggle_hud" => {
                let _ = toggle_hud_window_inner(app_handle);
            }
            "toggle_hud_size" => {
                let _ = set_hud_visible_inner(app_handle, true);
                let _ = app_handle.emit("tauri-hud-toggle-mode", true);
            }
            "dock_hud" => {
                let _ = dock_and_save_hud(app_handle);
            }
            "dnd_1h" => {
                trigger_dnd_async(app_handle.clone(), 60);
            }
            "connect_mobile" => {
                let _ = show_main_window_inner(app_handle);
                let _ = app_handle.emit("tauri-open-mobile-qr", true);
            }
            "quit" => {
                startup_log::log("tray: user selected quit");
                if let Some(saver) = app_handle.try_state::<hud_state::HudPositionSaver>() {
                    saver.stop();
                }
                if let Some(tracker) = app_handle.try_state::<win_tracker::WinTrackerHandle>() {
                    tracker.stop();
                }
                if let Some(backend) = app_handle.try_state::<backend_manager::BackendGuard>() {
                    backend.shutdown();
                }
                app_handle.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let _ = toggle_hud_window_inner(tray.app_handle());
            }
            TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } => {
                let _ = show_main_window_inner(tray.app_handle());
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn setup_system_tray(app: &tauri::App) -> tauri::Result<()> {
    match build_system_tray_once(app) {
        Ok(()) => Ok(()),
        Err(first_err) => {
            startup_log::log(&format!(
                "tray_warn: first attempt failed ({first_err}); retrying in 1200ms"
            ));
            std::thread::sleep(Duration::from_millis(1200));
            build_system_tray_once(app)
        }
    }
}

#[cfg(desktop)]
fn setup_global_shortcuts(app: &tauri::App) -> tauri::Result<()> {
    let toggle_hud_shortcut =
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
    let show_main_shortcut = Shortcut::new(
        Some(Modifiers::CONTROL | Modifiers::SHIFT | Modifiers::ALT),
        Code::KeyH,
    );

    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app_handle, shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if shortcut == &toggle_hud_shortcut {
                        let _ = toggle_hud_window_inner(app_handle);
                    } else if shortcut == &show_main_shortcut {
                        let _ = show_main_window_inner(app_handle);
                    }
                }
            })
            .build(),
    )?;

    if let Err(err) = app.global_shortcut().register(toggle_hud_shortcut) {
        startup_log::log(&format!(
            "shortcuts_warn: Could not register Ctrl+Shift+Space: {err}"
        ));
    }
    if let Err(err) = app.global_shortcut().register(show_main_shortcut) {
        startup_log::log(&format!(
            "shortcuts_warn: Could not register Ctrl+Shift+Alt+H: {err}"
        ));
    }

    Ok(())
}

fn schedule_hud_compositor_kick(app_handle: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(900));
        let handle = app_handle.clone();
        let _ = app_handle.run_on_main_thread(move || {
            if let Some(hud) = handle.get_webview_window("hud") {
                if hud.is_visible().unwrap_or(false) {
                    let _ = hud.set_background_color(Some(Color(0, 0, 0, 0)));
                    let _ = hud.set_always_on_top(true);
                    force_win32_topmost_refresh(&hud, false);
                }
            }
        });
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    startup_log::rotate_if_large();
    startup_log::install_panic_hook();

    let exe = std::env::current_exe()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    let cwd = std::env::current_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    let desktop = startup_log::current_desktop_name();
    let args: Vec<String> = std::env::args().collect();
    startup_log::log(&format!(
        "start: version={} desktop='{}' exe='{}' cwd='{}' args={:?}",
        env!("CARGO_PKG_VERSION"),
        desktop,
        exe,
        cwd,
        args
    ));

    // Win32 Named-Mutex Single-Instance Guard BEFORE Tauri/WebView2 initializes.
    // Prevents WebView2 HRESULT(0x800700AA) locks & duplicate instances; wakes existing HUD cleanly.
    let single_instance_guard = single_instance::acquire_or_wake_existing();

    let builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            resize_hud,
            open_main_dashboard,
            toggle_hud_window,
            get_hud_visible,
            set_hud_visible,
            dock_hud_corner,
            get_tauri_env
        ])
        .setup(move |app| {
            app.manage(single_instance_guard);

            // Optional autostart plugin: never abort startup if registry/plugin fails.
            match app.handle().plugin(tauri_plugin_autostart::init(
                MacosLauncher::LaunchAgent,
                Some(vec!["--autostart"]),
            )) {
                Ok(()) => startup_log::log("autostart_ok"),
                Err(err) => startup_log::log(&format!("autostart_warn: {err}")),
            }

            // 1. Ensure the local Express/SQLite backend is running and bound to a Win32 Job Object.
            let backend_guard = backend_manager::BackendGuard::ensure_started();
            let backend_ok = backend_guard.is_healthy_on_start();
            app.manage(backend_guard);

            // 2. Launch pure-Win32 5s activity tracker (automatically suspends Node PowerShell polling).
            let tracker_handle = win_tracker::start_win_tracker();
            app.manage(tracker_handle);
            startup_log::log(&format!("win_tracker_ok (backend_healthy={backend_ok})"));

            // 3. Configure native System Tray (never abort startup via `?`).
            match setup_system_tray(app) {
                Ok(()) => startup_log::log("tray_ok"),
                Err(err) => startup_log::log(&format!("tray_error: {err}")),
            }

            // 4. Configure global hotkeys (never abort startup via `?`).
            #[cfg(desktop)]
            match setup_global_shortcuts(app) {
                Ok(()) => startup_log::log("shortcuts_ok"),
                Err(err) => startup_log::log(&format!("shortcuts_error: {err}")),
            }

            // 5. Enforce true Windows WebView2 transparency and restore saved HUD position (or dock bottom-right).
            let show_hud_now = should_show_hud_on_start();
            if let Some(hud) = app.get_webview_window("hud") {
                let _ = hud.set_background_color(Some(Color(0, 0, 0, 0)));
                let _ = hud.set_size(Size::Logical(LogicalSize::new(
                    HUD_NORMAL_WIDTH,
                    HUD_NORMAL_HEIGHT,
                )));
                let saved_pos = hud_state::load_saved_position();
                if let Some(saved) = saved_pos.filter(|&p| {
                    hud_state::is_position_visible_on_monitors(
                        &hud,
                        p,
                        HUD_NORMAL_WIDTH,
                        HUD_NORMAL_HEIGHT,
                    )
                }) {
                    let _ = hud.set_position(Position::Physical(PhysicalPosition::new(
                        saved.x, saved.y,
                    )));
                    startup_log::log(&format!(
                        "hud_position: restored saved=({}, {})",
                        saved.x, saved.y
                    ));
                } else {
                    let docked = dock_hud_bottom_right(&hud, HUD_NORMAL_WIDTH, HUD_NORMAL_HEIGHT);
                    startup_log::log(&format!(
                        "hud_position: docked_default={docked:?} (saved={saved_pos:?})"
                    ));
                }

                if show_hud_now {
                    let _ = hud.unminimize();
                    let _ = hud.set_always_on_top(true);
                    let show_res = hud.show();
                    force_win32_topmost_refresh(&hud, true);
                    let _ = hud.set_focus();
                    let pos = hud.outer_position().ok();
                    let size = hud.outer_size().ok();
                    let vis = hud.is_visible().unwrap_or(false);
                    startup_log::log(&format!(
                        "hud_shown: show_res={show_res:?} visible={vis} pos={pos:?} size={size:?}"
                    ));
                    schedule_hud_compositor_kick(app.handle().clone());
                } else {
                    let _ = hud.hide();
                    startup_log::log("hud_hidden_by_setting: hudVisibleOnStart=false");
                }
            } else {
                startup_log::log("hud_error: webview window 'hud' not found");
            }

            // Register debounced HUD position saver AFTER initial positioning so creation moves never overwrite saved pos.
            app.manage(hud_state::HudPositionSaver::new());

            // 6. Start Web-to-Native HUD control bridge and sync visibility state.
            start_hud_bridge_listener(app.handle().clone());
            sync_hud_visible_to_backend_async(show_hud_now);

            // 7. Always show the Main Dashboard on manual launch (stay silent to Tray+HUD only on --autostart or --hud-only).
            if !is_autostart_launch() && !wants_hud_only_on_launch() {
                let _ = show_main_window_inner(app.handle());
                startup_log::log("dashboard_shown_on_start");
            }

            startup_log::log("setup_done");
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => match window.label() {
                "main" => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                "hud" => {
                    api.prevent_close();
                    let _ = window.hide();
                    let _ = window.app_handle().emit("tauri-hud-visibility", false);
                    sync_hud_visible_to_backend_async(false);
                }
                _ => {}
            },
            WindowEvent::Moved(pos) => {
                if window.label() == "hud" {
                    let visible = window.is_visible().unwrap_or(false);
                    let minimized = window.is_minimized().unwrap_or(false);
                    if visible && !minimized && pos.x > -10_000 && pos.y > -10_000 {
                        if let Some(saver) =
                            window.app_handle().try_state::<hud_state::HudPositionSaver>()
                        {
                            saver.schedule_save(hud_state::HudPosition { x: pos.x, y: pos.y });
                        }
                    }
                }
            }
            _ => {}
        });

    let app = match builder.build(tauri::generate_context!()) {
        Ok(app) => app,
        Err(err) => {
            startup_log::log(&format!(
                "FATAL: error while building RPG Life Tracker Tauri application: {err}"
            ));
            return;
        }
    };

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            startup_log::log("app_exit");
            if let Some(saver) = app_handle.try_state::<hud_state::HudPositionSaver>() {
                saver.stop();
            }
            if let Some(tracker) = app_handle.try_state::<win_tracker::WinTrackerHandle>() {
                tracker.stop();
            }
            if let Some(backend) = app_handle.try_state::<backend_manager::BackendGuard>() {
                backend.shutdown();
            }
        }
    });
}
