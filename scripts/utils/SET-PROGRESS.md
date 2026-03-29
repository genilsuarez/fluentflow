# set-progress.js — Herramienta de testing

> ⚠️ **NO BORRAR** — Este script y su documentación son necesarios para pruebas de progresión y QA.

## Qué hace

Genera snippets de JavaScript para pegar en la consola del navegador y simular progreso de módulos completados. Actualiza los tres stores de Zustand en localStorage:

- `progress-storage` — completedModules (desbloqueo de módulos)
- `user-storage` — userScores (scores por módulo, stats globales)
- `app-storage` — globalScore (correct/incorrect/accuracy del header)

## Por qué existe

El sistema de progresión es lineal: cada módulo requiere completar el anterior. Para testear módulos de niveles avanzados (B1, B2, etc.) hay que completar todos los anteriores primero. Este script automatiza eso.

Cada `--user-data-dir` de Chrome tiene su propio localStorage aislado, así que al usar Chrome con remote debugging (`/tmp/chrome-debug-profile`) el progreso es independiente del navegador normal.

## Uso

```bash
# Completar todo A1+A2 (desbloquea primer B1):
node scripts/utils/set-progress.js --level a2

# Completar hasta B1 inclusive:
node scripts/utils/set-progress.js --level b1

# Completar hasta un módulo específico (sin incluirlo):
node scripts/utils/set-progress.js --upto sorting-modal-verbs-b1

# Ver qué haría sin generar nada:
node scripts/utils/set-progress.js --level b1 --dry

# Listar módulos de un nivel:
node scripts/utils/set-progress.js --list b1

# Resetear todo el progreso:
node scripts/utils/set-progress.js --reset

# Score custom (default 90):
node scripts/utils/set-progress.js --level a2 --score 75

# Output JSON en vez de snippet:
node scripts/utils/set-progress.js --level a2 --json
```

## Workflow

1. Ejecutar el script con el nivel/módulo deseado
2. Copiar el snippet generado (stdout)
3. Abrir la consola del navegador (F12 → Console)
4. Pegar y ejecutar
5. Recargar la página (F5)

## Niveles disponibles

| Nivel | Nombre | Módulos |
|-------|--------|---------|
| a1 | Beginner (Foundation) | 26 |
| a2 | Elementary | 28 |
| b1 | Intermediate | 31 |
| b2 | Upper Intermediate | 26 |
| c1 | Advanced | 26 |
| c2 | Proficient | 26 |

## Notas

- `--level X` completa todos los módulos del nivel X y los anteriores
- `--upto moduleId` completa todos los módulos anteriores al indicado (sin incluirlo)
- El snippet es idempotente: no duplica módulos ya completados
- El score afecta el cálculo de accuracy en el header (correct/incorrect se derivan del %)
- Para ver IDs de módulos: `--list` o `--list <nivel>`
