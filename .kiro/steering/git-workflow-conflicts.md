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

### ✅ Solución Implementada: build:full con pull automático

```bash
npm run build:full
```

**Qué hace**:
1. `git pull --rebase` automático
2. Ejecuta pipeline completo
3. Push sin conflictos

**Cuándo usar**: Siempre que vayas a deployar

### ❌ Opción Antigua (Ya no necesaria)

```bash
# Antes tenías que hacer:
git pull --rebase
npm run build:full

# Ahora build:full lo hace automáticamente
```

## Flujo de Trabajo Recomendado

### Desarrollo Diario

```bash
# Cuando termines y quieras deployar
npm run build:full  # Ya incluye git pull --rebase automático
```

### Si el Push Falla (Raro)

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

1. ✅ **Usa build:full directamente**
   ```bash
   npm run build:full  # Ya incluye git pull --rebase
   ```

2. ✅ **Commits frecuentes**
   - Commitea cambios importantes regularmente
   - Evita perder trabajo en conflictos

3. ✅ **Confía en el pull automático**
   - build:full maneja pulls automáticamente
   - No necesitas pull manual antes

4. ❌ **No hagas pull manual innecesario**
   - build:full ya lo hace
   - Solo si necesitas actualizar sin deployar

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

**Comando único**: `npm run build:full`

- ✅ Incluye `git pull --rebase` automático
- ✅ Previene conflictos con cron job
- ✅ Pipeline completo + deploy
- ✅ Sin pasos manuales adicionales

**Recomendación**: Usa `npm run build:full` siempre que vayas a deployar. Ya no necesitas hacer pull manual.
