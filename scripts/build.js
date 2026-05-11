const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const studiesDir = path.join(root, "studies");
const outputDir = path.join(root, "estudos");
const assetVersion = "2026-05-09-v14";
const bibleBookNames = [
  "1 Samuel",
  "2 Samuel",
  "1 Reis",
  "2 Reis",
  "1 CrÃ´nicas",
  "2 CrÃ´nicas",
  "1 CorÃ­ntios",
  "2 CorÃ­ntios",
  "1 Tessalonicenses",
  "2 Tessalonicenses",
  "1 TimÃ³teo",
  "2 TimÃ³teo",
  "1 Pedro",
  "2 Pedro",
  "1 JoÃ£o",
  "2 JoÃ£o",
  "3 JoÃ£o",
  "GÃªnesis",
  "ÃŠxodo",
  "LevÃ­tico",
  "NÃºmeros",
  "DeuteronÃ´mio",
  "JosuÃ©",
  "JuÃ­zes",
  "Rute",
  "Esdras",
  "Neemias",
  "Ester",
  "JÃ³",
  "Salmos",
  "Salmo",
  "ProvÃ©rbios",
  "Eclesiastes",
  "Cantares",
  "IsaÃ­as",
  "Jeremias",
  "LamentaÃ§Ãµes",
  "Ezequiel",
  "Daniel",
  "Oseias",
  "Joel",
  "AmÃ³s",
  "Obadias",
  "Jonas",
  "Miqueias",
  "Naum",
  "Habacuque",
  "Sofonias",
  "Ageu",
  "Zacarias",
  "Malaquias",
  "Mateus",
  "Marcos",
  "Lucas",
  "JoÃ£o",
  "Atos",
  "Romanos",
  "GÃ¡latas",
  "EfÃ©sios",
  "Filipenses",
  "Colossenses",
  "Tito",
  "Filemom",
  "Hebreus",
  "Tiago",
  "Judas",
  "Apocalipse",
];
const bibleBookPattern = bibleBookNames
  .sort((a, b) => b.length - a.length)
  .map((book) => book.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"))
  .join("|");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readStudies() {
  if (!fs.existsSync(studiesDir)) return [];

  return fs
    .readdirSync(studiesDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const source = fs.readFileSync(path.join(studiesDir, file), "utf8");
      const parsed = parseMarkdownFile(source);
      const slug = parsed.meta.slug || parsed.meta.date || path.basename(file, ".md");

      return {
        ...parsed,
        slug,
        sourceFile: file,
        url: `estudos/${slug}/`,
      };
    })
    .sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}

function parseMarkdownFile(source) {
  const frontMatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontMatter) {
    throw new Error("Cada estudo precisa comecar com front matter entre ---.");
  }

  const meta = parseFrontMatter(frontMatter[1]);
  const body = source.slice(frontMatter[0].length).trim();

  validateMeta(meta);
  const sections = splitSections(body);
  validateStudyShape(meta, sections);

  return {
    meta,
    body,
    sections,
  };
}

function parseFrontMatter(raw) {
  const meta = {};

  raw.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) return;

    const [, key, rawValue] = match;
    meta[key] = parseValue(rawValue.trim());
  });

  return meta;
}

function parseValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => parseValue(item.trim()));
  }

  return value;
}

function validateMeta(meta) {
  ["title", "date", "baseText", "summary"].forEach((key) => {
    if (!meta[key]) {
      throw new Error(`Front matter incompleto: faltou "${key}".`);
    }
  });

  meta.type = meta.type || meta.service;
  if (!meta.type) {
    throw new Error('Front matter incompleto: faltou "type". Use valores como "Domingo", "Chama" ou "Conferencia".');
  }

  meta.service = meta.service || meta.type;
  if (!Array.isArray(meta.tags)) meta.tags = [];
}

function validateStudyShape(meta, sections) {
  const required = [
    "texto base e tema",
    "tese central",
    "caminho da mensagem",
    "mapa biblico da mensagem",
    "verdades para guardar",
    "para praticar na semana",
    "perguntas para meditar",
    "leituras da semana",
    "oracao guiada",
  ];
  const forbidden = [
    "referencias biblicas",
    "fluxo da mensagem",
    "verdades centrais da mensagem",
    "aplicacoes praticas",
    "perguntas para revisao",
    "reflexoes praticas",
    "acoes praticas da semana",
    "frases marcantes da mensagem",
    "diario espiritual",
  ];
  const titles = sections.map((section) => normalizeText(stripHeadingNumber(section.title)));
  const missing = required.filter((title) => !titles.includes(title));
  const legacy = titles.filter((title) => forbidden.includes(title));
  const errors = [];

  if (missing.length) errors.push(`secoes obrigatorias ausentes: ${missing.join(", ")}`);
  if (legacy.length) errors.push(`secoes antigas removidas pelo novo prompt: ${legacy.join(", ")}`);

  const mapSection = findSection(sections, "mapa biblico da mensagem");
  if (mapSection) {
    const points = splitSubsections(mapSection.content.join("\n"));
    if (points.length < 3 || points.length > 5) errors.push(`mapa biblico precisa ter entre 3 e 5 pontos; encontrou ${points.length}`);
    points.forEach((point, index) => {
      ["Ancora biblica", "Ensino", "Aplicacao", "Frase-chave"].forEach((label) => {
        if (!extractNamedLine(point.content, label).value) {
          errors.push(`ponto ${index + 1} do mapa nao tem "${label}"`);
        }
      });
    });
  }

  const truths = countListItems(findSection(sections, "verdades para guardar"));
  if (truths > 5) errors.push(`verdades para guardar deve ter no maximo 5 itens; encontrou ${truths}`);

  const actions = countListItems(findSection(sections, "para praticar na semana"));
  if (actions !== 3) errors.push(`para praticar na semana deve ter exatamente 3 acoes; encontrou ${actions}`);

  const questions = countListItems(findSection(sections, "perguntas para meditar"));
  if (questions !== 3) errors.push(`perguntas para meditar deve ter exatamente 3 perguntas; encontrou ${questions}`);

  const readings = countListItems(findSection(sections, "leituras da semana"));
  if (readings > 4) errors.push(`leituras da semana deve ter no maximo 4 leituras; encontrou ${readings}`);

  const thesis = findSection(sections, "tese central");
  if (thesis) {
    const paragraphs = thesis.content.map((line) => line.trim()).filter(Boolean).length;
    if (paragraphs > 2) errors.push(`tese central deve ter no maximo 2 paragrafos curtos; encontrou ${paragraphs}`);
  }

  const pathSection = findSection(sections, "caminho da mensagem");
  if (pathSection) {
    const text = normalizeText(pathSection.content.join("\n"));
    ["o problema apresentado", "o confronto de deus", "a resposta esperada"].forEach((label) => {
      if (!text.includes(label)) errors.push(`caminho da mensagem nao tem "${label}"`);
    });
  }

  if (errors.length) {
    throw new Error(`Estudo fora do novo padrao editorial (${meta.date} - ${meta.title}):\n- ${errors.join("\n- ")}`);
  }
}

function findSection(sections, normalizedTitle) {
  return sections.find((section) => normalizeText(stripHeadingNumber(section.title)) === normalizedTitle);
}

function countListItems(section) {
  if (!section) return 0;
  return section.content.filter((line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line)).length;
}

function splitSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1].trim(), content: [] };
      return;
    }

    if (!current) {
      current = { title: "Estudo", content: [] };
    }

    current.content.push(line);
  });

  if (current) sections.push(current);
  return sections;
}

function isHorizontalRule(line) {
  return /^-{3,}$/.test(line.trim());
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  }

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }

    if (isHorizontalRule(trimmed)) {
      flushParagraph();
      closeList();
      return;
    }

    const heading = trimmed.match(/^(#{3,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (list !== "ul") {
        closeList();
        list = "ul";
        html.push('<ul class="list">');
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      return;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (list !== "ol") {
        closeList();
        list = "ol";
        html.push('<ol class="list">');
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      return;
    }

    const quote = trimmed.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      return;
    }

    closeList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  closeList();

  return html.join("\n");
}

function inlineMarkdown(text) {
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/\*(.+?)\*/g, "<em>$1</em>");
  escaped = escaped.replace(/`(.+?)`/g, "<code>$1</code>");
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return linkBibleReferences(escaped);
}

function linkBibleReferences(html) {
  let contextBook = "";
  let contextChapter = "";
  let lastWasVerse = false;

  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (!part || part.startsWith("<")) return part;

      return part.replace(
        new RegExp(`(?<![\\p{L}\\d])(${bibleBookPattern})\\s+(\\d+(?::\\d+(?:-\\d+)?)?)|((?:\\s+(?:e|,|;)\\s*|\\s*[,;]\\s*)(\\d+(?::\\d+(?:-\\d+)?)?))`, "giu"),
        (match, book, detail, continuation, continuationDetail) => {
          if (book && detail) {
            contextBook = normalizeBookLabel(book);
            contextChapter = detail.split(":")[0];
            lastWasVerse = detail.includes(":");
            return bibleReferenceMarkup(`${contextBook} ${detail}`, contextBook, match);
          }

          if (continuation && contextBook) {
            const separator = match.slice(0, match.indexOf(continuationDetail));
            let ref;
            if (lastWasVerse && !continuationDetail.includes(":")) {
              ref = `${contextBook} ${contextChapter}:${continuationDetail}`;
            } else {
              ref = `${contextBook} ${continuationDetail}`;
              contextChapter = continuationDetail.split(":")[0];
              lastWasVerse = continuationDetail.includes(":");
            }
            return `${separator}${bibleReferenceMarkup(ref, contextBook, continuationDetail)}`;
          }

          return match;
        }
      );
    })
    .join("");
}

function normalizeBookLabel(book) {
  return book.replace(/\s+/g, " ").trim();
}

function bibleReferenceMarkup(ref, book, label) {
  return `<span class="ref-link" data-ref="${attr(ref)}" data-book="${attr(book)}">${label}</span>`;
}

function stripHeadingNumber(title) {
  return title.replace(/^\d+\.\s*/, "").trim();
}

function splitSubsections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    const heading = line.match(/^###\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1].trim(), content: [] };
      return;
    }

    if (!current) current = { title: "", content: [] };
    current.content.push(line);
  });

  if (current) sections.push(current);
  return sections.filter((section) => section.title || section.content.join("").trim());
}

function linesToListItems(lines) {
  const text = Array.isArray(lines) ? lines.join("\n") : lines;
  const html = markdownToHtml(text.trim());
  const matches = [...html.matchAll(/<p>([\s\S]*?)<\/p>|<li>([\s\S]*?)<\/li>/g)];
  return matches.map((match) => match[1] || match[2]).filter(Boolean);
}

function renderList(items) {
  if (!items.length) return '<p class="muted">â€”</p>';
  return `<ul class="list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function extractLabelValue(lines, labelPattern) {
  const index = lines.findIndex((line) => labelPattern.test(line.trim()));
  if (index === -1) return { value: "", lines };

  const line = lines[index].trim();
  const value = line.replace(labelPattern, "").trim();
  return {
    value: inlineMarkdown(value),
    lines: lines.filter((_, lineIndex) => lineIndex !== index),
  };
}

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\d]+/gu, " ")
    .trim();
}

function extractNamedLine(lines, label) {
  const target = normalizeText(label);
  const index = lines.findIndex((line) => {
    const match = line.trim().match(/^\*\*(.+?):\*\*/);
    return match && normalizeText(match[1]) === target;
  });
  if (index === -1) return { value: "", lines };

  const line = lines[index].trim();
  const value = line.replace(/^\*\*.+?:\*\*\s*/, "").trim();
  return {
    value: inlineMarkdown(value),
    lines: lines.filter((_, lineIndex) => lineIndex !== index),
  };
}

function renderReferencesSection(section) {
  const groups = splitSubsections(section.content.join("\n"));
  const cards = groups.map((group) => {
    const items = linesToListItems(group.content);
    return `
      <div class="mini-card">
        <div class="mini-label">${escapeHtml(stripHeadingNumber(group.title))}</div>
        ${renderList(items)}
      </div>`;
  });

  if (!groups.some((group) => stripHeadingNumber(group.title).toLowerCase() === "implÃ­citas" || stripHeadingNumber(group.title).toLowerCase() === "implicitas")) {
    cards.push(`
      <div class="mini-card">
        <div class="mini-label">ImplÃ­citas</div>
        <p class="muted">â€”</p>
      </div>`);
  }

  return `<div class="refs-grid">${cards.join("\n")}</div>`;
}

function renderFlowSection(section) {
  const steps = splitSubsections(section.content.join("\n"));
  return `
    <div class="flow">
      ${steps
        .map((step, index) => `
          <div class="flow-item">
            <div class="flow-step">Etapa ${index + 1}</div>
            <div class="flow-title">${escapeHtml(stripHeadingNumber(step.title))}</div>
            ${renderList(linesToListItems(step.content))}
          </div>`)
        .join("\n")}
    </div>`;
}

function renderMapSection(section) {
  const points = splitSubsections(section.content.join("\n"));
  return `
    <div class="mapa-stack">
      ${points
        .map((point, index) => {
          const title = stripHeadingNumber(point.title).replace(/^Ponto\s+\d+:\s*/i, "");
          let lines = point.content.map((line) => line.trim()).filter(Boolean);
          const anchorResult = extractNamedLine(lines, "Ancora biblica");
          lines = anchorResult.lines;
          const teachingResult = extractNamedLine(lines, "Ensino");
          lines = teachingResult.lines;
          const applicationResult = extractNamedLine(lines, "Aplicacao");
          lines = applicationResult.lines;
          const keyResult = extractNamedLine(lines, "Frase-chave");
          lines = keyResult.lines.filter((line) => !/^Uma frase forte da pregacao foi:?$/i.test(normalizeText(line)));
          const teaching = teachingResult.value || markdownToHtml(lines.join("\n").trim());

          return `
            <article class="mapa-item">
              <div class="card-eyebrow">Ponto ${index + 1}</div>
              <h3>${escapeHtml(title)}</h3>
              <div class="mapa-grid">
                <div class="mini-card">
                  <div class="mini-label">Âncora</div>
                  <div class="mini-text">${anchorResult.value || "—"}</div>
                </div>
                <div class="mini-card">
                  <div class="mini-label">Aplicação</div>
                  <div class="mini-text">${applicationResult.value || "—"}</div>
                </div>
                <div class="mini-card">
                  <div class="mini-label">Frase-chave</div>
                  <div class="mini-text">${keyResult.value || "—"}</div>
                </div>
              </div>
              <div class="mini-card teaching">
                <div class="mini-label">Ensino</div>
                <div class="mini-text">${teaching || "—"}</div>
              </div>
            </article>`;
        })
        .join("\n")}
    </div>`;
}

function renderReadingsSection(section) {
  const groups = splitSubsections(section.content.join("\n"));
  if (!groups.length || groups.every((group) => !group.title)) return markdownToHtml(section.content.join("\n").trim());

  return `
    <div class="refs-grid">
      ${groups
        .map((group) => `
          <div class="mini-card">
            <div class="mini-label">${escapeHtml(stripHeadingNumber(group.title))}</div>
            ${renderList(linesToListItems(group.content))}
          </div>`)
        .join("\n")}
    </div>`;
}

function renderSectionContent(section) {
  const title = normalizeText(stripHeadingNumber(section.title));

  if (title.includes("referencias biblicas")) {
    return renderReferencesSection(section);
  }

  if (title.includes("fluxo da mensagem")) {
    return renderFlowSection(section);
  }

  if (title.includes("mapa biblico") || title.includes("mapa biblia")) {
    return renderMapSection(section);
  }

  if (title.includes("leituras complementares") || title.includes("leituras da semana")) {
    return renderReadingsSection(section);
  }

  return `<div class="prose${title.includes("tese central") || title.includes("oracao") ? " lead" : ""} study-content">
    ${markdownToHtml(section.content.join("\n").trim())}
  </div>`;
}

function sectionClassFor(section, index) {
  const title = normalizeText(stripHeadingNumber(section.title));
  const classes = ["section"];
  if (index === 0) classes.push("section-anchor");
  if (title.includes("tese central") || title.includes("oracao")) classes.push("section-thesis");
  if (title.includes("para praticar")) classes.push("section-action");
  return classes.join(" ");
}

function renderIndex(studies) {
  const latest = studies[0];
  const years = [...new Set(studies.map((study) => study.meta.date.slice(0, 4)))];
  const months = [...new Set(studies.map((study) => study.meta.date.slice(5, 7)))].sort();
  const types = [...new Set(studies.map((study) => study.meta.type))].sort((a, b) => a.localeCompare(b));
  const studyCards = studies
    .map((study) => {
      const tags = study.meta.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("");
      const preacher = study.meta.preacher ? `<span class="pill">Pregador <strong>${escapeHtml(study.meta.preacher)}</strong></span>` : "";
      const video = study.meta.videoUrl ? `<a class="pill pill-link" href="${attr(study.meta.videoUrl)}" target="_blank" rel="noopener noreferrer">YouTube</a>` : "";
      const metaPills = [
        `<span class="pill">Texto-base <strong>${escapeHtml(study.meta.baseText)}</strong></span>`,
        preacher,
        video,
        tags,
      ]
        .filter(Boolean)
        .join("\n");
      return `
        <article class="summary-card" data-study-card data-title="${attr(study.meta.title)}" data-tags="${attr(study.meta.tags.join(" "))}" data-type="${attr(study.meta.type)}" data-date="${attr(study.meta.date)}" data-preacher="${attr(study.meta.preacher || "")}" data-video-url="${attr(study.meta.videoUrl || "")}">
          <div class="summary-card-top">
            <div>
              <div class="card-eyebrow">${formatDate(study.meta.date)}</div>
              <h2>${escapeHtml(study.meta.title)}</h2>
            </div>
            <span class="date-chip">${escapeHtml(study.meta.type)}</span>
          </div>
          <p class="summary-card-copy">${escapeHtml(study.meta.summary)}</p>
          <div class="summary-card-meta">
            ${metaPills}
          </div>
          <div class="summary-card-actions">
            <a class="btn" href="${study.url}">Abrir estudo</a>
          </div>
        </article>`;
    })
    .join("\n");

  return pageShell({
    title: "Sobre Mesa",
    assetPrefix: "",
    body: `
      <div class="topbar">
        <div class="brand">
          <a href="index.html" class="brand-link">SOBRE MESA</a>
          <button class="pill about-trigger" type="button" data-about-open>Sobre N&oacute;s</button>
        </div>
      </div>

      <header class="hero hero-index">
        <div class="hero-copy">
          <h1 class="hero-title hero-title-brand">SOBRE MESA</h1>
          <p class="hero-subtitle">A &ldquo;sobremesa&rdquo; espiritual da semana: um espa&ccedil;o para saborear, meditar e viver, ao longo dos dias, a Palavra servida &Agrave; Mesa.</p>
          <div class="hero-notes">
            <div class="hero-note"><strong>Total:</strong> ${studies.length} estudo${studies.length === 1 ? "" : "s"} publicado${studies.length === 1 ? "" : "s"}.</div>
            <div class="hero-note"><strong>Mais recente:</strong> ${latest ? `${formatDate(latest.meta.date)} - ${escapeHtml(latest.meta.title)}` : "Nenhum estudo cadastrado."}</div>
          </div>
        </div>
      </header>

      <section class="card filter-card">
        <div class="filter-grid">
          <label class="field">
            <span>Buscar</span>
            <input type="search" data-search placeholder="Tema, titulo ou texto-base" />
          </label>
          <label class="field">
            <span>Tipo</span>
            <select data-type>
              <option value="">Todos</option>
              ${types.map((type) => `<option value="${attr(type)}">${escapeHtml(type)}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Ano</span>
            <select data-year>
              <option value="">Todos</option>
              ${years.map((year) => `<option value="${year}">${year}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Mes</span>
            <select data-month>
              <option value="">Todos</option>
              ${months.map((month) => `<option value="${month}">${monthName(month)}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Ordem</span>
            <select data-order>
              <option value="desc">Mais recentes</option>
              <option value="asc">Mais antigos</option>
            </select>
          </label>
        </div>
      </section>

      <main class="summary-grid" data-study-list>
        ${studyCards || '<div class="card empty-state">Nenhum estudo cadastrado ainda.</div>'}
      </main>
      ${aboutModal()}
      <script>${indexScript()}</script>`,
  });
}

function aboutModal() {
  return `
      <div id="about-modal" class="bible-modal" hidden>
        <div class="bible-modal-overlay" data-about-close></div>
        <div class="bible-modal-content about-modal-content card" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">
          <div class="bible-modal-header">
            <h3 id="about-modal-title">Sobre N&oacute;s</h3>
            <button class="btn btn-ghost" type="button" data-about-close>Fechar</button>
          </div>
          <div class="about-modal-body">
            <p>O Sobre Mesa nasceu com um desejo simples: ajudar a igreja a n&atilde;o apenas ouvir a Palavra, mas viver aquilo que tem sido pregado.</p>
            <p>A cada culto, uma mensagem &eacute; servida. Deus fala, confronta, consola, ensina e direciona. Mas a prega&ccedil;&atilde;o n&atilde;o deve terminar quando o culto acaba. Ela pode, e deve, continuar sendo meditada durante a semana, aplicada nas decis&otilde;es, lembrada nas conversas, praticada no secreto e transformada em obedi&ecirc;ncia no dia a dia.</p>
            <p>Por isso, o Sobre Mesa transforma as prega&ccedil;&otilde;es da igreja A Mesa em estudos pr&aacute;ticos, devocionais e aplic&aacute;veis para a semana.</p>
            <p>Aqui, cada mensagem &eacute; organizada em um formato simples e profundo, com resumo da prega&ccedil;&atilde;o, texto-base b&iacute;blico, refer&ecirc;ncias, pontos centrais, aplica&ccedil;&otilde;es pr&aacute;ticas, perguntas de reflex&atilde;o, ora&ccedil;&atilde;o guiada e desafios da semana.</p>
            <p>O nome carrega essa ideia:</p>
            <p class="about-quote">&quot;Depois da Palavra servida, vem o tempo de saborear, meditar e viver.&quot;</p>
            <p>O Sobre Mesa &eacute; a &ldquo;sobremesa&rdquo; espiritual da semana: um espa&ccedil;o para continuar vivendo aquilo que foi servido A Mesa.</p>
            <p>Mais do que uma biblioteca de prega&ccedil;&otilde;es, este app &eacute; uma ferramenta de pr&aacute;tica, reflex&atilde;o e amadurecimento espiritual. Ele existe para qualquer pessoa que deseja sair da posi&ccedil;&atilde;o de apenas ouvinte para come&ccedil;ar a viver, de forma concreta, aquilo que Deus tem falado.</p>
            <p>Porque a Palavra n&atilde;o foi feita apenas para ser escutada. Foi feita para formar, transformar e gerar fruto.</p>
          </div>
        </div>
      </div>`;
}

function renderStudy(study, previous, next) {
  const preacher = study.meta.preacher ? `<span class="pill">Pregador <strong>${escapeHtml(study.meta.preacher)}</strong></span>` : "";
  const video = study.meta.videoUrl ? `<a class="pill pill-link" href="${attr(study.meta.videoUrl)}" target="_blank" rel="noopener noreferrer">Ver no YouTube</a>` : "";
  const heroPills = [preacher, video, study.meta.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")]
    .filter(Boolean)
    .join("\n");
  const sections = study.sections
    .map((section, index) => {
      const displayTitle = stripHeadingNumber(section.title);
      const id = slugify(displayTitle);
      return `
        <section class="card ${sectionClassFor(section, index)}" id="${id}" data-section="${id}">
          <h2>${index + 1}) ${escapeHtml(displayTitle)}</h2>
          ${renderSectionContent(section)}
        </section>`;
    })
    .join("\n");

  return pageShell({
    title: `${study.meta.title} - ${formatDate(study.meta.date)}`,
    assetPrefix: "../../",
    body: `
      <div class="reading-progress"><span data-reading-progress></span></div>

      <div class="topbar">
        <div class="brand">
          <a href="../../index.html" class="brand-link">SOBRE MESA</a>
          <span class="badge">${escapeHtml(study.meta.type)}</span>
          <span class="badge">${formatDate(study.meta.date)}</span>
        </div>
        <div class="actions">
          <a class="btn btn-ghost" href="../../index.html">Voltar</a>
        </div>
      </div>

      <header class="hero hero-study">
        <div class="hero-copy">
          <div class="card-eyebrow">Resumo de Estudo</div>
          <h1 class="hero-title">${escapeHtml(study.meta.title)}</h1>
          <p class="hero-subtitle">${escapeHtml(study.meta.summary)}</p>
          <div class="hero-tags">
            ${heroPills}
          </div>
        </div>
      </header>

      <nav class="card toc" aria-label="Navegacao do estudo">
        <div class="toc-title">Navegacao</div>
        <div class="toc-grid">
          ${study.sections
            .map((section) => {
              const displayTitle = stripHeadingNumber(section.title);
              const id = slugify(displayTitle);
              return `<a class="toc-link" href="#${id}" data-section-link="${id}">${escapeHtml(displayTitle)}</a>`;
            })
            .join("")}
        </div>
      </nav>

      <main class="stack">
        ${sections}
      </main>

      <nav class="study-nav" aria-label="Estudos anterior e proximo">
        ${previous ? `<a class="btn btn-ghost" href="../${previous.slug}/">Anterior: ${escapeHtml(previous.meta.title)}</a>` : "<span></span>"}
        ${next ? `<a class="btn" href="../${next.slug}/">Proximo: ${escapeHtml(next.meta.title)}</a>` : "<span></span>"}
      </nav>

      <button class="back-to-top" type="button" data-back-to-top hidden>Topo</button>
      <div class="footer">Conteudo organizado a partir da ministracao - ${formatDate(study.meta.date)}</div>

      ${bibleModal()}
      <script>${studyScript()}</script>`,
  });
}

function pageShell({ title, assetPrefix, body }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${assetPrefix}assets/styles.css?v=${assetVersion}" />
</head>
<body>
  <div class="page-glow page-glow-a"></div>
  <div class="page-glow page-glow-b"></div>
  <div class="container">
    ${body}
  </div>
</body>
</html>
`;
}

function bibleModal() {
  return `
    <div id="bible-modal" class="bible-modal" hidden>
      <div class="bible-modal-overlay" data-bible-close></div>
      <div class="bible-modal-content card">
        <div class="bible-modal-header">
          <h3 id="bible-modal-title">Referencia</h3>
          <button id="bible-modal-close" class="btn btn-ghost" type="button" data-bible-close>Fechar</button>
        </div>
        <div id="bible-modal-body" class="prose">
          <p>Carregando...</p>
        </div>
      </div>
    </div>`;
}

function indexScript() {
  return `
const search = document.querySelector("[data-search]");
const type = document.querySelector("[data-type]");
const year = document.querySelector("[data-year]");
const month = document.querySelector("[data-month]");
const order = document.querySelector("[data-order]");
const list = document.querySelector("[data-study-list]");
const cards = Array.from(document.querySelectorAll("[data-study-card]"));
const aboutModal = document.getElementById("about-modal");
const aboutOpen = document.querySelector("[data-about-open]");
const aboutCloseControls = Array.from(document.querySelectorAll("[data-about-close]"));

function applyFilters() {
  const query = (search.value || "").toLowerCase();
  const selectedType = type.value;
  const selectedYear = year.value;
  const selectedMonth = month.value;
  const direction = order.value;

  cards
    .sort((a, b) => direction === "asc"
      ? a.dataset.date.localeCompare(b.dataset.date)
      : b.dataset.date.localeCompare(a.dataset.date))
    .forEach((card) => list.appendChild(card));

  cards.forEach((card) => {
    const haystack = (
      card.textContent +
      " " +
      card.dataset.title +
      " " +
      card.dataset.tags +
      " " +
      card.dataset.type +
      " " +
      (card.dataset.preacher || "") +
      " " +
      (card.dataset.videoUrl || "")
    ).toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesType = !selectedType || card.dataset.type === selectedType;
    const matchesYear = !selectedYear || card.dataset.date.startsWith(selectedYear);
    const matchesMonth = !selectedMonth || card.dataset.date.slice(5, 7) === selectedMonth;
    card.hidden = !(matchesQuery && matchesType && matchesYear && matchesMonth);
  });
}

[search, type, year, month, order].forEach((control) => control.addEventListener("input", applyFilters));
applyFilters();

function openAboutModal() {
  aboutModal.hidden = false;
  aboutModal.querySelector("[data-about-close]").focus();
}

function closeAboutModal() {
  aboutModal.hidden = true;
  aboutOpen.focus();
}

aboutOpen.addEventListener("click", openAboutModal);
aboutCloseControls.forEach((control) => control.addEventListener("click", closeAboutModal));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !aboutModal.hidden) {
    closeAboutModal();
  }
});
`;
}

function studyScript() {
  return `
const sectionLinks = Array.from(document.querySelectorAll("[data-section-link]"));
const sections = Array.from(document.querySelectorAll("[data-section]"));
const progressBar = document.querySelector("[data-reading-progress]");
const backToTop = document.querySelector("[data-back-to-top]");
const modal = document.getElementById("bible-modal");
const modalTitle = document.getElementById("bible-modal-title");
const modalBody = document.getElementById("bible-modal-body");

function updateProgress() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const pct = max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0;
  if (progressBar) progressBar.style.width = pct + "%";
  if (backToTop) backToTop.hidden = pct < 18;
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const id = entry.target.getAttribute("data-section");
    sectionLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("data-section-link") === id));
  });
}, { rootMargin: "-35% 0px -45% 0px", threshold: 0.1 });

sections.forEach((section) => observer.observe(section));
window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);
updateProgress();

if (backToTop) {
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function normalizeReference(ref) {
  return ref
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");
}
      const bibleBookCodes = {
        "genesis": "gn", "gn": "gn", "exodo": "ex", "ex": "ex", "levitico": "lv", "lv": "lv",
        "numeros": "nm", "nm": "nm", "deuteronomio": "dt", "dt": "dt", "josue": "js", "js": "js",
        "juizes": "jd", "jz": "jd", "rute": "rt", "rt": "rt", "1 samuel": "1sm", "1sm": "1sm",
        "2 samuel": "2sm", "2sm": "2sm", "1 reis": "1kgs", "1rg": "1kgs", "2 reis": "2kgs", "2rg": "2kgs",
        "1 cronicas": "1ch", "1cr": "1ch", "2 cronicas": "2ch", "2cr": "2ch", "esdras": "ezr", "ez": "ezr",
        "neemias": "ne", "ne": "ne", "ester": "et", "et": "et", "jo": "job", "salmos": "ps", "salmo": "ps", "sl": "ps",
        "proverbios": "prv", "pv": "prv", "eclesiastes": "ec", "ec": "ec", "cantares": "so", "ct": "so",
        "isaias": "is", "is": "is", "jeremias": "jr", "jr": "jr", "lamentacoes": "lm", "lm": "lm",
        "ezequiel": "ez", "eze": "ez", "daniel": "dn", "dn": "dn", "oseias": "ho", "os": "ho",
        "joel": "jl", "jl": "jl", "amos": "am", "am": "am", "obadias": "ob", "ob": "ob",
        "jonas": "jn", "jon": "jn", "miqueias": "mi", "mq": "mi", "naum": "na", "na": "na",
        "habacuque": "hk", "hc": "hk", "sofonias": "zp", "sf": "zp", "ageu": "hg", "ag": "hg",
        "zacarias": "zc", "zc": "zc", "malaquias": "ml", "ml": "ml", "mateus": "mt", "mt": "mt",
        "marcos": "mk", "mc": "mk", "lucas": "lk", "lc": "lk", "joao": "jo", "atos": "act", "at": "act",
        "romanos": "rm", "rm": "rm", "1 corintios": "1co", "1co": "1co", "2 corintios": "2co", "2co": "2co",
        "galatas": "gl", "gl": "gl", "efesios": "eph", "ef": "eph", "filipenses": "ph", "fp": "ph",
        "colossenses": "cl", "cl": "cl", "1 tessalonicenses": "1ts", "1ts": "1ts",
        "2 tessalonicenses": "2ts", "2ts": "2ts", "1 timoteo": "1tm", "1tm": "1tm",
        "2 timoteo": "2tm", "2tm": "2tm", "tito": "tt", "tt": "tt", "filemon": "phm", "fm": "phm",
        "hebreus": "hb", "hb": "hb", "tiago": "jm", "tg": "jm", "1 pedro": "1pe", "1pe": "1pe",
        "2 pedro": "2pe", "2pe": "2pe", "1 joao": "1jo", "1jo": "1jo", "2 joao": "2jo", "2jo": "2jo",
        "3 joao": "3jo", "3jo": "3jo", "judas": "jud", "jd": "jud", "apocalipse": "re", "ap": "re"
      };

const bibleCache = new Map();

function bookCode(book) {
  const normalizedBook = book
    .replace(/^([1-3])(?=\\p{L})/u, "$1 ")
    .replace(/\\s+/g, " ");
  return bibleBookCodes[normalizeReference(normalizedBook).toLowerCase()];
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseBibleReference(ref, book) {
  const code = bookCode(book);
  const detail = ref.slice(book.length).trim().match(/^(\\d+)(?::(\\d+)(?:-(\\d+))?)?$/);
  if (!code || !detail) return null;

  return {
    code,
    chapter: Number(detail[1]),
    startVerse: detail[2] ? Number(detail[2]) : null,
    endVerse: detail[3] ? Number(detail[3]) : null
  };
}

async function fetchBibleBook(code) {
  if (bibleCache.has(code)) return bibleCache.get(code);
  const url = "https://raw.githubusercontent.com/MaatheusGois/bible/main/versions/pt-br/acf/" + code + "/" + code + ".json";
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error("Falha ao carregar Biblia");
  const book = await response.json();
  bibleCache.set(code, book);
  return book;
}

async function renderBibleText(ref, book) {
  const parsed = parseBibleReference(ref, book);
  if (!parsed) throw new Error("Referencia invalida");

  const bibleBook = await fetchBibleBook(parsed.code);
  const chapter = bibleBook.chapters[parsed.chapter - 1];
  if (!chapter) throw new Error("Capitulo nao encontrado");

  const startV = parsed.startVerse || 1;
  const endV = parsed.startVerse ? (parsed.endVerse || parsed.startVerse) : chapter.length;
  
  const verses = chapter.slice(startV - 1, endV);
  if (!verses.length) throw new Error("Versiculo nao encontrado");

  return verses
    .map((text, index) => "<p><strong>" + (startV + index) + "</strong> " + escapeText(text) + "</p>")
    .join("");
}

document.addEventListener("click", async (event) => {
  const close = event.target.closest("[data-bible-close]");
  if (close) {
    modal.hidden = true;
    return;
  }

  const link = event.target.closest(".ref-link");
  if (!link) return;

  const ref = link.dataset.ref.trim();
  const book = link.dataset.book.trim();

  modalTitle.textContent = ref;
  modalBody.innerHTML = "<p>Carregando texto biblico...</p>";
  modal.hidden = false;

  try {
    modalBody.innerHTML = await renderBibleText(ref, book);
  } catch (error) {
    modalBody.innerHTML = "<p>Nao conseguimos carregar <strong>" + escapeText(ref) + "</strong> agora.</p>";
  }
});
`;
}

function writeSite(studies) {
  ensureDir(outputDir);

  studies.forEach((study, index) => {
    const previous = studies[index + 1];
    const next = studies[index - 1];
    const dir = path.join(outputDir, study.slug);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, "index.html"), renderStudy(study, previous, next));
  });

  fs.writeFileSync(path.join(root, "index.html"), renderIndex(studies));
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function monthName(value) {
  const names = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Marco",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  };
  return names[value] || value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function attr(value) {
  return escapeHtml(value).replace(/\n/g, " ");
}

const studies = readStudies();
writeSite(studies);
console.log(`Site gerado com ${studies.length} estudo(s).`);
