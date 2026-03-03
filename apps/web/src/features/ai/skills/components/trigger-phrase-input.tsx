import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

interface TriggerPhraseInputProps {
  phrases: string[];
  onChange: (phrases: string[]) => void;
  variant: 'positive' | 'negative';
  disabled?: boolean;
  label: string;
}

const VARIANT_STYLES = {
  positive: {
    pill: 'bg-[#d1fae5] text-[#065f46]',
    pillHover: 'hover:bg-[#a7f3d0]',
    removeButton: 'text-[#065f46]/60 hover:text-[#065f46]',
  },
  negative: {
    pill: 'bg-[#fee2e2] text-[#991b1b]',
    pillHover: 'hover:bg-[#fecaca]',
    removeButton: 'text-[#991b1b]/60 hover:text-[#991b1b]',
  },
} as const;

export function TriggerPhraseInput({
  phrases,
  onChange,
  variant,
  disabled = false,
  label,
}: TriggerPhraseInputProps) {
  const { t } = useI18n('ai');
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const styles = VARIANT_STYLES[variant];

  const addPhrase = useCallback(
    (phrase: string) => {
      const trimmed = phrase.trim();
      if (trimmed && !phrases.includes(trimmed)) {
        onChange([...phrases, trimmed]);
      }
      setInputValue('');
    },
    [phrases, onChange],
  );

  const removePhrase = useCallback(
    (phrase: string) => {
      onChange(phrases.filter((p) => p !== phrase));
    },
    [phrases, onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addPhrase(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && phrases.length > 0) {
      const lastPhrase = phrases[phrases.length - 1];
      if (lastPhrase) removePhrase(lastPhrase);
    }
  };

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div
        className={`mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-border p-2 transition-shadow focus-within:ring-2 focus-within:ring-[#7c3aed]/30 ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
        onClick={() => !disabled && inputRef.current?.focus()}
        role="group"
        aria-label={label}
      >
        {phrases.map((phrase) => (
          <span
            key={phrase}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles.pill}`}
          >
            {phrase}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePhrase(phrase);
                }}
                className={`ml-0.5 inline-flex items-center rounded-full p-0.5 transition-colors ${styles.removeButton}`}
                aria-label={t('skills.triggerInput.remove', { phrase })}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) {
                addPhrase(inputValue);
              }
            }}
            className="min-w-[120px] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={phrases.length === 0 ? t('skills.triggerInput.placeholder') : ''}
            disabled={disabled}
            aria-label={label}
          />
        )}
      </div>
    </div>
  );
}
