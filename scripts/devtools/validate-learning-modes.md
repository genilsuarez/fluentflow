# Validate Learning Modes

6 modos de aprendizaje + validaciones generales + anti-remount.

> Prerequisitos y setup en [README.md](README.md). Ejecutar "Antes de empezar" primero.

---

## 1. Quiz

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/quiz-basic-vocabulary-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Which word means", "What does"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
```

ANOTAR: texto de la pregunta, opciones, session score = "0 correct"

### Responder una pregunta

```
mcp_chrome_devtools_click
uid: {uid-opcion}
includeSnapshot: true
```

Validar:
- [ ] Session score cambió a "1 correct" o "1 incorrect"
- [ ] La pregunta es LA MISMA (no cambió al responder)
- [ ] Feedback visible: icono ✓/✗, explicación
- [ ] Botón "Next Question" visible

### Avanzar

```
mcp_chrome_devtools_click
uid: {uid-next-question}
includeSnapshot: true
```

- [ ] Pregunta nueva diferente
- [ ] Score acumulado se mantiene
- [ ] Contador avanzó (ej: "2/10")

---

## 2. Completion

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/completion-basic-sentences-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["____"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
```

ANOTAR: oración con blank, session score = "0 correct"

### Completar oración

```
mcp_chrome_devtools_fill
uid: {uid-input}
value: "{respuesta}"

mcp_chrome_devtools_press_key
key: "Enter"
includeSnapshot: true
```

Validar:
- [ ] Session score cambió
- [ ] La oración es LA MISMA
- [ ] Muestra "Correct!" o "Incorrect" con respuesta correcta
- [ ] Botón "Next Exercise" visible

### Avanzar

```
mcp_chrome_devtools_click
uid: {uid-next-exercise}
includeSnapshot: true
```

- [ ] Nueva oración con blank
- [ ] Score acumulado se mantiene

---

## 3. Matching

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/matching-common-verbs-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Click items from both columns"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
```

ANOTAR: términos, definiciones, contador "0/X"

### Emparejar todos los items

```
# Para cada par: click término → click definición
mcp_chrome_devtools_click
uid: {uid-term}

mcp_chrome_devtools_click
uid: {uid-definition}
includeSnapshot: true
# Verificar contador incrementó. Repetir hasta "X/X"
```

### Check Matches

```
mcp_chrome_devtools_click
uid: {uid-check-matches}
includeSnapshot: true
```

Validar:
- [ ] Session score cambió
- [ ] Pares siguen visibles (NO se reiniciaron/barajaron)
- [ ] Botones "Finish Exercise" y "View Summary" aparecen

---

## 4. Sorting

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/sorting-word-categories-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Drag and drop words"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
```

ANOTAR: palabras, categorías, contador "0/X"

### Arrastrar palabras a categorías

```
# IMPORTANTE: tomar snapshot DESPUÉS de cada drag (uids cambian)
mcp_chrome_devtools_drag
from_uid: {uid-palabra}
to_uid: {uid-categoria}

mcp_chrome_devtools_take_snapshot
# Repetir hasta "X/X - All words sorted!"
```

### Check Answers

```
mcp_chrome_devtools_click
uid: {uid-check-answers}
includeSnapshot: true
```

Validar:
- [ ] Session score cambió
- [ ] Categorías muestran checkmarks ✓ para correctas
- [ ] Botones "Finish Sorting" y "View Summary" aparecen
- [ ] Palabras NO volvieron a "Available Words"

---

## 5. Flashcard

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/flashcard-basic-vocabulary-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Flip", "1/"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
```

### Flip

```
mcp_chrome_devtools_click
uid: {uid-flip-btn}
includeSnapshot: true
```

- [ ] Muestra reverso (traducción/definición)
- [ ] Botón cambia a "Flip Back"
- [ ] Contador no cambió

### Navegación

```
mcp_chrome_devtools_click
uid: {uid-next-btn}
includeSnapshot: true
```

- [ ] Nueva tarjeta, contador avanzó ("2/X")
- [ ] Tarjeta empieza por el frente

```
mcp_chrome_devtools_click
uid: {uid-prev-btn}
includeSnapshot: true
```

- [ ] Vuelve a tarjeta anterior, contador retrocedió

### Keyboard

```
mcp_chrome_devtools_press_key
key: " "

mcp_chrome_devtools_press_key
key: "ArrowRight"

mcp_chrome_devtools_press_key
key: "ArrowLeft"
```

- [ ] Space = flip, ArrowRight = next, ArrowLeft = prev

---

## 6. Reading

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/reading-greetings-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Learning Objectives", "Start Reading", "Greetings"]
timeout: 5000

mcp_chrome_devtools_take_snapshot
```

### Navegar secciones

```
mcp_chrome_devtools_click
uid: {uid-next-btn}
includeSnapshot: true
# Repetir hasta llegar al summary
```

- [ ] Contenido de lectura visible en cada sección
- [ ] Contador muestra sección actual (ej: "1/3")
- [ ] Summary muestra "Key Vocabulary" y/o "Grammar Points"

### Finish

```
mcp_chrome_devtools_click
uid: {uid-finish-btn}
includeSnapshot: true
```

- [ ] URL cambió a `#/menu`
- [ ] Módulo aparece como "Completed"

---

## 7. Validaciones generales

### 7a. Navegación menú ↔ módulo

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/quiz-basic-vocabulary-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Which word means", "What does"]
timeout: 5000

mcp_chrome_devtools_click
uid: {uid-return-menu}
includeSnapshot: true
```

- [ ] URL cambió a `#/menu`
- [ ] Global score visible (no session score)

### 7b. Módulo inexistente

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/nonexistent-module-xyz'; return 'ok'; }"

mcp_chrome_devtools_take_snapshot
```

- [ ] Error UI visible (no crash)
- [ ] Botón "Try Again" o "Return to Menu"

### 7c. Console limpia

```
mcp_chrome_devtools_evaluate_script
function: "() => { console.clear(); return 'cleared'; }"

# Navegar a quiz, responder, volver
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/quiz-basic-vocabulary-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Which word means", "What does"]
timeout: 5000

mcp_chrome_devtools_click
uid: {uid-opcion}

mcp_chrome_devtools_list_console_messages
types: ["error", "warn"]
pageSize: 20
```

- [ ] Sin errores de React ("unmounted component", "state update")
- [ ] Sin warnings de keys duplicadas

### 7d. Persistencia

```
mcp_chrome_devtools_navigate_page
type: "reload"
timeout: 10000

mcp_chrome_devtools_take_snapshot
```

- [ ] Global score se mantiene
- [ ] Módulos completados siguen marcados
- [ ] Settings (tema, idioma) preservados

### 7e. Horizontal overflow

```
mcp_chrome_devtools_evaluate_script
function: "() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth
})"
```

- [ ] `overflow: false` en desktop, tablet y mobile

### 7f. Zustand selector check

```bash
grep -r "useAppStore()" src/components/learning/ src/components/layout/AppRouter.tsx src/App.tsx src/components/ui/Header.tsx
# Esperado: sin resultados → todos usan selectores individuales
```

---

## 8. Anti-remount

Verifica que `updateSessionScore` no causa remount del componente.

```
mcp_chrome_devtools_evaluate_script
function: "() => { window.location.hash = '#/learn/quiz-basic-vocabulary-a1'; return 'ok'; }"

mcp_chrome_devtools_wait_for
text: ["Which word means", "What does"]
timeout: 5000

# Instalar detector
mcp_chrome_devtools_evaluate_script
function: "() => {
  let remounts = 0;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.removedNodes) {
        if (node.nodeType === 1 && node.querySelector && node.querySelector('h2')) {
          remounts++;
        }
      }
    }
  });
  observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  window.__remountDetector = { count: () => remounts, stop: () => observer.disconnect() };
  return 'Detector installed';
}"

mcp_chrome_devtools_take_snapshot
# ANOTAR: pregunta actual

mcp_chrome_devtools_click
uid: {uid-opcion}

mcp_chrome_devtools_evaluate_script
function: "() => {
  const count = window.__remountDetector.count();
  window.__remountDetector.stop();
  return { remounts: count, verdict: count === 0 ? 'PASS' : 'FAIL - remounted ' + count + ' times' };
}"
```

- [ ] `remounts: 0` → PASS
- [ ] Pregunta es la misma que antes de responder

---

## Checklist rápido

```
[ ] Quiz: responder → score actualiza, pregunta no cambia
[ ] Completion: enviar → score actualiza, oración no cambia
[ ] Matching: Check → pares no se reinician
[ ] Sorting: Check → palabras no vuelven
[ ] Flashcard: flip/next/prev funciona
[ ] Reading: navegar secciones, finish vuelve al menú
[ ] Console sin errores de React
[ ] Progreso persiste después de reload
[ ] Sin overflow horizontal
```
