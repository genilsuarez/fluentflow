---
description: "Guía crítica de optimización CSS para arquitectura BEM pura. Usar cuando: modificar configuración de build CSS, evaluar herramientas de minificación, o investigar problemas de performance CSS."
keywords: ["css", "optimization", "esbuild", "cssnano", "bem", "performance", "build", "vite"]
priority: high
updated: 2026-02-27
---

# CSS Optimization Guidelines

## 🎯 REGLA CRÍTICA: esbuild > cssnano para este proyecto

**APRENDIZAJE CLAVE**: Para arquitectura BEM pura, esbuild supera significativamente a cssnano.

## 📊 Datos Comprobados (Validado Feb 2026)

| Herramienta | Bundle CSS | Gzip | Build Time | Resultado |
|-------------|------------|------|------------|-----------|
| **esbuild** | 283 KB | 36.8 KB | 9s | ✅ ÓPTIMO |
| cssnano | 420 KB | 53.6 KB | 19s | ❌ PEOR |

**Mejora con esbuild**: -33% tamaño, -31% gzip, +58% velocidad

**Estado actual del proyecto**: ✅ Usando esbuild (configurado en config/vite.config.ts)

## ⚙️ Configuración Actual (2026)

### ✅ Vite Config (Simplificado):
```typescript
// config/vite.config.ts
build: {
  cssMinify: 'esbuild',  // ✅ Mejor para BEM puro
  cssCodeSplit: true,
}
css: {
  devSourcemap: mode === 'development',
  modules: false  // Pure BEM, no CSS modules
}
```

**IMPORTANTE**: 
- ❌ NO usar PostCSS (eliminado - innecesario)
- ❌ NO usar autoprefixer (Vite lo maneja automáticamente)
- ✅ Vite + esbuild manejan todo el procesamiento CSS

## 🚨 EVITAR

### ❌ NO agregar PostCSS:
```javascript
// ❌ NUNCA agregar esto de nuevo
css: {
  postcss: './postcss.config.js'  // Overhead innecesario
}
```

### ❌ NO usar cssnano:
```javascript
// ❌ Configuración que empeora performance
cssnano: {
  preset: ['default', { ... }]  // Resulta en bundles más grandes
}
```

### ❌ NO instalar autoprefixer:
- Vite ya agrega prefijos automáticamente
- autoprefixer solo agrega overhead sin beneficio

## 🔍 Por Qué esbuild + Vite (Sin PostCSS)

1. **Integración nativa**: esbuild está integrado en Vite, cero configuración
2. **BEM-friendly**: Maneja mejor selectores largos y repetitivos
3. **Velocidad**: 2x más rápido que cssnano
4. **Simplicidad máxima**: Sin middleware, sin plugins, sin overhead
5. **Prefijos automáticos**: Vite agrega vendor prefixes sin autoprefixer
6. **Menos dependencias**: Sin postcss, autoprefixer, cssnano en node_modules

## 🛡️ Validación

Antes de cambiar CSS optimization:

```bash
# 1. Build actual y anotar tamaños
npm run build

# 2. Cambiar configuración
# 3. Build nuevo y comparar

# 4. Si empeora, revertir inmediatamente
```

## 💡 Reglas de Oro

1. **"Vite + esbuild = Configuración óptima para BEM puro"**
2. **"No agregar PostCSS a menos que tengas una razón MUY específica"**
3. **"Menos configuración = Menos problemas"**

Prioridad: Simplicidad > Configuración compleja > Performance comprobada

## 📝 Historial de Decisiones

- **Feb 2026**: Eliminado postcss.config.js (innecesario)
- **Feb 2026**: Eliminado autoprefixer (Vite lo maneja)
- **Feb 2026**: Confirmado esbuild como única herramienta CSS
- **Validado**: Build funciona perfectamente sin PostCSS