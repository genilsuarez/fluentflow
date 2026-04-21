# Reglas del Codebase

Antes de proponer soluciones o crear specs, explorar el código existente.

## Stack y Arquitectura

- React 18 + TypeScript strict + Vite + Vitest
- Pure CSS con BEM (NO Tailwind, NO CSS modules)
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

| Necesidad | Herramienta | Tools clave |
|-----------|-------------|-------------|
| Validar UI post-deploy | Playwright | `browser_navigate`, `browser_snapshot`, `browser_take_screenshot` |
| Recorrer módulos/flujos | Playwright | `browser_click`, `browser_wait_for`, `browser_snapshot` |
| Screenshots comparativos | Playwright | `browser_take_screenshot` |
| Network debugging | Chrome DevTools | `list_network_requests`, `get_network_request` |
| Console logs/errores | Chrome DevTools | `list_console_messages`, `get_console_message` |
| Performance/Lighthouse | Chrome DevTools | `lighthouse_audit`, `performance_start_trace` |
| Offline/service worker | Chrome DevTools | `emulate` (networkConditions) |

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

## Antes de cualquier cambio

1. Leer `src/types/index.ts` para interfaces existentes
2. Revisar `src/styles/` para patrones BEM
3. Revisar `src/components/` para componentes reutilizables
4. Revisar `src/stores/` para estado global
5. Revisar `public/data/` para estructura de datos JSON

## Reglas

- Extender interfaces existentes (BaseLearningData, FlashcardData, etc.), no crear nuevas
- Seguir nomenclatura BEM: Block__Element--Modifier
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

| Comando | Descripción |
|---------|-------------|
| `npm run validate:all` | Validaciones base: data-paths + BEM |
| `npm run validate:full` | Base + analyze-unused + deep-analysis (47 pasadas) |
| `npm run validate:content` | Validación profunda de contenido JSON (160 módulos) |
| `npm run validate:content:errors` | Solo errores de contenido |
| `npm run analyze:unused` | 17 pasadas: archivos huérfanos, exports muertos, CSS sin uso, BEM, !important audit |
| `npm run analyze:deep` | DA+DB+DC (30 pasadas): CSS quality, cross-file, JSON integrity |
| `npm run analyze:deep:da` | Solo DA-1..DA-10: propiedades duplicadas, @keyframes, :root vars, reglas vacías |
| `npm run analyze:deep:db` | Solo DB-1..DB-10: var() sin definición, CSS huérfanos, timers, storage |
| `npm run analyze:deep:dc` | Solo DC-1..DC-10: integridad JSON, prerequisites, schema, progresión |

Ejecutar `npm run validate:full` después de cambios CSS o refactoring significativo.

---

# Reglas CSS

Este proyecto usa esbuild (integrado en Vite) para minificación CSS. No agregar PostCSS, cssnano ni autoprefixer.

## Benchmark (Feb 2026)

| Herramienta | Bundle | Gzip | Build |
|-------------|--------|------|-------|
| esbuild | 283 KB | 36.8 KB | 9s |
| cssnano | 420 KB | 53.6 KB | 19s |

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
