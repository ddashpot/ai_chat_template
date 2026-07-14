# PLAN — 設計と意思決定ログ

コーディング AI / 開発者はまずこのファイルを読むこと。作業前の土台。

## アーキテクチャ
3 層構成。
- **UI 層** (`src/ui`): 画面描画とイベント。store を読み書きする。
- **Core 層** (`src/core`): config / schema（データ模型）/ crypto（暗号化）/ store（メモリ vault と永続化）。
- **Adapter 層** (`src/storage`): storage-interface を実装する local / gdrive。

データフロー: UI → store.CRUD → store.persist() → crypto.encryptJSON() → adapter.save()。
読込: adapter.load() → crypto.decryptJSON() → store.vault（メモリ）→ UI。

## データモデル（`src/core/schema.js`）
AppSettings / Provider / Model / SystemPrompt / Conversation / Message / Artifact / GuardrailConfig。
全体を 1 つの vault にまとめ、丸ごと暗号化して保存。`schemaVersion` で将来のマイグレーションに対応（`migrate()`）。

## 意思決定ログ
- 実装形態: ビルド不要の ES Modules モジュール構成（静的配信でそのまま動く）。
- 暗号化: 自動解錠（非抽出 CryptoKey / IndexedDB）を既定。任意で PBKDF2 パスフレーズモード。
  → 「鍵をデータの隣に平文で置かない」ことで難読化ではなく実暗号化を担保。
- 保存先: local(IndexedDB) と gdrive(appDataFolder)。Drive 選択時もローカルに暗号化控えを保持し鍵整合を取る。
- Google Drive: 利用者自身の OAuth クライアント ID を使用（アプリに資格情報を同梱しない）。GIS トークン方式。
- ストリーミング: SSE 対応、非対応エンドポイントは JSON フォールバック。
- 認証ヘッダ: 既定 raw（Bearer なし）。接続先ごとに bearer / custom に変更可。

## マイルストーン
- M1 スキーマ+暗号化+ローカル保存+設定画面 … 実装済
- M2 チャット UI（履歴/送信/Markdown/画像/カメラ/ストリーミング）… 実装済
- M3 システムプロンプト+アーティファクト … 実装済
- M4 Google ドライブ保存先 … 実装済（要オリジン設定・要動作確認）
- M5 ガードレール枠+ドキュメント+ZIP … 実装済（ガードレールは no-op）

## 既知の制約 / 今後
- Drive 連携は実配信オリジン + OAuth 設定が必要なため、ローカル簡易サーバーでの実地確認が未了。
- vault は丸ごと暗号化。将来はレコード単位の分割暗号化で大規模履歴の書込コストを最適化可能。
- Markdown レンダラは軽量自作。テーブル等は未対応。必要なら安全な実装に差し替える。
- ガードレールは preSend / postReceive の no-op のみ。ルール DSL は未設計。
