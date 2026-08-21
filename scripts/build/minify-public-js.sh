#!/usr/bin/env bash
# Genera un <archivo>.min.js junto a cada script clásico de public/.
#
# Vite copia publicDir a dist/ verbatim: no lo pasa por el bundler ni lo
# minifica. Los scripts compartidos (lp-login.js, lp-analytics.js, …) se cargan
# vía <script src> desde index.html, así que sin este paso llegaban a producción
# sin minificar. Espejo de HubFlow/DeskFlow/LyricFlow scripts/minify-js.sh.
#
# Corre al inicio de `npm run build`, después de que copy-shared.sh haya
# refrescado los fuentes, así el .min.js nunca queda desactualizado.
# index.html enlaza los .min.js; el .js original queda como fuente editable.
set -euo pipefail
cd "$(dirname "$0")/../../public"

ESBUILD_VERSION="0.24.0"

shopt -s nullglob
for js in *.js; do
  [[ "$js" == *.min.js ]] && continue
  [[ "$js" == "sw.js" ]] && continue # service worker: se sirve por ruta fija
  if grep -qE '^\s*(export |import )' "$js"; then
    continue # módulo ES, no tocar
  fi
  out="${js%.js}.min.js"
  npx --yes "esbuild@${ESBUILD_VERSION}" "$js" --minify --outfile="$out" --log-level=warning
  echo "  ✓ $js → $out"
done
