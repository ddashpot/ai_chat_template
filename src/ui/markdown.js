// 安全な軽量 Markdown レンダラ。生 HTML は実行せず、必ずエスケープしてから整形する。
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// コードフェンス ```lang\n...\n``` を抽出して {html, artifacts} を返す。
export function renderMarkdown(md) {
  const artifacts = [];
  const blocks = [];
  let idx = 0;
  // フェンスを退避
  const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;
  let text = md.replace(fenceRe, (m, lang, code) => {
    const language = (lang || "").trim();
    artifacts.push({ language, content: code.replace(/\n$/, "") });
    const token = "\u0000CODE" + (idx++) + "\u0000";
    blocks.push({ token, language, code: code.replace(/\n$/, "") });
    return token;
  });

  text = escapeHtml(text);

  // 見出し
  text = text.replace(/^######\s?(.*)$/gm, "<h6>$1</h6>")
             .replace(/^#####\s?(.*)$/gm, "<h5>$1</h5>")
             .replace(/^####\s?(.*)$/gm, "<h4>$1</h4>")
             .replace(/^###\s?(.*)$/gm, "<h3>$1</h3>")
             .replace(/^##\s?(.*)$/gm, "<h2>$1</h2>")
             .replace(/^#\s?(.*)$/gm, "<h1>$1</h1>");
  // 太字・斜体・インラインコード
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
             .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
             .replace(/`([^`\n]+)`/g, "<code>$1</code>");
  // リンク
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // 箇条書き
  text = text.replace(/^(?:- |\* )(.*)$/gm, "<li>$1</li>");
  text = text.replace(/(<li>[\s\S]*?<\/li>)/g, m => "<ul>" + m + "</ul>");
  // 段落・改行
  text = text.split(/\n{2,}/).map(p => {
    if (/^\s*<(h\d|ul|pre|blockquote)/.test(p)) return p;
    if (p.includes("\u0000CODE")) return p;
    return "<p>" + p.replace(/\n/g, "<br>") + "</p>";
  }).join("\n");

  // コードフェンスを戻す
  for (const b of blocks) {
    const pre = '<pre class="code"><div class="code-head"><span>' + escapeHtml(b.language || "code") +
      '</span><button class="copy-btn" type="button">copy</button></div><code>' +
      escapeHtml(b.code) + "</code></pre>";
    text = text.replace(b.token, pre);
  }
  return { html: text, artifacts };
}
