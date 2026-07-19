// ============================================================
//  画面描画とイベント配線。store と api を繋ぐ。
// ============================================================
import config from "../app.config.js";
import { Store } from "./store.js";
import { chat, testConnection } from "./api.js";
import { renderMarkdown } from "./markdown.js";

const $ = (sel, root = document) => root.querySelector(sel);

const store = new Store();
store.load();

let activeId = null;      // 選択中の会話 ID
let controller = null;    // 生成中の AbortController

// --- DOM 参照 ---
const el = {
  appName: $("#appName"),
  convList: $("#convList"),
  messages: $("#messages"),
  rail: $("#rail"),
  input: $("#input"),
  composer: $("#composer"),
  send: $("#send"),
  stop: $("#stop"),
  newChat: $("#newChat"),
  openSettings: $("#openSettings"),
  menuToggle: $("#menuToggle"),
  sidebar: $("#sidebar"),
  overlay: $("#overlay"),
  toast: $("#toast"),
  dialog: $("#settingsDialog"),
  form: $("#settingsForm"),
  customHeaderRow: $("#customHeaderRow"),
  testBtn: $("#testBtn"),
  testResult: $("#testResult"),
};

// ============================================================
//  トースト
// ============================================================
let toastTimer = null;
function toast(msg, kind = "info") {
  el.toast.textContent = msg;
  el.toast.className = `toast ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 5000);
}

// ============================================================
//  接続レール
// ============================================================
function renderRail() {
  const s = store.settings;
  if (!store.isConfigured()) {
    el.rail.textContent = "未設定 — ⚙ 設定から接続情報を入力してください";
    el.rail.classList.add("warn");
    return;
  }
  el.rail.classList.remove("warn");
  let host = s.endpoint;
  try { host = new URL(s.endpoint).host; } catch {}
  el.rail.textContent = `${host} · ${s.model} · ${s.authMode}`;
}

// ============================================================
//  会話リスト
// ============================================================
function renderConvList() {
  el.convList.innerHTML = "";
  if (!store.conversations.length) {
    const empty = document.createElement("p");
    empty.className = "conv-empty";
    empty.textContent = "会話はまだありません";
    el.convList.appendChild(empty);
    return;
  }
  for (const c of store.conversations) {
    const item = document.createElement("div");
    item.className = "conv-item" + (c.id === activeId ? " active" : "");
    item.tabIndex = 0;
    item.setAttribute("role", "button");

    const title = document.createElement("span");
    title.className = "conv-title";
    title.textContent = c.title;
    item.appendChild(title);

    const actions = document.createElement("span");
    actions.className = "conv-actions";

    const rename = document.createElement("button");
    rename.className = "mini";
    rename.type = "button";
    rename.title = "リネーム";
    rename.textContent = "✎";
    rename.addEventListener("click", (e) => {
      e.stopPropagation();
      const next = prompt("会話のタイトル", c.title);
      if (next != null) {
        store.renameConversation(c.id, next);
        renderConvList();
      }
    });

    const del = document.createElement("button");
    del.className = "mini";
    del.type = "button";
    del.title = "削除";
    del.textContent = "🗑";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(`「${c.title}」を削除しますか？`)) return;
      store.deleteConversation(c.id);
      if (activeId === c.id) {
        activeId = store.conversations[0]?.id ?? null;
        renderMessages();
      }
      renderConvList();
    });

    actions.append(rename, del);
    item.appendChild(actions);

    const open = () => selectConversation(c.id);
    item.addEventListener("click", open);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    el.convList.appendChild(item);
  }
}

function selectConversation(id) {
  activeId = id;
  renderConvList();
  renderMessages();
  closeDrawer();
}

// ============================================================
//  メッセージ表示
// ============================================================
function renderMessages() {
  el.messages.innerHTML = "";
  const conv = activeId ? store.getConversation(activeId) : null;

  if (!conv || !conv.messages.length) {
    renderEmptyState();
    return;
  }
  for (const m of conv.messages) {
    el.messages.appendChild(bubble(m.role, m.content));
  }
  scrollToBottom();
}

function renderEmptyState() {
  const wrap = document.createElement("div");
  wrap.className = "empty";
  const h = document.createElement("h1");
  h.textContent = config.appName;
  wrap.appendChild(h);

  const p = document.createElement("p");
  p.textContent = store.isConfigured()
    ? "メッセージを送って会話を始めましょう。"
    : "まず ⚙ 設定から接続情報を入力してください。";
  wrap.appendChild(p);

  if (store.isConfigured() && config.starters?.length) {
    const row = document.createElement("div");
    row.className = "starters";
    for (const s of config.starters) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "starter";
      b.textContent = s;
      b.addEventListener("click", () => {
        el.input.value = s;
        el.input.focus();
        autoGrow();
      });
      row.appendChild(b);
    }
    wrap.appendChild(row);
  }
  el.messages.appendChild(wrap);
}

/** 吹き出し要素を作る。assistant は Markdown 整形。 */
function bubble(role, content) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  const body = document.createElement("div");
  body.className = "bubble-body";
  if (role === "assistant") {
    body.innerHTML = renderMarkdown(content);
    wireCopyButtons(body);
  } else {
    body.textContent = content;
  }
  div.appendChild(body);
  return div;
}

/** コードブロックのコピーを配線。 */
function wireCopyButtons(root) {
  for (const btn of root.querySelectorAll("pre.code .copy")) {
    btn.addEventListener("click", () => {
      const code = btn.parentElement.querySelector("code")?.textContent ?? "";
      navigator.clipboard?.writeText(code).then(
        () => { btn.textContent = "コピー済"; setTimeout(() => (btn.textContent = "コピー"), 1500); },
        () => toast("コピーに失敗しました", "error")
      );
    });
  }
}

function scrollToBottom() {
  el.messages.scrollTop = el.messages.scrollHeight;
}

// ============================================================
//  送信
// ============================================================
async function handleSend(text) {
  if (!store.isConfigured()) {
    openSettings();
    toast("接続情報が未設定です。設定を保存してください。", "warn");
    return;
  }
  if (!activeId) {
    const conv = store.createConversation();
    activeId = conv.id;
  }

  store.addMessage(activeId, "user", text);
  renderConvList();
  renderMessages();

  // アシスタント用の空メッセージを用意してストリームで埋める
  store.addMessage(activeId, "assistant", "");
  const conv = store.getConversation(activeId);
  const assistantBubble = bubble("assistant", "");
  el.messages.appendChild(assistantBubble);
  const body = assistantBubble.querySelector(".bubble-body");
  body.innerHTML = '<span class="cursor">▍</span>';
  scrollToBottom();

  setGenerating(true);
  controller = new AbortController();

  // API に渡すのは末尾の空 assistant を除いたメッセージ列
  const history = conv.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  let acc = "";

  try {
    await chat({
      settings: store.settings,
      messages: history,
      signal: controller.signal,
      onDelta: (d) => {
        acc += d;
        body.innerHTML = renderMarkdown(acc);
        wireCopyButtons(body);
        scrollToBottom();
      },
    });
    store.updateLastMessage(activeId, acc);
    renderConvList(); // タイトル更新反映
  } catch (e) {
    if (controller.signal.aborted) {
      store.updateLastMessage(activeId, acc || "（停止しました）");
      body.innerHTML = renderMarkdown(acc || "（停止しました）");
    } else {
      store.updateLastMessage(activeId, acc);
      toast(e.message, "error");
      if (!acc) {
        // 空応答なら空の assistant を消す
        conv.messages.pop();
        store.persist();
        assistantBubble.remove();
      }
    }
  } finally {
    setGenerating(false);
    controller = null;
  }
}

function setGenerating(on) {
  el.send.classList.toggle("hidden", on);
  el.stop.classList.toggle("hidden", !on);
  el.input.disabled = on;
}

// ============================================================
//  設定モーダル
// ============================================================
function openSettings() {
  const s = store.settings;
  el.form.endpoint.value = s.endpoint || "";
  el.form.apiKey.value = s.apiKey || "";
  el.form.authMode.value = s.authMode || "bearer";
  el.form.customHeader.value = s.customHeader || "";
  el.form.model.value = s.model || "";
  el.form.endpoint.placeholder = config.examples.endpoint;
  el.form.apiKey.placeholder = config.examples.apiKey;
  el.form.model.placeholder = config.examples.model;
  el.testResult.textContent = "";
  el.testResult.className = "test-result";
  toggleCustomHeaderRow();
  if (typeof el.dialog.showModal === "function") el.dialog.showModal();
  else el.dialog.setAttribute("open", "");
}

function toggleCustomHeaderRow() {
  el.customHeaderRow.classList.toggle("hidden", el.form.authMode.value !== "custom");
}

function readForm() {
  return {
    endpoint: el.form.endpoint.value.trim(),
    apiKey: el.form.apiKey.value.trim(),
    authMode: el.form.authMode.value,
    customHeader: el.form.customHeader.value.trim(),
    model: el.form.model.value.trim(),
  };
}

// ============================================================
//  ドロワー（モバイル）
// ============================================================
function openDrawer() {
  el.sidebar.classList.add("open");
  el.overlay.classList.remove("hidden");
}
function closeDrawer() {
  el.sidebar.classList.remove("open");
  el.overlay.classList.add("hidden");
}

// ============================================================
//  入力欄の自動リサイズ
// ============================================================
function autoGrow() {
  el.input.style.height = "auto";
  el.input.style.height = Math.min(el.input.scrollHeight, 200) + "px";
}

// ============================================================
//  イベント配線
// ============================================================
function wire() {
  el.appName.textContent = config.appName;
  document.title = config.appName;

  el.newChat.addEventListener("click", () => {
    const conv = store.createConversation();
    activeId = conv.id;
    renderConvList();
    renderMessages();
    closeDrawer();
    el.input.focus();
  });

  el.openSettings.addEventListener("click", openSettings);
  el.menuToggle.addEventListener("click", openDrawer);
  el.overlay.addEventListener("click", closeDrawer);

  el.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text) return;
    el.input.value = "";
    autoGrow();
    handleSend(text);
  });

  el.stop.addEventListener("click", () => controller?.abort());

  el.input.addEventListener("input", autoGrow);
  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      el.composer.requestSubmit();
    }
  });

  el.form.authMode.addEventListener("change", toggleCustomHeaderRow);

  el.form.addEventListener("submit", () => {
    // method="dialog" なのでデフォルトで閉じる。保存を実行。
    store.saveSettings(readForm());
    renderRail();
    renderMessages();
    toast("設定を保存しました", "success");
  });

  el.testBtn.addEventListener("click", async () => {
    el.testResult.textContent = "テスト中…";
    el.testResult.className = "test-result";
    const r = await testConnection(readForm());
    el.testResult.textContent = r.message;
    el.testResult.className = "test-result " + (r.ok ? "ok" : "ng");
  });
}

// ============================================================
//  起動
// ============================================================
function boot() {
  wire();
  renderRail();
  renderConvList();
  activeId = store.conversations[0]?.id ?? null;
  renderMessages();
  if (!store.isConfigured()) openSettings(); // 初回は設定を促す
}

boot();
