# Fix: Módulo Actual en Modo Offline

## Problema Identificado

Cuando el usuario está offline e intenta cargar un módulo que NO está en caché:
- El Service Worker devuelve error 503 con `MODULE_NOT_AVAILABLE_OFFLINE`
- `secureJsonFetch` lanzaba error genérico: "HTTP 503: Service Unavailable"
- El usuario veía un mensaje de error poco claro sin contexto

## Solución Implementada

### 1. Clase de Error Personalizada (`src/utils/secureHttp.ts`)
```typescript
export class ModuleNotAvailableOfflineError extends Error {
  constructor(message: string = 'Module not available offline') {
    super(message);
    this.name = 'ModuleNotAvailableOfflineError';
  }
}
```

### 2. Detección del Error en `secureJsonFetch` (`src/utils/secureHttp.ts`)
- Detecta respuestas 503 del Service Worker
- Parsea el JSON para verificar `error === 'MODULE_NOT_AVAILABLE_OFFLINE'`
- Lanza `ModuleNotAvailableOfflineError` con mensaje específico
- Mantiene compatibilidad con otros errores 503

### 3. UI Mejorada (`src/components/layout/AppRouter.tsx`)
- Importa `ModuleNotAvailableOfflineError`
- Detecta el tipo de error con `instanceof`
- Muestra mensaje específico para errores offline:
  - Icono: 📡 (en lugar de ⚠️)
  - Título: "Este módulo no está disponible offline"
  - Descripción: "Para usar este módulo sin conexión, descárgalo primero o conéctate a internet"
  - Botón primario: "Ir a Configuración Offline"
  - Botón secundario: "Intentar de Nuevo"

### 4. Traducciones (`src/utils/i18n.ts`)
Agregadas en inglés y español:
- `errors.moduleNotAvailableOffline`
- `errors.moduleNotAvailableOfflineDescription`
- `errors.goToOfflineSettings`

## Flujo Mejorado

1. Usuario offline intenta cargar módulo no cacheado
2. Service Worker no encuentra en cache → devuelve 503 con error específico
3. `secureJsonFetch` detecta el error y lanza `ModuleNotAvailableOfflineError`
4. UI muestra mensaje claro con opciones:
   - Ir a configuración offline para descargar el módulo
   - Intentar de nuevo (por si recupera conexión)

## Testing

### Manual
1. Habilitar modo offline en DevTools
2. Navegar a un módulo NO descargado
3. Verificar que se muestre el mensaje específico con icono 📡
4. Verificar botones funcionales

### Con Chrome DevTools MCP
```bash
# Después del deploy
mcp_chrome_devtools_new_page: https://gsphome.github.io/englishgame6/
mcp_chrome_devtools_emulate: networkConditions="Offline"
mcp_chrome_devtools_navigate_page: url="#/learn/a1-flashcard-basic-vocabulary"
mcp_chrome_devtools_take_snapshot: verificar mensaje de error
```

## Archivos Modificados

- `src/utils/secureHttp.ts` - Error personalizado y detección
- `src/components/layout/AppRouter.tsx` - UI mejorada
- `src/utils/i18n.ts` - Traducciones

## Compatibilidad

- ✅ No rompe funcionalidad existente
- ✅ Mantiene manejo de otros errores HTTP
- ✅ Compatible con módulos descargados
- ✅ Build exitoso sin warnings
