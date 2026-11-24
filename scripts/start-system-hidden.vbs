Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
daemonScript = fso.BuildPath(scriptDir, "run-daemon.ps1")
trayScript = fso.BuildPath(scriptDir, "tray-companion.ps1")

daemonCmd = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & daemonScript & """"
WshShell.Run daemonCmd, 0, False

WScript.Sleep 1800

trayCmd = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File """ & trayScript & """"
WshShell.Run trayCmd, 0, False
