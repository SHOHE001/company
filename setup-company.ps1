# Gemini Company Setup Script
$ErrorActionPreference = "Stop"

Write-Host "--- Gemini Company Setup ---" -ForegroundColor Cyan
$goal = Read-Host "1. あなたの事業・活動の主な目標は何ですか？"
$today = Get-Date -Format "yyyy-MM-DD"

# Create Directories
$dirs = @(".company", ".company/secretary", ".company/secretary/inbox", ".company/secretary/todos", ".company/secretary/notes", ".company/engineering")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
}

Write-Host "--- 組織構成を構築中... ---"

# Setup logic (Simplified for setup script)
# Actual Gemini instructions are managed via GEMINI.md files created earlier.

Write-Host "`n[Success] Gemini Company の骨組みが完成しました。" -ForegroundColor Green
Write-Host "1. cd .company/secretary に移動してください。"
Write-Host "2. 'gemini' コマンドで秘書を呼び出し、'$goal' について指示してください。"
