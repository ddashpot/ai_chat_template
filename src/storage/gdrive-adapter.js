import { StorageAdapter } from "./storage-interface.js";

// 利用者自身の Google OAuth クライアント ID を使い、Drive の appDataFolder に
// 暗号化 vault(vault.json) を保存する。GIS(トークン)方式・スコープは drive.appdata。
// 前提: OAuth は http(s) オリジン必須（file:// 不可）。localhost 等で配信すること。
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const FILE_NAME = "vault.json";
const GIS_SRC = "https://accounts.google.com/gsi/client";

let gisLoaded = null;
function loadGIS() {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (window.google && google.accounts) return resolve();
    const s = document.createElement("script");
    s.src = GIS_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Identity Services を読み込めません"));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

export class GDriveAdapter extends StorageAdapter {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.token = null;
    this.fileId = null;
  }

  async ensureToken(interactive = true) {
    if (this.token) return this.token;
    if (!this.clientId) throw new Error("Google OAuth クライアント ID が未設定です");
    await loadGIS();
    return await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp && resp.access_token) { this.token = resp.access_token; resolve(this.token); }
          else reject(new Error("アクセストークンを取得できませんでした"));
        }
      });
      client.requestAccessToken({ prompt: interactive ? "" : "none" });
    });
  }

  async _headers() { return { Authorization: "Bearer " + (await this.ensureToken()) }; }

  async _findFile() {
    const url = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=" +
      encodeURIComponent("name='" + FILE_NAME + "'") + "&fields=files(id,name)";
    const res = await fetch(url, { headers: await this._headers() });
    if (!res.ok) throw new Error("Drive 検索に失敗: " + res.status);
    const data = await res.json();
    this.fileId = (data.files && data.files[0]) ? data.files[0].id : null;
    return this.fileId;
  }

  async load() {
    await this._findFile();
    if (!this.fileId) return null;
    const res = await fetch("https://www.googleapis.com/drive/v3/files/" + this.fileId + "?alt=media",
      { headers: await this._headers() });
    if (!res.ok) throw new Error("Drive 読込に失敗: " + res.status);
    return await res.json();
  }

  async save(envelope) {
    const body = JSON.stringify(envelope);
    if (!this.fileId) await this._findFile();
    if (this.fileId) {
      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files/" + this.fileId + "?uploadType=media",
        { method: "PATCH", headers: { ...(await this._headers()), "Content-Type": "application/json" }, body });
      if (!res.ok) throw new Error("Drive 更新に失敗: " + res.status);
    } else {
      const boundary = "-------chatapp" + Date.now();
      const meta = { name: FILE_NAME, parents: ["appDataFolder"] };
      const multipart =
        "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(meta) + "\r\n--" + boundary +
        "\r\nContent-Type: application/json\r\n\r\n" + body + "\r\n--" + boundary + "--";
      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        { method: "POST", headers: { ...(await this._headers()), "Content-Type": "multipart/related; boundary=" + boundary }, body: multipart });
      if (!res.ok) throw new Error("Drive 作成に失敗: " + res.status);
      this.fileId = (await res.json()).id;
    }
  }

  async clear() {
    if (!this.fileId) await this._findFile();
    if (this.fileId) {
      await fetch("https://www.googleapis.com/drive/v3/files/" + this.fileId,
        { method: "DELETE", headers: await this._headers() });
      this.fileId = null;
    }
  }

  meta() { return { kind: "gdrive", label: "Google ドライブ (appDataFolder)" }; }
}
