// ============================================================
//  アプリ定義（転用時はここを差し替える）
//  別アプリ化するときに主に触るのはこのファイルと styles/theme.css。
// ============================================================
export default {
  appName: "Chat Playground",
  theme: "default",

  // 起動時に用意しておく接続先（利用者が設定画面で編集可）
  // authMode "bearer": Authorization: Bearer <apiKey> を送る。
  // エンドポイントとトークン（apiKey）はどちらも同梱せず、利用者が設定画面で入力する。
  // 入力例:
  //   エンドポイント: https://auth-gtw.ddashpot.com/v1/chat/completions
  //   トークン(apiKey): agk_… のキー（暗号化して保存される）
  defaultProviders: [
    { name: "Gateway", endpoint: "", authMode: "bearer", apiKey: "" }
  ],

  // 起動時に用意しておくモデル（provider は defaultProviders の name を参照）
  defaultModels: [
    { name: "Gemini 2.5 Flash", modelString: "google-ai-studio/gemini-2.5-flash", provider: "Gateway", supportsImages: true, isDefault: true }
  ],

  // タイトル付きシステムプロンプトの初期プリセット
  defaultSystemPrompts: [
    { title: "標準アシスタント", body: "あなたは親切で有能なアシスタントです。", isDefault: true }
  ],

  // 機能フラグ
  features: { streaming: true, artifacts: true, camera: true, gdrive: true },

  // アシスタント出力からコード等を自動でアーティファクト化するか
  artifactAutoExtract: true,

  // 暗号化モード: "auto"（非抽出鍵で自動解錠・推奨） / "passphrase"（毎回入力）
  encryptionMode: "auto",

  // 既定の保存先: "local" / "gdrive"
  storageDefault: "local"
};
