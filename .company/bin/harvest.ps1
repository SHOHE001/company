param (
    [string]$MemoPath = "MEMO.md",
    [string]$StateFile = ".company/state/context.json"
)

if (-not (Test-Path $MemoPath)) { return }

$content = Get-Content -Path $MemoPath -Raw
if ([string]::IsNullOrWhiteSpace($content) -or $content.Trim().StartsWith("# 📥") -and $content.Trim().Length -lt 50) {
    Write-Host "No new info to harvest in MEMO.md." -ForegroundColor Gray
    return
}

Write-Host "--- Obsidianからの知識吸収を開始 ---" -ForegroundColor Green
Write-Host "AIチームがメモの内容を吸収しています..." -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$taskFile = ".company/secretary/inbox/harvest_$timestamp.md"
Set-Content -Path $taskFile -Value "以下のメモ内容（Obsidian経由）を解析し、知識ベースに蓄積してください。`n`n内容:`n$content" -Encoding UTF8

# アーカイブ処理
$archiveDir = "Archive/Memos"
if (-not (Test-Path $archiveDir)) { New-Item -ItemType Directory -Path $archiveDir | Out-Null }
Move-Item -Path $MemoPath -Destination "$archiveDir/memo_$timestamp.md"
Set-Content -Path $MemoPath -Value "# 📥 AIへのインプット`n# ここに書いた内容は、次回起動時にAIが吸収し、アーカイブへ移動します。`n" -Encoding UTF8
