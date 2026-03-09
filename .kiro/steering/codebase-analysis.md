---
description: "Metodología obligatoria para análisis del codebase antes de implementar cambios. Usar cuando: crear nuevas features, refactorizar código, resolver bugs complejos, o proponer arquitectura."
keywords: ["codebase", "analysis", "architecture", "best-practices", "workflow", "development", "refactoring"]
priority: critical
updated: 2026-02-27
---

# Codebase-First Analysis Guidelines

## Principio Fundamental
**SIEMPRE explorar y entender el codebase existente ANTES de proponer soluciones o crear specs.**

## Proceso Obligatorio para Nuevos Specs

### 1. Exploración Inicial del Codebase
Antes de crear cualquier spec, SIEMPRE ejecutar esta secuencia:

```
1. Leer package.json → Stack: React 18, TypeScript, Vite, Pure CSS (BEM)
2. Explorar src/types/index.ts → Interfaces y tipos del sistema de aprendizaje
3. Revisar src/styles/ → Arquitectura BEM pura, CSS variables para temas
4. Analizar public/data/ → Contenido JSON por niveles CEFR (A1-C2)
5. Examinar src/components/ → Componentes React funcionales con hooks
6. Revisar src/stores/ → Zustand para estado global con persistencia
7. Verificar scripts/ → 5 directorios: build, development, git, validation, utils
8. Leer steering rules → Entender decisiones arquitectónicas críticas
```

### 2. Identificar Filosofía del Proyecto (englishgame6 - 2026)
Arquitectura y decisiones clave:
- **Pure CSS con BEM** - NO Tailwind, arquitectura CSS mantenible y escalable
- **Data-driven approach** - Todo el contenido configurable desde JSON (public/data/)
- **Modular architecture** - Componentes reutilizables, separación de concerns
- **Performance-first** - esbuild para CSS, lazy loading, bundle size < 1MB
- **Type-safe** - TypeScript strict mode, Zod para validación de datos
- **Modern tooling** - Vite, Vitest, React 18, Zustand, TanStack Query
- **CI/CD automatizado** - GitHub Actions con pipelines de quality, security, build
- **Deployment** - GitHub Pages con validación automática

### 3. Extender, No Reinventar (Herramientas Actuales 2026)
- **Usar interfaces existentes** - Extender BaseLearningData, FlashcardData, etc.
- **Seguir patrones BEM** - Mantener nomenclatura Block__Element--Modifier
- **Aprovechar herramientas instaladas**:
  - React 18 + TypeScript para componentes
  - Zustand para estado global
  - TanStack Query para data fetching
  - Recharts para visualizaciones
  - Zod + React Hook Form para validación
  - i18next para internacionalización
  - Vitest para testing
- **Respetar estructura de scripts** - 5 directorios consolidados (build, development, git, validation, utils)
- **No modificar** - Configuración de esbuild CSS, estructura de datos JSON, arquitectura BEM

## Preguntas de Validación

Antes de proponer cualquier solución, preguntarse:

1. **¿He leído el código existente relacionado?**
2. **¿Estoy extendiendo patrones existentes o creando nuevos?**
3. **¿Mi propuesta respeta la filosofía data-driven del proyecto?**
4. **¿Estoy usando las herramientas y librerías ya instaladas?**
5. **¿Mi diseño es consistente con el sistema existente?**

## Señales de Alerta

Si encuentras estas situaciones, DETENTE y explora más:

❌ **Creando nuevas interfaces** cuando podrías extender existentes
❌ **Proponiendo nuevas librerías** sin verificar las instaladas
❌ **Hardcodeando valores** en lugar de usar configuración JSON
❌ **Modificando componentes core** sin entender el impacto
❌ **Ignorando patrones de naming** establecidos

## Ejemplo de Aplicación

### ❌ Enfoque Incorrecto (Sin explorar codebase)
```typescript
// Crear nueva interface sin revisar las existentes
interface EnhancedFlashcardData {
  // Duplicar campos existentes...
}
```

### ✅ Enfoque Correcto (Después de explorar codebase)
```typescript
// Extender interface existente encontrada en src/types/index.ts
interface FlashcardData extends BaseLearningData {
  // Campos existentes...
  // Nuevos campos opcionales:
  contextualTips?: string[];
  memoryAids?: string[];
}
```

## Beneficios de Este Enfoque

1. **Eficiencia** - Menos iteraciones y correcciones
2. **Consistencia** - Soluciones alineadas con la arquitectura
3. **Calidad** - Aprovecha patrones probados y establecidos
4. **Mantenibilidad** - Código coherente y predecible
5. **Respeto** - Honra el trabajo y decisiones previas del desarrollador

## Aplicación en Diferentes Tipos de Tareas

### Specs y Features
- Explorar módulos relacionados antes de diseñar
- Identificar patrones de datos existentes
- Verificar componentes reutilizables

### Bug Fixes
- Entender el contexto completo del problema
- Verificar si hay patrones similares ya resueltos
- Mantener consistencia con soluciones existentes

### Refactoring
- Mapear todas las dependencias antes de cambiar
- Identificar oportunidades de reutilización
- Preservar funcionalidad existente

## Recordatorio Final

**El código existente es la documentación más precisa del proyecto.** 
Siempre empezar por ahí antes de proponer cambios o nuevas funcionalidades.