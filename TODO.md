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
- [x] PWA(マニフェスト/SW/アイコン)・オフライン起動
- [x] スマホ/PC レスポンシブ(ドロワー)
- [x] 本番用クライアントID(config.json)・UI 非表示
- [x] セットアップ画面（エンドポイント/トークン/モデル + リクエスト・プレビュー + 接続テスト）
- [x] 接続レール（送信先・モデル・認証・接続状態の常時表示）
- [x] トースト UI（alert 廃止、エラー文言を行動指示に）
- [x] 画面の作り直し（配色/タイポ/空状態/吹き出し/固定コンポーザ/履歴検索・リネーム）

## 未了 / 次の作業
- [ ] Google ドライブ連携の実地テスト（OAuth クライアント ID + localhost 配信）
- [ ] パスフレーズモードの UI 導線（現状は app.config.js 切替 + prompt）
- [ ] アーティファクトの HTML プレビュー（iframe sandbox）
- [ ] Markdown: テーブル / 引用 / 番号付きリスト対応
- [ ] ガードレール実装（ルール定義、preSend/postReceive の本処理）
- [ ] 単体テスト（crypto / store / provider-client）
