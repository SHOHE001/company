#!/bin/bash
# Gemini Company Mobile Entry Script (gc)
# Path: .company/bin/mobile_entry.sh

echo "--------------------------------------------------"
echo "🛎️  Welcome to Gemini Company (Mobile Access)"
echo "--------------------------------------------------"

# 1. 組織ステータスの簡易表示
echo "📊 Current Status:"
grep "- \*\*現在のフェーズ\*\*" Dashboard.md | sed 's/- \*\*\([^*]*\)\*\*: \(.*\)/\1: \2/'
echo ""

# 2. 直近の TODO 表示
echo "📋 Pending Tasks:"
ls .company/secretary/todos/*.md 2>/dev/null | xargs -n 1 basename | sed 's/\.md//' | head -n 5
echo ""

# 3. カンパニーの起動
echo "🚀 Launching Secretary for autonomous cycle..."
# Windows のバッチファイル相当の処理を順次実行
python3 .company/bin/sync_calendar.py || echo "⚠️ Calendar sync skipped."
python3 .company/bin/sync_journal_drive.py || echo "⚠️ Journal sync skipped."
python3 .company/bin/analyze_journal.py || echo "⚠️ Journal analysis skipped."

# メインの Gemini CLI 起動
gemini -y -i "Act as the Secretary (.company/secretary/GEMINI.md), check inbox, run orchestrate.ps1, and start autonomous operations."
