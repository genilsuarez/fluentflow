import React, { useRef, useEffect } from 'react';

interface EditableInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}

/**
 * EditableInput - A contenteditable div that behaves like an input
 * Used to avoid iOS password autofill bar that appears on <input> elements
 */
export const EditableInput: React.FC<EditableInputProps> = ({
  value,
  onChange,
  onFocus,
  placeholder = '',
  disabled = false,
  className = '',
  style = {},
  autoFocus = false,
}) => {
  const divRef = useRef<HTMLDivElement>(null);

  // Update div content when value changes externally
  useEffect(() => {
    if (divRef.current && divRef.current.textContent !== value) {
      divRef.current.textContent = value;
    }
  }, [value]);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && divRef.current && !disabled) {
      setTimeout(() => divRef.current?.focus(), 100);
    }
  }, [autoFocus, disabled]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newValue = e.currentTarget.textContent || '';
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Prevent Enter key from creating new lines
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Prevent pasting formatted text
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div
      ref={divRef}
      contentEditable={!disabled}
      onInput={handleInput}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={className}
      style={style}
      data-placeholder={!value ? placeholder : ''}
      role="textbox"
      aria-label={placeholder}
      suppressContentEditableWarning
      // Prevent iOS form navigation bar
      data-form-type="other"
    />
  );
};
