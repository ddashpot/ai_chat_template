import { store } from "../core/store.js";
import { getConfig } from "../core/config.js";
import { renderSidebar } from "./sidebar.js";
import { renderChat } from "./chat-view.js";
import { renderSettings } from "./settings-view.js";
import { renderSystemPrompts } from "./system-prompts-view.js";
import { renderArtifacts } from "./artifacts-view.js";

const ctx = {
  view: "chat",
  activeConvId: null,
  onNewChat, onOpenConv, onDeleteConv, onNav, refreshSidebar, refreshMain
};

const sidebarEl = () => document.getElementById("sidebar");
const mainEl = () => document.getElementById("main");

function refreshSidebar() { renderSidebar(sidebarEl(), ctx); }
function refreshMain() {
  const el = mainEl();
  if (ctx.view === "chat") renderChat(el, ctx);
  else if (ctx.view === "settings") renderSettings(el);
  else if (ctx.view === "prompts") renderSystemPrompts(el);
  else if (ctx.view === "artifacts") renderArtifacts(el);
}
function refreshAll() { refreshSidebar(); refreshMain(); }

function onNav(view) { ctx.view = view; refreshAll(); }
function onNewChat() { const c = store.newConversation(); ctx.activeConvId = c.id; ctx.view = "chat"; refreshAll(); }
function onOpenConv(id) { ctx.activeConvId = id; ctx.view = "chat"; refreshAll(); }
async function onDeleteConv(id) {
  await store.removeConversation(id);
  if (ctx.activeConvId === id) ctx.activeConvId = store.vault.conversations[0]?.id || null;
  refreshAll();
}

async function boot() {
  const cfg = getConfig();
  document.getElementById("appName").textContent = cfg.appName;
  document.title = cfg.appName;

  try {
    if (cfg.encryptionMode === "passphrase") {
      const pass = await promptPassphrase();
      await store.unlock(pass);
    } else {
      await store.unlock();
    }
  } catch (e) {
    mainEl().innerHTML = '<div class="panel"><p class="error">解錠に失敗しました: ' + e.message + "</p></div>";
    return;
  }

  store.on(() => { /* 変更通知（必要なら差分描画）*/ });

  // 初期ビュー: プロバイダ/モデル未設定なら設定へ
  if (store.vault.providers.length === 0 || store.vault.models.length === 0) ctx.view = "settings";
  else { const c = store.vault.conversations[0] || store.newConversation(); ctx.activeConvId = c.id; }

  refreshAll();
}

function promptPassphrase() {
  return new Promise((resolve) => {
    const p = window.prompt("パスフレーズを入力してください（暗号化の解錠に使用）");
    resolve(p || "");
  });
}

boot();
