// 画面下中央に短いフィードバックを出す。alert の置き換え。
export function toast(message, kind = "info", ms = 2600) {
  const host = document.getElementById("toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "toast " + (kind === "error" ? "ng" : kind === "success" ? "ok" : "");
  el.textContent = message;
  el.setAttribute("role", "status");
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
