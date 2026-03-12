# Testing Scripts

Scripts para testing y validación de la aplicación.

## Offline Mode Testing

### test-offline-mode.js

Script guía para probar el modo offline de la aplicación usando Chrome DevTools MCP.

**Uso:**
```bash
npm run test:offline
```

Este script proporciona una guía paso a paso para:
- Validar carga inicial online/offline
- Probar navegación en modo offline
- Verificar el caso de borde del next-module
- Validar persistencia de progreso
- Medir performance offline

### automated-offline-test.md

Documento con comandos MCP exactos para ejecutar las pruebas de forma automatizada.

**Casos de prueba:**
1. Carga inicial ONLINE
2. Completar módulo para activar next-module
3. Modo OFFLINE - Navegación básica
4. CASO DE BORDE - Next-module OFFLINE
5. Cambio de vista OFFLINE
6. Volver ONLINE - Sincronización
7. Edge Case - Sin cache inicial
8. Performance OFFLINE

## Prerequisitos

### Chrome con Remote Debugging

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### MCP Chrome DevTools

Asegúrate de tener configurado el MCP server de Chrome DevTools en `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-chrome-devtools"],
      "env": {},
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Casos de borde del next-module

El next-module es una feature crítica que recomienda el siguiente módulo a completar. Los casos de borde a probar son:

### 1. Next-module offline
- **Problema potencial:** El cálculo de next-module requiere datos de módulos que pueden no estar cacheados
- **Validación:** Verificar que `getNextRecommendedModule()` funciona con datos cacheados

### 2. Scroll automático a next-module
- **Problema potencial:** El scroll automático puede fallar si el módulo no está renderizado aún
- **Validación:** Verificar timing de `scrollToNextModule` en `MainMenu.tsx`

### 3. Next-module con prerequisites
- **Problema potencial:** Módulos bloqueados pueden aparecer como next si el cálculo falla
- **Validación:** Verificar que `isModuleUnlocked()` funciona correctamente offline

### 4. Next-module cuando todos están completados
- **Problema potencial:** Puede no haber next-module si todos los módulos de un nivel están completados
- **Validación:** Verificar que la UI maneja el caso `nextModule === null`

### 5. Persistencia del progreso
- **Problema potencial:** El progreso puede no persistirse correctamente en localStorage
- **Validación:** Verificar que Zustand persist middleware funciona offline

## Archivos clave

| Archivo | Responsabilidad |
|---------|----------------|
| `src/services/progressionService.ts` | Lógica de progresión y next-module |
| `src/hooks/useProgression.ts` | Hook con `getNextRecommendedModule()` |
| `src/components/ui/MainMenu.tsx` | Scroll automático a next-module |
| `src/components/ui/ModuleCard.tsx` | Renderizado de next-module destacado |
| `src/components/ui/ProgressionDashboard.tsx` | Dashboard con next-module |
| `public/service-worker.js` | Cache de módulos JSON |

## Debugging

### Ver estado de progresión en consola

```javascript
// En Chrome DevTools Console
const state = window.__ZUSTAND_STORE__?.getState?.();
console.log('Completed modules:', state?.completedModules);
console.log('Next module:', state?.progression?.nextRecommendedModule);
```

### Ver localStorage

```javascript
// Ver todas las keys
Object.keys(localStorage);

// Ver progreso guardado
JSON.parse(localStorage.getItem('fluentflow-progress'));
```

### Ver Service Worker cache

```javascript
// Ver caches disponibles
caches.keys().then(console.log);

// Ver contenido de un cache
caches.open('fluentflow-v1').then(cache => 
  cache.keys().then(console.log)
);
```

## Métricas de éxito

### Performance offline
- LCP (Largest Contentful Paint): < 2.5s
- FCP (First Contentful Paint): < 1.8s
- TTI (Time to Interactive): < 3.8s
- CLS (Cumulative Layout Shift): < 0.1

### Funcionalidad
- ✓ App carga completamente offline (con cache previo)
- ✓ Módulos JSON se cargan desde cache
- ✓ Next-module se calcula correctamente
- ✓ Scroll automático funciona
- ✓ Progreso se persiste en localStorage
- ✓ Navegación entre tabs funciona
- ✓ Completar módulos offline funciona
- ✓ Progreso se mantiene al volver online

## Troubleshooting

### "Chrome no está conectado"
```bash
# Verificar que Chrome está corriendo con remote debugging
lsof -i :9222

# Si no está corriendo, iniciarlo
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

### "Service Worker no se registra"
```bash
# Verificar que el service worker existe
curl -I https://gsphome.github.io/englishgame6/service-worker.js

# Verificar en Chrome DevTools > Application > Service Workers
```

### "Módulos no se cachean"
```bash
# Verificar estrategia de cache en service-worker.js
# Buscar: workbox.strategies.CacheFirst o similar
```

### "Next-module no se actualiza"

**✅ FIXED (2026-03-12)**: Race condition entre Zustand y TanStack Query resuelto.

**Solución implementada:**
- `useProgression.ts`: Agregado `refetchOnMount: true` y `refetchOnWindowFocus: false`
- `ProgressionDashboard.tsx`: Forzar refresh cuando cambia `completedModules`

Si aún experimentas el problema:
```javascript
// Verificar estado de progresión
const progression = useProgressStore.getState();
console.log('Completed count:', Object.keys(progression.completedModules).length);
```

## Referencias

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [Workbox](https://developers.google.com/web/tools/workbox)
