# Gemini Company Dispatcher v3.0
param (
    [string]Action,      # "sync", "expand", "archive"
    [string]DeptName,
    [string]ContextJson,
    [string]SessionJson,
    [switch]AutoSummary
)

stateDir = ".company/state"
if (-not (Test-Path stateDir)) { New-Item -ItemType Directory -Path stateDir | Out-Null }

if (Action -eq "sync") {
    if (ContextJson) { Set-Content -Path "$stateDir/context.json" -Value ContextJson -Encoding UTF8 }
    if (SessionJson) { Set-Content -Path "$stateDir/session.json" -Value SessionJson -Encoding UTF8 }
    Write-Host "[State Sync v3] Persistent state updated." -ForegroundColor Cyan
}

if (Action -eq "archive") {
    # Archive current session to history
    historyDir = "$stateDir/history"
    if (-not (Test-Path historyDir)) { New-Item -ItemType Directory -Path historyDir | Out-Null }
    	imestamp = Get-Date -Format "yyyyMMddHHmmss"
    Copy-Item -Path "$stateDir/session.json" -Destination "$historyDir/session_$timestamp.json"
    Write-Host "[State Archive] Session archived." -ForegroundColor Gray
}

