# arrange-windows.ps1 - Tile all Roblox windows across the screen in strict 2x2 grid
# Called by EternityBlox via execFile or native fallback
param(
  [string]$Mode = "grid"
)

Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class WinPos {
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  }
"@

$procs = Get-Process -Name "RobloxPlayerBeta" -ErrorAction SilentlyContinue |
         Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero }

$count = $procs.Count
if ($count -eq 0) {
  Write-Output 0
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$screenW = $screen.Width
$screenH = $screen.Height
$startX = $screen.X
$startY = $screen.Y

# Strictly 2x2 layout tile in smallest windowed mode
$tileW = [int]($screenW / 2)
$tileH = [int]($screenH / 2)

for ($i = 0; $i -lt $count; $i++) {
  $slot = $i % 4
  $col = $slot % 2
  $row = [Math]::Floor($slot / 2)
  $x = $startX + ($col * $tileW)
  $y = $startY + ($row * $tileH)
  [WinPos]::ShowWindow($procs[$i].MainWindowHandle, 9) | Out-Null # SW_RESTORE (windowed mode)
  [WinPos]::MoveWindow($procs[$i].MainWindowHandle, $x, $y, $tileW, $tileH, $true) | Out-Null
  [WinPos]::SetWindowPos($procs[$i].MainWindowHandle, [IntPtr]::Zero, $x, $y, $tileW, $tileH, 0x0014) | Out-Null
}

Write-Output $count
