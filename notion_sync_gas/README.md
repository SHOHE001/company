# Notion Task Carry-over (GAS)

前日の未完了タスクを当日に自動で引き継ぐ Google Apps Script です。

## セットアップ手順

1.  **プロジェクト作成**:
    ```bash
    cd notion_sync_gas
    clasp create --type standalone --title "Notion Carryover Sync"
    ```
2.  **秘密情報の設定**:
    GASのエディタ（Web画面）を開き、「設定」 > 「スクリプトプロパティ」に以下を追加してください。
    *   `NOTION_TOKEN`: 内部インテグレーション・トークン
    *   `TASK_DB_ID`: タスク管理データベースのID
3.  **デプロイ**:
    ```bash
    clasp push
    ```
4.  **トリガー設定**:
    GASのエディタで「トリガー」 > 「トリガーを追加」を選択。
    *   実行する関数: `runDailyCarryOver`
    *   イベントのソース: 時間主導型
    *   タイプ: 日付ベースのタイマー
    *   時刻: 午前 4時〜5時

## 仕様
*   ステータスが「完了」以外のタスクをコピーします。
*   元のステータス（未着手、進行中など）を維持します。
*   二重実行しても、同じ名前のタスクが今日分に存在すればスキップします。
