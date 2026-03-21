# TODO: Google Calendar Integration Prototype (Engineering)

## 概要
リサーチ部（Research）が完了した「Google Calendar CLI Integration 技術調査報告」に基づき、Python によるプロトタイプ実装を行う。

## 要件
- [ ] Python 環境のセットアップ (google-api-python-client, google-auth-oauthlib)
- [ ] `.company/secret/` ディレクトリの作成と `.gitignore` への追加
- [ ] `get_calendar.py` の実装 (OAuth 2.0 Loopback Flow)
- [ ] 認証情報の取得と `token.json` の永続化
- [ ] 今日の予定を JSON 形式で出力する機能の検証

## 参考資料
- `.company/research/reports/2026-03-21-Calendar-Integration.md`

## 担当
- 開発部 (Engineering)
