// スキーマ定義とデータモデルのファクトリ。将来のマイグレーションのため schemaVersion を持つ。
export const SCHEMA_VERSION = 1;

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
      guardrail: { enabled: false, rules: [] },
      webSearch: false // Web検索（Google検索グラウンディング）。gemini 系モデルのみ有効
    },
    providers,
    models,
    systemPrompts: (config && config.defaultSystemPrompts) ? config.defaultSystemPrompts.map(makeSystemPrompt) : [],
    conversations: [],
    artifacts: []
  };
}

// スキーマ移行のフック（今は v1 のみ）。
export function migrate(vault) {
  if (!vault.schemaVersion) vault.schemaVersion = SCHEMA_VERSION;
  if (vault.settings && vault.settings.webSearch === undefined) vault.settings.webSearch = false;
  return vault;
}
