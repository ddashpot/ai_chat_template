// OpenAI 互換 /v1/chat/completions クライアント。ストリーミング対応（非対応時はフォールバック）。
// Web検索（grounding）時のみ Gemini ネイティブ経路（…:generateContent）へ切り替える。
function buildHeaders(provider) {
  const h = { "Content-Type": "application/json" };
  const mode = provider.authMode || "raw";
  const key = provider.apiKey;
  if (!key) return h;
  // ブローカー発行キー(agk_/apk_)は Authorization: Bearer 以外だとゲートウェイで必ず
  // 401 missing_token になる。認証方式が raw のままでも Bearer で送るよう自動補正する
  // （public/custom を明示している場合はユーザーの意図を尊重してそのまま）。
  const isBrokerKey = /^(agk|apk)_/.test(key);
  if (mode === "bearer" || (isBrokerKey && mode !== "public" && mode !== "custom")) {
    h["Authorization"] = "Bearer " + key;
  } else if (mode === "public") {
    h["X-Broker-App"] = key; // 公開アプリ（アプリIDを送る）
  } else if (mode === "custom" && provider.customHeaderName) {
    h[provider.customHeaderName] = key;
  } else {
    h["Authorization"] = key; // raw（非ブローカーキー）
  }
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

// ============================================================
//  Web検索（Google検索グラウンディング）: Gemini ネイティブ経路
//  google-ai-studio/gemini 系モデル専用。/v1/… のエンドポイントから
//  ベース URL を推定し …/v1/google-ai-studio/v1beta/models/<model>:generateContent へ送る。
// ============================================================

// grounding を使えるモデルか（google-ai-studio/gemini 系のみ）。
export function supportsGrounding(modelString) {
  return /gemini/i.test((modelString || "").replace(/^google-ai-studio\//, ""));
}

function geminiTarget(endpoint, modelString, stream) {
  const bare = (modelString || "").replace(/^google-ai-studio\//, "");
  let base;
  try {
    const u = new URL(endpoint);
    const i = u.pathname.indexOf("/v1/");
    base = u.origin + (i >= 0 ? u.pathname.slice(0, i) : "");
  } catch (e) { throw new Error("エンドポイント URL を解釈できません: " + endpoint); }
  const method = stream ? "streamGenerateContent" : "generateContent";
  return base + "/v1/google-ai-studio/v1beta/models/" + encodeURIComponent(bare) + ":" + method;
}

// OpenAI 形式の messages を Gemini ネイティブの contents へ変換。
// role: assistant→model / それ以外→user。画像 dataURL は inline_data に変換する。
function toGeminiContents(messages) {
  return messages.filter(m => m.role !== "system").map(m => {
    const parts = [];
    if (typeof m.content === "string") {
      if (m.content) parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p.type === "text" && p.text) parts.push({ text: p.text });
        else if (p.type === "image_url" && p.image_url && p.image_url.url) {
          const mt = /^data:([^;]+);base64,(.*)$/.exec(p.image_url.url);
          if (mt) parts.push({ inline_data: { mime_type: mt[1], data: mt[2] } });
        }
      }
    }
    if (parts.length === 0) parts.push({ text: "" });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });
}

// Web検索付きチャット。返り値: { text, grounding }
// grounding = { queries: string[], sources: [{title, uri}] } または null（検索が行われなかった場合）。
export async function chatGrounded({ provider, modelString, messages, stream = true, onToken, signal }) {
  if (!provider || !provider.endpoint) throw new Error("接続先が未設定です");
  if (!supportsGrounding(modelString)) throw new Error("Web検索は google-ai-studio/gemini 系モデルのみ対応です");

  const target = geminiTarget(provider.endpoint, modelString, stream);
  const body = { contents: toGeminiContents(messages), tools: [{ google_search: {} }] };
  const sys = messages.find(m => m.role === "system");
  if (sys && sys.content) body.systemInstruction = { parts: [{ text: String(sys.content) }] };

  const res = await fetch(target, {
    method: "POST",
    headers: buildHeaders(provider),
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) throw new Error("HTTP " + res.status + ": " + (await res.text()));

  let text = "";
  let gm = null;
  if (stream && res.body && (res.headers.get("content-type") || "").includes("text/event-stream")) {
    await readGeminiStream(res,
      (delta) => { text += delta; if (onToken) onToken(delta); },
      (g) => { gm = g; });
  } else {
    const data = await res.json();
    // 非ストリーム時は単一オブジェクト、alt=sse でない配列応答のこともある
    const cands = Array.isArray(data) ? data.flatMap(d => d.candidates || []) : (data.candidates || []);
    text = cands.map(c => (c.content?.parts || []).map(p => p?.text).filter(Boolean).join("")).join("");
    gm = cands.map(c => c && c.groundingMetadata).find(Boolean) || null;
    if (onToken && text) onToken(text);
  }
  return { text, grounding: normalizeGrounding(gm) };
}

// Gemini ネイティブ SSE を読む。[DONE] 番兵は無い。groundingMetadata は途中チャンクに載る。
async function readGeminiStream(res, onDelta, onGrounding) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      try {
        const obj = JSON.parse(t.slice(5).trim());
        const parts = obj.candidates?.[0]?.content?.parts;
        if (parts) {
          const txt = parts.map(p => p?.text).filter(Boolean).join("");
          if (txt) onDelta(txt);
        }
        const g = obj.candidates?.map(c => c && c.groundingMetadata).find(Boolean);
        if (g) onGrounding(g);
      } catch (e) { /* 部分行は無視 */ }
    }
  }
}

// groundingMetadata を保存用の最小形に整える。
function normalizeGrounding(gm) {
  if (!gm) return null;
  const queries = Array.isArray(gm.webSearchQueries) ? gm.webSearchQueries : [];
  const sources = (Array.isArray(gm.groundingChunks) ? gm.groundingChunks : [])
    .map(c => c && c.web).filter(Boolean)
    .map(w => ({ title: w.title || "", uri: w.uri || "" }));
  return { queries, sources };
}
