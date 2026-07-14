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
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      storage: (config && config.storageDefault) || "local",
      theme: (config && config.theme) || "default",
      defaultModelId: "",
      defaultSystemPromptId: "",
      googleClientId: "",
      encryptionMode: (config && config.encryptionMode) || "auto", // auto | passphrase
      guardrail: { enabled: false, rules: [] }
    },
    providers: (config && config.defaultProviders) ? config.defaultProviders.map(makeProvider) : [],
    models: [],
    systemPrompts: (config && config.defaultSystemPrompts) ? config.defaultSystemPrompts.map(makeSystemPrompt) : [],
    conversations: [],
    artifacts: []
  };
}

// スキーマ移行のフック（今は v1 のみ）。
export function migrate(vault) {
  if (!vault.schemaVersion) vault.schemaVersion = SCHEMA_VERSION;
  return vault;
}
