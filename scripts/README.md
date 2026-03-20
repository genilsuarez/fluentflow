# Scripts de Utilidades

Herramientas organizadas por funcionalidad para el mantenimiento del proyecto.

## Estructura

### build/
- `security-patterns.js` - Deteccion de patrones de seguridad peligrosos

### development/
- `dev-tools.js` - Orquestador de pipelines (quality/security/build/full)
- `simulate-github-pages.js` - Simulacion local de GitHub Pages

### devtools/
- `validate-learning-modes.md` - Tests E2E para los 6 modos de aprendizaje
- `validate-modals.md` - Tests E2E para los 10 modales de la app
- `automated-offline-test.md` - Tests de modo offline y PWA
- Artifacts de testing (screenshots, snapshots, traces)

### git/
- `smart-commit.js` - Commits inteligentes con AI
- `github-actions-status.js` - Estado de GitHub Actions
- `validate-pages-deployment.js` - Validacion de deployments

### validation/
- `validate-all.js` - Orquestador maestro (data-paths + BEM; con --full incluye analyze-unused + deep-analysis)
- `validate-bem.js` - Validacion BEM en TSX
- `validate-data-paths.js` - Verificacion de datos JSON y rutas
- `analyze-unused.js` - 17 pasadas: archivos huerfanos, exports muertos, CSS sin uso, BEM, !important audit
- `deep-analysis.js` - 30 pasadas en 3 grupos (DA+DB+DC): CSS quality, cross-file, JSON integrity
- `audit-content.js` - Auditoria de contenido educativo
- `audit-modules.js` - Auditoria de modulos y dependencias

### utils/
- `logger.js` - Sistema de logging compartido
- `git-utils.js` - Operaciones de Git
- `cleanup.js` - Limpieza de artifacts de build

## Uso Rapido

```bash
# Pipelines
npm run pipeline           # Interactivo
npm run pipeline:quality   # Lint + types + tests
npm run pipeline:build     # Build produccion
npm run pipeline:all       # Todo

# Validacion
npm run validate:all       # Data + BEM
npm run validate:full      # Data + BEM + analyze-unused + deep-analysis (47 pasadas)
npm run validate:bem       # Solo BEM
npm run validate:data      # Solo datos JSON

# Analisis profundos
npm run analyze:unused     # 17 pasadas CSS/JS
npm run analyze:deep       # DA+DB+DC (30 pasadas)
npm run analyze:deep:da    # Solo DA-1..DA-10 (CSS/TSX quality)
npm run analyze:deep:db    # Solo DB-1..DB-10 (cross-file & runtime)
npm run analyze:deep:dc    # Solo DC-1..DC-10 (JSON data integrity)

# Seguridad
npm run security:audit     # npm audit
npm run security:scan      # Patrones peligrosos

# Modulos y limpieza
npm run audit:modules      # Auditoria de modulos
npm run clean              # Limpieza de artifacts

# Git
npm run commit             # Smart commit interactivo
npm run commit:push        # Stage all + commit + push
npm run gh:status          # Estado GitHub Actions
npm run gh:current         # Workflows activos
npm run gh:watch           # Monitorear en tiempo real
npm run deploy:status      # Estado deployment
```

## DevTools Testing

Tests E2E con Chrome DevTools MCP contra produccion. Ver `scripts/devtools/README.md` para setup y workflow.

```bash
# Post-deploy rapido: ejecutar checklists finales de cada script
# Regresion completa: ejecutar los 3 scripts en orden
```
