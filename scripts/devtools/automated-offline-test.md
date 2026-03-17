# Automated Offline Test

Service Worker, cache, navegación offline, sincronización y performance.

> Prerequisitos y setup en [README.md](README.md). Ejecutar "Antes de empezar" primero.

---

## 1. Carga inicial online

```
mcp_chrome_devtools_list_network_requests
resourceTypes: ["document", "script", "fetch", "xhr"]
pageSize: 50
```

- [ ] Requests incluyen módulos JSON (`/data/app-config.json`)
- [ ] Status 200 en requests principales

### Service Worker

```
mcp_chrome_devtools_evaluate_script
function: "async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return { active: !!reg?.active, waiting: !!reg?.waiting, scope: reg?.scope };
}"
```

- [ ] `active: true`
- [ ] `scope` incluye `/englishgame6/`

---

## 2. Completar módulo (activar next-module)

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/reading-greetings-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Learning Objectives", "Start Reading", "Greetings"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
```

Navegar todas las secciones con click en next hasta finish:

```
mcp_chrome_devtools_click
uid: {uid-next-btn}
includeSnapshot: true
# Repetir hasta "Finish Reading"

mcp_chrome_devtools_click
uid: {uid-finish-btn}
includeSnapshot: true
```

- [ ] URL cambió a `#/menu`
- [ ] Módulo "Completed", next-module destacado

### Verificar progreso en localStorage

```
mcp_chrome_devtools_evaluate_script
function: "() => {
  const keys = Object.keys(localStorage).filter(k => k.includes('progress') || k.includes('score') || k.includes('fluentflow'));
  return keys.map(k => ({ key: k, size: localStorage.getItem(k).length }));
}"
```

- [ ] Datos de progreso guardados, size > 0

---

## 3. Modo offline — navegación básica

```
mcp_chrome_devtools_emulate
networkConditions: "Offline"

mcp_chrome_devtools_navigate_page
type: "reload"
timeout: 10000

mcp_chrome_devtools_take_snapshot
```

- [ ] App carga (heading "FluentFlow" visible)
- [ ] Módulos visibles
- [ ] Progreso persistido
- [ ] Global score se mantiene

### Requests offline

```
mcp_chrome_devtools_list_network_requests
pageSize: 30
```

- [ ] Servidos desde SW cache, sin errores que rompan UI

---

## 4. Next-module offline

```
mcp_chrome_devtools_evaluate_script
function: "() => {
  const nextBtn = document.querySelector('[data-module-id].module-card--next-recommended');
  if (!nextBtn) return { error: 'No next-module found' };
  const moduleId = nextBtn.getAttribute('data-module-id');
  window.location.hash = '#/learn/' + moduleId;
  return { navigatedTo: moduleId };
}"

mcp_chrome_devtools_wait_for
text: ["Flip", "Which word", "Click items", "Drag and drop", "____", "Learning Objectives"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
```

- [ ] Módulo carga offline (contenido JSON desde cache)
- [ ] Sin pantalla de error
- [ ] Interacción funciona

### Volver al menú

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/menu'; return 'ok'; }"

mcp_chrome_devtools_take_snapshot
```

- [ ] Menú carga, progreso se mantiene

---

## 5. Cambio de vista offline

```
mcp_chrome_devtools_take_snapshot

mcp_chrome_devtools_click
uid: {uid-tab-all}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-tab-progress}
includeSnapshot: true
```

- [ ] Navegación entre tabs funciona offline
- [ ] Stats correctos
- [ ] Módulos completados marcados

---

## 6. Volver online — sincronización

```
mcp_chrome_devtools_emulate

mcp_chrome_devtools_navigate_page
type: "reload"
timeout: 10000

mcp_chrome_devtools_take_snapshot
```

- [ ] Progreso intacto
- [ ] Módulos completados siguen marcados
- [ ] Next-module correcto

```
mcp_chrome_devtools_list_network_requests
resourceTypes: ["fetch", "xhr"]
pageSize: 30
```

- [ ] Requests exitosos (status 200)

---

## 7. Edge case — sin cache inicial

```
mcp_chrome_devtools_new_page
url: "about:blank"
isolatedContext: "test-no-cache"

mcp_chrome_devtools_emulate
networkConditions: "Offline"

mcp_chrome_devtools_navigate_page
type: "url"
url: "https://gsphome.github.io/englishgame6/"
timeout: 10000

mcp_chrome_devtools_take_snapshot

mcp_chrome_devtools_list_console_messages
types: ["error", "warn"]
pageSize: 20
```

- [ ] Error apropiado (no crash silencioso)
- [ ] Sin excepciones JS no manejadas

### Cleanup

```
mcp_chrome_devtools_list_pages

mcp_chrome_devtools_close_page
pageId: {id-pagina-aislada}
```

---

## 8. Performance offline

```
mcp_chrome_devtools_list_pages

mcp_chrome_devtools_select_page
pageId: {id-pagina-principal}

# Online primero para tener cache
mcp_chrome_devtools_emulate

mcp_chrome_devtools_navigate_page
type: "url"
url: "https://gsphome.github.io/englishgame6/"
timeout: 10000

# Offline + trace
mcp_chrome_devtools_emulate
networkConditions: "Offline"

mcp_chrome_devtools_performance_start_trace
reload: true
autoStop: true
filePath: "scripts/devtools/perf-offline-trace.json.gz"
```

- [ ] LCP < 2.5s
- [ ] FCP < 1.8s
- [ ] CLS < 0.1

### Cleanup

```
mcp_chrome_devtools_emulate
```

---

## Resultados esperados

| Test | Online | Offline (cache) | Sin cache |
|------|--------|-----------------|-----------|
| Carga inicial | ✓ | ✓ | ✗ (error esperado) |
| Completar módulo | ✓ | ✓ | N/A |
| Next-module | ✓ | ✓ | N/A |
| Navegación tabs | ✓ | ✓ | N/A |
| Persistencia | ✓ | ✓ | N/A |
| Performance | Excelente | Bueno | N/A |

---

## Checklist rápido

```
[ ] Service Worker activo
[ ] Modo offline: app carga desde cache
[ ] Modo offline: módulos navegables
[ ] Modo offline: progreso persiste
[ ] Vuelta online: progreso intacto
[ ] Sin errores JS en console
```
