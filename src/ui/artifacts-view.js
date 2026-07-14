import { store } from "../core/store.js";

export function renderArtifacts(el) {
  const draw = () => {
    const arts = store.vault.artifacts;
    el.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>アーティファクト</h2></div>
        <div class="art-list">
          ${arts.map(a => `
            <div class="art-card">
              <div class="art-meta"><strong>${esc(a.title)}</strong>
                <span class="muted">${esc(a.language || a.type)}</span>
                <button class="btn danger sm" data-del="${a.id}">削除</button></div>
              <pre class="code"><code>${esc(a.content)}</code></pre>
            </div>`).join("") || '<p class="muted">保存されたアーティファクトはありません</p>'}
        </div>
      </div>`;
    el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { await store.removeArtifact(b.dataset.del); draw(); });
  };
  draw();
}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
