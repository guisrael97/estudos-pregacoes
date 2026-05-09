const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const studiesDir = path.join(root, "studies");
const outputDir = path.join(root, "estudos");
const assetVersion = "2026-05-09-spacing-2";

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

  return {
    meta,
    body,
    sections: splitSections(body),
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
  return escaped;
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
  if (!items.length) return '<p class="muted">—</p>';
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

  if (!groups.some((group) => stripHeadingNumber(group.title).toLowerCase() === "implícitas" || stripHeadingNumber(group.title).toLowerCase() === "implicitas")) {
    cards.push(`
      <div class="mini-card">
        <div class="mini-label">Implícitas</div>
        <p class="muted">—</p>
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
          const anchorResult = extractLabelValue(lines, /^\*\*Âncora bíblica:\*\*\s*/i);
          lines = anchorResult.lines;
          const keyResult = extractLabelValue(lines, /^\*\*Frase-chave:\*\*\s*/i);
          lines = keyResult.lines.filter((line) => !/^Uma frase forte da pregação foi:?$/i.test(line));
          const teaching = markdownToHtml(lines.join("\n").trim());

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
  if (!groups.length) return markdownToHtml(section.content.join("\n").trim());

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
  const title = stripHeadingNumber(section.title).toLowerCase();

  if (title.includes("referências bíblicas") || title.includes("referencias biblicas")) {
    return renderReferencesSection(section);
  }

  if (title.includes("fluxo da mensagem")) {
    return renderFlowSection(section);
  }

  if (title.includes("mapa bíblia") || title.includes("mapa biblia")) {
    return renderMapSection(section);
  }

  if (title.includes("leituras complementares")) {
    return renderReadingsSection(section);
  }

  return `<div class="prose${title.includes("tese central") || title.includes("oração") || title.includes("oracao") ? " lead" : ""} study-content">
    ${markdownToHtml(section.content.join("\n").trim())}
  </div>`;
}

function sectionClassFor(section, index) {
  const title = stripHeadingNumber(section.title).toLowerCase();
  const classes = ["section"];
  if (index === 0) classes.push("section-anchor");
  if (title.includes("tese central") || title.includes("oração") || title.includes("oracao")) classes.push("section-thesis");
  if (title.includes("aplicações") || title.includes("aplicacoes") || title.includes("ações práticas") || title.includes("acoes praticas")) classes.push("section-action");
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
      return `
        <article class="summary-card" data-study-card data-title="${attr(study.meta.title)}" data-tags="${attr(study.meta.tags.join(" "))}" data-type="${attr(study.meta.type)}" data-date="${attr(study.meta.date)}">
          <div class="summary-card-top">
            <div>
              <div class="card-eyebrow">${formatDate(study.meta.date)}</div>
              <h2>${escapeHtml(study.meta.title)}</h2>
            </div>
            <span class="date-chip">${escapeHtml(study.meta.type)}</span>
          </div>
          <p class="summary-card-copy">${escapeHtml(study.meta.summary)}</p>
          <div class="summary-card-meta">
            <span class="pill">Texto-base <strong>${escapeHtml(study.meta.baseText)}</strong></span>
            ${tags}
          </div>
          <div class="summary-card-actions">
            <a class="btn" href="${study.url}">Abrir estudo</a>
          </div>
        </article>`;
    })
    .join("\n");

  return pageShell({
    title: "Base de Estudos de Pregacoes",
    assetPrefix: "",
    body: `
      <div class="topbar">
        <div class="brand">
          <a href="index.html" class="brand-link">Reader</a>
          <span class="badge">Base de Estudos</span>
        </div>
        <div class="actions">
          <a class="btn btn-ghost" href="studies/">Markdown</a>
        </div>
      </div>

      <header class="hero hero-index">
        <div class="hero-copy">
          <div class="card-eyebrow">Estudos semanais</div>
          <h1 class="hero-title">Base de estudos de pregacoes</h1>
          <p class="hero-subtitle">Navegue pelos estudos organizados por data, tema e texto-base.</p>
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
      <script>${indexScript()}</script>`,
  });
}

function renderStudy(study, previous, next) {
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
          <a href="../../index.html" class="brand-link">Reader</a>
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
          <p class="hero-subtitle"><strong>Tese/resumo:</strong> ${escapeHtml(study.meta.summary)}</p>
          <div class="hero-tags">
            ${study.meta.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
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
    const haystack = (card.textContent + " " + card.dataset.title + " " + card.dataset.tags + " " + card.dataset.type).toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesType = !selectedType || card.dataset.type === selectedType;
    const matchesYear = !selectedYear || card.dataset.date.startsWith(selectedYear);
    const matchesMonth = !selectedMonth || card.dataset.date.slice(5, 7) === selectedMonth;
    card.hidden = !(matchesQuery && matchesType && matchesYear && matchesMonth);
  });
}

[search, type, year, month, order].forEach((control) => control.addEventListener("input", applyFilters));
applyFilters();
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

const bookMap = {
  "Apocalipse": "Revelation",
  "Mateus": "Matthew",
  "Joao": "John",
  "João": "John",
  "Hebreus": "Hebrews",
  "Tiago": "James",
  "Romanos": "Romans",
  "Galatas": "Galatians",
  "Gálatas": "Galatians",
  "Filipenses": "Philippians",
  "Salmo": "Psalms",
  "Lucas": "Luke",
  "1 Joao": "1 John",
  "1 João": "1 John",
  "1 Pedro": "1 Peter",
  "2 Corintios": "2 Corinthians",
  "2 Coríntios": "2 Corinthians"
};

const localBible = {
  "Apocalipse 3:14-22": "<p><strong>14</strong> Ao anjo da igreja em Laodiceia escreva: Estas sao as palavras do Amem, a testemunha fiel e verdadeira, o soberano da criacao de Deus. <strong>15</strong> Conheco as suas obras, sei que voce nao e frio nem quente. Melhor seria que voce fosse frio ou quente! <strong>16</strong> Assim, porque voce e morno, nem frio nem quente, estou a ponto de vomita-lo da minha boca. <strong>17</strong> Voce diz: Estou rico, adquiri riquezas e nao preciso de nada. Nao reconhece, porem, que e miseravel, digno de compaixao, pobre, cego e que esta nu. <strong>18</strong> Dou-lhe este conselho: Compre de mim ouro refinado no fogo e voce se tornara rico; compre roupas brancas e vista-se para cobrir a sua vergonhosa nudez; e compre colirio para ungir os seus olhos e poder enxergar. <strong>19</strong> Repreendo e disciplino aqueles que eu amo. Por isso, seja diligente e arrependa-se. <strong>20</strong> Eis que estou a porta e bato. Se alguem ouvir a minha voz e abrir a porta, entrarei e cearei com ele, e ele comigo. <strong>21</strong> Ao vencedor darei o direito de sentar-se comigo em meu trono, assim como eu tambem venci e sentei-me com meu Pai em seu trono. <strong>22</strong> Aquele que tem ouvidos ouca o que o Espirito diz as igrejas.</p>",
  "Apocalipse 2:4-5": "<p><strong>4</strong> Contra voce, porem, tenho isto: voce abandonou o seu primeiro amor. <strong>5</strong> Lembre-se de onde caiu! Arrependa-se e pratique as obras que praticava no principio.</p>",
  "Apocalipse 3:14-17": "<p><strong>14</strong> Ao anjo da igreja em Laodiceia escreva: Estas sao as palavras do Amem, a testemunha fiel e verdadeira, o soberano da criacao de Deus. <strong>15</strong> Conheco as suas obras, sei que voce nao e frio nem quente. Melhor seria que voce fosse frio ou quente! <strong>16</strong> Assim, porque voce e morno, nem frio nem quente, estou a ponto de vomita-lo da minha boca. <strong>17</strong> Voce diz: Estou rico, adquiri riquezas e nao preciso de nada. Nao reconhece, porem, que e miseravel, digno de compaixao, pobre, cego e que esta nu.</p>",
  "Apocalipse 3:15-16": "<p><strong>15</strong> Conheco as suas obras, sei que voce nao e frio nem quente. Melhor seria que voce fosse frio ou quente! <strong>16</strong> Assim, porque voce e morno, nem frio nem quente, estou a ponto de vomita-lo da minha boca.</p>",
  "Mateus 7:21-23": "<p><strong>21</strong> Nem todo aquele que me diz: Senhor, Senhor, entrara no Reino dos ceus, mas apenas aquele que faz a vontade de meu Pai que esta nos ceus. <strong>23</strong> Entao eu lhes direi claramente: Nunca os conheci.</p>",
  "Joao 15:1-8": "<p><strong>1</strong> Eu sou a videira verdadeira, e meu Pai e o agricultor. <strong>4</strong> Permanecam em mim, e eu permanecerei em voces. <strong>5</strong> Eu sou a videira; voces sao os ramos. Se alguem permanecer em mim e eu nele, esse dara muito fruto; pois sem mim voces nao podem fazer coisa alguma.</p>",
  "Hebreus 12:5-11": "<p><strong>6</strong> O Senhor disciplina a quem ama. <strong>11</strong> Nenhuma disciplina parece ser motivo de alegria no momento, mas sim de tristeza. Mais tarde, porem, produz fruto de justica e paz para aqueles que por ela foram exercitados.</p>",
  "Tiago 2:14-26": "<p><strong>26</strong> Assim como o corpo sem espirito esta morto, tambem a fe sem obras esta morta.</p>",
  "1 Joao 5:3": "<p><strong>3</strong> Porque nisto consiste o amor a Deus: em obedecer aos seus mandamentos. E os seus mandamentos nao sao pesados.</p>",
  "2 Corintios 5:14-15": "<p><strong>14</strong> Pois o amor de Cristo nos constrange. <strong>15</strong> E ele morreu por todos para que aqueles que vivem ja nao vivam mais para si mesmos, mas para aquele que por eles morreu e ressuscitou.</p>",
  "Galatas 2:20": "<p><strong>20</strong> Fui crucificado com Cristo. Assim, ja nao sou eu quem vive, mas Cristo vive em mim.</p>",
  "1 Pedro 1:6-9": "<p><strong>7</strong> Assim acontece para que fique comprovado que a fe que voces tem redundara em louvor, gloria e honra na revelacao de Jesus Cristo.</p>",
  "Romanos 12:1-2": "<p><strong>1</strong> Oferecam-se em sacrificio vivo, santo e agradavel a Deus. <strong>2</strong> Nao se amoldem ao padrao deste mundo, mas transformem-se pela renovacao da sua mente.</p>",
  "Lucas 9:23": "<p><strong>23</strong> Se alguem quiser acompanhar-me, negue-se a si mesmo, tome diariamente a sua cruz e siga-me.</p>"
};

function normalizeReference(ref) {
  return ref
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/í/g, "i")
    .replace(/Í/g, "I");
}

document.querySelectorAll(".study-content li, .study-content p, .refs-grid li, .mini-text").forEach((el) => {
  el.innerHTML = el.innerHTML.replace(/\\b((?:[1-3]\\s)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚáéíóúÂÊÔâêôÃÕãõÇç]+)\\s+(\\d+)(?::(\\d+)(?:-(\\d+))?)?/g, (match, book) => {
    if (!bookMap[book] && !bookMap[book.replace(/\\s+/g, " ")]) return match;
    return '<span class="ref-link" data-ref="' + match + '" data-book="' + book + '">' + match + '</span>';
  });
});

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
  const englishBook = bookMap[book] || bookMap[book.replace(/\\s+/g, " ")] || book;
  const query = encodeURIComponent(ref.replace(book, englishBook));

  modalTitle.textContent = ref;
  modalBody.innerHTML = "<p>Carregando texto biblico...</p>";
  modal.hidden = false;

  const localRef = localBible[ref] || localBible[normalizeReference(ref)];
  if (localRef) {
    modalBody.innerHTML = localRef;
    return;
  }

  try {
    const response = await fetch("https://bible-api.com/" + query + "?translation=almeida");
    if (!response.ok) throw new Error("Falha ao buscar referencia");
    const data = await response.json();
    modalBody.innerHTML = data.verses.map((verse) => "<p><strong>" + verse.verse + "</strong> " + verse.text + "</p>").join("");
  } catch (error) {
    modalBody.innerHTML = "<p>Nao conseguimos buscar <strong>" + ref + "</strong> automaticamente agora.</p>";
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
