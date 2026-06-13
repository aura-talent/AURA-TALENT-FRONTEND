/**
 * Minimal, dependency-free markdown → HTML for rendering report/suggestion text
 * in the popup. Escapes HTML first, then handles the subset the backend emits:
 * headings, bold/italic, inline code, links, and unordered/ordered lists.
 */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function renderMarkdown(md) {
  const lines = escapeHtml(md || "").split("\n");
  const out = [];
  
  let listType = null; // 'ul' | 'ol' | null
  let inTable = false;
  let tableHeaderParsed = false;
  let inCodeBlock = false;
  let inBlockquote = false;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
      tableHeaderParsed = false;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      out.push("</blockquote>");
      inBlockquote = false;
    }
  };

  const closeAllBlocks = () => {
    closeList();
    closeTable();
    closeBlockquote();
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // 1. Code Block handling
    const isCodeDelimiter = line.trim().match(/^(\`\`\`|'''|""")(.*)$/);
    if (isCodeDelimiter) {
      closeAllBlocks();
      if (!inCodeBlock) {
        out.push("<pre><code>");
        inCodeBlock = true;
      } else {
        out.push("</code></pre>");
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      out.push(raw);
      continue;
    }

    // 2. Horizontal Rule handling
    if (line.trim().match(/^[-*_]{3,}$/)) {
      closeAllBlocks();
      out.push("<hr />");
      continue;
    }

    // 3. Blockquote handling
    const bqMatch = line.match(/^\s*&gt;\s?(.*)$/);
    if (bqMatch) {
      closeList();
      closeTable();
      if (!inBlockquote) {
        out.push("<blockquote>");
        inBlockquote = true;
      }
      out.push(`<p>${inline(bqMatch[1])}</p>`);
      continue;
    } else {
      closeBlockquote();
    }

    // 4. Table handling
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("|") && trimmedLine.endsWith("|")) {
      closeList();
      
      const cells = trimmedLine.split("|").map(c => c.trim()).slice(1, -1);
      const isSeparator = cells.length > 0 && cells.every(c => c.match(/^:?-+:?$/));
      
      if (isSeparator) {
        if (inTable && !tableHeaderParsed) {
          out.push("</thead><tbody>");
          tableHeaderParsed = true;
        }
        continue;
      }

      if (!inTable) {
        out.push('<table class="md-table"><thead><tr>');
        cells.forEach(cell => {
          out.push(`<th>${inline(cell)}</th>`);
        });
        out.push("</tr>");
        inTable = true;
        tableHeaderParsed = false;
      } else {
        if (!tableHeaderParsed) {
          out.push("</thead><tbody>");
          tableHeaderParsed = true;
        }
        out.push("<tr>");
        cells.forEach(cell => {
          out.push(`<td>${inline(cell)}</td>`);
        });
        out.push("</tr>");
      }
      continue;
    } else {
      closeTable();
    }

    // 5. List handling
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    closeList();

    // 6. Heading handling
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }

    // 7. Regular paragraph
    if (line.trim()) {
      out.push(`<p>${inline(line)}</p>`);
    }
  }

  closeAllBlocks();
  return out.join("\n");
}
