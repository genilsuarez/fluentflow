# FluentFlow

English learning app (CEFR A1-C2) — React 18, TypeScript, Pure CSS/BEM.

**Live**: https://genilsuarez.github.io/fluentflow/

## Stack

React 18 · TypeScript strict · Vite + esbuild · Zustand · TanStack Query · Zod · Fuse.js · Custom i18n · Vitest · GitHub Actions → GitHub Pages

## Features

10 learning modes (Flashcards, Quiz, Completion, Sorting, Matching, Reading, Reordering, Transformation, Word Formation, Error Correction) · 276 modules · Dark/light theme · Offline mode · Progress tracking · Bilingual EN/ES · CEFR A1-C2

## Setup

```bash
git clone https://github.com/genilsuarez/fluentflow.git && cd fluentflow
npm install && npm run dev
```

## Commands

| Category | Command | Description |
|----------|---------|-------------|
| Dev | `npm run dev` | Dev server |
| Build | `npm run build` | Production build |
| Test | `npm test` | 4 files, 55 tests, ~2s |
| Lint | `npm run lint` | ESLint |
| Format | `npm run format` | Prettier |
| Types | `npm run type-check` | TypeScript check |
| Validate | `npm run validate:all` | Data + BEM validations |
| Validate Full | `npm run validate:full` | All validations (47 passes) |
| CSS | `npm run validate:bem` | BEM validation |
| Unused | `npm run analyze:unused` | 17 passes: orphans, dead exports, CSS |
| Deep | `npm run analyze:deep` | 30 passes: CSS quality, cross-file, JSON |
| Modules | `npm run audit:modules` | Module audit |
| Clean | `npm run clean` | Cleanup build artifacts |
| Security | `npm run security:audit` | Dependency audit |
| Security Scan | `npm run security:scan` | Dangerous patterns scan |
| Build Full | `npm run build:full` | Pull + quality + security + build + push + deploy |
| Commit | `npm run commit:push` | Stage all + smart commit + push |
| Monitor | `npm run gh:status` | GitHub Actions status |
| Watch | `npm run gh:watch` | Monitor workflows in real time |
| Deploy | `npm run deploy:status` | Deployment status |
| Pipeline | `npm run pipeline` | Interactive pipeline |

## Structure

```
config/          5 files (vite, vitest, tsconfig, eslint, .env)
src/             components/ hooks/ services/ stores/ styles/ types/ utils/
public/data/     Learning content JSON by CEFR level (A1-C2)
scripts/         5 dirs: build, development, git, validation, utils
tests/           setup.ts + 4 test files (api-service, progressionService, offlineManager, useOfflineStatus)
```

## Architecture

- Pure CSS/BEM — no Tailwind, no utility classes
- esbuild CSS minification (33% smaller than cssnano for BEM)
- No PostCSS, no autoprefixer (Vite handles it)
- Data-driven: all content in `public/data/` JSON, no external APIs
- CSS variables for light/dark theming
