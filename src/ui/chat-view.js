import { store } from "../core/store.js";
import { chat, buildUserContent } from "../providers/provider-client.js";
import { preSend, postReceive } from "../guardrails/guardrail.js";
import { renderMarkdown } from "./markdown.js";
import { getConfig } from "../core/config.js";

let images = [];   // 添付画像(dataURL)
let stream = null; // カメラ
let abort = null;  // 送信中断

export function renderChat(el, ctx) {
  const v = store.vault;
  const conv = store.getConversation(ctx.activeConvId);
  const cfg = getConfig();

  el.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-head">
        <select id="modelSel" class="model-sel">
          ${v.models.map(m => `<option value="${m.id}" ${conv && conv.modelId===m.id?"selected":""}>${esc(m.name)}</option>`).join("") || '<option value="">モデル未登録</option>'}
        </select>
        <select id="spSel" class="model-sel">
          <option value="">システムプロンプトなし</option>
          ${v.systemPrompts.map(p => `<option value="${p.id}" ${conv && conv.systemPromptId===p.id?"selected":""}>${esc(p.title)}</option>`).join("")}
        </select>
      </div>
      <div id="thread" class="thread"></div>
      <div class="composer">
        <div id="thumbs" class="thumbs"></div>
        <div class="composer-row">
          <textarea id="msg" rows="1" placeholder="メッセージを入力…"></textarea>
          <div class="composer-tools">
            <label class="tool-btn" title="画像">📎<input id="file" type="file" accept="image/*" multiple hidden></label>
            ${cfg.features.camera ? '<button id="camBtn" class="tool-btn" title="カメラ">📷</button>' : ""}
            <button id="send" class="send-btn">送信</button>
          </div>
        </div>
        <video id="video" playsinline autoplay muted></video>
      </div>
    </div>`;

  const thread = el.querySelector("#thread");
  const drawThread = () => {
    const c = store.getConversation(ctx.activeConvId);
    if (!c) { thread.innerHTML = '<p class="muted center">新規チャットを開始してください</p>'; return; }
    thread.innerHTML = c.messages.map(m => msgHtml(m)).join("");
    thread.querySelectorAll(".copy-btn").forEach(b => b.onclick = () => {
      const code = b.closest(".code").querySelector("code").innerText;
      navigator.clipboard.writeText(code);
      b.textContent = "copied"; setTimeout(() => b.textContent = "copy", 1200);
    });
    thread.scrollTop = thread.scrollHeight;
  };
  drawThread();

  el.querySelector("#modelSel").onchange = e => { if (conv) { conv.modelId = e.target.value; store.persist(); } };
  el.querySelector("#spSel").onchange = e => { if (conv) { conv.systemPromptId = e.target.value; store.persist(); } };

  // 画像添付
  const fileInput = el.querySelector("#file");
  fileInput.onchange = () => {
    for (const f of fileInput.files) {
      const r = new FileReader(); r.onload = () => { images.push(r.result); drawThumbs(); }; r.readAsDataURL(f);
    }
    fileInput.value = "";
  };
  const thumbs = el.querySelector("#thumbs");
  function drawThumbs() {
    thumbs.innerHTML = images.map((u, i) => `<div class="thumb"><img src="${u}"><button data-i="${i}">&times;</button></div>`).join("");
    thumbs.querySelectorAll("button").forEach(b => b.onclick = () => { images.splice(+b.dataset.i, 1); drawThumbs(); });
  }

  // カメラ
  const camBtn = el.querySelector("#camBtn");
  const video = el.querySelector("#video");
  if (camBtn) camBtn.onclick = async () => {
    if (stream) { stopCam(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream; video.style.display = "block"; camBtn.textContent = "⏺";
      video.onclick = () => {
        const cv = document.createElement("canvas"); cv.width = video.videoWidth; cv.height = video.videoHeight;
        cv.getContext("2d").drawImage(video, 0, 0); images.push(cv.toDataURL("image/jpeg", .9)); drawThumbs();
      };
    } catch (e) { alert("カメラを起動できません: " + e.message + "\n(HTTPS または localhost が必要です)"); }
  };
  function stopCam() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; video.style.display = "none"; if (camBtn) camBtn.textContent = "📷"; }

  // 送信
  const msg = el.querySelector("#msg");
  msg.oninput = () => { msg.style.height = "auto"; msg.style.height = Math.min(msg.scrollHeight, 200) + "px"; };
  const sendBtn = el.querySelector("#send");
  sendBtn.onclick = () => send();
  msg.onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); };

  async function send() {
    let c = store.getConversation(ctx.activeConvId);
    if (!c) { c = store.newConversation(); ctx.activeConvId = c.id; ctx.refreshSidebar(); }
    const model = store.vault.models.find(m => m.id === c.modelId) || store.vault.models[0];
    if (!model) { alert("設定でモデルを追加してください"); return; }
    const provider = store.vault.providers.find(p => p.id === model.providerId);
    if (!provider) { alert("モデルに接続先が紐づいていません"); return; }

    const text = msg.value.trim();
    if (!text && images.length === 0) return;

    // ガードレール（no-op）
    const pre = await preSend(text, store.vault.settings.guardrail);
    if (!pre.allowed) { alert("ガードレールにより送信がブロックされました"); return; }

    const userContent = buildUserContent(pre.text, images.slice());
    await store.addMessage(c.id, { role: "user", content: userContent, attachments: images.slice() });
    images = []; drawThumbs();
    msg.value = ""; msg.style.height = "auto";
    drawThread();

    // API 用 messages 構築
    const apiMessages = [];
    const sp = store.vault.systemPrompts.find(p => p.id === c.systemPromptId);
    if (sp && sp.body) apiMessages.push({ role: "system", content: sp.body });
    for (const m of c.messages) apiMessages.push({ role: m.role, content: m.content });

    // アシスタント枠を仮追加してストリーミング描画
    c.messages.push({ role: "assistant", content: "", attachments: [], createdAt: new Date().toISOString() });
    drawThread();
    const assistant = c.messages[c.messages.length - 1];

    sendBtn.textContent = "停止";
    abort = new AbortController();
    sendBtn.onclick = () => { if (abort) abort.abort(); };

    try {
      const full = await chat({
        provider, modelString: model.modelString, messages: apiMessages,
        stream: getConfig().features.streaming, params: model.params || {},
        signal: abort.signal,
        onToken: (t) => { assistant.content += t; liveRender(thread, c); }
      });
      const post = await postReceive(full || assistant.content, store.vault.settings.guardrail);
      assistant.content = post.text;
      // アーティファクト自動抽出
      if (getConfig().artifactAutoExtract) autoExtract(assistant.content, c);
      c.updatedAt = new Date().toISOString();
      await store.persist();
      drawThread();
    } catch (e) {
      assistant.content = (assistant.content || "") + "\n\n[エラー] " + e.message;
      await store.persist(); drawThread();
    } finally {
      sendBtn.textContent = "送信"; sendBtn.onclick = () => send(); abort = null;
    }
  }

  function liveRender(container, c) {
    container.innerHTML = c.messages.map(m => msgHtml(m)).join("");
    container.scrollTop = container.scrollHeight;
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

function msgHtml(m) {
  const isUser = m.role === "user";
  let inner;
  if (isUser) {
    const textPart = typeof m.content === "string" ? m.content
      : (m.content.find(p => p.type === "text")?.text || "");
    const imgs = (m.attachments || []).map(u => `<img class="msg-img" src="${u}">`).join("");
    inner = escapeHtml(textPart).replace(/\n/g, "<br>") + imgs;
  } else {
    inner = renderMarkdown(m.content || "").html || '<span class="muted">…</span>';
  }
  return `<div class="msg ${isUser ? "user" : "assistant"}">
    <div class="msg-role">${isUser ? "You" : "Assistant"}</div>
    <div class="msg-body">${inner}</div></div>`;
}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escapeHtml(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
