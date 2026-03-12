# DevTools Test Artifacts

Este directorio contiene todos los artifacts generados por Chrome DevTools MCP durante testing y debugging.

## Estructura

```
scripts/devtools/
├── README.md                           # Este archivo
├── {categoria}-{numero}-{desc}.png     # Screenshots
├── {categoria}-{numero}-{desc}.txt     # DOM snapshots
├── {categoria}-{numero}-{desc}.json    # Performance traces
└── {categoria}-test-results.md         # Reportes de testing
```

## Convención de Nombres

### Formato
```
{categoria}-{numero}-{descripcion}.{extension}
```

### Categorías
- `offline-` - Testing de modo offline y PWA
- `edge-` - Casos de borde y edge cases
- `perf-` - Performance testing y audits
- `network-` - Network debugging y API calls
- `issue-` - Debugging de issues específicos
- `visual-` - Testing visual y screenshots comparativos

### Ejemplos
```
offline-test-01-initial-online.png
offline-test-02-offline-activated.txt
edge-01-module-online.png
perf-01-lighthouse-report.json
network-01-api-calls.txt
issue-123-snapshot.txt
```

## Tipos de Archivos

### Screenshots (.png, .jpg)
Capturas visuales de la aplicación en diferentes estados.

**Uso:**
```javascript
take_screenshot(
  filePath: "scripts/devtools/offline-01-screenshot.png",
  fullPage: true
)
```

### Snapshots (.txt)
Estructura DOM (a11y tree) con UIDs para interacción.

**Uso:**
```javascript
take_snapshot(
  filePath: "scripts/devtools/offline-01-snapshot.txt"
)
```

### Performance Traces (.json)
Datos de performance traces para análisis detallado.

**Uso:**
```javascript
performance_stop_trace(
  filePath: "scripts/devtools/perf-01-trace.json"
)
```

### Reportes (.md)
Documentación de resultados de testing con análisis y conclusiones.

## Limpieza

Los artifacts antiguos deben limpiarse periódicamente:

```bash
# Eliminar artifacts de más de 30 días
find scripts/devtools -type f -mtime +30 -delete

# Eliminar todos los artifacts (mantener README)
find scripts/devtools -type f ! -name 'README.md' -delete
```

## Gitignore

Los artifacts NO deben commitearse a git (excepto reportes importantes):

```gitignore
# En .gitignore
scripts/devtools/*.png
scripts/devtools/*.jpg
scripts/devtools/*.txt
scripts/devtools/*.json
!scripts/devtools/README.md
!scripts/devtools/*-results.md
```

## Referencia

Ver skill completo: `~/.kiro/skills/chrome-devtools-debugging.md`
