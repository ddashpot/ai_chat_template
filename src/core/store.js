// 復号済み vault をメモリ保持し、CRUD と永続化を担うシングルトン。UI へ変更通知する。
import { getConfig } from "./config.js";
import { getAutoKey, deriveKey, encryptJSON, decryptJSON } from "./crypto.js";
import { LocalAdapter } from "../storage/local-adapter.js";
import { GDriveAdapter } from "../storage/gdrive-adapter.js";
import { defaultVault, migrate, makeConversation, makeMessage, makeArtifact } from "./schema.js";
import { runtimeConfig } from "./runtime-config.js";

class Store {
  constructor() {
    this.config = getConfig();
    this.vault = null;
    this.key = null;
    this.adapter = null;
    this.listeners = new Set();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.vault); }

  resolvedGoogleClientId() {
    return runtimeConfig().googleClientId || (this.vault && this.vault.settings.googleClientId) || "";
  }
  hasRuntimeClientId() { return !!runtimeConfig().googleClientId; }
  adapterFor(kind) {
    if (kind === "gdrive") return new GDriveAdapter(this.resolvedGoogleClientId());
    return new LocalAdapter();
  }

  async unlock(passphrase) {
    // まずローカルに保存された envelope を試し、保存先設定に従って本適用する。
    const local = new LocalAdapter();
    const localEnv = await local.load();
    const mode = this.config.encryptionMode;

    // 鍵の準備
    if (mode === "passphrase") {
      const saltB64 = localEnv?._salt || null;
      if (!passphrase) throw new Error("パスフレーズが必要です");
      const { key, salt } = await deriveKey(passphrase, saltB64);
      this.key = key; this._salt = salt;
    } else {
      this.key = await getAutoKey();
    }

    // envelope の読込と復号（保存先は設定値に従う）
    let env = localEnv;
    let vault;
    if (env) {
      vault = migrate(await decryptJSON(env, this.key));
    } else {
      vault = defaultVault(this.config);
    }
    this.vault = vault;

    // 実際の保存先アダプタを確定
    this.adapter = this.adapterFor(vault.settings.storage);
    if (vault.settings.storage === "gdrive") {
      try {
        const remote = await this.adapter.load();
        if (remote) this.vault = migrate(await decryptJSON(remote, this.key));
      } catch (e) { console.warn("Drive 読込スキップ:", e.message); }
    }
    this.emit();
    return this.vault;
  }

  async persist() {
    if (!this.vault || !this.key || !this.adapter) return;
    this.vault.schemaVersion = this.vault.schemaVersion || 1;
    const env = await encryptJSON(this.vault, this.key);
    if (this._salt) env._salt = this._salt; // passphrase モードの salt は平文で保持
    await this.adapter.save(env);
    // ローカルにも常に控えを置く（保存先が Drive でも復号鍵の整合のため）
    if (this.adapter.meta().kind !== "local") {
      try { await new LocalAdapter().save(env); } catch (e) {}
    }
  }

  async setStorage(kind) {
    this.vault.settings.storage = kind;
    this.adapter = this.adapterFor(kind);
    await this.persist();
    this.emit();
  }

  // --- CRUD ---
  get s() { return this.vault.settings; }

  async updateSettings(patch) { Object.assign(this.vault.settings, patch); await this.persist(); this.emit(); }

  async addProvider(p) { this.vault.providers.push(p); await this.persist(); this.emit(); }
  async updateProvider(id, patch) { const x = this.vault.providers.find(p => p.id === id); if (x) Object.assign(x, patch); await this.persist(); this.emit(); }
  async removeProvider(id) { this.vault.providers = this.vault.providers.filter(p => p.id !== id); await this.persist(); this.emit(); }

  async addModel(m) { this.vault.models.push(m); await this.persist(); this.emit(); }
  async updateModel(id, patch) { const x = this.vault.models.find(m => m.id === id); if (x) Object.assign(x, patch); await this.persist(); this.emit(); }
  async removeModel(id) { this.vault.models = this.vault.models.filter(m => m.id !== id); await this.persist(); this.emit(); }

  async addPrompt(p) { this.vault.systemPrompts.push(p); await this.persist(); this.emit(); }
  async updatePrompt(id, patch) { const x = this.vault.systemPrompts.find(s => s.id === id); if (x) Object.assign(x, patch); await this.persist(); this.emit(); }
  async removePrompt(id) { this.vault.systemPrompts = this.vault.systemPrompts.filter(s => s.id !== id); await this.persist(); this.emit(); }

  newConversation(modelId) {
    const c = makeConversation({ modelId: modelId || this.vault.settings.defaultModelId });
    c.systemPromptId = this.vault.settings.defaultSystemPromptId || "";
    this.vault.conversations.unshift(c);
    this.emit();
    return c;
  }
  getConversation(id) { return this.vault.conversations.find(c => c.id === id); }
  async removeConversation(id) { this.vault.conversations = this.vault.conversations.filter(c => c.id !== id); await this.persist(); this.emit(); }
  async renameConversation(id, title) { const c = this.getConversation(id); if (c) { c.title = title; c.updatedAt = new Date().toISOString(); } await this.persist(); this.emit(); }

  async addMessage(convId, msg) {
    const c = this.getConversation(convId);
    if (!c) return;
    c.messages.push(makeMessage(msg));
    c.updatedAt = new Date().toISOString();
    if (c.messages.filter(m => m.role === "user").length === 1 && c.title === "New chat" && msg.role === "user") {
      c.title = (typeof msg.content === "string" ? msg.content : "画像メッセージ").slice(0, 40);
    }
    await this.persist(); this.emit();
  }

  async addArtifact(a) { this.vault.artifacts.unshift(makeArtifact(a)); await this.persist(); this.emit(); }
  async removeArtifact(id) { this.vault.artifacts = this.vault.artifacts.filter(a => a.id !== id); await this.persist(); this.emit(); }

  exportJSON() { return JSON.stringify(this.vault, null, 2); }
  async importJSON(text) { this.vault = migrate(JSON.parse(text)); await this.persist(); this.emit(); }
}

export const store = new Store();
