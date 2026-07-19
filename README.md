# Chat Playground（シンプル再実装 MVP）

OpenAI 互換エンドポイントに接続する、**ビルド不要の静的チャットフロントエンド**。
ChatGPT / Gemini 風の UI で、`app.config.js` と `styles/theme.css` の差し替えで各種アプリに転用できます。

このリポジトリは「小さく確実に動くコア」から作り直した MVP です。
全体の要件と段階計画は **`プラン.md`** を参照してください。

## MVP でできること
- 接続設定（エンドポイント / API キー / 認証方式 / モデル）と接続テスト
- チャット送受信、**ストリーミング逐次表示**（非対応エンドポイントは通常 JSON にフォールバック）、生成の停止
- 会話履歴のローカル保存（`localStorage`）・選択・削除・リネーム、タイトル自動生成
- Markdown / コード整形（安全レンダリング）、コードブロックのコピー
- レスポンシブ（モバイル=ドロワー / PC=固定サイドバー）

MVP に含まない機能（暗号化保存・Google ドライブ・アーティファクト・システムプロンプト・
複数モデル/プロバイダ・画像/カメラ・Web検索・ガードレール・PWA）は `プラン.md` にロードマップとして記載しています。

## 使い方
`file://` では動きません。http(s) で配信してください。
```bash
python3 -m http.server 8000
# http://localhost:8000/
```
初回起動で設定画面が開きます。次の 3 つを入力し「接続をテスト」→「保存」を押します。

- エンドポイント: 例 `https://auth-gtw.ddashpot.com/v1/chat/completions`
- API キー: 例 `agk_…`
- モデル: 例 `google-ai-studio/gemini-2.5-flash`

既定の認証は `Authorization: Bearer <キー>`。接続先に応じて `raw`（キー直入れ）/ `custom`（ヘッダ名指定）に変更できます。

> ⚠️ MVP は設定と会話を `localStorage` に**平文**で保存します（API キーを含む）。
> 共有端末での利用は避けてください。暗号化保存はロードマップ（M2）で導入します。

## 構成
```
index.html            画面骨格（サイドバー / メイン / コンポーザ / 設定モーダル）
app.config.js         アプリ名・入力例・既定値（転用時に触る）
styles/theme.css      配色・タイポ（:root トークン差し替えでテーマ変更）
src/
  api.js              OpenAI 互換クライアント（ストリーミング / 停止 / フォールバック / 接続テスト）
  store.js            localStorage の設定・会話 CRUD
  markdown.js         安全な軽量 Markdown → HTML
  app.js              画面描画とイベント配線
```

## 転用のしかた
差し替えるのは基本的に次の 2 つ:
- `app.config.js` … アプリ名 / 入力例プレースホルダ / 既定値 / スターター例
- `styles/theme.css` … `:root` の配色・タイポ

`src/api.js`・`src/store.js`・`src/markdown.js` は共通のまま再利用できます。

仕様・設計・ロードマップは `プラン.md` を参照。
