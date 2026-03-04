/* eslint-disable i18next/no-literal-string */
/**
 * EmailRecipientField — reusable multi-email chip input.
 *
 * Used for To, Cc, Bcc fields in the email composition dialog.
 * Validates emails against RFC 5322 (BR-COM-001).
 * Detects cross-field duplicates (BR-COM-002).
 *
 * E10-3 Task 5.3
 */

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// RFC 5322 simplified email regex
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

interface EmailRecipientFieldProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  label?: string;
  /** All emails across To/Cc/Bcc for duplicate detection (BR-COM-002) */
  allRecipients?: string[];
  disabled?: boolean;
}

export function EmailRecipientField({
  value,
  onChange,
  placeholder = 'Add email address',
  label,
  allRecipients = [],
  disabled = false,
}: EmailRecipientFieldProps) {
  const [inputValue, setInputValue] = useState('');
  const [invalidEmails, setInvalidEmails] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const addEmail = useCallback(
    (raw: string) => {
      const email = raw.trim().toLowerCase();
      if (!email) return;

      if (!isValidEmail(email)) {
        // Add as invalid chip
        if (!value.includes(email)) {
          onChange([...value, email]);
          setInvalidEmails((prev) => new Set(prev).add(email));
        }
        setInputValue('');
        return;
      }

      // Check for duplicates within this field
      if (value.includes(email)) {
        setInputValue('');
        return;
      }

      onChange([...value, email]);
      setInputValue('');
    },
    [value, onChange],
  );

  const removeEmail = useCallback(
    (email: string) => {
      onChange(value.filter((e) => e !== email));
      setInvalidEmails((prev) => {
        const next = new Set(prev);
        next.delete(email);
        return next;
      });
    },
    [value, onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
        if (inputValue.trim()) {
          e.preventDefault();
          addEmail(inputValue);
        }
      } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        removeEmail(value[value.length - 1]!);
      }
    },
    [inputValue, value, addEmail, removeEmail],
  );

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) {
      addEmail(inputValue);
    }
  }, [inputValue, addEmail]);

  const isDuplicate = (email: string) => {
    // Count occurrences across all recipient fields
    const count = allRecipients.filter((e) => e.toLowerCase() === email.toLowerCase()).length;
    return count > 1;
  };

  return (
    <div className="space-y-1">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 transition-colors',
          'focus-within:ring-2 focus-within:ring-[#7c3aed]/30 focus-within:border-[#7c3aed]',
          disabled && 'opacity-50 pointer-events-none',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((email) => {
          const isInvalid = invalidEmails.has(email);
          const duplicate = isDuplicate(email);
          const hasIssue = isInvalid || duplicate;
          const tooltipMessage = isInvalid
            ? 'Invalid email format'
            : duplicate
              ? 'Duplicate recipient'
              : '';

          const chip = (
            <span
              key={email}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                hasIssue
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20',
              )}
            >
              <span className="max-w-[200px] truncate">{email}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeEmail(email);
                }}
                className={cn(
                  'ml-0.5 rounded-full p-0.5 transition-colors',
                  hasIssue ? 'hover:bg-red-200/60' : 'hover:bg-[#7c3aed]/20',
                )}
                aria-label={`Remove ${email}`}
              >
                <X className="size-3" />
              </button>
            </span>
          );

          if (hasIssue) {
            return (
              <TooltipProvider key={email} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>{chip}</TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {tooltipMessage}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return chip;
        })}
        <input
          ref={inputRef}
          type="email"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="min-w-[120px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
