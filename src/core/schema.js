// スキーマ定義とデータモデルのファクトリ。将来のマイグレーションのため schemaVersion を持つ。
export const SCHEMA_VERSION = 2;

export function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function now() { return new Date().toISOString(); }

export function makeProvider({ name = "New Provider", endpoint = "", authMode = "raw", customHeaderName = "", apiKey = "" } = {}) {
  return { id: uid("prov"), name, endpoint, authMode, customHeaderName, apiKey };
}

export function makeModel({ name = "New Model", modelString = "", providerId = "", supportsImages = false, params = {} } = {}) {
  return { id: uid("model"), name, modelString, providerId, supportsImages, params };
}

export function makeSystemPrompt({ title = "Untitled", body = "", isDefault = false } = {}) {
  return { id: uid("sp"), title, body, isDefault };
}

export function makeConversation({ title = "New chat", modelId = "" } = {}) {
  const ts = now();
  return { id: uid("conv"), title, modelId, systemPromptId: "", createdAt: ts, updatedAt: ts, messages: [] };
}

export function makeMessage({ role = "user", content = "", attachments = [] } = {}) {
  return { role, content, attachments, createdAt: now() };
}

export function makeArtifact({ conversationId = "", type = "code", title = "Artifact", content = "", language = "" } = {}) {
  return { id: uid("art"), conversationId, type, title, content, language, createdAt: now() };
}

// 復号後にメモリで保持する vault の初期形。
export function defaultVault(config) {
  const providers = (config && config.defaultProviders) ? config.defaultProviders.map(makeProvider) : [];
  // defaultModels の provider（name 参照）を生成済み provider の id に解決する
  const models = (config && config.defaultModels) ? config.defaultModels.map(m => {
    const prov = providers.find(p => p.name === m.provider) || providers[0];
    return makeModel({ ...m, providerId: prov ? prov.id : "" });
  }) : [];
  const defModel = (config && config.defaultModels)
    ? models[config.defaultModels.findIndex(m => m.isDefault)] || models[0]
    : null;
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      storage: (config && config.storageDefault) || "local",
      theme: (config && config.theme) || "default",
      defaultModelId: defModel ? defModel.id : "",
      defaultSystemPromptId: "",
      googleClientId: "",
      encryptionMode: (config && config.encryptionMode) || "auto", // auto | passphrase
      guardrail: { enabled: false, rules: [] }
    },
    providers,
    models,
    systemPrompts: (config && config.defaultSystemPrompts) ? config.defaultSystemPrompts.map(makeSystemPrompt) : [],
    conversations: [],
    artifacts: []
  };
}

// スキーマ移行のフック。config を渡すと既定モデルの補完も行う。
export function migrate(vault, config) {
  if (!vault.schemaVersion) vault.schemaVersion = 1;

  if (vault.schemaVersion < 2) {
    // v1→v2: app.config.js の defaultProviders と同じ endpoint を持つ既存接続先の
    // 認証方式を追従させる（Gateway は raw → bearer に変更された。raw のまま
    // だと Bearer プレフィックスなしで送られ、ゲートウェイが missing_token を返す）。
    const defaults = (config && config.defaultProviders) || [];
    for (const p of vault.providers || []) {
      const def = defaults.find(d => d.endpoint === p.endpoint);
      if (def && p.authMode === "raw" && def.authMode !== "raw" && !p.customHeaderName) {
        p.authMode = def.authMode;
      }
    }
    vault.schemaVersion = 2;
  }

  // モデル未登録の vault に defaultModels を補完する（バージョン非依存の修復）。
  if (config && config.defaultModels && (vault.models || []).length === 0 && (vault.providers || []).length > 0) {
    vault.models = config.defaultModels.map(m => {
      const prov = vault.providers.find(p => p.name === m.provider) || vault.providers[0];
      return makeModel({ ...m, providerId: prov ? prov.id : "" });
    });
    if (!vault.settings.defaultModelId && vault.models[0]) {
      const idx = config.defaultModels.findIndex(m => m.isDefault);
      vault.settings.defaultModelId = (vault.models[idx] || vault.models[0]).id;
    }
  }

  return vault;
}
