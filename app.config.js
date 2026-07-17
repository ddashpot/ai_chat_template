// ============================================================
//  アプリ定義（転用時はここを差し替える）
//  別アプリ化するときに主に触るのはこのファイルと styles/theme.css。
// ============================================================
export default {
  appName: "Chat Playground",
  theme: "default",

  // 起動時に用意しておく接続先の枠（利用者が設定画面で編集する）。
  // authMode "bearer": Authorization: Bearer <apiKey> を送る。
  // endpoint と apiKey は同梱しない。初回起動のセットアップ画面で利用者が入力する。
  defaultProviders: [
    { name: "Gateway", endpoint: "", authMode: "bearer", apiKey: "" }
  ],

  // 起動時に用意しておくモデルの枠（provider は defaultProviders の name を参照）
  defaultModels: [
    { name: "Gemini 2.5 Flash", modelString: "", provider: "Gateway", supportsImages: true, isDefault: true }
  ],

  // セットアップ画面と設定画面のプレースホルダに出す入力例（値そのものは保存しない）
  examples: {
    endpoint: "https://auth-gtw.ddashpot.com/v1/chat/completions",
    apiKey: "agk_…",
    modelString: "google-ai-studio/gemini-2.5-flash"
  },

  // 空のチャットに出す送信例
  starters: [
    "こんにちは",
    "この画像に何が写っているか教えて",
    "このコードのバグを直して"
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
