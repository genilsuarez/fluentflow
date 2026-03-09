---
inclusion: auto
---

# CI/CD Maintenance Guidelines

## Cron Jobs Activos

### CI Security (Diario)
- **Schedule**: `0 2 * * *` (2 AM UTC diario)
- **Propósito**: Auditoría de seguridad automática
- **Acciones**:
  - npm audit (high, production, critical)
  - Security patterns check (eval, secrets)
  - TruffleHog secret scan

## Artifact Retention

### Build Artifacts
- **Retention**: 7 días
- **Naming**: `build-files-{commit-sha}`
- **Problema conocido**: CD Deploy falla si el artifact expiró

### Solución para Artifacts Expirados

Si el CD Deploy falla con "artifact not found":

```bash
# Opción 1: Forzar nuevo deploy (recompila)
gh workflow run "CD Deploy" --field force-deploy=true

# Opción 2: Trigger completo (recomendado)
git commit --allow-empty -m "chore: trigger CI/CD pipelines"
git push
```

## Mantenimiento Preventivo

### Cada 7 días (antes de expiración de artifacts)
Si no hay commits nuevos pero quieres mantener el deployment actualizado:

```bash
npm run build:full
```

Esto ejecuta:
1. Quality pipeline (lint, type-check, tests, format)
2. Security pipeline (audit, patterns)
3. Build pipeline (tsc + vite build)
4. Commit + Push automático
5. Trigger de GitHub Actions
6. Deploy automático

### Monitoreo de Seguridad

El cron job diario de seguridad puede fallar si:
- Nuevas vulnerabilidades en dependencias
- Patrones inseguros detectados (eval, secrets)
- Cambios en políticas de seguridad

**Acción requerida**: Revisar logs y actualizar dependencias

```bash
# Ver últimas ejecuciones del security workflow
npm run gh:status

# Ver logs de un workflow específico
gh run view <run-id> --log-failed
```

## Prevención de Fallos

### 1. Commits Regulares
- Hacer commits al menos cada 5-6 días
- Esto mantiene artifacts frescos y deployment actualizado

### 2. Monitoreo Proactivo
```bash
# Verificar estado de deployment
npm run deploy:status

# Verificar workflows activos
npm run gh:current
```

### 3. Build Local Antes de Push
```bash
# Validar localmente antes de push
npm run build:full
```

## Troubleshooting

### CD Deploy Failed: "artifact not found"
**Causa**: Artifact del CI Build expiró (>7 días)

**Solución**:
```bash
# Trigger nuevo build completo
git commit --allow-empty -m "chore: refresh build artifacts"
git push
```

### Security Workflow Failed
**Causa**: Vulnerabilidades detectadas o patrones inseguros

**Solución**:
```bash
# Revisar vulnerabilidades
npm audit

# Actualizar dependencias
npm update

# Verificar patrones de seguridad
npm run security:scan
```

### GitHub Pages 404
**Causa**: GitHub Pages no configurado o deployment fallido

**Solución**:
```bash
# Verificar configuración
gh api repos/gsphome/englishgame6/pages

# Si no está configurado, habilitar
gh api --method POST repos/gsphome/englishgame6/pages --field build_type=workflow

# Forzar redeploy
gh workflow run "CD Deploy" --field force-deploy=true
```

## Best Practices

1. **Commits frecuentes** - Al menos cada 5 días para mantener artifacts
2. **Monitoreo diario** - Revisar notificaciones de GitHub Actions
3. **Build local primero** - Usar `npm run build:full` antes de push importante
4. **Validar deployment** - Usar `npm run deploy:status` después de deploy
5. **Actualizar dependencias** - Revisar `npm audit` semanalmente

## Comandos Útiles

```bash
# Pipeline completo local + deploy
npm run build:full

# Verificar estado de deployment
npm run deploy:status

# Ver workflows activos
npm run gh:current

# Monitorear workflows en tiempo real
npm run gh:watch

# Ver logs de workflow fallido
gh run view <run-id> --log-failed

# Forzar deploy sin validaciones
gh workflow run "CD Deploy" --field force-deploy=true
```

## Notas Importantes

- Los artifacts expiran después de 7 días (configurado en ci-build.yml)
- El cron job de seguridad corre diariamente a las 2 AM UTC
- GitHub Pages requiere `build_type: workflow` para GitHub Actions deployment
- El CD Deploy solo se dispara cuando todos los CI pipelines pasan
