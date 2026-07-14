// 本番ではデプロイ時に配置する config.json から実行時設定を読む（リポジトリには含めない）。
let cache = null;
export async function loadRuntimeConfig() {
  if (cache) return cache;
  try {
    const r = await fetch("./config.json", { cache: "no-store" });
    cache = r.ok ? await r.json() : {};
  } catch (e) { cache = {}; }
  return cache;
}
export function runtimeConfig() { return cache || {}; }
