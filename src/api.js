// ============================================================
//  OpenAI 互換チャットクライアント（ストリーミング / 停止 / フォールバック）
// ============================================================

/**
 * 認証ヘッダを組み立てる。
 * @param {{apiKey:string, authMode:string, customHeader?:string}} s
 */
function authHeaders(s) {
  const key = (s.apiKey || "").trim();
  if (!key) return {};
  if (s.authMode === "raw") return { Authorization: key };
  if (s.authMode === "custom" && s.customHeader) return { [s.customHeader]: key };
  return { Authorization: `Bearer ${key}` }; // 既定 bearer
}

/**
 * 401/404/CORS などをユーザー向けの指針つきメッセージに変換。
 */
function friendlyError(status, bodyText) {
  const detail = bodyText ? `\n${bodyText.slice(0, 500)}` : "";
  if (status === 401 || status === 403)
    return `認証に失敗しました (${status})。API キーと認証方式を確認してください。${detail}`;
  if (status === 404)
    return `エンドポイントが見つかりません (404)。URL のパス（/v1/chat/completions 等）を確認してください。${detail}`;
  if (status === 429)
    return `レート制限に達しました (429)。しばらく待って再試行してください。${detail}`;
  if (status >= 500)
    return `サーバーエラー (${status})。接続先の状態を確認してください。${detail}`;
  return `リクエストに失敗しました (${status})。${detail}`;
}

/**
 * チャット送信。ストリーミング対応。
 * @param {object} args
 * @param {object} args.settings   - endpoint/apiKey/authMode/customHeader/model
 * @param {Array}  args.messages   - [{role, content}]
 * @param {(delta:string)=>void} args.onDelta - 逐次テキスト
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<string>} 完全なアシスタントテキスト
 */
export async function chat({ settings, messages, onDelta, signal }) {
  const endpoint = (settings.endpoint || "").trim();
  if (!endpoint) throw new Error("エンドポイントが未設定です。設定画面で入力してください。");
  if (!settings.model) throw new Error("モデルが未設定です。設定画面で入力してください。");

  const payload = {
    model: settings.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(settings) },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    // ネットワーク層 / CORS 到達不可
    throw new Error(
      `接続できませんでした。エンドポイントの URL、ネットワーク、CORS 許可を確認してください。（${e.message}）`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(friendlyError(res.status, text));
  }

  const ctype = res.headers.get("content-type") || "";
  // ストリーミング（SSE）
  if (res.body && ctype.includes("text/event-stream")) {
    return await readSSE(res.body, onDelta, signal);
  }

  // 非ストリームフォールバック（通常 JSON）
  const data = await res.json().catch(() => null);
  const full = extractContent(data);
  if (full && onDelta) onDelta(full);
  return full || "";
}

/** SSE ストリームを読み、delta を流しつつ全文を返す。 */
async function readSSE(body, onDelta, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // イベントは「\n\n」区切り。行頭 "data:" を拾う。
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of rawEvent.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return full;
          let json;
          try {
            json = JSON.parse(data);
          } catch {
            continue;
          }
          const delta =
            json?.choices?.[0]?.delta?.content ??
            json?.choices?.[0]?.message?.content ??
            "";
          if (delta) {
            full += delta;
            onDelta?.(delta);
          }
        }
      }
    }
  } finally {
    try { reader.cancel(); } catch {}
  }
  return full;
}

/** 非ストリーム応答から本文を取り出す。 */
function extractContent(data) {
  if (!data) return "";
  return (
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    ""
  );
}

/**
 * 接続テスト。最小リクエストを投げて到達可否を返す。
 * @returns {Promise<{ok:boolean, message:string}>}
 */
export async function testConnection(settings) {
  try {
    let got = "";
    await chat({
      settings,
      messages: [{ role: "user", content: "ping" }],
      onDelta: (d) => (got += d),
    });
    return { ok: true, message: "接続に成功しました。" };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
