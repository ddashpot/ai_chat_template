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
