import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

interface EditableInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onEnter?: () => void;
  onTab?: (shiftKey: boolean) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}

export interface EditableInputHandle {
  focus: () => void;
  clear: () => void;
}

/**
 * EditableInput - A contenteditable div that behaves like an input
 * Used to avoid iOS password autofill bar that appears on <input> elements
 */
export const EditableInput = forwardRef<EditableInputHandle, EditableInputProps>(
  (
    {
      value,
      onChange,
      onFocus,
      onEnter,
      onTab,
      placeholder = '',
      ariaLabel,
      disabled = false,
      className = '',
      style = {},
      autoFocus = false,
    },
    ref
  ) => {
    const divRef = useRef<HTMLDivElement>(null);
    // Track whether the div currently has focus to avoid cursor-reset on mobile
    const isFocused = useRef(false);

    // Expose focus() and clear() to parent components for imperative control
    useImperativeHandle(ref, () => ({
      focus() {
        focusAtEnd();
      },
      clear() {
        if (divRef.current) {
          // Remove all child nodes (text, <br>, <div>) — not just textContent
          divRef.current.innerHTML = '';
        }
      },
    }));

    // Force native spellcheck/autocorrect attributes for iOS Safari/Chrome
    useEffect(() => {
      const el = divRef.current;
      if (!el) return;
      el.setAttribute('spellcheck', 'false');
      el.setAttribute('autocorrect', 'off');
      el.setAttribute('autocapitalize', 'off');
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('data-gramm', 'false'); // Grammarly
      el.setAttribute('data-gramm_editor', 'false');
      el.setAttribute('data-enable-grammarly', 'false');
    }, []);

    // Focus and place cursor at end of content
    const focusAtEnd = () => {
      const el = divRef.current;
      if (!el || disabled) return;
      el.focus();
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false); // collapse to end
      sel?.removeAllRanges();
      sel?.addRange(range);
    };

    // Update div content when value changes externally.
    // While focused, skip writes to preserve cursor — except external clears (e.g. next question).
    useEffect(() => {
      if (!divRef.current) return;
      const el = divRef.current;
      if (el.textContent === value) return;
      if (!isFocused.current || value === '') {
        el.textContent = value;
      }
    }, [value]);

    // Auto-focus if requested
    useEffect(() => {
      if (autoFocus && !disabled) {
        focusAtEnd();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoFocus, disabled]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      // Strip any <br> or block elements that contentEditable may insert on Enter
      const raw = el.textContent || '';
      const clean = raw.replace(/\n/g, '');
      if (raw !== clean || el.innerHTML.includes('<br') || el.innerHTML.includes('<div')) {
        // Save cursor offset before nuking HTML artifacts
        const sel = window.getSelection();
        let cursorOffset = clean.length; // fallback: end
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          // Calculate offset relative to the element's full text
          const preRange = document.createRange();
          preRange.selectNodeContents(el);
          preRange.setEnd(range.startContainer, range.startOffset);
          cursorOffset = preRange.toString().replace(/\n/g, '').length;
        }
        // Nuke HTML artifacts and restore clean text
        el.textContent = clean;
        // Restore cursor to saved position (clamped)
        const textNode = el.firstChild;
        if (textNode && sel) {
          const restoredOffset = Math.min(cursorOffset, clean.length);
          const restoreRange = document.createRange();
          restoreRange.setStart(textNode, restoredOffset);
          restoreRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(restoreRange);
        }
      }
      onChange(clean);
    };

    const handleFocus = () => {
      isFocused.current = true;
      onFocus?.();
    };

    const handleBlur = () => {
      isFocused.current = false;
      // Sync content on blur in case external value differs
      if (divRef.current && divRef.current.textContent !== value) {
        divRef.current.textContent = value;
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onEnter?.();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        onTab?.(e.shiftKey);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      // Prevent pasting formatted text — insert as plain text
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(text));
      sel.collapseToEnd();
      // Trigger onChange with updated content
      onChange(divRef.current?.textContent || '');
    };

    return (
      <div
        ref={divRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`${className}${placeholder ? '' : ' editable-input--no-placeholder'}`}
        style={style}
        data-placeholder={placeholder}
        data-empty={!value ? 'true' : 'false'}
        role="textbox"
        aria-label={ariaLabel || placeholder || 'Blank'}
        suppressContentEditableWarning
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        // Prevent iOS form navigation bar
        data-form-type="other"
      />
    );
  }
);
