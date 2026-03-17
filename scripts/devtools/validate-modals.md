# Validate Modals

11 modales + validaciones generales (z-index, scroll lock, a11y, dark mode, responsive).

> Prerequisitos y setup en [README.md](README.md). Ejecutar "Antes de empezar" primero.

---

## 1. Side Menu (Hamburger)

### Abrir

```
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true
```

- [ ] Overlay oscuro visible (`.header-side-menu-overlay`)
- [ ] Panel lateral con heading "FluentFlow"
- [ ] Secciones: "Main Navigation", "Configuration", "User Account"
- [ ] Items: Main Menu, Progress Dashboard, Learning Path, Advanced Settings, About FluentFlow

### Cerrar con overlay

```
mcp_chrome_devtools_click
uid: {uid-overlay}
includeSnapshot: true
```

- [ ] Side menu cerrado, overlay desapareció

### Cerrar con Escape

```
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_press_key
key: "Escape"
includeSnapshot: true
```

- [ ] Side menu cerrado con Escape

### Navegación

```
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-main-menu-item}
includeSnapshot: true
```

- [ ] Side menu se cerró automáticamente
- [ ] URL es `#/menu`

---

## 2. Profile (CompactProfile)

### Abrir desde header

```
mcp_chrome_devtools_click
uid: {uid-login-btn}
includeSnapshot: true
```

- [ ] Modal visible con overlay
- [ ] Heading "User Profile"
- [ ] Botón X de cierre (`.modal__close-btn`)
- [ ] Body scroll deshabilitado
- [ ] Secciones: "Basic Info", "Preferences", "Interested Categories"

### Campos del formulario

- [ ] Input "Name" (text, required)
- [ ] Select "English Level" (beginner/intermediate/advanced)
- [ ] Select "Language" (English/Español)
- [ ] Input "Daily Goal" (number, 1-100)
- [ ] Range "Difficulty" (1-5, emoji + label)
- [ ] Checkboxes categorías: Vocabulary, Grammar, PhrasalVerbs, Idioms
- [ ] Checkbox "Enable Notifications"
- [ ] Botón "Save Profile"

### Guardar

```
mcp_chrome_devtools_fill
uid: {uid-name-input}
value: "Test User"

mcp_chrome_devtools_fill
uid: {uid-level-select}
value: "intermediate"

mcp_chrome_devtools_click
uid: {uid-save-btn}
includeSnapshot: true
```

- [ ] Modal se cerró
- [ ] Header muestra "Test User"

### Validación (nombre vacío)

```
mcp_chrome_devtools_click
uid: {uid-user-btn}
includeSnapshot: true

mcp_chrome_devtools_fill
uid: {uid-name-input}
value: ""

mcp_chrome_devtools_click
uid: {uid-save-btn}
includeSnapshot: true
```

- [ ] Modal NO se cerró
- [ ] Error visible bajo campo nombre

### Cerrar con Escape

```
mcp_chrome_devtools_press_key
key: "Escape"
includeSnapshot: true
```

- [ ] Modal cerrado sin guardar, body scroll restaurado

---

## 3. Settings (CompactAdvancedSettings)

### Abrir desde side menu

```
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-settings-item}
includeSnapshot: true
```

- [ ] Side menu se cerró
- [ ] Settings modal visible
- [ ] Heading "Advanced Settings" con ⚙️
- [ ] Body scroll deshabilitado
- [ ] 4 tabs: General, Games, Categories, Offline

### Tab General (default)

- [ ] Select "Theme" (light/dark)
- [ ] Select "Language" (English/Español)
- [ ] Select "Level" (A1-C2)
- [ ] Toggle "Development Mode"
- [ ] Toggle "Randomize Items"

### Tab Games

```
mcp_chrome_devtools_click
uid: {uid-games-tab}
includeSnapshot: true
```

- [ ] Tab activo (`.compact-settings__tab--active`)
- [ ] Campos de configuración de juegos visibles

### Tab Categories

```
mcp_chrome_devtools_click
uid: {uid-categories-tab}
includeSnapshot: true
```

- [ ] Lista de categorías con toggles

### Tab Offline

```
mcp_chrome_devtools_click
uid: {uid-offline-tab}
includeSnapshot: true
```

- [ ] Toggle "Enable Offline Mode"
- [ ] Checkboxes de niveles (A1-C2)
- [ ] Botón "Download" o "Manage Downloads"

### Cambiar tema

```
mcp_chrome_devtools_click
uid: {uid-general-tab}
includeSnapshot: true

mcp_chrome_devtools_fill
uid: {uid-theme-select}
value: "dark"

mcp_chrome_devtools_click
uid: {uid-save-btn}
includeSnapshot: true

mcp_chrome_devtools_evaluate_script
function: "() => document.documentElement.classList.contains('dark')"
```

- [ ] Modal cerrado, tema cambió

### Cerrar con Escape

```
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-settings-item}
includeSnapshot: true

mcp_chrome_devtools_press_key
key: "Escape"
includeSnapshot: true
```

- [ ] Modal cerrado, body scroll restaurado

---

## 4. About (CompactAbout)

### Abrir

```
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-about-item}
includeSnapshot: true
```

- [ ] Side menu cerrado
- [ ] About modal visible, logo FluentFlow
- [ ] Body scroll deshabilitado

### Contenido

- [ ] App Info: Version "2.0.0", Platform "Web", Build date
- [ ] Features: 4 items con emojis (📚, 🎯, 📊, 🌐)
- [ ] Developer: "Genil Suárez" con link GitHub
- [ ] Tech Stack: React, TypeScript, CSS, Zustand, Vite
- [ ] Botón "Close" en footer

### Screen Info sub-modal

```
mcp_chrome_devtools_click
uid: {uid-react-tech-item}
includeSnapshot: true
```

- [ ] Sub-modal "Screen Information" sobre About
- [ ] Campos: Resolution, Viewport, Pixel Ratio, Color Depth, Orientation

```
mcp_chrome_devtools_click
uid: {uid-screen-info-close}
includeSnapshot: true
```

- [ ] Sub-modal cerrado, About sigue visible

### Cerrar About

```
mcp_chrome_devtools_click
uid: {uid-close-btn}
includeSnapshot: true
```

- [ ] About cerrado, body scroll restaurado

### Escape cierra ambos modales

```
# Reabrir About + Screen Info
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-about-item}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-react-tech-item}
includeSnapshot: true

mcp_chrome_devtools_press_key
key: "Escape"
includeSnapshot: true
```

- [ ] Ambos modales cerrados

---

## 5. Progress Dashboard (CompactProgressDashboard)

```
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-progress-item}
includeSnapshot: true
```

- [ ] Heading "Progress Dashboard" con BarChart3
- [ ] Score total: correct, incorrect, accuracy %
- [ ] Body scroll deshabilitado

```
mcp_chrome_devtools_click
uid: {uid-continue-btn}
includeSnapshot: true
```

- [ ] Modal cerrado, scroll restaurado

---

## 6. Learning Path (CompactLearningPath)

```
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-learning-path-item}
includeSnapshot: true
```

- [ ] Heading "Learning Path" con MapPin
- [ ] Progress Overview: X%, módulos X/Y
- [ ] 6 círculos SVG (A1-C2) con porcentaje
- [ ] Body scroll deshabilitado

```
mcp_chrome_devtools_click
uid: {uid-continue-btn}
includeSnapshot: true
```

- [ ] Modal cerrado, scroll restaurado

---

## 7. Download Manager (DownloadManagerModal)

> Se abre desde Settings → tab Offline → "Manage Downloads"

```
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-settings-item}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-offline-tab}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-manage-downloads-btn}
includeSnapshot: true
```

- [ ] Download Manager visible sobre Settings
- [ ] Lista de niveles descargados (o estado vacío)

### Cerrar

```
mcp_chrome_devtools_press_key
key: "Escape"
includeSnapshot: true
```

- [ ] Download Manager cerrado, Settings sigue visible

---

## 8. Sorting Summary Modal

> Requiere completar el ejercicio completo primero.

### Completar ejercicio

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/sorting-word-categories-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Drag and drop words"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
# Arrastrar todas las palabras (snapshot después de cada drag)
# Click "Check Answers"
```

### Abrir summary

```
mcp_chrome_devtools_click
uid: {uid-view-summary}
includeSnapshot: true
```

- [ ] Modal overlay (`.sorting-modal`, z-index 50)
- [ ] Header naranja (gradient `#ea580c → #f97316`)
- [ ] Heading "Exercise Summary"
- [ ] Results grid: cards correctas (verde ✓), incorrectas (rojo ✗)
- [ ] Cada card: palabra, categoría correcta
- [ ] Cards incorrectas: "Your Answer" con categoría elegida

### Scroll en modal

```
mcp_chrome_devtools_evaluate_script
function: "() => {
  const content = document.querySelector('.sorting-modal__content');
  if (!content) return { error: 'no content' };
  return { scrollHeight: content.scrollHeight, clientHeight: content.clientHeight, isScrollable: content.scrollHeight > content.clientHeight };
}"
```

### Cerrar

```
mcp_chrome_devtools_click
uid: {uid-close-button}
includeSnapshot: true
```

- [ ] Modal cerrado
- [ ] Ejercicio sigue visible con resultados (no se reinició)

---

## 9. Matching Summary Modal

> Requiere completar el ejercicio completo primero. Incluye body scroll management.

### Completar ejercicio

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/matching-common-verbs-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Click items from both columns"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
# Emparejar todos los items → Click "Check Matches"
```

### Abrir summary

```
mcp_chrome_devtools_click
uid: {uid-view-summary}
includeSnapshot: true
```

- [ ] Modal overlay (`.matching-modal`, z-index 50)
- [ ] Glassmorphism (`backdrop-filter: blur(20px)`)
- [ ] Header violeta (gradient `#8b5cf6 → #6366f1`)
- [ ] Heading "Exercise Summary"
- [ ] Cards correctas: fondo verde, icono ✓
- [ ] Cards incorrectas: fondo rojo, icono ✗, respuesta tachada

### Verificar scroll lock

```
mcp_chrome_devtools_evaluate_script
function: "() => ({
  hasModalOpen: document.body.classList.contains('modal-open'),
  scrollY: document.documentElement.style.getPropertyValue('--scroll-y'),
  bodyOverflow: getComputedStyle(document.body).overflow
})"
```

- [ ] `hasModalOpen: true`
- [ ] `bodyOverflow: "hidden"`

### Individual explanation (botón ℹ️)

```
# Cerrar summary primero
mcp_chrome_devtools_click
uid: {uid-close-button}
includeSnapshot: true

# Click info de un par
mcp_chrome_devtools_click
uid: {uid-info-btn}
includeSnapshot: true
```

- [ ] Vista individual con término, traducción, explicación
- [ ] Borde izquierdo violeta (`border-left: 3px solid #8b5cf6`)

### Cerrar y verificar scroll restore

```
mcp_chrome_devtools_click
uid: {uid-close-button}
includeSnapshot: true

mcp_chrome_devtools_evaluate_script
function: "() => ({
  hasModalOpen: document.body.classList.contains('modal-open'),
  bodyOverflow: getComputedStyle(document.body).overflow
})"
```

- [ ] `hasModalOpen: false`
- [ ] Body scroll restaurado
- [ ] Posición no saltó al top

### Keyboard

```
# Reabrir summary
mcp_chrome_devtools_click
uid: {uid-view-summary}
includeSnapshot: true

mcp_chrome_devtools_press_key
key: "Escape"
includeSnapshot: true
```

- [ ] Cerrado con Escape, scroll restaurado

---

## 10. Modales dentro de learning modes

Verificar que abrir/cerrar modales no afecta el estado del learning mode activo.

### Settings dentro de Quiz

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/quiz-basic-vocabulary-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Which word means", "What does"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
# ANOTAR: pregunta, index, score

mcp_chrome_devtools_click
uid: {uid-opcion}
includeSnapshot: true
# ANOTAR: score actualizado

# Abrir Settings
mcp_chrome_devtools_click
uid: {uid-menu-btn}
includeSnapshot: true

mcp_chrome_devtools_click
uid: {uid-settings-item}
includeSnapshot: true

mcp_chrome_devtools_press_key
key: "Escape"
includeSnapshot: true
```

- [ ] Misma pregunta, score, index que antes de abrir Settings

### About y Profile dentro de Quiz

Repetir abriendo About y Profile desde side menu:
- [ ] Estado del quiz intacto en cada caso

### Otros modos

Repetir desde Completion (`completion-basic-sentences-a1`) y Flashcard (`flashcard-basic-vocabulary-a1`):
- [ ] Completion: misma oración, input, score
- [ ] Flashcard: misma tarjeta, index, estado flip

---

## 11. Validaciones generales

### 11a. Z-index stacking

```
mcp_chrome_devtools_evaluate_script
function: "() => {
  const zIndexes = {};
  ['.header-side-menu-overlay', '.header-side-menu', '.compact-profile', '.compact-settings', '.compact-about', '.compact-progress-dashboard', '.compact-learning-path', '.sorting-modal', '.matching-modal', '.screen-info-modal'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) zIndexes[sel] = getComputedStyle(el).zIndex;
  });
  return zIndexes;
}"
```

- [ ] Side menu overlay: 40, Side menu: 50
- [ ] Modales principales: 50
- [ ] Screen info: 60

### 11b. Body scroll prevention

```
mcp_chrome_devtools_evaluate_script
function: "() => {
  const sheets = Array.from(document.styleSheets);
  let hasRule = false;
  for (const sheet of sheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        if (rule.selectorText?.includes('body:has(.compact-')) { hasRule = true; break; }
      }
    } catch(e) {}
    if (hasRule) break;
  }
  return { hasScrollPreventionRule: hasRule };
}"
```

- [ ] `hasScrollPreventionRule: true`

### 11c. Portal rendering

```
mcp_chrome_devtools_evaluate_script
function: "() => {
  const header = document.querySelector('header');
  const results = {};
  ['.compact-profile', '.compact-settings', '.compact-about', '.compact-progress-dashboard', '.compact-learning-path'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) results[sel] = { parentTag: el.parentElement?.tagName, isInHeader: header?.contains(el) };
  });
  return results;
}"
```

- [ ] Todos: `parentTag: "BODY"`, `isInHeader: false`

### 11d. Accessibility

```
mcp_chrome_devtools_evaluate_script
function: "() => {
  const modals = document.querySelectorAll('.compact-profile, .compact-settings, .compact-about, .compact-progress-dashboard, .compact-learning-path, .sorting-modal, .matching-modal');
  return Array.from(modals).map(m => ({
    class: m.className.split(' ')[0],
    hasCloseAriaLabel: !!m.querySelector('[aria-label]'),
    hasHeading: !!m.querySelector('h2, h3')
  }));
}"
```

- [ ] Cada modal tiene close con `aria-label` y heading

### 11e. Touch targets ≥ 44px

```
mcp_chrome_devtools_evaluate_script
function: "() => {
  const btns = document.querySelectorAll('.modal__close-btn, .sorting-modal__close-btn, .matching-modal__close-btn');
  return Array.from(btns).map(b => {
    const r = b.getBoundingClientRect();
    return { class: b.className, width: r.width, height: r.height, ok: r.width >= 44 && r.height >= 44 };
  });
}"
```

- [ ] Todos `ok: true`

### 11f. Reduced motion

```
mcp_chrome_devtools_evaluate_script
function: "() => {
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        if (rule.conditionText?.includes('prefers-reduced-motion')) return { supported: true };
      }
    } catch(e) {}
  }
  return { supported: false };
}"
```

- [ ] `supported: true`

### 11g. Console limpia

```
mcp_chrome_devtools_evaluate_script
function: "() => { console.clear(); return 'cleared'; }"

# Abrir y cerrar side menu rápidamente
mcp_chrome_devtools_evaluate_script
function: "() => {
  const btn = document.querySelector('[aria-label*=\"menu\" i], [aria-label*=\"Menu\" i]');
  if (btn) btn.click();
  setTimeout(() => {
    const overlay = document.querySelector('.header-side-menu-overlay');
    if (overlay) overlay.click();
  }, 300);
  return 'triggered';
}"

mcp_chrome_devtools_list_console_messages
types: ["error", "warn"]
pageSize: 20
```

- [ ] Sin errores de React ni memory leaks

### 11h. Dark mode

```
mcp_chrome_devtools_evaluate_script
function: "() => { document.documentElement.classList.add('dark'); return 'dark'; }"
```

Abrir cualquier modal y verificar:
- [ ] Background oscuro, texto legible, bordes visibles

### 11i. Mobile responsive

```
mcp_chrome_devtools_resize_page
width: 375
height: 667
```

- [ ] Side menu: `min(85vw, 320px)`
- [ ] Modales no desbordan viewport
- [ ] Botones accesibles con touch

```
mcp_chrome_devtools_resize_page
width: 1280
height: 800
```

---

## Inventario de modales

| # | Modal | CSS Class | Escape | Portal | Scroll Lock |
|---|-------|-----------|--------|--------|-------------|
| 1 | Side Menu | `.header-side-menu` | ✓ | No | No |
| 2 | Profile | `.compact-profile` | ✓ | ✓ | CSS `body:has()` |
| 3 | Settings | `.compact-settings` | ✓ | ✓ | CSS `body:has()` |
| 4 | About | `.compact-about` | ✓ | ✓ | CSS `body:has()` |
| 5 | Screen Info | `.screen-info-modal` | Via parent | No | Hereda |
| 6 | Progress | `.compact-progress-dashboard` | ✓ | ✓ | CSS `body:has()` |
| 7 | Learning Path | `.compact-learning-path` | ✓ | ✓ | CSS `body:has()` |
| 8 | Download Mgr | `.download-manager` | ✓ | No | Hereda |
| 9 | Sorting Summary | `.sorting-modal` | No | No | Overlay |
| 10 | Matching Summary | `.matching-modal` | ✓ Esc/Enter | No | JS `modal-open` |

---

## Checklist rápido

```
[ ] Side menu: abre, cierra con overlay, cierra con Escape
[ ] Profile: form valida, guarda, cierra con Escape
[ ] Settings: 4 tabs, guarda cambios, cierra con Escape
[ ] About: Screen Info sub-modal, cierra ambos con Escape
[ ] Progress Dashboard: muestra datos, cierra
[ ] Learning Path: progreso por nivel, cierra
[ ] Download Manager: cierra sin cerrar Settings
[ ] Sorting Summary: results grid correct/incorrect, cierra
[ ] Matching Summary: scroll locked, cierra y restaura scroll
[ ] Body scroll deshabilitado en todos, restaurado al cerrar
[ ] Dark mode correcto en todos
[ ] Mobile: no desborda, botones accesibles
[ ] Console limpia
[ ] Portales en body (no en header)
[ ] Modales no afectan estado de learning mode
```
