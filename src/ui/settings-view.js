import { store } from "../core/store.js";
import { makeProvider, makeModel } from "../core/schema.js";

export function renderSettings(el) {
  const draw = () => {
    const v = store.vault;
    const s = v.settings;
    el.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>設定</h2></div>

      <section class="sect">
        <h3>接続先（プロバイダ）</h3>
        <div id="provList"></div>
        <button id="addProv" class="btn">＋ 接続先を追加</button>
      </section>

      <section class="sect">
        <h3>モデル</h3>
        <div id="modelList"></div>
        <button id="addModel" class="btn">＋ モデルを追加</button>
      </section>

      <section class="sect">
        <h3>データ保存先</h3>
        <label class="inline"><input type="radio" name="stor" value="local" ${s.storage==="local"?"checked":""}> ローカル (IndexedDB)</label>
        <label class="inline"><input type="radio" name="stor" value="gdrive" ${s.storage==="gdrive"?"checked":""}> Google ドライブ (appDataFolder)</label>
        <div class="field2">
          ${store.hasRuntimeClientId()
            ? '<div class="locked-note">Google OAuth クライアント ID はデプロイ設定から適用されています。</div>'
            : '<label>Google OAuth クライアント ID</label><input id="gid" value="'+attr(s.googleClientId)+'" placeholder="xxxx.apps.googleusercontent.com"><p class="muted small">承認済み JavaScript 生成元に配信元 URL を登録してください。</p>'}
        </div>
      </section>

      <section class="sect">
        <h3>暗号化</h3>
        <p class="muted small">モード: <strong>${s.encryptionMode==="passphrase"?"パスフレーズ":"自動（非抽出鍵）"}</strong>。
        自動は AES-GCM の非抽出鍵を端末に保持して自動解錠します（難読化ではなく実暗号化）。切替は app.config.js の encryptionMode で行います。</p>
      </section>

      <section class="sect">
        <h3>ガードレール</h3>
        <label class="inline"><input type="checkbox" id="grd" ${s.guardrail.enabled?"checked":""}> 有効化（枠のみ・実処理は未実装）</label>
      </section>

      <section class="sect">
        <h3>バックアップ</h3>
        <button id="exp" class="btn">エクスポート(JSON)</button>
        <button id="imp" class="btn">インポート</button>
        <input id="impFile" type="file" accept="application/json" hidden>
      </section>
    </div>`;

    // providers
    const pl = el.querySelector("#provList");
    pl.innerHTML = v.providers.map(p => `
      <div class="row-card">
        <input class="pv-name" data-id="${p.id}" value="${attr(p.name)}" placeholder="名前">
        <input class="pv-ep" data-id="${p.id}" value="${attr(p.endpoint)}" placeholder="Endpoint">
        <div class="grid2">
          <select class="pv-auth" data-id="${p.id}">
            <option value="raw" ${p.authMode==="raw"?"selected":""}>Authorization 直入れ (Bearer なし)</option>
            <option value="bearer" ${p.authMode==="bearer"?"selected":""}>Bearer 付与</option>
            <option value="custom" ${p.authMode==="custom"?"selected":""}>カスタムヘッダ</option>
          </select>
          <input class="pv-hdr" data-id="${p.id}" value="${attr(p.customHeaderName)}" placeholder="ヘッダ名(custom時)">
        </div>
        <input class="pv-key" data-id="${p.id}" type="password" value="${attr(p.apiKey)}" placeholder="API キー / トークン">
        <div class="row-actions"><button class="btn danger" data-delp="${p.id}">削除</button></div>
      </div>`).join("") || '<p class="muted">接続先がありません</p>';
    bind(pl, ".pv-name", "name"); bind(pl, ".pv-ep", "endpoint");
    bind(pl, ".pv-hdr", "customHeaderName"); bind(pl, ".pv-key", "apiKey");
    pl.querySelectorAll(".pv-auth").forEach(x => x.onchange = () => store.updateProvider(x.dataset.id, { authMode: x.value }));
    pl.querySelectorAll("[data-delp]").forEach(b => b.onclick = async () => { await store.removeProvider(b.dataset.delp); draw(); });

    // models
    const ml = el.querySelector("#modelList");
    ml.innerHTML = v.models.map(m => `
      <div class="row-card">
        <input class="md-name" data-id="${m.id}" value="${attr(m.name)}" placeholder="表示名">
        <input class="md-str" data-id="${m.id}" value="${attr(m.modelString)}" placeholder="model 文字列 (例: google-ai-studio/gemini-2.0-flash)">
        <div class="grid2">
          <select class="md-prov" data-id="${m.id}">
            ${v.providers.map(p => `<option value="${p.id}" ${m.providerId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}
          </select>
          <label class="inline"><input type="checkbox" class="md-img" data-id="${m.id}" ${m.supportsImages?"checked":""}> 画像対応</label>
        </div>
        <div class="row-actions">
          <label class="inline"><input type="radio" name="defModel" ${s.defaultModelId===m.id?"checked":""} data-defm="${m.id}"> 既定</label>
          <button class="btn danger" data-delm="${m.id}">削除</button>
        </div>
      </div>`).join("") || '<p class="muted">モデルがありません</p>';
    bind(ml, ".md-name", "name", "updateModel"); bind(ml, ".md-str", "modelString", "updateModel");
    ml.querySelectorAll(".md-prov").forEach(x => x.onchange = () => store.updateModel(x.dataset.id, { providerId: x.value }));
    ml.querySelectorAll(".md-img").forEach(x => x.onchange = () => store.updateModel(x.dataset.id, { supportsImages: x.checked }));
    ml.querySelectorAll("[data-defm]").forEach(r => r.onchange = () => store.updateSettings({ defaultModelId: r.dataset.defm }));
    ml.querySelectorAll("[data-delm]").forEach(b => b.onclick = async () => { await store.removeModel(b.dataset.delm); draw(); });

    // storage / gdrive / guardrail
    el.querySelectorAll("[name=stor]").forEach(r => r.onchange = () => store.setStorage(r.value));
    const gidEl = el.querySelector("#gid"); if (gidEl) gidEl.onchange = e => store.updateSettings({ googleClientId: e.target.value.trim() });
    el.querySelector("#grd").onchange = e => { s.guardrail.enabled = e.target.checked; store.updateSettings({ guardrail: s.guardrail }); };

    // backup
    el.querySelector("#exp").onclick = () => {
      const blob = new Blob([store.exportJSON()], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "chatapp-vault.json"; a.click();
    };
    const impFile = el.querySelector("#impFile");
    el.querySelector("#imp").onclick = () => impFile.click();
    impFile.onchange = async () => {
      const f = impFile.files[0]; if (!f) return;
      await store.importJSON(await f.text()); draw();
    };
  };

  function bind(root, sel, field, method = "updateProvider") {
    root.querySelectorAll(sel).forEach(i => i.onchange = () => store[method](i.dataset.id, { [field]: i.value }));
  }
  draw();
  el.querySelector("#addProv").onclick = async () => { await store.addProvider(makeProvider({ name: "新規接続先", endpoint: "https://auth-gtw.ddashpot.com/v1/chat/completions" })); draw(); };
  el.querySelector("#addModel").onclick = async () => {
    const pid = store.vault.providers[0]?.id || "";
    await store.addModel(makeModel({ name: "新規モデル", providerId: pid }));
    draw();
  };
}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function attr(s){return (s||"").replace(/"/g,"&quot;");}
