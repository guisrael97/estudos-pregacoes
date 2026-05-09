# Estudos de Pregacoes

Base estatica para publicar estudos semanais no GitHub Pages.

## Como adicionar um estudo

1. Crie um arquivo Markdown em `studies/` usando a data no nome:

   `studies/2026-05-10.md`

2. Use este formato:

   ```md
   ---
   title: "Titulo do estudo"
   date: "2026-05-10"
   type: "Domingo"
   service: "Culto Noite"
   baseText: "Texto biblico principal"
   summary: "Resumo curto da mensagem."
   tags: ["Tema 1", "Tema 2"]
   ---

   ## Tese central

   Conteudo do estudo...
   ```

3. Gere o site:

   ```bash
   npm run build
   ```

   Se o `npm` nao estiver disponivel no computador, use o Node diretamente:

   ```bash
   node scripts/build.js
   ```

4. Publique no GitHub. O workflow em `.github/workflows/pages.yml` gera e publica o site automaticamente quando houver push na branch `main`.

## Estrutura

- `studies/`: estudos em Markdown.
- `scripts/build.js`: gerador das paginas HTML.
- `assets/styles.css`: tema visual compartilhado.
- `index.html`: indice gerado.
- `estudos/<data>/index.html`: paginas geradas dos estudos.

## Fluxo pelo chat

Quando voce enviar um novo `.md`, o conteudo pode ser revisado, padronizado e gerado por aqui. Se o campo `type` nao vier definido, vamos confirmar se o estudo e de `Domingo`, `Chama`, `Conferencia` ou outro tipo antes de publicar.
