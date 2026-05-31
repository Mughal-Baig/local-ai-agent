$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Port = if ($env:PORT) { $env:PORT } else { "4173" }
$Url = "http://127.0.0.1:$Port/"
$LogDir = Join-Path $env:LOCALAPPDATA "AgentTrail\Logs"
$PidFile = Join-Path $LogDir "agenttrail.pid"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Start-AgentTrail {
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "$Url/api/status" -TimeoutSec 1 | Out-Null
    return
  } catch {}
  $env:PORT = $Port
  $env:AGENTTRAIL_DESKTOP = "1"
  $env:AGENTTRAIL_APP_MODE = "tray"
  $env:AGENTTRAIL_DESKTOP_NOTIFICATIONS = "on"
  $env:AGENTTRAIL_UPDATE_CHANNEL = "stable"
  $outLog = Join-Path $LogDir "agenttrail.out.log"
  $errLog = Join-Path $LogDir "agenttrail.err.log"
  $process = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $Root -PassThru -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  Set-Content -Path $PidFile -Value $process.Id
}

function Stop-AgentTrail {
  if (Test-Path $PidFile) {
    $pidValue = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($pidValue) {
      Stop-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Start-AgentTrail
Start-Process $Url

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Application
$notify.Text = "AgentTrail"
$notify.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$open = $menu.Items.Add("Open AgentTrail")
$restart = $menu.Items.Add("Restart server")
$logs = $menu.Items.Add("Show logs")
$quit = $menu.Items.Add("Quit")

$open.Add_Click({ Start-Process $Url })
$restart.Add_Click({ Stop-AgentTrail; Start-AgentTrail; $notify.ShowBalloonTip(3000, "AgentTrail", "Server restarted.", [System.Windows.Forms.ToolTipIcon]::Info) })
$logs.Add_Click({ Start-Process $LogDir })
$quit.Add_Click({ Stop-AgentTrail; $notify.Visible = $false; [System.Windows.Forms.Application]::Exit() })

$notify.ContextMenuStrip = $menu
$notify.ShowBalloonTip(3000, "AgentTrail", "Desktop server is running.", [System.Windows.Forms.ToolTipIcon]::Info)
[System.Windows.Forms.Application]::Run()
