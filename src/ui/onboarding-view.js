// 初回セットアップ。利用者が「エンドポイント」と「トークン」を入力し、接続テストしてから使い始める。
// 入力中の値は右のプレビューに実際の fetch 形で反映される（トークンは伏せ字）。
import { store } from "../core/store.js";
import { testConnection } from "../providers/provider-client.js";
import { getConfig } from "../core/config.js";
import { makeProvider, makeModel } from "../core/schema.js";
import { toast } from "./toast.js";

export function renderOnboarding(el, ctx) {
  const cfg = getConfig();
  const v = store.vault;
  if (v.providers.length === 0) v.providers.push(makeProvider({ name: "Gateway", authMode: "bearer" }));
  const prov = v.providers[0];
  if (v.models.length === 0) v.models.push(makeModel({ name: "Gemini 2.5 Flash", modelString: "", providerId: prov.id, supportsImages: true }));
  const model = v.models.find(m => m.providerId === prov.id) || v.models[0];

  const ex = cfg.examples || {};

  el.innerHTML = `
  <div class="onb">
    <h1 class="onb-mark">接続先を登録する</h1>
    <p class="onb-lead">このアプリはデータを持ちません。あなたのゲートウェイに直接つなぎます。
      入力した内容は暗号化してこの端末に保存され、送信先はあなたが指定した URL だけです。</p>

    <div class="step">
      <div class="step-n">01</div>
      <div class="step-b">
        <div class="step-t">エンドポイント</div>
        <div class="step-d">OpenAI 互換の <code>/v1/chat/completions</code> の URL</div>
        <input id="ob-ep" class="mono" value="${attr(prov.endpoint)}" placeholder="${attr(ex.endpoint || "https://example.com/v1/chat/completions")}" spellcheck="false" autocapitalize="off">
      </div>
    </div>

    <div class="step">
      <div class="step-n">02</div>
      <div class="step-b">
        <div class="step-t">トークン</div>
        <div class="step-d">Authorization ヘッダに付けて送ります</div>
        <div class="with-btn">
          <input id="ob-key" class="mono" type="password" value="${attr(prov.apiKey)}" placeholder="${attr(ex.apiKey || "agk_…")}" spellcheck="false" autocapitalize="off">
          <button id="ob-eye" class="btn" type="button">表示</button>
        </div>
        <label class="inline"><input type="checkbox" id="ob-bearer" ${prov.authMode !== "raw" ? "checked" : ""}> <span><code>Bearer</code> を付ける</span></label>
      </div>
    </div>

    <div class="step">
      <div class="step-n">03</div>
      <div class="step-b">
        <div class="step-t">モデル</div>
        <div class="step-d">ゲートウェイに渡す model 文字列</div>
        <input id="ob-model" class="mono" value="${attr(model.modelString)}" placeholder="${attr(ex.modelString || "provider/model-name")}" spellcheck="false" autocapitalize="off">
      </div>
    </div>

    <div class="preview" aria-live="polite">
      <div class="preview-h">送信されるリクエスト</div>
      <pre id="ob-prev"></pre>
    </div>

    <div class="onb-foot">
      <button id="ob-test" class="btn">接続をテスト</button>
      <button id="ob-go" class="btn primary">保存してはじめる</button>
      <span id="ob-out" class="test-out muted"></span>
    </div>
  </div>`;

  const $ = s => el.querySelector(s);
  const ep = $("#ob-ep"), key = $("#ob-key"), ms = $("#ob-model"), bearer = $("#ob-bearer");
  const out = $("#ob-out"), prev = $("#ob-prev");

  const draft = () => ({
    endpoint: ep.value.trim(),
    apiKey: key.value.trim(),
    authMode: bearer.checked ? "bearer" : "raw",
    modelString: ms.value.trim()
  });

  function drawPreview() {
    const d = draft();
    const auth = d.apiKey ? (d.authMode === "bearer" ? "Bearer " + mask(d.apiKey) : mask(d.apiKey)) : "（未入力）";
    prev.innerHTML =
`<span class="c">await</span> fetch(<span class="s">"${esc(d.endpoint || "（エンドポイント未入力）")}"</span>, {
  method: <span class="s">"POST"</span>,
  headers: {
    <span class="k">"Authorization"</span>: <span class="s">"${esc(auth)}"</span>,
    <span class="k">"Content-Type"</span>: <span class="s">"application/json"</span>
  },
  body: JSON.stringify({
    <span class="k">model</span>: <span class="s">"${esc(d.modelString || "（モデル未入力）")}"</span>,
    <span class="k">messages</span>: [{ <span class="k">role</span>: <span class="s">"user"</span>, <span class="k">content</span>: <span class="s">"こんにちは"</span> }]
  })
});`;
  }
  [ep, key, ms].forEach(i => i.oninput = drawPreview);
  bearer.onchange = drawPreview;
  drawPreview();

  $("#ob-eye").onclick = () => {
    const shown = key.type === "text";
    key.type = shown ? "password" : "text";
    $("#ob-eye").textContent = shown ? "表示" : "隠す";
  };

  function validate() {
    const d = draft();
    if (!/^https:\/\/|^http:\/\/localhost/.test(d.endpoint)) return "エンドポイントは https:// で始まる URL を入力してください";
    if (!d.apiKey) return "トークンを入力してください";
    if (!d.modelString) return "model 文字列を入力してください";
    return null;
  }

  async function apply() {
    const d = draft();
    Object.assign(prov, { endpoint: d.endpoint, apiKey: d.apiKey, authMode: d.authMode });
    model.modelString = d.modelString;
    model.providerId = prov.id;
    v.settings.defaultModelId = model.id;
    await store.persist();
  }

  $("#ob-test").onclick = async () => {
    const err = validate();
    if (err) { out.className = "test-out ng"; out.textContent = err; return; }
    const d = draft();
    out.className = "test-out muted"; out.textContent = "テスト中…";
    ctx.setStatus("wait");
    const r = await testConnection({
      provider: { endpoint: d.endpoint, apiKey: d.apiKey, authMode: d.authMode },
      modelString: d.modelString
    });
    out.className = "test-out " + (r.ok ? "ok" : "ng");
    out.textContent = r.message;
    out.title = r.message;
    ctx.setStatus(r.ok ? "ok" : "ng");
  };

  $("#ob-go").onclick = async () => {
    const err = validate();
    if (err) { out.className = "test-out ng"; out.textContent = err; return; }
    await apply();
    toast("接続先を保存しました", "success");
    ctx.onSetupDone();
  };
}

function mask(k) { return k.length <= 10 ? k.slice(0, 2) + "…" : k.slice(0, 6) + "…" + k.slice(-2); }
function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function attr(s) { return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
