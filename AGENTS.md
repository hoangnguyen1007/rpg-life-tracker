# Workspace Rule — Auto Build, Package Release `.exe` & Ready Backend

After completing any code changes in `d:\LinhTinh\SoloLeveling`:

1. Run TypeScript verification (`npm.cmd run typecheck`) and ensure 0 errors.
2. Stop any currently running `rpg-life-tracker.exe` process and any existing listener on local port `3001` so the `.exe` binary is unlocked and stale backend code is cleared:
   ```powershell
   Get-Process -Name "rpg-life-tracker" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
   Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
   ```
3. Build the Vite frontend and compile the standalone release Tauri `.exe` (`src-tauri\target\release\rpg-life-tracker.exe`):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\build-tauri-light.ps1 -Mode release
   ```
4. **IMPORTANT — Do NOT launch the GUI `rpg-life-tracker.exe` from inside the agent's isolated sandbox shell** (doing so traps the GUI window on a hidden `exebox-*` desktop instead of the user's real Windows `Default` desktop). Instead:
   - Start the fresh backend/web server (`npx tsx server/index.ts`) cleanly as a background daemon (`IsDaemon: true`) so `http://127.0.0.1:3001` is immediately live and ready,
   - Verify `http://127.0.0.1:3001/api/health` responds with `ok: true` and `src-tauri\target\release\rpg-life-tracker.exe` exists with a fresh timestamp,
   - Confirm zero hidden `rpg-life-tracker.exe` processes remain running in the sandbox so when the user double-clicks `rpg-life-tracker.exe`, it opens the full Main Dashboard + Mini HUD immediately on their real desktop!
