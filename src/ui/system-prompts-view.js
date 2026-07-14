import { store } from "../core/store.js";
import { makeSystemPrompt } from "../core/schema.js";

export function renderSystemPrompts(el) {
  const v = store.vault;
  el.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>システムプロンプト</h2>
        <button id="addPrompt" class="btn primary">＋ 追加</button></div>
      <div id="promptList"></div>
    </div>`;
  const list = el.querySelector("#promptList");
  const draw = () => {
    list.innerHTML = store.vault.systemPrompts.map(p => `
      <div class="row-card">
        <input class="pt" data-id="${p.id}" value="${attr(p.title)}" placeholder="タイトル">
        <textarea class="pb" data-id="${p.id}" rows="3" placeholder="本文">${esc(p.body)}</textarea>
        <div class="row-actions">
          <label><input type="radio" name="defPrompt" ${p.isDefault ? "checked" : ""} data-def="${p.id}"> 既定</label>
          <button class="btn danger" data-del="${p.id}">削除</button>
        </div>
      </div>`).join("") || '<p class="muted">プロンプトはまだありません</p>';

    list.querySelectorAll(".pt").forEach(i => i.onchange = () => store.updatePrompt(i.dataset.id, { title: i.value }));
    list.querySelectorAll(".pb").forEach(i => i.onchange = () => store.updatePrompt(i.dataset.id, { body: i.value }));
    list.querySelectorAll("[data-def]").forEach(r => r.onchange = async () => {
      store.vault.systemPrompts.forEach(p => p.isDefault = (p.id === r.dataset.def));
      await store.updateSettings({ defaultSystemPromptId: r.dataset.def });
    });
    list.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { await store.removePrompt(b.dataset.del); draw(); });
  };
  draw();
  el.querySelector("#addPrompt").onclick = async () => { await store.addPrompt(makeSystemPrompt({ title: "新規プロンプト" })); draw(); };
}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function attr(s){return (s||"").replace(/"/g,"&quot;");}
