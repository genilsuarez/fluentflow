# Reglas del Codebase

Antes de proponer soluciones o crear specs, explorar el código existente.

## Stack y Arquitectura

- React 18 + TypeScript strict + Vite + Vitest
- Pure CSS con BEM (NO Tailwind, NO CSS modules)
- Design tokens: `--lp-*` prefix (Learn Platform) — warm editorial palette shared with LearnHub & LyricFlow
- Typography: Newsreader (display/serif) + Manrope (body/UI) + JetBrains Mono (code)
- Zustand para estado global con persistencia
- TanStack Query para data fetching
- Fuse.js para búsqueda fuzzy
- Lucide React para iconos
- Zod + React Hook Form para validación
- Custom i18n (src/utils/i18n.ts) para internacionalización
- Contenido en JSON: `public/data/` por niveles CEFR (A1-C2)
- GitHub Actions → GitHub Pages
- Playwright MCP para análisis UI/UX (headless)
- Chrome DevTools MCP para debugging técnico (network, console, performance)
- Context7 MCP para documentación actualizada de librerías (React, Vite, TanStack Query, Zustand, Zod, etc.)

## Context7 — Documentación de librerías

Usar Context7 cuando necesites documentación actualizada o ejemplos de código de cualquier librería del stack. Evita hallucinations y APIs desactualizadas.

**Cuándo usar:**

- Consultar API de TanStack Query, Zustand, Zod, React Hook Form, Vite, Vitest, Playwright
- Verificar sintaxis o configuración de una versión específica
- Generar código con APIs correctas y actualizadas

**Cómo usar:**

1. `resolve-library-id` — busca el ID de la librería (ej: `/tanstack/query`, `/colinhacks/zod`)
2. `query-docs` — trae la documentación relevante para tu query

**Ejemplo:**

```
resolve-library-id: libraryName="TanStack Query", query="useQuery options"
query-docs: libraryId="/tanstack/query", query="useQuery options and staleTime"
```

**Regla**: Usar Context7 proactivamente para cualquier librería del stack antes de generar código que dependa de su API.

## Browser tools — Cuándo usar cada una

| Necesidad                | Herramienta     | Tools clave                                                       |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| Validar UI post-deploy   | Playwright      | `browser_navigate`, `browser_snapshot`, `browser_take_screenshot` |
| Recorrer módulos/flujos  | Playwright      | `browser_click`, `browser_wait_for`, `browser_snapshot`           |
| Screenshots comparativos | Playwright      | `browser_take_screenshot`                                         |
| Network debugging        | Chrome DevTools | `list_network_requests`, `get_network_request`                    |
| Console logs/errores     | Chrome DevTools | `list_console_messages`, `get_console_message`                    |
| Performance/Lighthouse   | Chrome DevTools | `lighthouse_audit`, `performance_start_trace`                     |
| Offline/service worker   | Chrome DevTools | `emulate` (networkConditions)                                     |

Regla: Playwright primero para UI/UX. Chrome DevTools solo para debugging técnico de bajo nivel.

## Inyectar estado en el browser del usuario

**Playwright** corre en su propio contexto — su `localStorage` NO es el del usuario. No sirve para esto.

**Chrome DevTools MCP** se conecta al Chrome real del usuario (vía `--remote-debugging-port=9222`) — comparte el mismo localStorage. Usar siempre Chrome DevTools MCP para ejecutar JS en el browser del usuario.

Si Chrome DevTools MCP no está disponible, fallback: crear script en `scripts/tmp/` que use WebSocket CDP directo (`ws://localhost:9222/devtools/page/<id>`) con `Runtime.evaluate` + `Page.reload`.

Ver detalle completo en `docs/browser-localstorage-mcp.md`.

**Script set-progress.js** (`scripts/utils/set-progress.js`) — simular progreso por nivel:

- `--level a2` → completa A1+A2 (91 módulos) → desbloquea B1 como NEXT
- `--level b1` → completa A1+A2+B1 → desbloquea B2
- `--reset` → borra todo el progreso
- `--dry` → muestra qué módulos se marcarían sin ejecutar
- Modifica `progress-storage`, `user-storage` y `app-storage` en localStorage

## Progression System — Quick Reference

The module progression uses a DAG (prerequisites graph). Key files:

| Concern                                                          | File                                              |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| Service (unlock logic, next module)                              | `src/services/progressionService.ts`              |
| Cloud sync (Zustand ↔ Supabase ↔ v1 projection)                 | `src/services/syncEngine.ts`                      |
| Shared merge helpers (remote progress + activity)                  | `src/services/progressMerge.ts`                   |
| Auth bridge (lp-login + Supabase)                                | `src/services/authSetup.ts`                       |
| Hook (React integration, dev mode bypass)                        | `src/hooks/useProgression.ts`                     |
| Main Menu (flat grid, `currentModuleId` & `highlightedModuleId`) | `src/components/ui/MainMenu.tsx`                  |
| Progression View (unit accordion, `--next` class)                | `src/components/ui/ProgressionDashboard.tsx`      |
| Card component                                                   | `src/components/ui/ModuleCard.tsx`                |
| Card styles (light/dark, `--current`, `--next-recommended`)      | `src/styles/components/module-card.css`           |
| Progression view styles (`--next`, `--unlocked`, `--locked`)     | `src/styles/components/progression-dashboard.css` |
| Module data (prerequisites, units)                               | `public/data/learningModules.json`                |

### How "next recommended" works

1. `progressionService.getNextAvailableModules()` → all unlocked + not-completed modules
2. `getNextRecommendedModule()` sorts by unit (asc), then by prerequisite count (asc), picks first
3. Since the sort is not stable beyond those two criteria, **array order in learningModules.json is the tiebreaker**

### Visual indicators

| Class                                     | Where                | Behavior                                          |
| ----------------------------------------- | -------------------- | ------------------------------------------------- |
| `module-card--current`                    | MainMenu flat grid   | Persistent blue glow on the next-recommended card |
| `module-card--next-recommended`           | MainMenu flat grid   | Temporary 2.5s pulse animation (scroll-to)        |
| `progression-dashboard__module--next`     | ProgressionDashboard | Persistent highlight + "Sig."/"Next" badge        |
| `progression-dashboard__module--unlocked` | ProgressionDashboard | All unlocked cards show ▶️ icon + visible border  |

### Common confusion: "two active cards"

Multiple modules can be `unlocked` simultaneously (parallel prerequisite chains).
All unlocked modules show the ▶️ icon and active border — but only ONE gets the "SIG." badge.
This is correct behavior, not a bug. The prerequisite graph has parallel branches
(e.g. idioms chain vs phrasal verbs chain are independent).

### developmentMode

When `developmentMode: true` (settingsStore), `canAccessModule()` and `getModuleStatus()` return
`unlocked` for ALL modules regardless of prerequisites. This does NOT change which module is
"next recommended" — `getNextAvailableModules()` still filters by the real prerequisite graph.

## Shared platform scripts (public/)

Copied from `Learn/scripts/` — keep in sync on auth/theme/login changes:

| File | Role |
|------|------|
| `public/lp-login.js` | Login modal; Header calls `lpLogin.open()` |
| `public/lp-guest-reset.js` | Guest logout + cross-tab reset |
| `public/lp-platform-urls.js` | Cross-app hrefs (mirrored by `platformUrls.ts`) |
| `public/lp-nav-active.css` | Imported in `src/index.css` — side menu active item |

**About modal:** React-only via `CompactAbout.tsx` — vanilla apps use `lp-about.js`.

**Side menu active styles:** do not duplicate in `header.css` — use `lp-nav-active.css`.

## Antes de cualquier cambio

1. Leer `src/styles/design-system/tokens.css` para design tokens (--lp-\*)
2. Leer `src/types/index.ts` para interfaces existentes
3. Revisar `src/styles/` para patrones BEM
4. Revisar `src/components/` para componentes reutilizables
5. Revisar `src/stores/` para estado global
6. Revisar `public/data/` para estructura de datos JSON

## Reglas

- Extender interfaces existentes (BaseLearningData, FlashcardData, etc.), no crear nuevas
- Seguir nomenclatura BEM: Block\_\_Element--Modifier
- Usar librerías ya instaladas, no proponer nuevas sin verificar
- Datos configurables desde JSON, no hardcodear valores
- Respetar estructura de scripts: build, development, git, validation, utils
- No modificar: configuración esbuild CSS, estructura de datos JSON, arquitectura BEM

## Ejecución de comandos

- **CRÍTICO**: SIEMPRE crear scripts en `scripts/` para cualquier invocación de node/python. Sin excepciones.
- NUNCA ejecutar directamente en la terminal:
  - `node -e "..."` o `node -p "..."` (ni siquiera una línea)
  - `node --check archivo.js` o `node --syntax-check` (crear script wrapper)
  - `node archivo.js` con argumentos complejos
  - `python -c "..."` o `python3 -c "..."`
  - `npx`, `tsx`, `ts-node` con código inline
  - Loops, pipes, subshells, one-liners con lógica
  - Cualquier comando con template literals, comillas anidadas o interpolación
  - `jq`, `sed`, `awk` con expresiones complejas
  - Heredocs (`cat > file << 'EOF'`, `cat << EOF`) — sobrepasan el buffer de la shell y fallan
  - Cualquier forma de escribir archivos desde la shell (`cat >`, `echo >`, `printf >`) — usar siempre las herramientas de escritura de archivos del IDE (fsWrite, strReplace, etc.)
- **Comandos permitidos directamente** (no requieren script):
  - `npm run <script>` (scripts ya definidos en package.json)
  - `wc -l`, `cat`, `ls`, `find` (comandos simples sin lógica)
  - `git` commands simples (status, add, commit, push)
- La terminal tiene limitaciones de contexto y falla con comandos complejos
- Los scripts son reproducibles, debuggeables y evitan errores de ventana de contexto
- **Scripts temporales** (auditorías, fixes, análisis one-off) → crear en `scripts/tmp/`
  - Esta carpeta está en `.gitignore` — no se commitean ni ensucian el historial
  - Ejecutar con `node scripts/tmp/nombre.js`
- **Scripts permanentes** (validación, build, utils) → crear en `scripts/` o subcarpetas correspondientes
- **Regla de oro**: Si necesitas ejecutar código JS/Python, SIEMPRE crear un archivo en `scripts/` (o `scripts/tmp/` si es temporal). Sin excepciones.

## Scripts de validación

| Comando                           | Descripción                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run validate:all`            | Validaciones base: data-paths + BEM                                                 |
| `npm run validate:full`           | Base + analyze-unused + deep-analysis (47 pasadas)                                  |
| `npm run validate:content`        | Validación profunda de contenido JSON (300+ módulos)                                |
| `npm run validate:content:errors` | Solo errores de contenido                                                           |
| `npm run analyze:unused`          | 17 pasadas: archivos huérfanos, exports muertos, CSS sin uso, BEM, !important audit |
| `npm run analyze:deep`            | DA+DB+DC (30 pasadas): CSS quality, cross-file, JSON integrity                      |
| `npm run analyze:deep:da`         | Solo DA-1..DA-10: propiedades duplicadas, @keyframes, :root vars, reglas vacías     |
| `npm run analyze:deep:db`         | Solo DB-1..DB-10: var() sin definición, CSS huérfanos, timers, storage              |
| `npm run analyze:deep:dc`         | Solo DC-1..DC-10: integridad JSON, prerequisites, schema, progresión                |

Ejecutar `npm run validate:full` después de cambios CSS o refactoring significativo.

---

# Reglas CSS

Este proyecto usa esbuild (integrado en Vite) para minificación CSS. No agregar PostCSS, cssnano ni autoprefixer.

## Benchmark (Feb 2026)

| Herramienta | Bundle | Gzip    | Build |
| ----------- | ------ | ------- | ----- |
| esbuild     | 283 KB | 36.8 KB | 9s    |
| cssnano     | 420 KB | 53.6 KB | 19s   |

## Configuración actual

```typescript
// config/vite.config.ts
build: {
  cssMinify: 'esbuild',
  cssCodeSplit: true,
}
css: {
  devSourcemap: mode === 'development',
  modules: false  // Pure BEM
}
```

## Prohibiciones

- No agregar PostCSS ni postcss.config.js
- No usar cssnano (produce bundles más grandes con BEM)
- No instalar autoprefixer (Vite ya maneja vendor prefixes)

## Antes de cambiar configuración CSS

Hacer build antes y después, comparar tamaños. Si empeora, revertir.

**Corrección (2026-07-23)**: "Vite ya maneja vendor prefixes" (línea de arriba) es impreciso — esbuild minifica pero no auto-agrega prefijos `-webkit-` faltantes como sí hace autoprefixer con browserslist. Se encontraron y corrigieron gaps reales (`-webkit-backdrop-filter`, `-webkit-appearance`, `-webkit-user-select`) que causaban bugs visuales en Safari. Seguir agregando prefijos manualmente al escribir CSS con propiedades WebKit-sensibles.

# Detección de navegador embebido (Cursor IDE, preview de dispositivo)

`src/utils/cursorBrowserDetection.ts` detecta si la app corre dentro del preview de dispositivo móvil de Cursor IDE (via `navigator.userAgent` matcheando `Cursor/`) y agrega la clase `.browser-cursor-embedded` a `<html>`.

**Por qué existe**: el preview móvil de Cursor simula un dispositivo con home-indicator (estilo iPhone X+) y dibuja esa barra encima de la página. `game-controls.css` y `unified-filter.css` usan la clase `.browser-cursor-embedded` para levantar los controles fijos por encima de esa zona.

**Causa raíz real (confirmada en vivo con devtools de Cursor, 2026-07-23)**: el resto de la app ya reserva espacio para el home-indicator de un iPhone real usando `env(safe-area-inset-bottom)` — el mecanismo estándar del navegador (ver `padding-bottom: max(var(--game-controls-bar-padding-y), env(safe-area-inset-bottom))` más abajo en `game-controls.css`). El dispositivo simulado de Cursor dibuja una barra tipo home-indicator, pero su viewport simulado **no alimenta un `env(safe-area-inset-bottom)` correspondiente** — confirmado con `getBoundingClientRect()`: `.game-controls` quedaba exactamente al ras (`bottom === innerHeight`, cero espacio), consistente con que ese env() resuelve a `0` en Cursor.

**Historial de valores (documentado para no repetir el ciclo)**:

1. `52px` — valor original heredado, nunca verificado. Dejaba una franja vacía visible (confirmado en vivo) → **incorrecto, de más**.
2. `0px` — corregido tras confirmar que la franja estaba vacía. Pero luego, en otra vista (ejercicio de lectura/matching), los íconos de la barra de controles aparecieron cortados por el bisel real de Cursor (confirmado en vivo, con captura) → **incorrecto, de menos**.
3. `34px` — valor actual. En vez de adivinar un tercer número, se usó la constante real de Apple para el alto del home-indicator en iPhone X+ (34pt, documentado en el HIG) como fallback de lo que `env(safe-area-inset-bottom)` debería haber dado. Pendiente de confirmar en vivo si es exacto — es una estimación principiada (basada en un valor real de Apple), no una medición directa de Cursor, porque `env()` no se puede leer con JS para comparar.

**Se mantiene la detección** (no se borró `cursorBrowserDetection.ts`) — pero **no cambiar este valor sin una razón medida o principiada, no una adivinanza**. Este patrón (hardcode de navegador/host sin verificar) ya causó el bug original de Safari (`safariDetection.ts`, eliminado — ver más abajo) y dos de los tres intentos de este mismo valor. Antes de tocarlo: pedir una medición en vivo (devtools de Cursor → `getBoundingClientRect()` del elemento afectado) en vez de asumir.

**Single source of truth**: el valor vive en un solo lugar — `html.browser-cursor-embedded { --cursor-preview-chrome-bottom: 34px; }` en `game-controls.css`. El JS (`cursorBrowserDetection.ts`) solo decide **si** el entorno aplica, nunca el pixel value.

**Por qué no se mide dinámicamente con `window.visualViewport`**: según MDN, `visualViewport` no refleja overlays dibujados por un host que embebe la página (iframe/webview) — devolvería el mismo valor que `innerHeight` sin importar si hay o no un toolbar real. No sirve como sustituto de verificar en vivo.

**No extender a Claude Code**: el Browser pane de Claude Code (`mcp__Claude_Browser__*`) tampoco tiene overlay — a 375×812, `innerHeight`, `visualViewport.height`, `outerHeight` y `screen.height` coinciden exactos. No agregar `Claude/` a la detección sin un overlay real y medido primero — evita repetir el mismo error de sobre-generalizar detección de navegador que causó el bug original de Safari (ver historial de `safariDetection.ts`, eliminado — el sniffing de UA debe ser el último recurso, no el primero, y todo valor que dependa de él debe verificarse en vivo, no asumirse).
