#!/bin/bash

git add -A
git commit -m "fix(ui): render DownloadManagerModal outside parent modal

CAUSA RAIZ: DownloadManagerModal dentro de CompactAdvancedSettings
heredaba restricciones CSS del padre

SOLUCION:
- React Fragment para renderizar modales al mismo nivel
- DownloadManagerModal independiente del modal padre
- Cada modal con su propio overlay y z-index

ANTES: DownloadManagerModal DENTRO del div padre
AHORA: DownloadManagerModal FUERA, independiente"

git push
