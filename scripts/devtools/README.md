# DevTools E2E Testing

Pruebas E2E con Chrome DevTools MCP contra producción: `https://gsphome.github.io/englishgame6/`

## Scripts de test

| Script | Qué prueba | Tiempo |
|--------|-----------|--------|
| [`validate-learning-modes.md`](validate-learning-modes.md) | 6 modos de aprendizaje, anti-remount, persistencia, responsive | ~15 min |
| [`validate-modals.md`](validate-modals.md) | 11 modales, scroll lock, a11y, dark mode, portal rendering | ~20 min |
| [`automated-offline-test.md`](automated-offline-test.md) | Service Worker, cache, navegación offline, sync, performance | ~15 min |

## Antes de empezar

### 1. Chrome con Remote Debugging

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

### 2. Abrir página y activar Dev Mode

Dev Mode desbloquea todos los módulos sin completar prerequisites. Ejecutar siempre al inicio de cada sesión:

```
mcp_chrome_devtools_new_page
url: "https://gsphome.github.io/englishgame6/"
timeout: 10000

mcp_chrome_devtools_evaluate_script
function: "() => {
  const raw = localStorage.getItem('settings-storage');
  const data = JSON.parse(raw);
  data.state.devMode = true;
  localStorage.setItem('settings-storage', JSON.stringify(data));
  location.reload();
  return 'Dev mode enabled';
}"
```

Verificar badge "🔧 DEV" en el header. Alternativa: Settings → General → toggle "Dev Mode".

### 3. Verificar sitio activo

```
mcp_chrome_devtools_take_snapshot
```

Debe mostrar heading "FluentFlow", módulos en gridcells, y URL `#/menu`.

## Cómo ejecutar

### Post-deploy rápido (~5 min)

Ir al checklist rápido al final de cada script:
1. `validate-learning-modes.md` → Checklist
2. `validate-modals.md` → Checklist
3. `automated-offline-test.md` → Checklist

### Regresión completa (~50 min)

Ejecutar los 3 scripts completos en orden:
1. Learning modes → funcionalidad core
2. Modals → UI/UX + summary modals (Matching/Sorting)
3. Offline → PWA/cache

### Revisión visual multi-viewport (~20 min)

| Viewport | Tema | Idioma | Resize |
|----------|------|--------|--------|
| Desktop 1280×800 | Light | English | `width: 1280, height: 800` |
| Mobile 375×667 | Dark | Español | `width: 375, height: 667` |
| Tablet 768×1024 | Dark | Español | `width: 768, height: 1024` |

Para cada combinación: menú → quiz → completion → flashcard → matching → sorting → reading → side menu → modales.

```
mcp_chrome_devtools_resize_page
width: 375
height: 667

mcp_chrome_devtools_evaluate_script
function: "() => { document.documentElement.classList.add('dark'); return 'dark'; }"
```

## Referencia rápida

### Navegación a módulos

Los module cards no son clickeables via a11y tree. Usar siempre:

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/{moduleId}'; return 'ok'; }"
```

### Módulos de referencia por modo

| Modo | Módulo A1 | Módulo A2 |
|------|-----------|-----------|
| Quiz | `quiz-basic-vocabulary-a1` | `quiz-family-home-a2` |
| Completion | `completion-basic-sentences-a1` | `completion-daily-activities-a2` |
| Matching | `matching-common-verbs-a1` | `matching-time-expressions-a2` |
| Sorting | `sorting-word-categories-a1` | `sorting-past-tense-a2` |
| Flashcard | `flashcard-basic-vocabulary-a1` | `flashcard-family-a2` |
| Reading | `reading-greetings-a1` | `reading-business-a2` |

### Debugging

```
# localStorage
mcp_chrome_devtools_evaluate_script
function: "() => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key).length + ' chars';
  }
  return data;
}"

# Service Worker
mcp_chrome_devtools_evaluate_script
function: "async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return { active: !!reg?.active, scope: reg?.scope };
}"

# Cache storage
mcp_chrome_devtools_evaluate_script
function: "async () => {
  const names = await caches.keys();
  const details = {};
  for (const name of names) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    details[name] = keys.length + ' entries';
  }
  return details;
}"
```

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Chrome no conecta | `lsof -i :9222`, reiniciar Chrome con `--remote-debugging-port=9222` |
| Service Worker no registra | `curl -I https://gsphome.github.io/englishgame6/service-worker.js` |
| Módulos no se cachean | Revisar estrategia en `service-worker.js` |
| Next-module no actualiza | Verificar `useProgression.ts` (`refetchOnMount: true`) |
| Snapshot muestra contenido oculto | Normal: a11y tree expone `opacity:0`. Verificar `aria-hidden` |
| wait_for timeout | Página ya cargó. Usar `take_snapshot` directamente |

## Señales de regresión

| Síntoma | Causa probable | Script |
|---------|----------------|--------|
| Pregunta cambia al responder | `useAppStore()` sin selector | `validate-learning-modes.md` §8 |
| Modal no se abre | Estado `show*` no se actualiza | `validate-modals.md` §1-9 |
| Body scrollable con modal | CSS `body:has()` roto | `validate-modals.md` §10b |
| App no carga offline | SW no registrado o cache vacío | `automated-offline-test.md` §3 |
| Score se pierde al recargar | Zustand persist roto | `validate-learning-modes.md` §7f |
| Pares se barajan al Check | Remount del MatchingComponent | `validate-learning-modes.md` §8 |
| Scroll no restaura al cerrar modal | `--scroll-y` no restaurado | `validate-modals.md` §9f |

## Artifacts

Archivos generados durante testing (gitignored):

| Extensión | Herramienta | Uso |
|-----------|-------------|-----|
| `.png` | `take_screenshot` | Capturas visuales |
| `.txt` | `take_snapshot` | DOM a11y tree |
| `.json` / `.json.gz` | `performance_stop_trace` | Performance traces |

Convención: `{categoria}-{descripcion}.{ext}` — Categorías: `offline-`, `perf-`, `visual-`, `issue-`, `review-`

```bash
# Limpiar artifacts
find scripts/devtools -type f \( -name '*.png' -o -name '*.txt' -o -name '*.json' -o -name '*.json.gz' \) -delete
```

## Archivos clave del proyecto

| Archivo | Responsabilidad |
|---------|----------------|
| `src/services/progressionService.ts` | Progresión y next-module |
| `src/hooks/useProgression.ts` | `getNextRecommendedModule()` |
| `src/components/ui/ScoreDisplay.tsx` | Score en header |
| `src/components/learning/*.tsx` | 6 modos de aprendizaje |
| `public/service-worker.js` | Cache de módulos JSON |
