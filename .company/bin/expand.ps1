# expand.ps1 - 自律型部署生成エンジン
param (
    [string]$DeptName,
    [string]$RolePrompt
)

$targetDir = ".company/$DeptName"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
    $geminiMd = "# $DeptName 役割定義`n`n$RolePrompt"
    Set-Content -Path "$targetDir/GEMINI.md" -Value $geminiMd
    Write-Host "[Autonomous Expansion] $DeptName 部署を設立しました。" -ForegroundColor Cyan
}
