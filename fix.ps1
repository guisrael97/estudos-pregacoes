$ErrorActionPreference = "Stop"

# Fix build.js
$file = "c:\Users\Gustavo\OneDrive\Documentos\New project\scripts\build.js"
$lines = [System.IO.File]::ReadAllLines($file)
$lines[239] = '  if (!items.length) return ''<p class="muted">—</p>'';'
$lines[266] = '  if (!groups.some((group) => stripHeadingNumber(group.title).toLowerCase() === "implícitas" || stripHeadingNumber(group.title).toLowerCase() === "implicitas")) {'
$lines[269] = '        <div class="mini-label">Implícitas</div>'
$lines[270] = '        <p class="muted">—</p>'
$lines[300] = '          const anchorResult = extractLabelValue(lines, /^\*\*Âncora bíblica:\*\*\s*/i);'
$lines[303] = '          lines = keyResult.lines.filter((line) => !/^Uma frase forte da pregação foi:?$/i.test(line));'
$lines[313] = '                  <div class="mini-label">Âncora</div>'
$lines[314] = '                  <div class="mini-text">${anchorResult.value || "—"}</div>'
$lines[322] = '                <div class="mini-text">${teaching || "—"}</div>'
$lines[349] = '  if (title.includes("referências bíblicas") || title.includes("referencias biblicas")) {'
$lines[357] = '  if (title.includes("mapa bíblia") || title.includes("mapa biblia")) {'
$lines[365] = '  return `<div class="prose${title.includes("tese central") || title.includes("oração") || title.includes("oracao") ? " lead" : ""} study-content">`'
$lines[374] = '  if (title.includes("tese central") || title.includes("oração") || title.includes("oracao")) classes.push("section-thesis");'
$lines[375] = '  if (title.includes("aplicações") || title.includes("aplicacoes") || title.includes("ações práticas") || title.includes("acoes praticas")) classes.push("section-action");'

[System.IO.File]::WriteAllLines($file, $lines, [System.Text.Encoding]::UTF8)

# Fix markdown files
$mdfiles = @(
  "c:\Users\Gustavo\OneDrive\Documentos\New project\studies\2026-05-03.md",
  "c:\Users\Gustavo\OneDrive\Documentos\New project\studies\2026-05-02.md",
  "c:\Users\Gustavo\OneDrive\Documentos\New project\studies\2026-04-19.md"
)
foreach ($md in $mdfiles) {
  if (Test-Path $md) {
    $content = [System.IO.File]::ReadAllText($md, [System.Text.Encoding]::UTF8)
    $content = $content -replace '## Mapa Bíblia para sermão', '## Mapa Bíblia -> Sermão'
    [System.IO.File]::WriteAllText($md, $content, [System.Text.Encoding]::UTF8)
  }
}

Write-Output "Fix concluído."
