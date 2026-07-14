import { store } from "../core/store.js";
import { getConfig } from "../core/config.js";
import { loadRuntimeConfig } from "../core/runtime-config.js";
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

const $ = (id) => document.getElementById(id);
const isMobile = () => window.matchMedia("(max-width:820px)").matches;

function refreshSidebar() { renderSidebar($("sidebar"), ctx); }
function refreshMain() {
  const el = $("main");
  if (ctx.view === "chat") renderChat(el, ctx);
  else if (ctx.view === "settings") renderSettings(el);
  else if (ctx.view === "prompts") renderSystemPrompts(el);
  else if (ctx.view === "artifacts") renderArtifacts(el);
}
function refreshAll() { refreshSidebar(); refreshMain(); }

function openDrawer(open) {
  $("drawer").classList.toggle("open", open);
  $("scrim").classList.toggle("show", open);
}
function closeDrawerOnMobile() { if (isMobile()) openDrawer(false); }

function onNav(view) { ctx.view = view; refreshAll(); closeDrawerOnMobile(); }
function onNewChat() { const c = store.newConversation(); ctx.activeConvId = c.id; ctx.view = "chat"; refreshAll(); closeDrawerOnMobile(); }
function onOpenConv(id) { ctx.activeConvId = id; ctx.view = "chat"; refreshAll(); closeDrawerOnMobile(); }
async function onDeleteConv(id) {
  await store.removeConversation(id);
  if (ctx.activeConvId === id) ctx.activeConvId = store.vault.conversations[0]?.id || null;
  refreshAll();
}

async function boot() {
  const cfg = getConfig();
  $("appName").textContent = cfg.appName;
  $("appNameTop").textContent = cfg.appName;
  document.title = cfg.appName;

  await loadRuntimeConfig();

  try {
    if (cfg.encryptionMode === "passphrase") await store.unlock(window.prompt("パスフレーズを入力してください") || "");
    else await store.unlock();
  } catch (e) {
    $("main").innerHTML = '<div class="panel"><p class="error">起動に失敗しました: ' + e.message + "</p></div>";
    return;
  }

  // header actions
  $("menuBtn").onclick = () => openDrawer(!$("drawer").classList.contains("open"));
  $("scrim").onclick = () => openDrawer(false);
  $("settingsBtn").onclick = () => onNav("settings");

  if (store.vault.providers.length === 0 || store.vault.models.length === 0) ctx.view = "settings";
  else { const c = store.vault.conversations[0] || store.newConversation(); ctx.activeConvId = c.id; }

  refreshAll();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
}

boot();
