@echo off
setlocal
cd /d "%~dp0"

:: タイトルと最小限の開始表示
title Gemini Company
echo Starting Gemini Company...

:: 各スクリプトを静かに実行（出力はログへ）
powershell -NoProfile -ExecutionPolicy Bypass -File ".company\bin\harvest.ps1" > .company\logs\boot.log 2>&1
python .company\bin\sync_calendar.py >> .company\logs\boot.log 2>&1
python .company\bin\sync_journal_drive.py >> .company\logs\boot.log 2>&1
python .company\bin\analyze_journal.py >> .company\logs\boot.log 2>&1

:: 秘書室の起動（超簡潔なモード）
gemini -y -i "Act as the Secretary. Briefly acknowledge the status and wait for input. Keep your response under 2 lines."
