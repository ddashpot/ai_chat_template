# Chat Playground — マルチプロバイダ・チャットアプリ基盤

ChatGPT / Gemini 風の UI を持ち、OpenAI 互換エンドポイントに接続するブラウザ完結型チャットアプリ。
モデル・接続情報・チャットログ・アーティファクトを **暗号化して** ローカル（IndexedDB）または
利用者自身の Google ドライブに保存します。`app.config.js` の差し替えで各種アプリに転用できます。

## 特長
- ChatGPT/Gemini 風 UI（履歴サイドバー、ストリーミング表示、Markdown/コード整形、画像添付・カメラ）
- 利用者が自分でモデル・接続先を追加/編集
- タイトル付きシステムプロンプトのプリセット
- アーティファクトの自動抽出・保存
- データ保存先をローカル / Google ドライブから選択
- **実暗号化**（難読化ではない）: AES-GCM ＋ 非抽出鍵の自動解錠（任意でパスフレーズモード）
- ガードレール機構（枠のみ・未実装。後日差し込み可能）

## 動かし方（重要）
ES Modules と OAuth の都合上、**`file://` では動きません。http(s) で配信してください。**

```bash
# 例: このフォルダで簡易サーバーを起動
python3 -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```

初回は設定画面が開きます。接続先の API キーとモデル（`model` 文字列）を登録すればチャットできます。

## Google ドライブを使う場合
1. Google Cloud Console で OAuth クライアント ID（種類: ウェブアプリ）を作成
2. 「承認済みの JavaScript 生成元」に配信元（例 `http://localhost:8000`）を登録
3. Drive API を有効化（スコープは `drive.appdata`）
4. アプリの設定画面に **自分の OAuth クライアント ID** を入力し、保存先を Google ドライブに切替

データは Drive の `appDataFolder`（利用者に見えない専用領域）に暗号化されて保存されます。

## 暗号化について
- 既定(auto): AES-GCM の鍵を **非抽出(extractable:false) の CryptoKey** として IndexedDB に保存し自動解錠。
  保存される vault は暗号文のみ。鍵材料は JS からも読み出せず、Drive のファイル単体では復号不可。
- これは難読化ではなく実暗号化です。ただし自動解錠型の共通の限界として、同一端末のブラウザ
  プロファイルにフルアクセスでき、かつアプリのオリジンでコード実行できる攻撃者は復号可能です。
- より強固にするには `app.config.js` の `encryptionMode` を `"passphrase"` にしてください
  （起動時にパスフレーズ入力。鍵は保存されません。パスフレーズを失うと復号不可）。
- バックアップは設定画面の「エクスポート(JSON)」から取得できます。

## 転用のしかた
別アプリ化で触るのは基本的に次の2つ:
- `app.config.js` … アプリ名 / 既定プロバイダ・モデル・プロンプト / 機能フラグ / アーティファクト種別 / 暗号化モード / 保存先
- `styles/theme.css` … 配色・タイポグラフィ

Core / Storage / Provider（`src/core`, `src/storage`, `src/providers`）は共通のまま再利用できます。

## ディレクトリ構成
```
index.html / app.config.js / styles/theme.css
src/core/      config.js schema.js crypto.js store.js
src/storage/   storage-interface.js local-adapter.js gdrive-adapter.js
src/providers/ provider-client.js
src/guardrails/guardrail.js
src/ui/        app.js sidebar.js chat-view.js settings-view.js system-prompts-view.js artifacts-view.js markdown.js
```

詳細な仕様は `REQUIREMENTS.md`、設計は `PLAN.md` を参照。
