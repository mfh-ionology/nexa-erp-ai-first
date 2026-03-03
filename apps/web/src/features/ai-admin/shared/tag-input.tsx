/* eslint-disable i18next/no-literal-string */
/**
 * Shared TagInput component for AI admin forms.
 * Used by agent-form-page and skill-form-page for tag/pill entry.
 */

import { useState } from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  pillClassName: string;
  tagType: string;
  /** When true, preserves the original casing of entered tags. Default: lowercases. */
  preserveCase?: boolean;
}

export function TagInput({
  value,
  onChange,
  placeholder,
  pillClassName,
  tagType,
  preserveCase,
}: TagInputProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      const tag = preserveCase ? input.trim() : input.trim().toLowerCase();
      if (!value.includes(tag)) {
        onChange([...value, tag]);
      }
      setInput('');
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className={`${pillClassName} gap-1 pr-1`}>
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="relative ml-1 inline-flex size-5 items-center justify-center rounded-full hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] after:absolute after:-inset-3 after:content-['']"
              aria-label={`Remove ${tagType} ${tag}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="text-sm"
      />
    </div>
  );
}
