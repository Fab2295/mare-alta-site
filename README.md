# Maré Alta — site

Site do jogo **Maré Alta** (iPhone), em **português (BR)**, **English** e **Español**.
Publicado em https://fab2295.github.io/mare-alta-site/

| Idioma | Início | Suporte | Privacidade |
|---|---|---|---|
| pt-BR | `/` | `/suporte/` | `/privacidade/` |
| en | `/en/` | `/en/support/` | `/en/privacy/` |
| es | `/es/` | `/es/soporte/` | `/es/privacidad/` |

## Como funciona

- `src/` é a fonte; `docs/` é o site gerado (o GitHub Pages serve `main` → `/docs`).
- `build.mjs` gera as 9 páginas estáticas a partir de `src/i18n/{pt,en,es}.json`, com `hreflang`, canonical, sitemap e robots.
- Cenário do herói/rodapé: `src/scene.js` (three.js, câmera ortográfica com 5 camadas em parallax, jangada seguindo a onda, noite + estrelas).
- `design-source/` guarda o export original do design (não é publicado).

## Otimizações de memória

- three.js só é baixado (import dinâmico) quando uma cena chega perto da viewport, e é tree-shaken (~540 KB min).
- No máximo uma cena WebGL ativa: ao sair da tela por 4 s, a cena é destruída (texturas, materiais, renderer, `forceContextLoss`).
- Texturas sem mipmaps, sem depth/stencil, DPR limitado a 1,5, bitmap da CPU descartado após o upload à GPU.
- Loop de render só enquanto a cena está visível e a aba ativa; respeita `prefers-reduced-motion` e `saveData`.
- Enquanto o WebGL não sobe (ou falha), as camadas `<img>` estáticas servem de fallback e são removidas do DOM quando o canvas assume.
- Imagens em WebP (telas 924 px), fontes locais só com subset latin (Baloo 2 variável + Shrikhand), ícone pré-renderizado (o SVG original usava `feTurbulence`, caro de rasterizar).

## Desenvolvimento

```bash
npm install
npm run build          # gera docs/
npx serve docs         # ou qualquer servidor estático
```
