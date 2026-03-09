---
inclusion: auto
---

# Git Workflow: Prevención de Conflictos con Cron Jobs

## Problema

El cron job de mantenimiento hace commits automáticos cada 5 días. Si trabajas localmente sin hacer `git pull`, tu repo local queda desactualizado y `npm run build:full` fallará al intentar push.

## Escenario de Conflicto

```
Día 1: Trabajas localmente, haces cambios
Día 5: Cron job hace commit vacío en remoto
Día 6: Ejecutas npm run build:full
       ❌ Push falla: "Updates were rejected"
```

## Soluciones

### ✅ Opción 1: build:safe (Recomendado)

```bash
npm run build:safe
```

**Qué hace**:
1. `git pull --rebase` automático
2. Ejecuta pipeline completo
3. Push sin conflictos

**Cuándo usar**: Siempre que vayas a hacer `build:full`

### ✅ Opción 2: Pull Manual + build:full

```bash
# Paso 1: Pull primero
git pull --rebase

# Paso 2: Build completo
npm run build:full
```

**Cuándo usar**: Si prefieres control manual del pull

### ❌ Opción 3: build:full directo (Riesgoso)

```bash
npm run build:full  # ❌ Puede fallar si hay commits remotos
```

**Problema**: Si el cron job corrió, el push fallará.

## Flujo de Trabajo Recomendado

### Desarrollo Diario

```bash
# 1. Antes de empezar a trabajar
git pull --rebase

# 2. Hacer cambios locales
# ... editar archivos ...

# 3. Cuando termines y quieras deployar
npm run build:safe
```

### Si el Push Falla

```bash
# Error: "Updates were rejected"

# Solución:
git pull --rebase
git push
```

## Cómo Funciona git pull --rebase

```bash
# Escenario:
# Local:  A - B - C (tus commits)
# Remote: A - B - D (commit del cron job)

git pull --rebase

# Resultado:
# Local:  A - B - D - C (tu commit después del cron)
# Remote: A - B - D
```

**Ventajas**:
- Historial lineal (sin merge commits)
- Tus cambios se aplican después de los remotos
- Compatible con el flujo del proyecto

## Prevención Automática

### En el Cron Job (Ya implementado)

El workflow de mantenimiento ya maneja conflictos:

```yaml
- name: Push changes
  run: |
    if ! git push 2>&1; then
      git pull --rebase
      git push
    fi
```

### En tu Workflow Local

Usa `npm run build:safe` que incluye `git pull --rebase` automático.

## Casos Especiales

### Si Tienes Cambios Sin Commitear

```bash
# Error: "Cannot pull with rebase: You have unstaged changes"

# Solución 1: Stash temporal
git stash
git pull --rebase
git stash pop

# Solución 2: Commit primero
git add .
git commit -m "wip: work in progress"
git pull --rebase
```

### Si Hay Conflictos Reales

```bash
# Durante git pull --rebase
# CONFLICT (content): Merge conflict in file.ts

# Resolver conflictos:
# 1. Editar archivos con conflictos
# 2. Marcar como resueltos
git add file.ts

# 3. Continuar rebase
git rebase --continue

# O abortar si prefieres
git rebase --abort
```

## Best Practices

1. ✅ **Siempre pull antes de push**
   ```bash
   git pull --rebase && npm run build:full
   # O simplemente: npm run build:safe
   ```

2. ✅ **Pull al inicio del día**
   ```bash
   git pull --rebase
   ```

3. ✅ **Commits frecuentes**
   - Commitea cambios importantes antes de pull
   - Evita perder trabajo en conflictos

4. ✅ **Usar build:safe por defecto**
   - Más seguro que build:full
   - Maneja pulls automáticamente

5. ❌ **Evitar build:full sin pull**
   - Alto riesgo de conflictos
   - Puede fallar el push

## Comandos de Referencia

```bash
# Ver estado del repo
git status

# Ver commits remotos que no tienes
git fetch
git log HEAD..origin/main

# Ver commits locales que no están en remoto
git log origin/main..HEAD

# Pull con rebase (recomendado)
git pull --rebase

# Pull con merge (no recomendado para este proyecto)
git pull

# Push forzado (⚠️ PELIGROSO - solo si sabes lo que haces)
git push --force-with-lease
```

## Resumen

| Comando | Pull Automático | Seguridad | Recomendado |
|---------|----------------|-----------|-------------|
| `npm run build:safe` | ✅ Sí | 🟢 Alta | ✅ Sí |
| `git pull && npm run build:full` | ⚠️ Manual | 🟡 Media | ⚠️ OK |
| `npm run build:full` | ❌ No | 🔴 Baja | ❌ No |

**Recomendación**: Usa `npm run build:safe` siempre que vayas a deployar.
