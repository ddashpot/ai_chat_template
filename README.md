# Chat Playground

ChatGPT / Gemini 風 UI のマルチプロバイダ・チャットアプリ（PWA）。OpenAI 互換エンドポイントに接続し、
モデル・接続情報・チャットログ・アーティファクトを保存します。`app.config.js` の差し替えで各種アプリに転用できます。

## 特長
- ChatGPT/Gemini 風 UI（履歴、ストリーミング、Markdown/コード整形、画像添付・カメラ）
- スマホ / PC で最適化されたレスポンシブ表示（モバイルはドロワー、PC は固定サイドバー）
- 設定画面: 接続先・モデルの追加/編集、保存先切替、バックアップ
- タイトル付きシステムプロンプト、アーティファクトの自動保存
- 保存先: ローカル / 利用者自身の Google ドライブ
- PWA: インストール可・オフライン起動
- ガードレール機構（枠のみ・未実装）

## 初期設定（エンドポイント・トークンは利用者が入力）
テンプレートには接続先の枠（認証方式: Bearer）とモデル `google-ai-studio/gemini-2.5-flash`（画像入力対応）が
登録されていますが、**エンドポイントとトークン（API キー）はどちらも同梱していません**。初回起動時に
設定画面が開くので、利用者が次の2つを入力してください（`app.config.js` で既定値を変更可）。

- エンドポイント: 例 `https://auth-gtw.ddashpot.com/v1/chat/completions`
- トークン（API キー）: 例 `agk_…`

入力したトークンは暗号化されて保存され、リクエスト時に `Authorization: Bearer <キー>` として
入力されたエンドポイントへ送信されます。

送信されるリクエストは次の呼び出しと等価です:
```js
await fetch("https://auth-gtw.ddashpot.com/v1/chat/completions", {
  method: "POST",
  headers: { "Authorization": "Bearer <キー>", "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "google-ai-studio/gemini-2.5-flash",
    messages: [{ role: "user", content: "こんにちは" }]
  })
});
```

## 開発時の起動
`file://` では動きません。http(s) で配信してください。
```bash
python3 -m http.server 8000
# http://localhost:8000/
```

## 本番デプロイ
1. 一式を静的ホスティング（HTTPS 必須。PWA / OAuth に必要）へ配置。
2. Google ドライブを使う場合、**`config.example.json` を `config.json` にコピーして OAuth クライアント ID を記入**し、同じ場所へ配置。`config.json` はリポジトリに含めない（`.gitignore` 済み）。UI にはクライアント ID を表示しません。
3. Google Cloud の OAuth クライアント（ウェブ）で、**承認済み JavaScript 生成元**に本番の配信元 URL を登録。Drive API を有効化（スコープ `drive.appdata`）。

Web の OAuth クライアント ID はシークレットではなく、保護は「承認済み JavaScript 生成元」で行います。値をソースに載せたくない場合は上記 `config.json` を使用してください。

## 転用のしかた
差し替えるのは基本的に次の2つ:
- `app.config.js` … アプリ名 / 既定プロバイダ（`defaultProviders`）・既定モデル（`defaultModels`）・プロンプト / 機能フラグ / 保存先
- `styles/theme.css` … 配色・タイポグラフィ

`src/core`・`src/storage`・`src/providers` は共通のまま再利用できます。

## 構成
```
index.html / app.config.js / manifest.webmanifest / service-worker.js
config.example.json (→ 本番は config.json を配置)
icons/  styles/theme.css
src/core/      config.js runtime-config.js schema.js crypto.js store.js
src/storage/   storage-interface.js local-adapter.js gdrive-adapter.js
src/providers/ provider-client.js
src/guardrails/guardrail.js
src/ui/        app.js sidebar.js chat-view.js settings-view.js system-prompts-view.js artifacts-view.js markdown.js
```

仕様は `REQUIREMENTS.md`、設計は `PLAN.md`、作業状況は `TODO.md` / `FAIL_LOG.md` を参照。
