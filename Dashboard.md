# 🏢 Gemini Company Dashboard

## 📊 組織の現状
- **ミッション**: Full implementation and start of autonomous operation of Gemini Company
- **現在のフェーズ**: Autonomous Operation (v3.0)
- **稼働中の部署**: 
  - [[.company/secretary/GEMINI|🛎️ 秘書室]]
  - [[.company/engineering/GEMINI|🛠️ 開発部]]
  - [[.company/pm/GEMINI|🗺️ PM部]]
  - [[.company/marketing/GEMINI|📣 マーケティング部]]
  - [[.company/research/GEMINI|🔍 リサーチ部]]

## 📂 クイックアクセス
- 📝 [[MEMO|新規インプット (MEMO.md)]]
- 🏗️ [[architecture|組織設計図 (architecture.md)]]
- 📜 [[README|マニュアル (README.md)]]
- 📅 [[.company/pm/logs/2026-03-21-devlog|最新の作業ログ (PM)]]

## 🧠 組織記憶 (Knowledge Base)

| 日付 | ソース | 事実 | ステータス |
| :--- | :--- | :--- | :--- |
| 2026-03-21 | Engineering | Google Calendar API 連携プロトタイプ (`sync_calendar.py`) を実装。直近7日間の予定をJSON形式で取得可能。 | 実装済み（認証待機） |
| 2026-03-21 | Engineering | LINE ボットに「日記取り込み機能」を追加。日記用グループからの画像を `Gemini_Journal_Scans` フォルダへ自動集約。 | 実装済み |
| 2026-03-21 | MEMO.md | ユーザーは組織の有効活用法について、具体的にどのように機能するか理解が及んでいないと感じている。 | 解決済み（Marketing/PM 対応中） |

## 📅 ロードマップ (Milestones)

- **v3.1: UX Enhancement & Feedback Loop** (2026-04-10)
  - *Status: In Progress*
  - Refining user interaction protocols and interaction guides.
- **v3.2: Interactive Task Submission CLI** (2026-05-20)
  - *Status: Planned*
  - Develop a CLI tool for easier task submission to the secretary's inbox.
- **v4.0: External Ecosystem Integration** (2026-12-31)
  - *Status: Planned*
  - Connecting with external tools like GitHub Actions or Slack for real-time collaboration.

---
*Last Update: 2026-03-21*
