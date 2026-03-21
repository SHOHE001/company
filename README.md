# Gemini Company - Autonomous Agent Organization (v3.0)

Gemini CLI 上で、秘書室（Secretary）を窓口とした組織的なエージェント運用を可能にする、**究極の自律型組織エンジン**です。

## 🚀 コンセプト: Autonomous Orchestration
単一のエージェントではなく、専門性を持った複数の「部署（Department）」が、**Orchestrator（司令塔）**によって制御され、共有の**Knowledge Base（組織記憶）**を蓄積しながら目標を達成します。

## 🏢 組織構造
各部署は独立したディレクトリを持ち、専用の `GEMINI.md`（役割定義書）に従って動作します。

- **秘書室 (Secretary) [v3.0]**: メイン・コントローラー。`orchestrate.ps1` を駆使し、戦略立案と自己反省（Reflection）を担当。
- **開発部 (Engineering)**: システム設計、実装、バグ修正を担当。
- **PM部 (Project Management)**: 全体のロードマップ管理、タスクの優先順位付け、滞留タスクの再定義を担当。
- **リサーチ部 (Research)**: 技術選定、実現可能性の調査、プロトタイプ検証を担当。
- **マーケティング部 (Marketing)**: ユーザー体験(UX)の評価、ドキュメントの平易化、新機能の提案を担当。

## ⚙️ 自律エンジン v3.0 (The Autonomous Brain)
システムは以下のスクリプトとデータ構造によって「思考」し、「記憶」します。

### 1. Orchestrator (`.company/bin/orchestrate.ps1`) [New]
組織の「脳」です。`inbox` の依頼を読み、現在の組織状態と照らし合わせ、以下の情報を生成します。
- **Hop Count**: 部署間の移動回数を追跡し、無限ループを防止（最大5回）。
- **Dispatch Order**: 担当部署、具体的な目標、必要な文脈を定義した実行指示書。

### 2. Dispatcher (`.company/bin/dispatch.ps1`) [v3.0]
組織の「神経系」です。
- **State Sync**: `context.json` と `session.json` を一括更新。
- **Archive**: 完了したセッションを履歴として保存し、組織の記憶をクリーンに維持。

### 3. State Management (`.company/state/`)
- **context.json**: **Knowledge Base** セクションを新設。組織全体で共有すべき「重要な事実」を永続化。
- **session.json**: 現在進行中のタスク、訪問済み部署の履歴（History）、移動回数（Hop Count）を記録。

## 🛠 ワークフロー v3.0
1.  **指示**: ユーザーが `.company/secretary/inbox/` に依頼を投入。
2.  **戦略立案**: 秘書室が `orchestrate.ps1` を実行し、最適な戦略（Dispatch Order）を策定。
3.  **連鎖実行**: 担当部署が `session.json` を引き継ぎ、作業を完遂。必要に応じて他部署へバトンタッチ。
4.  **反省と記録**: 完了後、秘書室が「自己反省」を行い、得られた知見を **Knowledge Base** に蓄積。
5.  **アーカイブ**: 一連のタスク終了後、セッションをアーカイブし、次のミッションへ備える。

---
*Created and maintained by Gemini CLI - The Ultimate Autonomous Agent Engine.*
