import React, { useId, useRef } from 'react';
import { Search, X } from 'lucide-react';
import '../../styles/components/search-bar.css';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder?: string;
  label?: string;
  description?: string;
  clearLabel?: string;
  disabled?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  placeholder = 'Search modules...',
  label = 'Search learning modules',
  description = 'Search learning modules by name, category, or topic',
  clearLabel,
  disabled = false,
}) => {
  const searchId = useId();
  const clearButtonId = useId();
  const divRef = useRef<HTMLDivElement>(null);

  // Force native spellcheck/autocorrect attributes for iOS Safari/Chrome
  React.useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('autocomplete', 'off');
  }, []);

  // Update div content when query changes externally
  React.useEffect(() => {
    if (divRef.current && divRef.current.textContent !== query) {
      divRef.current.textContent = query;
    }
  }, [query]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newValue = e.currentTarget.textContent || '';
    onQueryChange(newValue);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Prevent pasting formatted text
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className="search-bar" role="search">
      <label htmlFor={searchId} className="sr-only">
        {label}
      </label>
      <div className="search-bar__icon" aria-hidden="true">
        <Search className="search-bar__icon-svg" />
      </div>
      <div
        ref={divRef}
        id={searchId}
        contentEditable={!disabled}
        onInput={handleInput}
        onPaste={handlePaste}
        className="search-bar__input"
        data-placeholder={!query ? placeholder : ''}
        role="searchbox"
        aria-label={description}
        aria-describedby={query ? clearButtonId : undefined}
        data-form-type="other"
        suppressContentEditableWarning
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
      {query && !disabled && (
        <button
          id={clearButtonId}
          onClick={() => onQueryChange('')}
          className="search-bar__clear"
          aria-label={clearLabel ? `${clearLabel}: ${query}` : `Clear: ${query}`}
          type="button"
        >
          <X className="search-bar__clear-icon" />
        </button>
      )}
    </div>
  );
};
