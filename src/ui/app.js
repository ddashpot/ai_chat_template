import { store } from "../core/store.js";
import { getConfig } from "../core/config.js";
import { makeProvider, makeModel, makeSystemPrompt } from "../core/schema.js";
import { loadRuntimeConfig } from "../core/runtime-config.js";
import { renderSidebar } from "./sidebar.js";
import { renderChat } from "./chat-view.js";
import { renderSettings } from "./settings-view.js";
import { renderSystemPrompts } from "./system-prompts-view.js";
import { renderArtifacts } from "./artifacts-view.js";
import { renderOnboarding } from "./onboarding-view.js";
import { endpointHost, maskKey } from "../providers/provider-client.js";

const ctx = {
  view: "chat",
  activeConvId: null,
  status: "idle", // idle | wait | ok | ng
  onNewChat, onOpenConv, onDeleteConv, onRenameConv, onNav, refreshSidebar, refreshMain, setStatus, onSetupDone
};

const $ = (id) => document.getElementById(id);
const isMobile = () => window.matchMedia("(max-width:820px)").matches;

function refreshSidebar() { renderSidebar($("sidebar"), ctx); }
function refreshMain() {
  const el = $("main");
  if (ctx.view === "onboard") renderOnboarding(el, ctx);
  else if (ctx.view === "chat") renderChat(el, ctx);
  else if (ctx.view === "settings") renderSettings(el, ctx);
  else if (ctx.view === "prompts") renderSystemPrompts(el);
  else if (ctx.view === "artifacts") renderArtifacts(el);
  drawStatusbar();
}
function refreshAll() { refreshSidebar(); refreshMain(); }

// ---- 接続レール（署名要素）: 今どこへ何を送るのかを常時見せる ----
function setStatus(s) { ctx.status = s; drawStatusbar(); }
function drawStatusbar() {
  const bar = $("statusbar");
  const p = store.vault?.providers?.[0];
  if (!p || !p.endpoint || ctx.view === "onboard") { bar.hidden = true; return; }
  bar.hidden = false;
  const model = store.vault.models.find(m => m.id === store.vault.settings.defaultModelId) || store.vault.models[0];
  const label = { idle: "未確認", wait: "確認中", ok: "接続済み", ng: "エラー" }[ctx.status];
  bar.innerHTML = `
    <span class="st-dot ${ctx.status === "idle" ? "" : ctx.status}" title="${label}"></span>
    <span class="st-chip" title="${attr(p.endpoint)}">${esc(endpointHost(p.endpoint))}</span>
    <span class="st-sep">/</span>
    <span class="st-chip">${esc(model ? model.modelString : "モデル未設定")}</span>
    <span class="st-sep">/</span>
    <span class="st-chip" title="認証方式">${p.authMode === "bearer" ? "Bearer " : p.authMode === "public" ? "App " : ""}${esc(maskKey(p.apiKey) || "トークン未設定")}</span>
    <span class="st-spacer"></span>
    <button class="st-act" id="stEdit">接続を編集</button>`;
  $("stEdit").onclick = () => onNav("settings");
}

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
async function onRenameConv(id) {
  const c = store.getConversation(id);
  const t = window.prompt("チャット名", c ? c.title : "");
  if (t && t.trim()) { await store.renameConversation(id, t.trim()); refreshAll(); }
}
function onSetupDone() {
  const c = store.vault.conversations[0] || store.newConversation();
  ctx.activeConvId = c.id; ctx.view = "chat"; refreshAll();
}

function needsSetup() {
  const p = store.vault.providers[0];
  return !p || !p.endpoint || !p.apiKey || !store.vault.models.some(m => m.modelString);
}

// ---- URL ハッシュからのプリフィル（ゲートウェイ管理画面からの遷移用） ----
// 例: /#token=agk_xxx&model=openai/gpt-4o-mini
//     /#mode=public&appId=app_xxx&endpoint=https://…/v1/chat/completions
// ハッシュはサーバへ送られないため、トークンを載せても通信上は漏れない。
// 反映後はハッシュを消す（履歴や共有時にトークンが残らないように）。
async function applyHash() {
  if (!location.hash || location.hash.length < 2) return;
  const p = new URLSearchParams(location.hash.slice(1));
  if (!["endpoint", "token", "appId", "model", "mode", "system"].some(k => p.has(k))) return;

  const v = store.vault;
  if (v.providers.length === 0) v.providers.push(makeProvider({ name: "Gateway", authMode: "bearer" }));
  const prov = v.providers[0];
  if (v.models.length === 0) v.models.push(makeModel({ name: "モデル", providerId: prov.id, supportsImages: true }));
  const model = v.models.find(m => m.providerId === prov.id) || v.models[0];

  if (p.has("endpoint")) prov.endpoint = p.get("endpoint");
  if (p.has("model")) { model.modelString = p.get("model"); if (!v.settings.defaultModelId) v.settings.defaultModelId = model.id; }
  if (p.has("token")) { prov.apiKey = p.get("token"); prov.authMode = p.get("mode") || "bearer"; }
  else if (p.has("appId")) { prov.apiKey = p.get("appId"); prov.authMode = p.get("mode") || "public"; }
  else if (p.has("mode")) prov.authMode = p.get("mode");
  if (p.has("system") && p.get("system")) {
    const sp = makeSystemPrompt({ title: "リンクから設定", body: p.get("system") });
    v.systemPrompts.push(sp);
    v.settings.defaultSystemPromptId = sp.id;
  }

  history.replaceState(null, "", location.pathname + location.search);
  await store.persist();
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
    $("main").innerHTML = '<div class="panel"><div class="sect"><h3>起動できませんでした</h3>'
      + '<p class="small muted">' + esc(e.message) + '</p>'
      + '<p class="small muted">保存データを復号できない場合は、ブラウザのサイトデータを削除すると初期状態から再開できます。</p></div></div>';
    return;
  }

  await applyHash();

  $("menuBtn").onclick = () => openDrawer(!$("drawer").classList.contains("open"));
  $("scrim").onclick = () => openDrawer(false);
  $("settingsBtn").onclick = () => onNav(needsSetup() ? "onboard" : "settings");

  if (needsSetup()) ctx.view = "onboard";
  else { const c = store.vault.conversations[0] || store.newConversation(); ctx.activeConvId = c.id; }

  refreshAll();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
}

function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function attr(s){return (s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;");}

boot();
