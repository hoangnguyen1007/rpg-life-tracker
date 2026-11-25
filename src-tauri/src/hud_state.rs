use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::WebviewWindow;

use crate::startup_log;

const DEBOUNCE_DELAY: Duration = Duration::from_millis(450);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct HudPosition {
    pub x: i32,
    pub y: i32,
}

pub fn position_file_path() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    base.join("RPG Life Tracker").join("hud-position.json")
}

pub fn load_saved_position() -> Option<HudPosition> {
    let path = position_file_path();
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str::<HudPosition>(&content).ok()
}

pub fn save_position_now(pos: HudPosition) {
    let path = position_file_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let Ok(payload) = serde_json::to_string_pretty(&pos) else {
        return;
    };
    let tmp_path = path.with_extension("json.tmp");
    if fs::write(&tmp_path, &payload).is_ok() {
        if fs::rename(&tmp_path, &path).is_err() {
            let _ = fs::write(&path, &payload);
            let _ = fs::remove_file(&tmp_path);
        }
    } else if let Err(err) = fs::write(&path, &payload) {
        startup_log::log(&format!("hud_state_warn: failed writing {}: {err}", path.display()));
    }
}

/// Validates that the full HUD rectangle at physical `pos` with logical `(logical_w, logical_h)`
/// fits cleanly inside at least one currently connected monitor's `work_area()`.
pub fn is_position_visible_on_monitors(
    window: &WebviewWindow,
    pos: HudPosition,
    logical_w: f64,
    logical_h: f64,
) -> bool {
    if pos.x <= -10_000 || pos.y <= -10_000 {
        return false;
    }

    let mut monitors = window.available_monitors().unwrap_or_default();
    if monitors.is_empty() {
        if let Ok(Some(primary)) = window.primary_monitor() {
            monitors.push(primary);
        }
    }

    for monitor in monitors {
        let scale = monitor.scale_factor();
        let wa = monitor.work_area();
        let hud_w = (logical_w * scale).round() as i32;
        let hud_h = (logical_h * scale).round() as i32;

        let wa_left = wa.position.x;
        let wa_top = wa.position.y;
        let wa_right = wa_left + (wa.size.width as i32);
        let wa_bottom = wa_top + (wa.size.height as i32);

        let hud_right = pos.x.saturating_add(hud_w);
        let hud_bottom = pos.y.saturating_add(hud_h);

        if pos.x >= wa_left && pos.y >= wa_top && hud_right <= wa_right && hud_bottom <= wa_bottom
        {
            return true;
        }
    }

    false
}

struct DebounceState {
    pending: Option<(HudPosition, Instant)>,
    suppress_until: Option<Instant>,
    stopped: bool,
}

/// Event-driven debounced writer for HUD window drags.
/// Sleeps on a Condvar with zero CPU overhead while idle and writes at most once
/// per drag gesture (~450ms after the last `WindowEvent::Moved`).
pub struct HudPositionSaver {
    inner: Arc<(Mutex<DebounceState>, Condvar)>,
    _worker: Option<JoinHandle<()>>,
}

impl HudPositionSaver {
    pub fn new() -> Self {
        let inner = Arc::new((
            Mutex::new(DebounceState {
                pending: None,
                suppress_until: None,
                stopped: false,
            }),
            Condvar::new(),
        ));

        let worker_inner = Arc::clone(&inner);
        let worker = thread::Builder::new()
            .name("rpg-hud-pos-saver".to_string())
            .spawn(move || run_debounce_loop(worker_inner))
            .ok();

        Self {
            inner,
            _worker: worker,
        }
    }

    pub fn schedule_save(&self, pos: HudPosition) {
        let (lock, cvar) = &*self.inner;
        if let Ok(mut state) = lock.lock() {
            if state.stopped {
                return;
            }
            if let Some(until) = state.suppress_until {
                if Instant::now() < until {
                    return;
                }
                state.suppress_until = None;
            }
            state.pending = Some((pos, Instant::now() + DEBOUNCE_DELAY));
            cvar.notify_one();
        }
    }

    pub fn suppress_briefly(&self, duration: Duration) {
        let (lock, _) = &*self.inner;
        if let Ok(mut state) = lock.lock() {
            state.suppress_until = Some(Instant::now() + duration);
        }
    }

    pub fn save_immediately(&self, pos: HudPosition) {
        let (lock, _) = &*self.inner;
        if let Ok(mut state) = lock.lock() {
            state.pending = None;
            state.suppress_until = Some(Instant::now() + Duration::from_millis(300));
        }
        save_position_now(pos);
    }

    pub fn stop(&self) {
        let (lock, cvar) = &*self.inner;
        let flush_pos = if let Ok(mut state) = lock.lock() {
            state.stopped = true;
            let pos = state.pending.take().map(|(p, _)| p);
            cvar.notify_one();
            pos
        } else {
            None
        };
        if let Some(pos) = flush_pos {
            save_position_now(pos);
        }
    }
}

impl Drop for HudPositionSaver {
    fn drop(&mut self) {
        self.stop();
    }
}

fn run_debounce_loop(inner: Arc<(Mutex<DebounceState>, Condvar)>) {
    let (lock, cvar) = &*inner;
    let Ok(mut state) = lock.lock() else {
        return;
    };

    loop {
        if state.stopped {
            return;
        }
        match state.pending {
            None => {
                state = match cvar.wait(state) {
                    Ok(guard) => guard,
                    Err(_) => return,
                };
            }
            Some((pos, deadline)) => {
                let now = Instant::now();
                if now >= deadline {
                    state.pending = None;
                    drop(state);
                    save_position_now(pos);
                    state = match lock.lock() {
                        Ok(guard) => guard,
                        Err(_) => return,
                    };
                } else {
                    let wait_for = deadline.saturating_duration_since(now);
                    state = match cvar.wait_timeout(state, wait_for) {
                        Ok((guard, _)) => guard,
                        Err(_) => return,
                    };
                }
            }
        }
    }
}
