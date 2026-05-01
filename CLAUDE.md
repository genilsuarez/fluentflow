# CLAUDE.md — Instrucciones para Claude Code

Fuente de verdad principal: `AGENTS.md` (reglas generales del proyecto, stack, arquitectura, BEM, validaciones).
Este archivo solo contiene **ajustes específicos** cuando Claude Code corre en la nube (claude.ai/code).

## Mapa rápido del repo

- `src/` — código React + TypeScript (componentes, stores, hooks, utils)
- `public/data/` — contenido JSON por nivel CEFR: `a1/`, `a2/`, `b1/`, `b2/`, `c1/`, `c2/`
- `public/data/learningModules.json` — registro central de todos los módulos (274+)
- `config/` — configs de Vite, Vitest, ESLint, TypeScript
- `scripts/` — validaciones, build, utils, git helpers
- `tests/` — tests de Vitest
- `.github/workflows/` — pipelines CI/CD (CI Build, CI Quality, CI Security, CD Deploy)
- `bot/` — infra local (Telegram + dashboard). **No aplica a sesiones cloud**

## Contexto de ejecución cloud

- La VM clona el repo fresco en cada sesión
- **`node_modules/` NO está presente al iniciar** — hay que instalar dependencias antes de cualquier build
- CI/CD corre automáticamente al pushear ramas y al mergear a `main`:
  - `CI Build` compila y genera el artifact de producción
  - `CI Quality` corre lint y tests
  - `CI Security` corre audit y escaneos
  - `CD Deploy` espera a los 3 y publica a GitHub Pages
- El deploy real a producción lo hace GitHub Actions, no la sesión cloud

## Paso 0 obligatorio: preparar el entorno

Antes de correr cualquier `npm run <script>`, verificar dependencias:

```bash
[ -d node_modules ] || npm ci
```

Si `npm ci` falla (por ejemplo por lockfile), usar `npm install` como fallback.
Sin esto, `build`, `validate:content`, `lint`, tests y cualquier script con deps fallarán.

## Antes de crear contenido nuevo (módulos, datos, componentes)

1. **Buscar si ya existe** antes de crear:
   - Módulos: grep en `public/data/learningModules.json` por nombre o id
   - Archivos de datos: `ls public/data/<level>/` por nivel CEFR
   - Componentes: `ls src/components/`
2. Si existe: reportar al usuario y preguntar si quiere modificarlo, no duplicar
3. Si no existe: seguir el flujo normal (leer tipos, extender interfaces, etc. — ver `AGENTS.md`)

## Validaciones en sesiones cloud

**Ejecutar (después del Paso 0):**
- `npm run build` — compilación TypeScript + Vite (confirma que el código compile)
- `npm run validate:content` — solo si se modificaron archivos en `public/data/`

**NO ejecutar en cloud (ya corren en CI al pushear):**
- `npm run build:full` — pipeline completo, redundante con CI
- `npm run lint`, `npm run test` — corren en `CI Quality`
- `npm run security:audit`, `npm run security:scan` — corren en `CI Security`
- `npm run analyze:unused`, `npm run analyze:deep` — solo bajo petición explícita

Razón: ahorra tiempo de sesión y rate limits. Si el `npm run build` pasa, CI validará el resto al pushear.

## Flujo esperado

1. Verificar `node_modules/`, correr `npm ci` si falta (Paso 0)
2. Si la tarea es crear contenido: chequear primero que no exista
3. Leer código relevante antes de cambiar (reglas de `AGENTS.md`)
4. Hacer cambios acotados al alcance de la tarea
5. Correr `npm run build` (y `validate:content` si aplica)
6. Si compila, pushear la rama
7. Abrir PR para que el usuario revise y mergee
8. El deploy a Pages ocurre solo al mergear a `main`

## Boundaries — qué NO tocar sin permiso explícito

No modificar estos archivos salvo que el usuario lo pida directamente:

- `tsconfig.json` y cualquier `config/tsconfig*.json`
- `config/vite.config.ts`, `config/vitest.config.ts`, `config/eslint.config.js`
- `.github/workflows/*.yml`
- `package.json` (dependencias y scripts)
- `public/sw.js` (service worker)
- `bot/` completo (infra local separada)

Si encuentras un error en estos archivos durante una tarea:
1. Reportar el error al usuario
2. Proponer el cambio
3. Esperar confirmación antes de aplicarlo

No "arreglar" errores pre-existentes que no son parte de la tarea pedida.

## Fuera de alcance en sesiones cloud

- **No tocar `bot/`** — infraestructura local (Telegram bot + dashboard), no aplica a la app
- **No correr servicios largos** (`npm run dev`, watchers) — la VM termina cuando cierra la sesión
- **No modificar workflows** `.github/workflows/*.yml` sin petición explícita

## Recursos de la VM

- 4 vCPUs, 16 GB RAM, 30 GB disco
- Node 20/21/22, npm/yarn/pnpm preinstalados
- `node_modules/` no viene clonado (ver Paso 0)
