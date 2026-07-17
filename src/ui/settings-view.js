import { store } from "../core/store.js";
import { makeProvider, makeModel } from "../core/schema.js";
import { testConnection, endpointHost } from "../providers/provider-client.js";
import { getConfig } from "../core/config.js";
import { toast } from "./toast.js";

export function renderSettings(el, ctx) {
  const cfg = getConfig();
  const ex = cfg.examples || {};

  const draw = () => {
    const v = store.vault;
    const s = v.settings;
    const incomplete = v.providers.filter(p => !p.endpoint || !p.apiKey);

    el.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h2>設定</h2></div>
      <p class="panel-lead">接続先・モデル・保存先。トークンは暗号化してこの端末にだけ残ります。</p>

      ${incomplete.length ? `<div class="note warn" style="margin-bottom:14px">
        <strong>${incomplete.length} 件の接続先が未完成です。</strong>
        エンドポイントとトークンの両方を入れると送信できるようになります。</div>` : ""}

      <section class="sect">
        <h3>接続先</h3>
        <p class="sect-lead">OpenAI 互換の <code>/v1/chat/completions</code> を持つゲートウェイ</p>
        <div id="provList"></div>
        <button id="addProv" class="btn">＋ 接続先を追加</button>
      </section>

      <section class="sect">
        <h3>モデル</h3>
        <p class="sect-lead">ゲートウェイに渡す model 文字列と、その表示名</p>
        <div id="modelList"></div>
        <button id="addModel" class="btn">＋ モデルを追加</button>
      </section>

      <section class="sect">
        <h3>データの保存先</h3>
        <p class="sect-lead">会話・接続先・アーティファクトの置き場所</p>
        <label class="inline"><input type="radio" name="stor" value="local" ${s.storage === "local" ? "checked" : ""}> この端末 (IndexedDB)</label>
        <label class="inline"><input type="radio" name="stor" value="gdrive" ${s.storage === "gdrive" ? "checked" : ""}> Google ドライブ (appDataFolder)</label>
        <div class="field" style="margin-top:12px">
          ${store.hasRuntimeClientId()
            ? '<div class="note">Google OAuth クライアント ID はデプロイ設定から読み込み済みです。</div>'
            : '<label for="gid">Google OAuth クライアント ID</label><input id="gid" class="mono" value="' + attr(s.googleClientId) + '" placeholder="xxxx.apps.googleusercontent.com"><p class="small muted" style="margin:0">承認済み JavaScript 生成元に、このアプリの配信元 URL を登録してください。</p>'}
        </div>
      </section>

      <section class="sect">
        <h3>暗号化</h3>
        <p class="sect-lead" style="margin:0">現在のモード: <strong>${s.encryptionMode === "passphrase" ? "パスフレーズ（起動ごとに入力）" : "自動（端末に非抽出鍵を保持）"}</strong>。
        いずれも AES-GCM の実暗号化です。切り替えは <code>app.config.js</code> の <code>encryptionMode</code> で行います。</p>
      </section>

      <section class="sect">
        <h3>ガードレール</h3>
        <p class="sect-lead">送信前・受信後にテキストを検査するフック（現在は枠のみ）</p>
        <label class="inline"><input type="checkbox" id="grd" ${s.guardrail.enabled ? "checked" : ""}> 有効にする</label>
      </section>

      <section class="sect">
        <h3>バックアップ</h3>
        <p class="sect-lead">トークンを含む全データを平文 JSON で書き出します。取り扱いに注意してください。</p>
        <button id="exp" class="btn">書き出す</button>
        <button id="imp" class="btn">読み込む</button>
        <input id="impFile" type="file" accept="application/json" hidden>
      </section>
    </div>`;

    // ---- providers ----
    const pl = el.querySelector("#provList");
    pl.innerHTML = v.providers.map(p => `
      <div class="row-card">
        <div class="field"><label>名前</label>
          <input class="pv-name" data-id="${p.id}" value="${attr(p.name)}" placeholder="Gateway"></div>
        <div class="field"><label>エンドポイント</label>
          <input class="pv-ep mono" data-id="${p.id}" value="${attr(p.endpoint)}" spellcheck="false" autocapitalize="off"
                 placeholder="${attr(ex.endpoint || "https://example.com/v1/chat/completions")}"></div>
        <div class="grid2">
          <div class="field"><label>認証方式</label>
            <select class="pv-auth" data-id="${p.id}">
              <option value="bearer" ${p.authMode === "bearer" ? "selected" : ""}>Authorization: Bearer &lt;トークン&gt;</option>
              <option value="raw" ${p.authMode === "raw" ? "selected" : ""}>Authorization: &lt;トークン&gt;</option>
              <option value="custom" ${p.authMode === "custom" ? "selected" : ""}>独自ヘッダ</option>
            </select></div>
          <div class="field"><label>ヘッダ名（独自の場合）</label>
            <input class="pv-hdr mono" data-id="${p.id}" value="${attr(p.customHeaderName)}" placeholder="x-api-key"></div>
        </div>
        <div class="field"><label>トークン</label>
          <div class="with-btn">
            <input class="pv-key mono" data-id="${p.id}" type="password" value="${attr(p.apiKey)}"
                   spellcheck="false" autocapitalize="off" placeholder="${attr(ex.apiKey || "agk_…")}">
            <button class="btn pv-eye" data-id="${p.id}" type="button">表示</button>
          </div></div>
        <div class="row-actions">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <button class="btn sm pv-test" data-id="${p.id}">接続をテスト</button>
            <span class="test-out muted" data-out="${p.id}"></span>
          </div>
          <button class="btn danger sm" data-delp="${p.id}">削除</button>
        </div>
      </div>`).join("") || '<p class="muted small">接続先がありません。「＋ 接続先を追加」から登録してください。</p>';

    bind(pl, ".pv-name", "name"); bind(pl, ".pv-ep", "endpoint");
    bind(pl, ".pv-hdr", "customHeaderName"); bind(pl, ".pv-key", "apiKey");
    pl.querySelectorAll(".pv-auth").forEach(x => x.onchange = () => store.updateProvider(x.dataset.id, { authMode: x.value }));
    pl.querySelectorAll(".pv-eye").forEach(b => b.onclick = () => {
      const i = pl.querySelector('.pv-key[data-id="' + b.dataset.id + '"]');
      const shown = i.type === "text"; i.type = shown ? "password" : "text"; b.textContent = shown ? "表示" : "隠す";
    });
    pl.querySelectorAll(".pv-test").forEach(b => b.onclick = async () => {
      const p = store.vault.providers.find(x => x.id === b.dataset.id);
      const m = store.vault.models.find(x => x.providerId === p.id);
      const out = pl.querySelector('[data-out="' + p.id + '"]');
      out.className = "test-out muted"; out.textContent = "テスト中…";
      if (ctx) ctx.setStatus("wait");
      const r = await testConnection({ provider: p, modelString: m ? m.modelString : "" });
      out.className = "test-out " + (r.ok ? "ok" : "ng");
      out.textContent = r.message; out.title = r.message;
      if (ctx) ctx.setStatus(r.ok ? "ok" : "ng");
    });
    pl.querySelectorAll("[data-delp]").forEach(b => b.onclick = async () => {
      const p = store.vault.providers.find(x => x.id === b.dataset.delp);
      if (!confirm(`接続先「${p.name}」を削除します。${endpointHost(p.endpoint)} への設定とトークンが消えます。`)) return;
      await store.removeProvider(b.dataset.delp); toast("接続先を削除しました"); draw();
    });

    // ---- models ----
    const ml = el.querySelector("#modelList");
    ml.innerHTML = v.models.map(m => `
      <div class="row-card">
        <div class="grid2">
          <div class="field"><label>表示名</label>
            <input class="md-name" data-id="${m.id}" value="${attr(m.name)}" placeholder="Gemini 2.5 Flash"></div>
          <div class="field"><label>接続先</label>
            <select class="md-prov" data-id="${m.id}">
              ${v.providers.map(p => `<option value="${p.id}" ${m.providerId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
            </select></div>
        </div>
        <div class="field"><label>model 文字列</label>
          <input class="md-str mono" data-id="${m.id}" value="${attr(m.modelString)}" spellcheck="false"
                 placeholder="${attr(ex.modelString || "provider/model-name")}"></div>
        <div class="row-actions">
          <div>
            <label class="inline"><input type="checkbox" class="md-img" data-id="${m.id}" ${m.supportsImages ? "checked" : ""}> 画像を送れる</label>
            <label class="inline"><input type="radio" name="defModel" ${s.defaultModelId === m.id ? "checked" : ""} data-defm="${m.id}"> 既定にする</label>
          </div>
          <button class="btn danger sm" data-delm="${m.id}">削除</button>
        </div>
      </div>`).join("") || '<p class="muted small">モデルがありません。</p>';

    bind(ml, ".md-name", "name", "updateModel"); bind(ml, ".md-str", "modelString", "updateModel");
    ml.querySelectorAll(".md-prov").forEach(x => x.onchange = () => store.updateModel(x.dataset.id, { providerId: x.value }));
    ml.querySelectorAll(".md-img").forEach(x => x.onchange = () => store.updateModel(x.dataset.id, { supportsImages: x.checked }));
    ml.querySelectorAll("[data-defm]").forEach(r => r.onchange = () => { store.updateSettings({ defaultModelId: r.dataset.defm }); if (ctx) ctx.setStatus(ctx.status); });
    ml.querySelectorAll("[data-delm]").forEach(b => b.onclick = async () => { await store.removeModel(b.dataset.delm); toast("モデルを削除しました"); draw(); });

    // ---- storage / guardrail / backup ----
    el.querySelectorAll("[name=stor]").forEach(r => r.onchange = async () => {
      await store.setStorage(r.value);
      toast(r.value === "gdrive" ? "保存先を Google ドライブにしました" : "保存先をこの端末にしました", "success");
    });
    const gidEl = el.querySelector("#gid");
    if (gidEl) gidEl.onchange = e => store.updateSettings({ googleClientId: e.target.value.trim() });
    el.querySelector("#grd").onchange = e => {
      s.guardrail.enabled = e.target.checked; store.updateSettings({ guardrail: s.guardrail });
    };
    el.querySelector("#exp").onclick = () => {
      const blob = new Blob([store.exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "chat-vault-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click(); URL.revokeObjectURL(a.href);
      toast("書き出しました", "success");
    };
    const impFile = el.querySelector("#impFile");
    el.querySelector("#imp").onclick = () => impFile.click();
    impFile.onchange = async () => {
      const f = impFile.files[0]; if (!f) return;
      if (!confirm("読み込むと現在のデータは置き換わります。続けますか。")) return;
      try { await store.importJSON(await f.text()); toast("読み込みました", "success"); draw(); }
      catch (e) { toast("読み込めません: " + e.message, "error"); }
    };

    // 再描画のたびに貼り直す（draw() 内で innerHTML を作り替えるため）
    el.querySelector("#addProv").onclick = async () => {
      await store.addProvider(makeProvider({ name: "新しい接続先", authMode: "bearer" })); draw();
    };
    el.querySelector("#addModel").onclick = async () => {
      const pid = (store.vault.providers[0] || {}).id || "";
      await store.addModel(makeModel({ name: "新しいモデル", providerId: pid })); draw();
    };
  };

  function bind(root, sel, field, method = "updateProvider") {
    root.querySelectorAll(sel).forEach(i => i.onchange = async () => {
      await store[method](i.dataset.id, { [field]: i.value.trim() });
      if (ctx) ctx.setStatus("idle");
    });
  }

  draw();
}
function esc(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function attr(s){return (s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;");}
