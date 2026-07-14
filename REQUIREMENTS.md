# 要件定義書（確定版） — マルチプロバイダ・チャットアプリ基盤

> 目的: ChatGPT / Gemini のようなチャット UI を持ち、OpenAI 互換エンドポイントに接続し、モデル・接続情報・チャットログ・アーティファクトを **暗号化して** ローカルまたは利用者自身の Google ドライブに保存する、**各種アプリに転用できるフロントエンド基盤**。

本書は確定版。決定事項には【確定】、既定採用（変更可）には【既定】を付す。この内容でリポジトリ雛形（README / PLAN / TODO / FAIL_LOG 含む）を ZIP 出力する。

---

## 0. 確定した主要方針

- 【確定】実装形態: **ビルド不要のモジュール構成リポジトリ（ES Modules）**。静的配信でそのまま動作。
- 【確定】暗号化: **AES-GCM ＋ 非抽出(non-extractable) CryptoKey を IndexedDB に保存して自動解錠**。難読化ではなく実暗号化（詳細は 6 章）。任意でパスフレーズモードに切替可能。
- 【確定】Google ドライブ保存方式: **`appDataFolder`（非表示の専用領域）**。利用者自身の OAuth クライアント ID を使用。
- 【既定】ストリーミング表示: **対応**（`stream:true`、非対応エンドポイントはフォールバック）。
- 【既定】アーティファクト抽出: **自動抽出 ＋ 手動保存の併用**。
- 【既定】認証ヘッダ: **Bearer なしで Authorization にトークン直入れ**（接続先ごと変更可）。

---

## 1. スコープ

**対象**: ブラウザのみで動く静的フロントエンド（サーバー実装なし）／ OpenAI 互換 `/v1/chat/completions` 接続／チャット UI・モデル管理・接続先管理・チャットログ・アーティファクト・タイトル付きシステムプロンプト／暗号化保存（ローカル ⇄ Google ドライブ 切替）／ガードレール機構（**枠のみ・未実装**）／転用可能なモジュール構成／README・PLAN・TODO・FAIL_LOG／ZIP 出力。

**対象外**: サーバーサイド・独自バックエンド／ガードレール実ロジック（no-op のみ）／課金・認証基盤（利用者自身の API キー・Google アカウントを使用）。

---

## 2. アーキテクチャ

3 層に分離し、差し替えで別アプリに転用できる構造。

```
UI 層       チャット / サイドバー / 設定 / アーティファクト / システムプロンプト
  │
Core 層     config・crypto・store（データ整合とスキーマ）・provider（API 呼び出し）・guardrail（フック）
  │
Adapter 層  storage-interface ← local-adapter(IndexedDB) / gdrive-adapter(利用者の Drive)
```

- 転用時に触るのは主に **`app.config.js`** と `styles/theme.css` のみ、を目標。
- ES Modules 構成、ビルド不要。

---

## 3. 機能要件

### 3.1 チャット UI（ChatGPT / Gemini 風）
サイドバー（会話履歴 / 新規 / 検索・リネーム・削除 / 設定導線）、メイン（吹き出し表示、Markdown とコードの整形、コードのコピー）、入力欄（複数行、送信/停止、画像添付、カメラ撮影）、ストリーミング逐次描画、レスポンシブ、フォーカス可視、`prefers-reduced-motion` 尊重。

### 3.2 モデル管理（利用者が自分で設定）
モデルの追加/編集/削除。項目: 表示名・`model` 文字列・使用する接続先参照・画像入力対応フラグ・既定生成パラメータ（任意）。会話ごとに切替。

### 3.3 接続先（プロバイダ）管理
複数登録・切替。項目: 名前・`endpoint`(baseURL)・認証方式（raw / bearer / custom ヘッダ名）・API キー。既定は raw（Bearer なし）。

### 3.4 チャットログ保存
会話＝メッセージ配列＋メタ（タイトル・作成/更新・使用モデル）。自動保存・復元・削除・リネーム・JSON エクスポート/インポート。タイトルは初回メッセージから自動生成（編集可）。

### 3.5 アーティファクト保存
アシスタント出力からコード/HTML/文書等を抽出して独立保存（一定行数以上を自動抽出＋手動アーティファクト化）。一覧・プレビュー・エクスポート、由来会話を保持。

### 3.6 システムプロンプト（タイトル付き）
「タイトル＋本文」プリセットを複数保存。会話へ適用、既定指定、編集・削除。

### 3.7 ガードレール（枠のみ・未実装）
フック地点: 送信前（入力）と受信後（出力）。有効/無効トグルとルール保持の器のみ。既定 no-op。実ロジックは後日差し込む前提のインターフェースだけ定義。

### 3.8 データ保存先の選択（ローカル / Google ドライブ）
ストレージ抽象化＋実装 2 種を切替。ローカル ⇄ Drive の移行に対応（エクスポート/インポート経由）。

### 3.9 暗号化（難読化ではない）
AES-GCM で暗号化。鍵は **非抽出 CryptoKey** として IndexedDB に保持し自動解錠。保存されるのは暗号文・IV のみ。平文はディスク（IndexedDB の値領域・Drive）に残さない。詳細は 6 章。

### 3.10 Google ドライブ連携（利用者自身のもの）
利用者自身の **Google OAuth クライアント ID** を設定入力（アプリ側資格情報は同梱しない）。Google Identity Services のトークンで認可、Drive API v3 の **`appDataFolder`** に暗号化 vault を保存。前提: OAuth は http(s) オリジン必須のため `file://` 不可 → localhost 等で配信（README に明記）。

---

## 4. 非機能要件

- セキュリティ: 鍵は非抽出・端末束縛。API キーも暗号化対象。Markdown は安全レンダリング（生 HTML を実行しない/サニタイズ）。
- プライバシー: データは利用者のブラウザ・利用者の Drive のみ。第三者送信なし。
- 可搬性: 静的配信で動作、ビルドなし。`app.config.js` 差し替えで別アプリ化。
- 性能: 画像・長い履歴に耐えるため保存は IndexedDB。
- 対応環境: 最新 Chrome / Edge / Safari / Firefox、モバイル対応。
- アクセシビリティ: フォーカス可視、コントラスト、キーボード操作。

---

## 5. データモデル（暗号化前の論理スキーマ）

`schemaVersion` を持たせ将来のマイグレーションに備える。

- **AppSettings**: 選択中の保存先・UI テーマ・既定モデル/プロンプト・Google OAuth クライアント ID・暗号化モード(auto|passphrase)・ガードレール設定
- **Provider**: id, name, endpoint, authMode(raw|bearer|custom), customHeaderName?, apiKey
- **Model**: id, name, modelString, providerId, supportsImages, params?
- **SystemPrompt**: id, title, body, isDefault
- **Conversation**: id, title, modelId, createdAt, updatedAt, messages[]
- **Message**: role(user|assistant|system), content(text | parts[]), attachments?(画像 dataURL), createdAt
- **Artifact**: id, conversationId, type(code|html|markdown|other), title, content, language?, createdAt
- **GuardrailConfig**: enabled(false 初期固定), rules[]（空）

全体を 1 つの「vault」として暗号化し保存先に格納。

---

## 6. 暗号化設計【確定】

- 鍵生成: 初回起動時に AES-GCM 256bit 鍵を生成し、**`extractable:false` の CryptoKey** として IndexedDB に保存。以降は自動で取得して解錠（パスフレーズ不要）。
- 暗号: AES-GCM（レコード/保存ごとに 12byte ランダム IV）。保存形式（封筒）: `{ v, iv, ciphertext }`（base64）。
- 鍵材料は JS からも読み出せない（非抽出）。**Drive 上の vault は暗号文のみ**で、ファイル単体を入手しても復号不可。鍵はこのブラウザ/オリジンに束縛。
- **これは難読化ではなく実暗号化**。ただし自動解錠型の共通限界として、同一端末のブラウザプロファイルにフルアクセスでき、かつアプリのオリジンでコード実行できる攻撃者は復号可能。
- 【任意】より強固にしたい場合は **パスフレーズモード**（PBKDF2 でパスフレーズ由来鍵、起動時入力、鍵は保存しない）に `app.config.js` / 設定から切替可能。
- バックアップは暗号化 JSON のエクスポートで利用者責任。復旧不可の条件を UI に明示。

---

## 7. ストレージ設計

共通インターフェース（例）:
```
StorageAdapter {
  async load(): Promise<EncryptedVault | null>
  async save(vault: EncryptedVault): Promise<void>
  async clear(): Promise<void>
  meta(): { kind: 'local' | 'gdrive', label: string }
}
```
- **LocalAdapter**: IndexedDB に暗号化 vault を保存。
- **GDriveAdapter**: 利用者の Drive `appDataFolder` に暗号化 vault ファイルを保存、更新は上書き。

vault は「まるごと暗号化 → 保存」。粒度分割は将来最適化として PLAN に記載。

---

## 8. リポジトリ構成と成果物

```
/
├─ README.md            … 概要・セットアップ（OAuth ID、配信、暗号化モード）・使い方・転用手順・セキュリティ注意
├─ PLAN.md              … アーキテクチャ・データモデル・意思決定ログ・マイルストーン
├─ TODO.md              … マイルストーン別チェックリスト
├─ FAIL_LOG.md          … 失敗と原因・対処を記録し再発を防ぐ台帳（コーディング AI 用）
├─ REQUIREMENTS.md      … 本書
├─ index.html
├─ app.config.js        … アプリ定義（名前・テーマ・既定プロバイダ/プロンプト・機能フラグ・アーティファクト種別・暗号化モード）
├─ src/
│  ├─ core/    config.js / crypto.js / store.js / schema.js
│  ├─ storage/ storage-interface.js / local-adapter.js / gdrive-adapter.js
│  ├─ providers/ provider-client.js
│  ├─ guardrails/ guardrail.js
│  └─ ui/      app.js / sidebar.js / chat-view.js / settings-view.js / artifacts-view.js / system-prompts-view.js / markdown.js
└─ styles/ theme.css
```
- 最終成果物は上記一式を **ZIP** で出力。

**コーディング AI 用ファイルの役割**
- PLAN.md: 全体設計と決定事項。作業前に必ず参照する土台。
- TODO.md: 実装タスクをチェックボックスで管理。
- FAIL_LOG.md: 「試したこと / 失敗理由 / 根本原因 / 解決策」を記録し同じ失敗を繰り返さない。

---

## 9. 転用（各種アプリへの流用）

別アプリ化で差し替える箇所を限定: `app.config.js`（アプリ名・テーマ・既定プロバイダ/モデル/プロンプト・機能フラグ・アーティファクト種別・暗号化モード）、`styles/theme.css`（配色・タイポ）、`guardrails/`（固有ルール・後日）。Core / Storage / Provider は共通のまま再利用。

---

## 10. 段階的実装計画（マイルストーン）

- **M1**: スキーマ＋暗号化（非抽出鍵/IndexedDB）＋ローカル保存＋設定画面（プロバイダ/モデル）
- **M2**: チャット UI（履歴サイドバー・送信・Markdown・画像/カメラ・ストリーミング）
- **M3**: タイトル付きシステムプロンプト＋アーティファクト抽出・保存
- **M4**: Google ドライブ（appDataFolder）保存先の追加と切替
- **M5**: ガードレールの枠（no-op）＋転用ドキュメント整備＋ZIP 出力

---

## 11. 確定状況

要確認だった 6 点はすべて確定（0 章参照）。唯一の留意点は暗号化の限界（6 章）で、自動解錠を選んだことによる残存リスクを明記済み。より強固にしたい場合はパスフレーズモードへ設定で切替可能。

→ この内容で確定。次ステップはリポジトリ雛形（README / PLAN / TODO / FAIL_LOG ＋ src 骨組み）の ZIP 出力。
