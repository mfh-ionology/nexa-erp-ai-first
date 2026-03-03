import type { MemoryCategory } from './types';

export const CATEGORY_STYLES: Record<MemoryCategory, { bg: string; text: string }> = {
  PREFERENCE: { bg: 'bg-[#dbeafe]', text: 'text-[#1e40af]' },
  INSTRUCTION: { bg: 'bg-[#e0e7ff]', text: 'text-[#3730a3]' },
  WORKFLOW: { bg: 'bg-[#d1fae5]', text: 'text-[#065f46]' },
  DECISION: { bg: 'bg-[#ede9fe]', text: 'text-[#6d28d9]' },
  ENTITY_CONTEXT: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]' },
};

export const CATEGORY_I18N_KEYS: Record<MemoryCategory, string> = {
  PREFERENCE: 'memory.settings.preference',
  WORKFLOW: 'memory.settings.workflow',
  DECISION: 'memory.settings.decision',
  INSTRUCTION: 'memory.settings.instruction',
  ENTITY_CONTEXT: 'memory.settings.entityContext',
};
