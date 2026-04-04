# Investigación: Token Usage en kiro-cli

**Fecha**: 2026-04-03  
**Resultado**: kiro-cli NO expone conteo de tokens

## Qué se investigó

- `kiro-cli chat --help` — sin flag para tokens
- Modo verbose / stderr — solo muestra `Time: Xs`, sin tokens
- Logs internos de kiro-cli — campo `usage_info: []` siempre vacío
- Telemetría (`ChatAddMessageEvent`) — tiene `response_length` y `request_length` pero no son token counts
- Slash command `/usage` — muestra billing/credits pero es interactivo, no scripteable
- Subcomando `kiro-cli user` — sin opciones de token reporting
- GitHub issues — sin feature requests ni implementación conocida
- Web — sin documentación sobre esta funcionalidad

## Conclusión

No hay forma actual de obtener token usage programáticamente desde kiro-cli. El campo `usage_info` existe en la estructura interna pero siempre retorna vacío. La única referencia a consumo es el comando interactivo `/usage` que muestra créditos de billing, no tokens por sesión.

## Código existente en el bot

El bot tiene una función `extractTokenUsage` preparada para parsear tokens, pero no recibe datos porque kiro-cli no los emite.
