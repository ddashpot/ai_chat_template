# TODO

## 完了
- [x] スキーマ / 暗号化(非抽出鍵) / IndexedDB 保存
- [x] 設定画面（接続先・モデルの CRUD、保存先切替、バックアップ）
- [x] チャット UI（履歴サイドバー、ストリーミング、Markdown、画像添付、カメラ）
- [x] タイトル付きシステムプロンプト
- [x] アーティファクト自動抽出・一覧・削除
- [x] Google ドライブ(appDataFolder)アダプタ
- [x] ガードレールのフック枠（no-op）
- [x] README / PLAN / TODO / FAIL_LOG

## 未了 / 次の作業
- [ ] Google ドライブ連携の実地テスト（OAuth クライアント ID + localhost 配信）
- [ ] パスフレーズモードの UI 導線（現状は app.config.js 切替 + prompt）
- [ ] アーティファクトの HTML プレビュー（iframe sandbox）
- [ ] Markdown: テーブル / 引用 / 番号付きリスト対応
- [ ] 会話検索・リネームの UI
- [ ] ガードレール実装（ルール定義、preSend/postReceive の本処理）
- [ ] エラー時のトースト UI（現状 alert / インライン）
- [ ] 単体テスト（crypto / store / provider-client）
