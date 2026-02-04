$WshShell = New-Object -ComObject WScript.Shell
$StartupPath = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupPath "ActivationSuite.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $PSScriptRoot "dist\ActivationSuite.exe"
$Shortcut.WorkingDirectory = Join-Path $PSScriptRoot "dist"
$Shortcut.Save()
Write-Host "Startup shortcut created at: $ShortcutPath"
