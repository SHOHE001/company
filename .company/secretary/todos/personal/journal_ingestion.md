# 📖 TODO: 手書き日記の自動解析システム

## 概要
- iPhone から SMB (Tailscale) 経由で `inbox/scans/` に届く日記画像を自動解析する。
- 手書き文字をテキスト化し、ユーザー様の思考（Mental Model）を更新する。

## 実装・運用フロー
1. [ ] **物理共有設定**: PC 上の `inbox/scans` フォルダを SMB 共有する。
2. [ ] **iPhone ショートカット**: 写真撮影 -> SMB 保存のショートカットを構築する。
3. [ ] **OCR プロトコル**: 秘書室が画像ファイルを検知した際、Gemini API (Multimodal) で解析を実行する。

## ステータス
- [x] 受け取り用フォルダ作成済み
- [ ] 初回画像投入のテスト

---
*Added by Secretary: Streamlining personal thought ingestion.*
