// app.config.js を読み込み、既定値とマージして返す。
import appConfig from "../../app.config.js";

const FALLBACK = {
  appName: "Chat Playground",
  theme: "default",
  defaultProviders: [],
  defaultModels: [],
  defaultSystemPrompts: [],
  features: { streaming: true, artifacts: true, camera: true, gdrive: true },
  artifactAutoExtract: true,
  encryptionMode: "auto",
  storageDefault: "local"
};

export function getConfig() {
  return { ...FALLBACK, ...(appConfig || {}), features: { ...FALLBACK.features, ...((appConfig || {}).features || {}) } };
}
