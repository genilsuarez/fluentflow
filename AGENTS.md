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

- **CRÍTICO**: SIEMPRE crear scripts en `scripts/` para cualquier análisis, transformación o comando complejo
- NUNCA ejecutar directamente en la terminal:
  - `node -e "..."` o `node -p "..."` (ni siquiera una línea)
  - `python -c "..."` o `python3 -c "..."`
  - Loops, pipes, subshells, one-liners con lógica
  - Cualquier comando con template literals, comillas anidadas o interpolación
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
