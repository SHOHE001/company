# Gemini Company Dispatcher Helper
param (
    [string]$Action,      # "expand" or "sync"
    [string]$DeptName,
    [string]$RolePrompt,
    [string]$ContextJson
)

$companyRoot = ".company"

if ($Action -eq "expand") {
    $targetDir = "$companyRoot/$DeptName"
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir | Out-Null
        Set-Content -Path "$targetDir/GEMINI.md" -Value "# $DeptName`n`n$RolePrompt"
        Write-Host "[Autonomous Expansion] New department '$DeptName' created." -ForegroundColor Green
    }
}

if ($Action -eq "sync") {
    $stateFile = "$companyRoot/state/context.json"
    if (-not (Test-Path "$companyRoot/state")) {
        New-Item -ItemType Directory -Path "$companyRoot/state" | Out-Null
    }
    Set-Content -Path $stateFile -Value $ContextJson
    Write-Host "[State Sync] Context updated." -ForegroundColor Cyan
}
