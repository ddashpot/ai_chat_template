import { store } from "../core/store.js";
import { chat, buildUserContent } from "../providers/provider-client.js";
import { preSend, postReceive } from "../guardrails/guardrail.js";
import { renderMarkdown } from "./markdown.js";
import { getConfig } from "../core/config.js";
import { toast } from "./toast.js";

let images = [];   // 添付画像(dataURL)
let cam = null;    // カメラの MediaStream
let abort = null;  // 送信中断

export function renderChat(el, ctx) {
  const v = store.vault;
  const conv = store.getConversation(ctx.activeConvId);
  const cfg = getConfig();
  const desktop = !window.matchMedia("(max-width:820px)").matches;

  el.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-head">
        <select id="modelSel" class="sel" aria-label="モデル">
          ${v.models.map(m => `<option value="${m.id}" ${conv && conv.modelId === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("") || '<option value="">モデル未登録</option>'}
        </select>
        <select id="spSel" class="sel" aria-label="システムプロンプト">
          <option value="">プロンプトなし</option>
          ${v.systemPrompts.map(p => `<option value="${p.id}" ${conv && conv.systemPromptId === p.id ? "selected" : ""}>${esc(p.title)}</option>`).join("")}
        </select>
      </div>
      <div id="thread" class="thread"></div>
      <div class="composer">
        <div id="thumbs" class="thumbs"></div>
        <div class="composer-row">
          <textarea id="msg" rows="1" placeholder="メッセージを入力"></textarea>
          <div class="composer-tools">
            <button id="fileBtn" class="tool-btn" title="画像を添付" aria-label="画像を添付">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M21.4 11.05l-9.2 9.2a5 5 0 0 1-7.07-7.07l9.2-9.2a3.33 3.33 0 0 1 4.71 4.71l-9.2 9.2a1.67 1.67 0 0 1-2.36-2.36l8.49-8.48"/></svg>
            </button>
            <input id="file" type="file" accept="image/*" multiple hidden>
            ${cfg.features.camera ? `<button id="camBtn" class="tool-btn" title="カメラで撮る" aria-label="カメラで撮る">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>` : ""}
            <button id="send" class="send-btn">送信</button>
          </div>
        </div>
        <video id="video" playsinline autoplay muted></video>
      </div>
      <div class="hint">${desktop ? "Enter で送信 · Shift+Enter で改行" : "⌘/Ctrl+Enter で送信"}</div>
    </div>`;

  const thread = el.querySelector("#thread");
  const msg = el.querySelector("#msg");
  const sendBtn = el.querySelector("#send");
  const autoGrow = () => { msg.style.height = "auto"; msg.style.height = Math.min(msg.scrollHeight, 190) + "px"; };

  function drawThread(scroll = true) {
    const c = store.getConversation(ctx.activeConvId);
    if (!c || c.messages.length === 0) { thread.innerHTML = emptyState(); bindEmpty(); return; }
    thread.innerHTML = c.messages.map(m => msgHtml(m)).join("");
    thread.querySelectorAll(".copy-btn").forEach(b => b.onclick = () => {
      navigator.clipboard.writeText(b.closest(".code").querySelector("code").innerText);
      b.textContent = "コピー済"; setTimeout(() => b.textContent = "copy", 1200);
    });
    if (scroll) thread.scrollTop = thread.scrollHeight;
  }

  function emptyState() {
    const model = store.vault.models.find(m => m.id === (conv && conv.modelId)) || store.vault.models[0];
    const starters = cfg.starters || [];
    return `<div class="empty">
      <h2 class="empty-mark">何から始めますか</h2>
      <p>${esc(model ? model.name : "モデル")} に直接つながっています。下の例はそのまま送れます。</p>
      <div class="empty-chips">
        ${starters.map(s => `<button class="chip" data-starter="${attr(s)}">${esc(s)}</button>`).join("")}
      </div>
    </div>`;
  }
  function bindEmpty() {
    thread.querySelectorAll("[data-starter]").forEach(b => b.onclick = () => {
      msg.value = b.dataset.starter; msg.focus(); autoGrow();
    });
  }
  drawThread();

  el.querySelector("#modelSel").onchange = e => { if (conv) { conv.modelId = e.target.value; store.persist(); } };
  el.querySelector("#spSel").onchange = e => { if (conv) { conv.systemPromptId = e.target.value; store.persist(); } };

  // ---- 画像添付 ----
  const fileInput = el.querySelector("#file");
  const thumbs = el.querySelector("#thumbs");
  el.querySelector("#fileBtn").onclick = () => fileInput.click();
  fileInput.onchange = () => {
    for (const f of fileInput.files) readImage(f);
    fileInput.value = "";
  };
  function readImage(f) { const r = new FileReader(); r.onload = () => { images.push(r.result); drawThumbs(); }; r.readAsDataURL(f); }
  function drawThumbs() {
    thumbs.innerHTML = images.map((u, i) => `<div class="thumb"><img src="${u}" alt=""><button data-i="${i}" aria-label="添付を外す">✕</button></div>`).join("");
    thumbs.querySelectorAll("button").forEach(b => b.onclick = () => { images.splice(+b.dataset.i, 1); drawThumbs(); });
  }
  drawThumbs();
  msg.onpaste = e => {
    for (const it of (e.clipboardData && e.clipboardData.items) || []) {
      if (it.type.startsWith("image/")) readImage(it.getAsFile());
    }
  };

  // ---- カメラ ----
  const camBtn = el.querySelector("#camBtn");
  const video = el.querySelector("#video");
  if (camBtn) camBtn.onclick = async () => {
    if (cam) { stopCam(); return; }
    try {
      cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = cam; video.style.display = "block"; camBtn.classList.add("on");
      toast("映像をタップすると撮影します");
      video.onclick = () => {
        const cv = document.createElement("canvas");
        cv.width = video.videoWidth; cv.height = video.videoHeight;
        cv.getContext("2d").drawImage(video, 0, 0);
        images.push(cv.toDataURL("image/jpeg", .9)); drawThumbs(); stopCam();
      };
    } catch (e) { toast("カメラを開けません。HTTPS か localhost で開いてください", "error"); }
  };
  function stopCam() {
    if (cam) cam.getTracks().forEach(t => t.stop());
    cam = null; video.style.display = "none"; if (camBtn) camBtn.classList.remove("on");
  }

  // ---- 入力 ----
  msg.oninput = autoGrow;
  sendBtn.onclick = () => send();
  msg.onkeydown = e => {
    if (e.key !== "Enter") return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); send(); return; }
    if (desktop && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  };

  // ---- 送信 ----
  async function send() {
    let c = store.getConversation(ctx.activeConvId);
    if (!c) { c = store.newConversation(); ctx.activeConvId = c.id; ctx.refreshSidebar(); }
    const model = store.vault.models.find(m => m.id === c.modelId) || store.vault.models[0];
    if (!model) { toast("設定でモデルを追加してください", "error"); return; }
    const provider = store.vault.providers.find(p => p.id === model.providerId);
    if (!provider || !provider.endpoint) { toast("接続先が未設定です。設定を開いてください", "error"); return; }

    const text = msg.value.trim();
    if (!text && images.length === 0) return;
    if (images.length && !model.supportsImages) { toast("このモデルは画像に対応していません", "error"); return; }

    const pre = await preSend(text, store.vault.settings.guardrail);
    if (!pre.allowed) { toast("ガードレールが送信を止めました", "error"); return; }

    const sent = images.slice();
    await store.addMessage(c.id, { role: "user", content: buildUserContent(pre.text, sent), attachments: sent });
    images = []; drawThumbs();
    msg.value = ""; msg.style.height = "auto";
    drawThread(); ctx.refreshSidebar();

    const apiMessages = [];
    const sp = store.vault.systemPrompts.find(p => p.id === c.systemPromptId);
    if (sp && sp.body) apiMessages.push({ role: "system", content: sp.body });
    for (const m of c.messages) apiMessages.push({ role: m.role, content: m.content });

    c.messages.push({ role: "assistant", content: "", attachments: [], createdAt: new Date().toISOString() });
    const assistant = c.messages[c.messages.length - 1];
    drawThread();

    sendBtn.textContent = "停止"; sendBtn.classList.add("stop");
    abort = new AbortController();
    sendBtn.onclick = () => { if (abort) abort.abort(); };
    ctx.setStatus("wait");

    try {
      const full = await chat({
        provider, modelString: model.modelString, messages: apiMessages,
        stream: cfg.features.streaming, params: model.params || {},
        signal: abort.signal,
        onToken: (t) => { assistant.content += t; drawThread(); }
      });
      const post = await postReceive(full || assistant.content, store.vault.settings.guardrail);
      assistant.content = post.text;
      if (cfg.artifactAutoExtract) autoExtract(assistant.content, c);
      c.updatedAt = new Date().toISOString();
      ctx.setStatus("ok");
      await store.persist();
      drawThread();
    } catch (e) {
      if (e.name === "AbortError") {
        ctx.setStatus("idle");
        if (!assistant.content) c.messages.pop();
      } else {
        ctx.setStatus("ng");
        toast(friendly(e.message), "error", 5200);
        if (!assistant.content) c.messages.pop();
        else assistant.content += "\n\n— 応答が途中で切れました";
      }
      await store.persist(); drawThread();
    } finally {
      sendBtn.textContent = "送信"; sendBtn.classList.remove("stop");
      sendBtn.onclick = () => send(); abort = null;
    }
  }

  function autoExtract(content, c) {
    const { artifacts } = renderMarkdown(content);
    artifacts.filter(a => a.content.split("\n").length >= 5).forEach(a => {
      store.addArtifact({
        conversationId: c.id,
        type: a.language === "html" ? "html" : "code",
        title: (a.language || "code") + " スニペット",
        content: a.content, language: a.language
      });
    });
  }
}

// エラー本文をそのまま出さず、次に取るべき行動が分かる文にする。
function friendly(m) {
  if (/HTTP 401|HTTP 403/.test(m)) return "トークンが拒否されました。設定で確認してください";
  if (/HTTP 404/.test(m)) return "エンドポイントのパスが違います";
  if (/HTTP 429/.test(m)) return "レート制限に達しました。少し待ってから送ってください";
  if (/HTTP 5\d\d/.test(m)) return "ゲートウェイ側のエラーです。時間をおいて再送してください";
  if (/Failed to fetch|NetworkError|Load failed/.test(m)) return "ゲートウェイに届きません。URL と CORS 許可を確認してください";
  return m.slice(0, 140);
}

function msgHtml(m) {
  const isUser = m.role === "user";
  let inner;
  if (isUser) {
    const textPart = typeof m.content === "string" ? m.content : ((m.content.find(p => p.type === "text") || {}).text || "");
    const imgs = (m.attachments || []).map(u => `<img class="msg-img" src="${u}" alt="">`).join("");
    inner = escapeHtml(textPart).replace(/\n/g, "<br>") + imgs;
  } else {
    inner = m.content ? renderMarkdown(m.content).html : '<span class="typing"></span>';
  }
  return `<div class="msg ${isUser ? "user" : "assistant"}">
    <div class="msg-role">${isUser ? "You" : "Assistant"}</div>
    <div class="msg-body">${inner}</div></div>`;
}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function attr(s){return (s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;");}
function escapeHtml(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
