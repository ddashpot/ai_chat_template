// ============================================================
//  軽量・安全な Markdown → HTML。
//  方針: 先に全体をエスケープし、そのうえで限定的な整形だけ行う（生 HTML は実行しない）。
//  対応: コードブロック / インラインコード / 見出し / 太字 / 斜体 / リンク / 箇条書き / 改行。
// ============================================================

function escapeHTML(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 行内の装飾（コード / 太字 / 斜体 / リンク）。入力は既にエスケープ済み文字列。 */
function inline(text) {
  // インラインコード（最優先）
  text = text.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  // リンク [label](url) — url は http(s) のみ許可
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  // 太字
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // 斜体
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return text;
}

/**
 * Markdown 文字列を安全な HTML に変換して返す。
 * @param {string} src
 * @returns {string}
 */
export function renderMarkdown(src) {
  const source = String(src ?? "");
  const out = [];
  const lines = source.split("\n");
  let i = 0;
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // コードフェンス ``` を検出
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      closeList();
      const lang = escapeHTML(fence[1] || "");
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 閉じフェンスを飛ばす
      const code = escapeHTML(buf.join("\n"));
      out.push(
        `<pre class="code" data-lang="${lang}"><button class="copy" type="button" aria-label="コピー">コピー</button><code>${code}</code></pre>`
      );
      continue;
    }

    // 見出し
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${inline(escapeHTML(h[2]))}</h${level}>`);
      i++;
      continue;
    }

    // 箇条書き（- / * ）
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${inline(escapeHTML(li[1]))}</li>`);
      i++;
      continue;
    }

    // 空行
    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }

    // 通常段落（連続行を <br> で連結）
    closeList();
    const para = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${para.map((l) => inline(escapeHTML(l))).join("<br>")}</p>`);
  }
  closeList();
  return out.join("\n");
}
