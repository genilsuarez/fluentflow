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

## Validaciones en sesiones cloud — modo express

Filosofía: validar local lo suficiente para que CI no falle. No monitorear CI. Si pasa local, se pushea y se abre PR. Fin.

**Obligatorio antes de commit, en este orden:**

1. `npx prettier --write <archivos tocados>` — CI Quality corre `prettier --check`; si no aplica esto, el PR falla.
2. `npx eslint <archivos tocados> --max-warnings=0 --no-error-on-unmatched-pattern` — mismo criterio que CI.
3. `npm run build` — TS + Vite compilation check.
4. `npm run validate:content` — solo si se tocó `public/data/`.

Si el archivo tocado es `.md`, `.json` o config que no pasa por ESLint, omitir el paso 2.

**NO ejecutar nunca en cloud:**

- `npm run build:full`, `npm run test`, `npm run security:*`, `npm run analyze:*` — corren en CI o son pesados.
- `gh pr checks --watch`, `gh run watch`, sondeo de CI — **prohibido monitorear**. Gasta tokens y no aporta.

Razón: la prevención local (1-4) elimina >95% de fallos de CI. El resto se maneja solo: si CI falla por algo que no se pudo prevenir, el usuario abre una nueva sesión con el log.

## Flujo esperado — express

1. Verificar `node_modules/`, correr `npm ci` si falta (Paso 0).
2. Si la tarea es crear contenido: chequear primero que no exista (grep en `learningModules.json`).
3. Leer código relevante antes de cambiar (reglas de `AGENTS.md`).
4. Hacer cambios acotados al alcance de la tarea.
5. Correr las validaciones locales (prettier → eslint → build → validate:content si aplica).
6. Commit + push del branch.
7. Abrir PR con `gh pr create`.
8. Mergear el PR inmediatamente: `gh pr merge <num> --squash --delete-branch`.
   - Las validaciones locales del paso 5 ya confirmaron que el código está listo. No tiene sentido esperar a CI para volver a confirmar lo mismo.
   - `main` está protegida con 3 checks (`Build Application`, `Code Quality`, `Security Scan`) y `strict: true` (rama debe estar al día). El merge se dispara cuando los checks completen.
   - Si el PR queda bloqueado por `BEHIND` (rama detrás de main porque otro PR mergeó en paralelo): `gh api -X PUT repos/<owner>/<repo>/pulls/<num>/update-branch` y volver a intentar `gh pr merge`.
   - **No monitorear** el estado ni los checks. Si falla el merge por permisos o bloqueos no resueltos, reportarlo al usuario y terminar. El PR queda abierto.
9. Reportar al usuario: link del PR + resumen 1-2 líneas. **Terminar la sesión**.
10. El merge dispara `CD Deploy` → Pages. Nada más que hacer.

**Nota sobre `--auto`**: El flag `--auto` de `gh pr merge` arma un merge diferido ("auto-merge when ready"). En la práctica falla con `strict: true` porque no actualiza la rama cuando queda `BEHIND`, requiere intervención manual y genera fricción en el flujo express. **Preferir merge inmediato** (sin `--auto`). Usar `--auto` solo si el usuario lo pide explícitamente.

## Atajos en lenguaje natural (desde chat del celular)

Mapear frases cortas del usuario a comandos `gh` directamente, sin pedir confirmación ni explicar. Ejecutar y reportar en una línea.

| Frase del usuario | Acción |
|---|---|
| `merge` | `gh pr merge <PR_actual> --squash --delete-branch` |
| `actualiza` | `gh api -X PUT repos/<owner>/<repo>/pulls/<PR_actual>/update-branch` |
| `auto-merge` | `gh pr merge <PR_actual> --auto --squash --delete-branch` (solo si lo pide explícito) |
| `cerrar` | `gh pr close <PR_actual> --delete-branch` |
| `estado` | `gh pr view <PR_actual> --json state,mergeStateStatus,statusCheckRollup` resumido en 2 líneas |

Variantes equivalentes aceptadas (mismo comando):
- `merge` ≡ `mergea` ≡ `mergea ya` ≡ `merge ahora`
- `actualiza` ≡ `update branch` ≡ `desbloquea` (para PRs `BEHIND`)
- `cerrar` ≡ `cierra el PR` ≡ `descarta`

`<PR_actual>` = el PR abierto en la sesión actual. Si hay ambigüedad, el más reciente del branch activo.

Si `merge` falla con `BEHIND`: ejecutar `actualiza` y reintentar `merge` sin preguntar.

Regla: **un comando, una línea de respuesta**. Ejemplo: `✅ merged #5`. No explicar, no monitorear.

Si alguna validación local falla en el paso 5: arreglar y repetir el paso 5 (no pushear con errores). Si un fallo es irresoluble en esta sesión, reportar al usuario con el error exacto y terminar.

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
