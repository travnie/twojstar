const MAX_PAGES = 500;
const MAX_TEXT_CHARS = 5_000_000;

function xmlEscape(value) {
  const source = String(value ?? "");
  let clean = "";
  for (let index = 0; index < source.length; index += 1) {
    const codePoint = source.codePointAt(index);
    if (codePoint > 0xffff) index += 1;
    const valid = codePoint === 0x9
      || codePoint === 0xa
      || codePoint === 0xd
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (valid) clean += String.fromCodePoint(codePoint);
  }
  return clean
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function bookmarkName(title, index) {
  const base = String(title || "bookmark")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^([^A-Za-z_])/, "_$1")
    .slice(0, 28) || "bookmark";
  return `${base}_${index + 1}`;
}

function destinationY(target) {
  if (target?.kind !== "page") return null;
  const type = target.view?.type || "Fit";
  const args = target.view?.args || [];
  const value = type === "XYZ"
    ? args[1]
    : type === "FitH" || type === "FitBH"
      ? args[0]
      : type === "FitR"
        ? args[3]
        : null;
  return Number.isFinite(value) ? Number(value) : null;
}

function outlinePage(item) {
  if (item?.target?.kind === "page" && Number.isInteger(item.target.pageIndex)) {
    return item.target.pageIndex;
  }
  for (const child of item?.children || []) {
    const pageIndex = outlinePage(child);
    if (Number.isInteger(pageIndex)) return pageIndex;
  }
  return null;
}

function flattenOutline(outline) {
  const result = [];
  let serial = 0;
  const visit = (items, depth) => {
    for (const item of items || []) {
      const pageIndex = outlinePage(item);
      if (Number.isInteger(pageIndex)) {
        result.push({
          title: String(item.title || "Untitled bookmark"),
          depth: Math.min(6, Math.max(1, depth + 1)),
          pageIndex,
          y: item.target?.kind === "page" ? destinationY(item.target) : null,
          name: bookmarkName(item.title, serial++),
        });
      }
      visit(item.children || [], depth + 1);
    }
  };
  visit(outline || [], 0);
  return result;
}

function pushLine(lines, current) {
  const text = current?.parts?.join("").trim();
  if (text) lines.push({ text, y: current.y });
}

function extractLines(textContent) {
  const lines = [];
  let current = null;
  let forceNew = false;

  for (const item of textContent?.items || []) {
    if (!item || typeof item.str !== "string" || !item.str) continue;
    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = Number(transform[4] ?? 0);
    const y = Number(transform[5] ?? 0);
    const fontSize = Math.max(1, Math.abs(Number(transform[3] ?? item.height ?? 10)));
    const width = Math.max(0, Number(item.width ?? 0));
    const tolerance = Math.max(2, fontSize * 0.45);
    const needsNew = forceNew
      || (current && Math.abs(y - current.y) > tolerance)
      || !current;

    if (needsNew) {
      pushLine(lines, current);
      current = { y, parts: [], lastEnd: null, fontSize };
      forceNew = false;
    }

    const gap = current.lastEnd === null ? 0 : x - current.lastEnd;
    const text = item.str;
    if (
      current.parts.length
      && gap > Math.max(1.5, fontSize * 0.15)
      && !/\s$/.test(current.parts.at(-1))
      && !/^[,.;:!?%)\]}]/.test(text)
    ) {
      current.parts.push(" ");
    }
    current.parts.push(text);
    current.lastEnd = x + width;
    if (item.hasEOL) forceNew = true;
  }

  pushLine(lines, current);
  return lines;
}

function headingParagraph(heading, bookmarkId) {
  const title = xmlEscape(heading.title);
  return `<w:p><w:pPr><w:pStyle w:val="Heading${heading.depth}"/></w:pPr><w:bookmarkStart w:id="${bookmarkId}" w:name="${xmlEscape(heading.name)}"/><w:r><w:t xml:space="preserve">${title}</w:t></w:r><w:bookmarkEnd w:id="${bookmarkId}"/></w:p>`;
}

function bodyParagraph(text) {
  return `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function pageBreakParagraph() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function assignHeadings(lines, headings) {
  const before = new Map();
  const replace = new Map();
  const used = new Set();

  for (const heading of headings) {
    const wanted = normalizeText(heading.title);
    let exactIndex = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (used.has(i)) continue;
      if (normalizeText(lines[i].text) === wanted) {
        exactIndex = i;
        break;
      }
    }

    if (exactIndex >= 0) {
      used.add(exactIndex);
      const list = replace.get(exactIndex) || [];
      list.push(heading);
      replace.set(exactIndex, list);
      continue;
    }

    let insertIndex = 0;
    if (heading.y !== null && lines.length) {
      let bestDistance = Infinity;
      lines.forEach((line, index) => {
        const distance = Math.abs(line.y - heading.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          insertIndex = index;
        }
      });
    }
    const list = before.get(insertIndex) || [];
    list.push(heading);
    before.set(insertIndex, list);
  }
  return { before, replace };
}

function documentXml(pages, outline) {
  const headings = flattenOutline(outline);
  const byPage = new Map();
  for (const heading of headings) {
    const list = byPage.get(heading.pageIndex) || [];
    list.push(heading);
    byPage.set(heading.pageIndex, list);
  }

  const body = [];
  let bookmarkId = 1;
  pages.forEach((page, pageIndex) => {
    const pageHeadings = byPage.get(pageIndex) || [];
    const { before, replace } = assignHeadings(page.lines, pageHeadings);

    if (!page.lines.length) {
      for (const heading of pageHeadings) body.push(headingParagraph(heading, bookmarkId++));
    } else {
      page.lines.forEach((line, lineIndex) => {
        for (const heading of before.get(lineIndex) || []) {
          body.push(headingParagraph(heading, bookmarkId++));
        }
        const replacements = replace.get(lineIndex) || [];
        if (replacements.length) {
          for (const heading of replacements) body.push(headingParagraph(heading, bookmarkId++));
        } else {
          body.push(bodyParagraph(line.text));
        }
      });
    }

    if (pageIndex < pages.length - 1) body.push(pageBreakParagraph());
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
}

function stylesXml() {
  const headings = Array.from({ length: 6 }, (_, index) => {
    const level = index + 1;
    return `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="${index}"/></w:pPr></w:style>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${headings}</w:styles>`;
}

function coreXml(metadata) {
  const title = xmlEscape(metadata?.title || "");
  const author = xmlEscape(metadata?.author || "");
  const subject = xmlEscape(metadata?.subject || "");
  const keywords = xmlEscape(metadata?.keywords || "");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator><dc:subject>${subject}</dc:subject><cp:keywords>${keywords}</cp:keywords></cp:coreProperties>`;
}

function zipDocx(files) {
  const zip = globalThis.fflate;
  if (!zip?.zipSync || !zip?.strToU8) throw new Error("ZIP runtime is unavailable.");
  return zip.zipSync(Object.fromEntries(
    Object.entries(files).map(([name, value]) => [name, zip.strToU8(value)]),
  ));
}

export async function convertPdfStateToDocx({ sources, plan, outline, metadata }) {
  if (!Array.isArray(plan) || !plan.length) throw new Error("Open a PDF first.");
  if (plan.length > MAX_PAGES) {
    throw new Error(`PDF → DOCX is limited to ${MAX_PAGES} pages per conversion.`);
  }

  const pages = [];
  let textChars = 0;
  for (let outputIndex = 0; outputIndex < plan.length; outputIndex += 1) {
    const entry = plan[outputIndex];
    const source = sources?.[entry.sourceId];
    if (!source?.pdf) throw new Error("PDF source is no longer available.");
    const page = await source.pdf.getPage(entry.pageIndex + 1);
    const textContent = await page.getTextContent();
    const lines = extractLines(textContent);
    textChars += lines.reduce((sum, line) => sum + line.text.length, 0);
    if (textChars > MAX_TEXT_CHARS) {
      throw new Error("PDF → DOCX text limit exceeded (5,000,000 characters).");
    }
    pages.push({ lines });
  }

  return zipDocx({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    "word/_rels/document.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "word/document.xml": documentXml(pages, outline),
    "word/styles.xml": stylesXml(),
    "docProps/core.xml": coreXml(metadata),
  });
}
