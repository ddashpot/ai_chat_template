// ============================================================
//  アプリ定義（転用時はここと styles/theme.css を差し替える）
// ============================================================
export default {
  appName: "Chat Playground",

  // 設定画面のプレースホルダに出す入力例（値そのものは保存しない）。
  examples: {
    endpoint: "https://auth-gtw.ddashpot.com/v1/chat/completions",
    apiKey: "agk_…",
    model: "google-ai-studio/gemini-2.5-flash",
  },

  // 設定の初期値（利用者が設定画面で編集する）。endpoint / apiKey / model は空で同梱。
  defaults: {
    endpoint: "",
    apiKey: "",
    authMode: "bearer", // 'bearer' | 'raw' | 'custom'
    customHeader: "",    // authMode==='custom' のときのヘッダ名（例: X-Api-Key）
    model: "",
  },

  // 空のチャットに出す送信例
  starters: [
    "こんにちは",
    "このコードのバグを直して",
    "この文章を要約して",
  ],
};
