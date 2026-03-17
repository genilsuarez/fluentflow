# DevTools Testing & Artifacts

Directorio para pruebas E2E con Chrome DevTools MCP y artifacts generados durante testing/debugging.
Ejecutar contra producción: `https://gsphome.github.io/englishgame6/`

## Test Scripts

| Script | Cobertura | Secciones |
|--------|-----------|-----------|
| `validate-learning-modes.md` | 6 modos de aprendizaje + 8 validaciones generales + anti-remount | 9 secciones (0-8) |
| `validate-modals.md` | 10 modales + 10 validaciones generales (z-index, scroll, a11y, dark mode) | 11 secciones (0-10) |
| `automated-offline-test.md` | 8 tests offline: cache, next-module, sync, performance | 9 secciones (0-8) |

## Paso 0: Activar Dev Mode (OBLIGATORIO)

Dev Mode desbloquea todos los módulos sin necesidad de completar prerequisites uno a uno. Sin esto, solo los módulos iniciales son accesibles y no se puede testear la mayoría del contenido.

Ejecutar siempre al inicio de cada sesión de testing:

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

Verificar que aparece el badge "🔧 DEV" en el header después del reload.

> Alternativa: abrir Settings → tab General → activar toggle "Dev Mode".

---

## Casos de uso

### Post-deploy rápido (~5 min)

Verificación mínima después de cada deploy:

1. Activar Dev Mode (Paso 0)
2. `validate-learning-modes.md` → Checklist rápido (sección final)
3. `validate-modals.md` → Checklist rápido (sección final)
4. `automated-offline-test.md` → Tests 1, 3, 6

### Regresión completa (~30 min)

Ejecutar los 3 scripts completos en orden (activar Dev Mode primero):

1. Learning modes (funcionalidad core)
2. Modals (UI/UX), incluyendo summary modals de Matching y Sorting
3. Offline (PWA/cache)

### Revisión visual multi-viewport (~20 min)

Combinaciones recomendadas para cobertura visual:

| Viewport | Tema | Idioma | Foco |
|----------|------|--------|------|
| Desktop 1280x800 | Light | English | Layout base, funcionalidad |
| Mobile 375x667 | Dark | Español | Responsive, i18n, dark mode |
| Tablet 768x1024 | Dark | Español | Layout intermedio |
| Desktop 1280x800 | Dark | Español | Side menu + modales dentro de learning |

Para cada combinación, navegar: menú → quiz → completion → flashcard → matching → sorting → reading → side menu → modales.

```
# Cambiar viewport
mcp_chrome_devtools_resize_page
width: 375
height: 667

# Cambiar tema y idioma via Settings o evaluate_script
mcp_chrome_devtools_evaluate_script
function: "() => { document.documentElement.classList.add('dark'); return 'dark'; }"
```

### Test de anti-remount (~3 min)

Verificar que `updateSessionScore` no causa remount del componente de learning (sección 8 de `validate-learning-modes.md`):

```
1. Navegar a quiz
2. Instalar MutationObserver detector
3. Responder una pregunta
4. Verificar remounts === 0
5. Verificar que la pregunta NO cambió
```

### Test de modales dentro de learning modes (~5 min)

Verificar que abrir/cerrar modales no afecta el estado del learning mode activo:

```
1. Navegar a quiz, responder 1 pregunta (anotar pregunta y score)
2. Abrir side menu → Settings → cerrar con Escape
3. Verificar: misma pregunta, mismo score, mismo index
4. Abrir side menu → About → cerrar con Escape
5. Verificar: estado intacto
6. Abrir side menu → Profile → cerrar con Escape
7. Verificar: estado intacto
```

### Test de modales de resumen Matching/Sorting (~10 min)

Estos modales requieren completar el ejercicio completo antes de poder abrirlos. Procedimiento detallado en `validate-modals.md` §8 (Sorting) y §9 (Matching).

**Sorting:**

```
# 1. Navegar a sorting
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/sorting-word-categories-a1'; return 'ok'; }"

# 2. Completar ejercicio: arrastrar todas las palabras a categorías
#    (tomar snapshot después de cada drag, los uids cambian)

# 3. Click "Check Answers" → Click "View Summary"
# 4. Verificar: results grid, cards correct/incorrect, heading "Exercise Summary"
# 5. Cerrar modal → verificar que ejercicio sigue visible con resultados
```

**Matching:**

```
# 1. Navegar a matching
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/matching-common-verbs-a1'; return 'ok'; }"

# 2. Completar ejercicio: emparejar todos los items (click columna izq + columna der)

# 3. Click "Check Matches" → Click "View Summary"
# 4. Verificar: results grid, body scroll locked (clase modal-open), header violeta
# 5. Cerrar modal → verificar scroll restaurado, posición no saltó al top
# 6. Verificar: body.classList NO contiene 'modal-open', overflow restaurado
```

**Validaciones clave:**
- Body scroll lock/restore (Matching usa `modal-open` class + `--scroll-y` CSS var)
- Cards muestran respuesta correcta e incorrecta con iconos ✓/✗
- Cerrar con botón Close, botón X, o Escape (Matching) / Enter (Matching)
- Estado del ejercicio preservado después de cerrar el summary

### Test de accesibilidad (~5 min)

Validaciones de a11y incluidas en `validate-modals.md` sección 10:

- Portal rendering (modales en `<body>`, no en `<header>`)
- Touch targets ≥ 44px en botones close
- `aria-hidden` en contenido oculto (resultado de Completion)
- `aria-label` en botones close de modales
- `prefers-reduced-motion` support en animaciones
- Body scroll prevention con `body:has(.compact-*)`

### Test de persistencia (~3 min)

```
1. Completar un módulo o responder preguntas
2. Anotar global score
3. Recargar página (F5)
4. Verificar: score idéntico, settings preservados, idioma/tema intactos
```

## Prerequisitos

### Chrome con Remote Debugging

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222
```

### MCP Chrome DevTools

Configurado en `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-chrome-devtools@latest"],
      "disabled": false
    }
  }
}
```

### Navegación a módulos

Los module cards no son clickeables via a11y tree. Usar siempre:

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/{moduleId}'; return 'ok'; }"
```

## Artifacts

### Convención de nombres

```
{categoria}-{descripcion}.{extension}
```

Categorías: `offline-`, `edge-`, `perf-`, `network-`, `issue-`, `visual-`, `review-`

### Tipos

| Extensión | Herramienta MCP | Uso |
|-----------|----------------|-----|
| `.png` | `take_screenshot` | Capturas visuales |
| `.txt` | `take_snapshot` | DOM a11y tree con UIDs |
| `.json` / `.json.gz` | `performance_stop_trace` | Performance traces |

### Limpieza

```bash
# Eliminar artifacts (mantener docs)
find scripts/devtools -type f \( -name '*.png' -o -name '*.txt' -o -name '*.json' -o -name '*.json.gz' \) -delete
```

## Debugging

### Console / localStorage / Service Worker

```javascript
// Estado de progresión
const state = JSON.parse(localStorage.getItem('fluentflow-progress'));

// Service Worker
const reg = await navigator.serviceWorker.getRegistration();
console.log({ active: !!reg?.active, waiting: !!reg?.waiting });

// Cache storage
const names = await caches.keys();
caches.open('fluentflow-v1').then(c => c.keys().then(console.log));
```

### Troubleshooting

| Problema | Solución |
|----------|----------|
| Chrome no conecta | Verificar `lsof -i :9222`, reiniciar Chrome con `--remote-debugging-port=9222` |
| Service Worker no registra | `curl -I https://gsphome.github.io/englishgame6/service-worker.js` |
| Módulos no se cachean | Revisar estrategia de cache en `service-worker.js` |
| Next-module no actualiza | Verificar `useProgression.ts` (`refetchOnMount: true`) |
| Snapshot muestra contenido oculto | Normal: a11y tree expone contenido con `opacity:0`. Verificar `aria-hidden` |
| wait_for timeout | Página ya cargó antes del wait. Usar `take_snapshot` directamente |

## Señales de regresión

| Síntoma | Causa probable | Script de referencia |
|---------|----------------|---------------------|
| Pregunta cambia al responder | `useAppStore()` sin selector en learning/AppRouter | `validate-learning-modes.md` §8 |
| Modal no se abre | Estado `show*` no se actualiza | `validate-modals.md` §1-9 |
| Body scrollable con modal abierto | CSS `body:has()` roto o `modal-open` no aplicada | `validate-modals.md` §10b |
| App no carga offline | Service Worker no registrado o cache vacío | `automated-offline-test.md` §3 |
| Score se pierde al recargar | Zustand persist middleware roto | `validate-learning-modes.md` §7f |

## Archivos clave

| Archivo | Responsabilidad |
|---------|----------------|
| `src/services/progressionService.ts` | Lógica de progresión y next-module |
| `src/hooks/useProgression.ts` | Hook con `getNextRecommendedModule()` |
| `src/components/ui/MainMenu.tsx` | Scroll automático a next-module |
| `src/components/ui/ScoreDisplay.tsx` | Score en header (session/global) |
| `src/components/learning/CompletionComponent.tsx` | Modo completion con resultado oculto |
| `public/service-worker.js` | Cache de módulos JSON |
