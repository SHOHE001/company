# Gemini Company 組織設計図 (Architecture)

## システム概要
Gemini CLI を基盤とした自律型組織エンジン v3.1 (Solo CEO Model)

## 技術スタック
- Runtime: PowerShell 7 / Gemini CLI / Python 3.10+
- State Management: JSON (context.json, session.json)
- Documentation: Markdown (README.md, architecture.md, devlogs)
- External Integration: Google Calendar API (OAuth 2.0 Loopback Flow)

## フォルダ構成
- `.company/bin/`: 実行可能なスクリプト群（PowerShell, Python）
  - `sync_calendar.py`: Google カレンダー同期スクリプト
- `.company/secret/`: 機密情報（Git 非公開）
  - `credentials.json`, `token.json`
- `.company/state/`: 組織の状態管理
- `.company/[department]/`: 各部署の作業領域

## 部署構成
- Secretary: 司令塔・ルーティング
- Engineering: 実装・バグ修正
- PM: 進捗・スコープ管理
- Research: 技術調査・プロトタイプ
- Marketing: UX・広報

## 運用ポリシー (Operation Policy)
1. **User-Centric Design**: すべての自律的動作は、ユーザーが `.company/secretary/inbox/` に投入した依頼を起点とする。
2. **Context Persistence**: セッションをまたぐ重要な知見は `context.json` (Knowledge Base) に永続化され、組織全体の知能向上に寄与する。
3. **Transparency**: 各部署の意思決定プロセスは `devlog` および `session.json` を通じて完全に追跡可能である。

