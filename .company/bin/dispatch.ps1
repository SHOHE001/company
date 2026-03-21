# Gemini Company Dispatcher Helper v2.1
param (
    [string]Action,      # "expand", "sync", or "inbox"
    [string]DeptName,
    [string]RolePrompt,
    [string]ContextJson,
    [string]SessionJson
)

companyRoot = ".company"

if (Action -eq "expand") {
    	argetDir = "$companyRoot/$DeptName"
    if (-not (Test-Path 	argetDir)) {
        New-Item -ItemType Directory -Path 	argetDir | Out-Null
        Set-Content -Path "$targetDir/GEMINI.md" -Value "# $DeptName

$RolePrompt" -Encoding UTF8
        Write-Host "[Autonomous Expansion] New department '$DeptName' created." -ForegroundColor Green
    }
}

if (Action -eq "sync") {
    stateDir = "$companyRoot/state"
    if (-not (Test-Path stateDir)) { New-Item -ItemType Directory -Path stateDir | Out-Null }
    if (ContextJson) { Set-Content -Path "$stateDir/context.json" -Value ContextJson -Encoding UTF8 }
    if (SessionJson) { Set-Content -Path "$stateDir/session.json" -Value SessionJson -Encoding UTF8 }
    Write-Host "[State Sync] Context and Session updated." -ForegroundColor Cyan
}

