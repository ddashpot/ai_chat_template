import { store } from "../core/store.js";

const NAV = [
  { id: "chat",      icon: "◆", label: "チャット" },
  { id: "prompts",   icon: "❝", label: "システムプロンプト" },
  { id: "artifacts", icon: "▤", label: "アーティファクト" },
  { id: "settings",  icon: "⚙", label: "設定" }
];

let filter = "";

export function renderSidebar(el, ctx) {
  const v = store.vault;
  const list = v.conversations.filter(c => !filter || c.title.toLowerCase().includes(filter.toLowerCase()));

  const items = list.map(c => `
    <div class="conv-item ${c.id === ctx.activeConvId ? "active" : ""}" data-id="${c.id}">
      <span class="conv-title">${esc(c.title)}</span>
      <button class="conv-btn" data-ren="${c.id}" title="名前を変更">✎</button>
      <button class="conv-btn" data-del="${c.id}" title="削除">✕</button>
    </div>`).join("");

  el.innerHTML = `
    <button id="newChat" class="side-new">＋ 新しいチャット</button>
    ${v.conversations.length > 4 ? `<input id="convSearch" class="side-search" placeholder="履歴を検索" value="${attr(filter)}">` : ""}
    <div class="side-label">履歴 ${v.conversations.length ? "· " + v.conversations.length : ""}</div>
    <div class="conv-list">${items || `<p class="small" style="color:var(--rail-muted);padding:4px 6px">${filter ? "一致する履歴はありません" : "まだ何も話していません"}</p>`}</div>
    <nav class="side-nav">
      ${NAV.map(n => `<button data-nav="${n.id}" class="nav-btn ${ctx.view === n.id ? "on" : ""}"><span class="nb-i">${n.icon}</span>${n.label}</button>`).join("")}
    </nav>`;

  el.querySelector("#newChat").onclick = () => ctx.onNewChat();
  const search = el.querySelector("#convSearch");
  if (search) search.oninput = () => { filter = search.value; renderSidebar(el, ctx); el.querySelector("#convSearch").focus(); };
  el.querySelectorAll(".conv-item").forEach(n => {
    n.querySelector(".conv-title").onclick = () => ctx.onOpenConv(n.dataset.id);
  });
  el.querySelectorAll("[data-ren]").forEach(b => b.onclick = e => { e.stopPropagation(); ctx.onRenameConv(b.dataset.ren); });
  el.querySelectorAll("[data-del]").forEach(b => b.onclick = e => { e.stopPropagation(); ctx.onDeleteConv(b.dataset.del); });
  el.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => ctx.onNav(b.dataset.nav));
}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function attr(s){return (s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;");}
