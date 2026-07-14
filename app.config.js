// ============================================================
//  アプリ定義（転用時はここを差し替える）
//  別アプリ化するときに主に触るのはこのファイルと styles/theme.css。
// ============================================================
export default {
  appName: "Chat Playground",
  theme: "default",

  // 起動時に用意しておく接続先（利用者が設定画面で編集可）
  defaultProviders: [
    { name: "Gateway", endpoint: "https://auth-gtw.ddashpot.com/v1/chat/completions", authMode: "raw", apiKey: "" }
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
