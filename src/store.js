// ============================================================
//  localStorage による設定・会話の保存（MVP は暗号化なし）
//  後続マイルストーンで暗号化 + IndexedDB に差し替える前提の薄い層。
// ============================================================
import config from "../app.config.js";

const SCHEMA_VERSION = 1;
const KEY = "chat-playground/v1";

/** 一意 ID。crypto.randomUUID があれば使う。 */
function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowISO() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...config.defaults },
    conversations: [],
  };
}

/** 保存レコードの健全化（壊れ / 古い形を吸収）。 */
function migrate(raw) {
  if (!raw || typeof raw !== "object") return defaultState();
  const base = defaultState();
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...base.settings, ...(raw.settings || {}) },
    conversations: Array.isArray(raw.conversations) ? raw.conversations : [],
  };
}

export class Store {
  constructor() {
    this.state = defaultState();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      this.state = raw ? migrate(JSON.parse(raw)) : defaultState();
    } catch {
      this.state = defaultState();
    }
    return this.state;
  }

  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("保存に失敗しました:", e);
    }
  }

  // --- 設定 ---
  get settings() {
    return this.state.settings;
  }
  saveSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.persist();
    return this.state.settings;
  }
  /** 最低限の接続設定が揃っているか。 */
  isConfigured() {
    const s = this.state.settings;
    return Boolean((s.endpoint || "").trim() && (s.model || "").trim());
  }

  // --- 会話 ---
  get conversations() {
    return this.state.conversations;
  }
  getConversation(id) {
    return this.state.conversations.find((c) => c.id === id) || null;
  }
  createConversation() {
    const conv = {
      id: uid(),
      title: "新しい会話",
      model: this.state.settings.model || "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      messages: [],
    };
    this.state.conversations.unshift(conv);
    this.persist();
    return conv;
  }
  deleteConversation(id) {
    this.state.conversations = this.state.conversations.filter((c) => c.id !== id);
    this.persist();
  }
  renameConversation(id, title) {
    const c = this.getConversation(id);
    if (!c) return;
    c.title = title.trim() || c.title;
    c.updatedAt = nowISO();
    this.persist();
  }

  // --- メッセージ ---
  addMessage(convId, role, content) {
    const c = this.getConversation(convId);
    if (!c) return null;
    const msg = { role, content, createdAt: nowISO() };
    c.messages.push(msg);
    c.updatedAt = nowISO();
    // 会話を先頭へ（最近更新順）
    this.state.conversations = [c, ...this.state.conversations.filter((x) => x.id !== convId)];
    // 初回 user 発話からタイトル自動生成
    if (c.title === "新しい会話" && role === "user") {
      c.title = content.slice(0, 30).replace(/\s+/g, " ").trim() || c.title;
    }
    this.persist();
    return msg;
  }
  /** ストリーミング中に最後の assistant メッセージを更新する用。 */
  updateLastMessage(convId, content) {
    const c = this.getConversation(convId);
    if (!c || !c.messages.length) return;
    c.messages[c.messages.length - 1].content = content;
    c.updatedAt = nowISO();
    this.persist();
  }
}
