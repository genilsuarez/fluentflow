# Automated Offline Test - MCP Chrome DevTools

Este documento contiene los comandos MCP exactos para ejecutar las pruebas de modo offline.

## Prerequisitos

```bash
# 1. Chrome debe estar corriendo con remote debugging
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# 2. Verificar que el sitio está desplegado
curl -I https://gsphome.github.io/englishgame6/
```

## Test Suite

### Test 1: Carga inicial ONLINE

```
mcp_chrome_devtools_new_page
url: https://gsphome.github.io/englishgame6/
timeout: 10000

mcp_chrome_devtools_take_snapshot
verbose: false

mcp_chrome_devtools_list_network_requests
resourceTypes: ["document", "script", "fetch", "xhr"]
pageSize: 50
```

**Validar:**
- ✓ Snapshot muestra estructura de la app
- ✓ Network requests incluyen módulos JSON
- ✓ Service worker registrado (buscar en console)

---

### Test 2: Completar módulo para activar next-module

```
# Tomar snapshot para identificar primer módulo
mcp_chrome_devtools_take_snapshot
includeSnapshot: true

# Click en primer módulo (ajustar uid según snapshot)
mcp_chrome_devtools_click
uid: "reading-greetings-a1"
includeSnapshot: true

# Esperar carga del módulo
mcp_chrome_devtools_wait_for
text: ["Start Learning", "Begin"]
timeout: 5000

# Click en Start
mcp_chrome_devtools_click
uid: "start-button"
includeSnapshot: true

# Completar módulo (ejemplo: reading mode)
# Repetir para cada pregunta:
mcp_chrome_devtools_click
uid: "answer-option-0"
includeSnapshot: false

mcp_chrome_devtools_click
uid: "next-button"
includeSnapshot: false

# Al finalizar, volver al menú
mcp_chrome_devtools_click
uid: "return-to-menu"
includeSnapshot: true

# Verificar next-module destacado
mcp_chrome_devtools_take_snapshot
verbose: false
```

**Validar:**
- ✓ Módulo se completa correctamente
- ✓ Progreso se guarda (localStorage)
- ✓ Next-module aparece destacado en el menú

---

### Test 3: Modo OFFLINE - Navegación básica

```
# Activar modo offline
mcp_chrome_devtools_emulate
networkConditions: "Offline"

# Recargar página
mcp_chrome_devtools_navigate_page
type: "reload"
timeout: 10000

# Verificar que app carga desde cache
mcp_chrome_devtools_take_snapshot
verbose: false

# Ver requests fallidos
mcp_chrome_devtools_list_network_requests
pageSize: 50
```

**Validar:**
- ✓ App carga completamente desde cache
- ✓ Módulos visibles
- ✓ Progreso persistido
- ✓ Network requests fallan pero app funciona

---

### Test 4: CASO DE BORDE - Next-module OFFLINE

```
# Mantener modo offline
# Verificar next-module
mcp_chrome_devtools_take_snapshot
verbose: false

# Click en next-module (ajustar uid según snapshot)
mcp_chrome_devtools_click
uid: "flashcard-basic-vocabulary-a1"
includeSnapshot: true

# Esperar carga
mcp_chrome_devtools_wait_for
text: ["Start Learning", "Flashcard"]
timeout: 5000

# Verificar que contenido carga desde cache
mcp_chrome_devtools_take_snapshot
verbose: false

# Completar módulo
mcp_chrome_devtools_click
uid: "start-button"
includeSnapshot: false

# Interactuar con flashcards (ejemplo)
mcp_chrome_devtools_click
uid: "flip-card"
includeSnapshot: false

mcp_chrome_devtools_click
uid: "next-card"
includeSnapshot: false

# Volver al menú
mcp_chrome_devtools_click
uid: "return-to-menu"
includeSnapshot: true

# Verificar nuevo next-module
mcp_chrome_devtools_take_snapshot
verbose: false
```

**Validar:**
- ✓ Next-module carga correctamente offline
- ✓ Contenido JSON viene desde cache
- ✓ Progreso se guarda en localStorage
- ✓ Nuevo next-module se calcula correctamente

---

### Test 5: Cambio de vista OFFLINE

```
# Mantener modo offline
# Click en tab "All Modules"
mcp_chrome_devtools_click
uid: "tab-all-modules"
includeSnapshot: true

# Verificar scroll automático a next-module
mcp_chrome_devtools_take_snapshot
verbose: false

# Click en tab "My Progress"
mcp_chrome_devtools_click
uid: "tab-my-progress"
includeSnapshot: true

# Verificar dashboard
mcp_chrome_devtools_take_snapshot
verbose: false

# Volver a "All Modules"
mcp_chrome_devtools_click
uid: "tab-all-modules"
includeSnapshot: true
```

**Validar:**
- ✓ Navegación entre tabs funciona offline
- ✓ Scroll automático a next-module
- ✓ Dashboard muestra stats correctos
- ✓ Módulos completados marcados correctamente

---

### Test 6: Volver ONLINE - Sincronización

```
# Desactivar modo offline
mcp_chrome_devtools_emulate
networkConditions: ""

# Recargar
mcp_chrome_devtools_navigate_page
type: "reload"
timeout: 10000

# Verificar progreso
mcp_chrome_devtools_take_snapshot
verbose: false

# Ver requests exitosos
mcp_chrome_devtools_list_network_requests
resourceTypes: ["fetch", "xhr"]
pageSize: 50
```

**Validar:**
- ✓ Progreso se mantiene intacto
- ✓ Módulos completados siguen marcados
- ✓ Next-module sigue siendo el correcto
- ✓ Network requests exitosos

---

### Test 7: Edge Case - Sin cache inicial

```
# Abrir nueva página en modo incógnito (o limpiar cache)
mcp_chrome_devtools_new_page
url: about:blank
isolatedContext: "test-offline"

# Activar offline ANTES de navegar
mcp_chrome_devtools_emulate
networkConditions: "Offline"

# Intentar cargar app
mcp_chrome_devtools_navigate_page
type: "url"
url: "https://gsphome.github.io/englishgame6/"
timeout: 10000

# Ver qué pasa
mcp_chrome_devtools_take_snapshot
verbose: false

mcp_chrome_devtools_list_console_messages
types: ["error", "warn"]
```

**Validar:**
- ✓ App muestra mensaje de error apropiado
- ✓ No hay crashes de JavaScript
- ✓ Fallback UI visible (si existe)

---

### Test 8: Performance OFFLINE

```
# Asegurar que hay cache (cargar online primero)
mcp_chrome_devtools_emulate
networkConditions: ""

mcp_chrome_devtools_navigate_page
type: "url"
url: "https://gsphome.github.io/englishgame6/"
timeout: 10000

# Activar offline
mcp_chrome_devtools_emulate
networkConditions: "Offline"

# Iniciar trace
mcp_chrome_devtools_performance_start_trace
reload: true
autoStop: true

# Esperar a que termine (autoStop)
# Luego obtener resultados
mcp_chrome_devtools_take_snapshot
verbose: false
```

**Validar:**
- ✓ LCP < 2.5s
- ✓ FCP < 1.8s
- ✓ TTI < 3.8s
- ✓ No layout shifts significativos

---

## Debugging Tips

### Ver console logs
```
mcp_chrome_devtools_list_console_messages
types: ["log", "error", "warn"]
pageSize: 100
```

### Ver localStorage
```
mcp_chrome_devtools_evaluate_script
function: "() => { return Object.keys(localStorage).map(key => ({ key, value: localStorage.getItem(key) })); }"
```

### Ver Service Worker status
```
mcp_chrome_devtools_evaluate_script
function: "async () => { const reg = await navigator.serviceWorker.getRegistration(); return { active: !!reg?.active, waiting: !!reg?.waiting, installing: !!reg?.installing }; }"
```

### Ver cache storage
```
mcp_chrome_devtools_evaluate_script
function: "async () => { const names = await caches.keys(); return names; }"
```

### Verificar next-module en memoria
```
mcp_chrome_devtools_evaluate_script
function: "() => { const state = window.__ZUSTAND_STORE__?.getState?.(); return state?.progression?.nextRecommendedModule; }"
```

---

## Resultados esperados

| Test | Online | Offline | Edge Case |
|------|--------|---------|-----------|
| Carga inicial | ✓ | ✓ (con cache) | ✗ (sin cache) |
| Completar módulo | ✓ | ✓ | ✓ |
| Next-module | ✓ | ✓ | ✓ |
| Navegación | ✓ | ✓ | ✓ |
| Persistencia | ✓ | ✓ | ✓ |
| Performance | Excelente | Bueno | N/A |

---

## Issues conocidos a verificar

1. **Next-module no se actualiza después de completar offline**
   - Verificar que `getNextRecommendedModule()` se llama después de guardar progreso
   - Revisar `useProgression.ts` y `progressionService.ts`

2. **Scroll automático no funciona en modo offline**
   - Verificar que `scrollToNextModule` se ejecuta en `MainMenu.tsx`
   - Revisar timing de `useEffect` con `autoScrollToNext`

3. **Módulos JSON no se cachean correctamente**
   - Verificar `service-worker.js` estrategia de cache
   - Revisar que fetch requests incluyen headers correctos

4. **localStorage no se sincroniza entre tabs**
   - Verificar `storage` event listener
   - Revisar Zustand persist middleware

---

## Comandos útiles

```bash
# Ver tamaño del cache
npm run deploy:ping

# Validar service worker
curl -I https://gsphome.github.io/englishgame6/service-worker.js

# Ver módulos disponibles
curl https://gsphome.github.io/englishgame6/data/learningModules.json | jq '.[] | {id, name, prerequisites}'
```
