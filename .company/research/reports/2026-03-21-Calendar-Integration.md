# Google Calendar CLI Integration 技術調査報告 (2026-03-21)

Gemini CLI から Google Calendar を読み取り、秘書室（Secretary）が予定を把握できるようにするための技術調査結果を報告します。

## 1. 認証方法: OAuth 2.0 Loopback Flow (ローカルループバック)
CLI 環境において、最も安全かつユーザー負担の少ない手法として **Loopback Flow** を推奨します。

- **仕組み**:
  - スクリプト実行時にローカルサーバー（http://localhost:port）を一時的に起動し、ブラウザで認証画面を開く。
  - 認証完了後、Google からローカルサーバーに認可コードが送信され、自動的にトークンを取得する。
- **管理するファイル**:
  - `credentials.json`: Google Cloud Console で作成した「デスクトップ アプリ」用の認証情報。
  - `token.json`: 取得したアクセストークンと **リフレッシュトークン**。一度認証すれば、有効期限が切れてもリフレッシュトークンを使用してバックグラウンドで更新可能。

## 2. 実装言語: Python (推奨)
既存の環境は PowerShell 中心ですが、Google Calendar API との連携には **Python** が最適です。

- **選定理由**:
  - **ライブラリの成熟度**: `google-api-python-client` および `google-auth-oauthlib` が、複雑な OAuth フローやトークンのリフレッシュ処理を十数行のコードで完結させることができます。
  - **メンテナンス性**: PowerShell で純粋に実装する場合、HTTP リスナーの管理や raw な JSON 処理が必要になり、コードが肥大化・複雑化します。
  - **GAS (clasp)**: クラウド側での処理には向いていますが、ローカル CLI からの呼び出しに Node.js (clasp) が必要になり、依存関係が重くなります。
- **必要ライブラリ**:
  - `google-api-python-client`
  - `google-auth-httplib2`
  - `google-auth-oauthlib`

## 3. セキュリティ: `.company/secret/` での管理
機密情報を安全に扱うため、組織構造内に専用の秘密ディレクトリを設けます。

- **配置場所**: `.company/secret/`
- **管理ポリシー**:
  - `.gitignore` に `.company/secret/` を追加し、絶対に Git にコミットしない。
  - `credentials.json` および `token.json` をこのディレクトリに集約する。
- **環境変数**: API キーなどの単一の値は、ローカルの `env.ps1`（非コミット推奨）などで環境変数として読み込む運用も検討。

## 4. アウトプット形式: 構造化 JSON
秘書室が `orchestrate.ps1` 経由で理解しやすいよう、以下の形式での出力を想定します。

```json
{
  "status": "success",
  "query_at": "2026-03-21T19:00:00Z",
  "events": [
    {
      "summary": "AI Team Weekly Meeting",
      "start": "2026-03-22T10:00:00+09:00",
      "end": "2026-03-22T11:00:00+09:00",
      "location": "Virtual",
      "description": "Discussing roadmap"
    }
  ]
}
```

## 5. 実現のためのステップバイステップ設計図

### Step 1: Google Cloud プロジェクトの準備
1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成。
2. 「Google Calendar API」を有効化。
3. 「OAuth 同意画面」を設定（外部、テストユーザーに自身のメールアドレスを追加）。
4. 「認証情報」から「OAuth 2.0 クライアント ID」を作成。タイプは **「デスクトップ アプリ」** を選択。
5. 作成したクライアント ID を JSON としてダウンロードし、`.company/secret/credentials.json` に保存。

### Step 2: 環境構築
```powershell
# Pythonライブラリのインストール
pip install --upgrade google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

### Step 3: 認証・取得スクリプトの実装 (`.company/bin/get_calendar.py`)
- `token.json` が存在しない場合はブラウザを起動して認証。
- 存在する場合は保存されたトークンを使用。期限切れならリフレッシュ。
- 今日の予定を JSON 形式で標準出力に書き出す。

### Step 4: 秘書室への統合 (`.company/bin/harvest-calendar.ps1`)
1. `get_calendar.py` を実行して JSON を取得。
2. 取得した内容を Markdown 形式に整形し、`.company/secretary/inbox/calendar_20260321.md` として保存。
3. `orchestrate.ps1` を実行することで、秘書室がカレンダーの予定をタスクとして認識・処理する。

## 必要な依存関係リスト
- **Runtime**: Python 3.10+
- **Libraries**:
  - `google-api-python-client`
  - `google-auth-httplib2`
  - `google-auth-oauthlib`
- **CLI Tool**: `pip` (Python package manager)
