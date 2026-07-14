// ガードレール（枠のみ・未実装）。
// フック地点: 送信前(preSend) と 受信後(postReceive)。既定は素通し(no-op)。
// 実ロジックは後日ここに差し込む。config: { enabled, rules[] }
export async function preSend(text, config) {
  if (!config || !config.enabled) return { allowed: true, text };
  // TODO: rules に基づく検査をここに実装する。現状は no-op。
  return { allowed: true, text };
}

export async function postReceive(text, config) {
  if (!config || !config.enabled) return { allowed: true, text };
  // TODO: 出力側の検査をここに実装する。現状は no-op。
  return { allowed: true, text };
}
