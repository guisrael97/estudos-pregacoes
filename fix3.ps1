$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding $False

# Fix build.js line 365 and remove BOM
$file = "c:\Users\Gustavo\OneDrive\Documentos\New project\scripts\build.js"
$lines = [System.IO.File]::ReadAllLines($file)
$lines[365] = '  return `<div class="prose${title.includes("tese central") || title.includes("oração") || title.includes("oracao") ? " lead" : ""} study-content">'
[System.IO.File]::WriteAllLines($file, $lines, $Utf8NoBom)

# Remove BOM from markdown files
$mdfiles = @(
  "c:\Users\Gustavo\OneDrive\Documentos\New project\studies\2026-05-03.md",
  "c:\Users\Gustavo\OneDrive\Documentos\New project\studies\2026-05-02.md",
  "c:\Users\Gustavo\OneDrive\Documentos\New project\studies\2026-04-19.md"
)
foreach ($md in $mdfiles) {
  if (Test-Path $md) {
    $content = [System.IO.File]::ReadAllText($md)
    # Re-read raw content in case there are other issues, but actually ReadAllText automatically handles BOM.
    # To be safe, just read and write using the NoBom encoding.
    $text = [System.IO.File]::ReadAllText($md, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($md, $text, $Utf8NoBom)
  }
}

Write-Output "BOM removido e build.js corrigido."
