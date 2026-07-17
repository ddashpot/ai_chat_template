// OpenAI 互換 /v1/chat/completions クライアント。ストリーミング対応（非対応時はフォールバック）。
function buildHeaders(provider) {
  const h = { "Content-Type": "application/json" };
  const mode = provider.authMode || "raw";
  if (!provider.apiKey) return h;
  if (mode === "bearer") h["Authorization"] = "Bearer " + provider.apiKey;
  else if (mode === "custom" && provider.customHeaderName) h[provider.customHeaderName] = provider.apiKey;
  else h["Authorization"] = provider.apiKey; // raw（既定）
  return h;
}

// エンドポイントのホスト名だけを取り出す（ステータス表示用）。
export function endpointHost(endpoint) {
  try { return new URL(endpoint).host; } catch (e) { return endpoint || ""; }
}

// トークンを伏せて表示する（先頭 6 文字 + 末尾 2 文字）。
export function maskKey(key) {
  if (!key) return "";
  if (key.length <= 10) return key.slice(0, 2) + "…";
  return key.slice(0, 6) + "…" + key.slice(-2);
}

// 接続テスト: 最小のリクエストを 1 回だけ投げて到達性と認証を確かめる。
// 返り値: { ok, ms, status, message }
export async function testConnection({ provider, modelString, timeoutMs = 20000 }) {
  const t0 = performance.now();
  if (!provider || !provider.endpoint) return { ok: false, message: "エンドポイントが空です" };
  if (!modelString) return { ok: false, message: "model 文字列が空です" };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(provider.endpoint, {
      method: "POST",
      headers: buildHeaders(provider),
      body: JSON.stringify({ model: modelString, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
      signal: ac.signal
    });
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) {
      const body = (await res.text()).slice(0, 160);
      return { ok: false, ms, status: res.status, message: httpHint(res.status) + " (HTTP " + res.status + ") " + body };
    }
    await res.json().catch(() => ({}));
    return { ok: true, ms, status: res.status, message: "接続できました (" + ms + "ms)" };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    if (e.name === "AbortError") return { ok: false, ms, message: "タイムアウトしました" };
    return { ok: false, ms, message: "到達できません: " + e.message + " — URL の綴りか CORS 許可を確認してください" };
  } finally { clearTimeout(timer); }
}

function httpHint(status) {
  if (status === 401 || status === 403) return "トークンが拒否されました";
  if (status === 404) return "エンドポイントのパスが違います";
  if (status === 429) return "レート制限に達しています";
  if (status >= 500) return "ゲートウェイ側のエラーです";
  return "リクエストが拒否されました";
}

// messages: [{role, content}] content は string または parts 配列（画像込み）。
export async function chat({ provider, modelString, messages, stream = true, params = {}, onToken, signal }) {
  if (!provider || !provider.endpoint) throw new Error("接続先が未設定です");
  const body = { model: modelString, messages, ...params };
  if (stream) body.stream = true;

  const res = await fetch(provider.endpoint, {
    method: "POST",
    headers: buildHeaders(provider),
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) throw new Error("HTTP " + res.status + ": " + (await res.text()));

  const ctype = res.headers.get("content-type") || "";
  if (stream && res.body && ctype.includes("text/event-stream")) {
    return await readStream(res, onToken);
  }
  // フォールバック（非ストリーム）
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (onToken && text) onToken(text);
  return text;
}

async function readStream(res, onToken) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) { full += delta; if (onToken) onToken(delta); }
      } catch (e) { /* 部分行は無視 */ }
    }
  }
  return full;
}

// 画像込みのユーザー content を組み立てる（OpenAI vision 互換）。
export function buildUserContent(text, imageDataUrls) {
  if (!imageDataUrls || imageDataUrls.length === 0) return text;
  const parts = [];
  if (text) parts.push({ type: "text", text });
  for (const url of imageDataUrls) parts.push({ type: "image_url", image_url: { url } });
  return parts;
}
