import { store } from "../core/store.js";

export function renderSidebar(el, ctx) {
  const v = store.vault;
  const items = v.conversations.map(c => `
    <div class="conv-item ${c.id === ctx.activeConvId ? "active" : ""}" data-id="${c.id}">
      <span class="conv-title">${escapeHtml(c.title)}</span>
      <button class="conv-del" data-del="${c.id}" title="削除">&times;</button>
    </div>`).join("");

  el.innerHTML = `
    <div class="side-top">
      <button id="newChat" class="side-new">＋ 新規チャット</button>
    </div>
    <div class="conv-list">${items || '<p class="muted">履歴はまだありません</p>'}</div>
    <nav class="side-nav">
      <button data-nav="chat" class="nav-btn ${ctx.view === "chat" ? "on" : ""}">チャット</button>
      <button data-nav="prompts" class="nav-btn ${ctx.view === "prompts" ? "on" : ""}">システムプロンプト</button>
      <button data-nav="artifacts" class="nav-btn ${ctx.view === "artifacts" ? "on" : ""}">アーティファクト</button>
      <button data-nav="settings" class="nav-btn ${ctx.view === "settings" ? "on" : ""}">設定</button>
    </nav>`;

  el.querySelector("#newChat").onclick = () => ctx.onNewChat();
  el.querySelectorAll(".conv-item").forEach(n => {
    n.querySelector(".conv-title").onclick = () => ctx.onOpenConv(n.dataset.id);
  });
  el.querySelectorAll("[data-del]").forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); ctx.onDeleteConv(b.dataset.del); };
  });
  el.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => ctx.onNav(b.dataset.nav));
}
function escapeHtml(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
