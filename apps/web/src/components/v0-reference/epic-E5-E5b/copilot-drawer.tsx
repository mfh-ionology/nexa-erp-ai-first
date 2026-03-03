'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Pin } from 'lucide-react';
import { EntityChip, type EntityMention, type EntityType } from './entity-chip';
import { EntityAutocompleteDropdown } from './entity-autocomplete';

// -- Mock entity database for demo --

const MOCK_ENTITIES: EntityMention[] = [
  { id: 'c1', type: 'contact', name: 'John Smith', subtitle: 'john@acme.com' },
  { id: 'c2', type: 'contact', name: 'Jane Jones', subtitle: 'jane@acme.com' },
  { id: 'c3', type: 'contact', name: 'James Oliver', subtitle: 'james@acme.com' },
  { id: 'c4', type: 'contact', name: 'Joanna Price', subtitle: 'joanna@meridian.co.uk' },
  { id: 'cu1', type: 'customer', name: 'Acme Ltd', subtitle: 'ACM-001' },
  { id: 'cu2', type: 'customer', name: 'Meridian Manufacturing', subtitle: 'MER-003' },
  { id: 'cu3', type: 'customer', name: 'Bristol Components', subtitle: 'BRI-007' },
  { id: 'inv1', type: 'invoice', name: 'INV-2026-0042', subtitle: 'Acme Ltd - £12,450.00' },
  {
    id: 'inv2',
    type: 'invoice',
    name: 'INV-2026-0038',
    subtitle: 'Bristol Components - £8,200.00',
  },
  {
    id: 'inv3',
    type: 'invoice',
    name: 'INV-2026-0041',
    subtitle: 'Meridian Manufacturing - £3,750.00',
  },
  { id: 'p1', type: 'product', name: 'Precision Bearing Assembly', subtitle: 'PBA-100' },
  { id: 'p2', type: 'product', name: 'Industrial Gasket Set', subtitle: 'IGS-200' },
  {
    id: 'po1',
    type: 'purchase-order',
    name: 'PO-2026-0015',
    subtitle: 'Steel Supply Co - £4,200.00',
  },
  {
    id: 'po2',
    type: 'purchase-order',
    name: 'PO-2026-0016',
    subtitle: 'Components Direct - £1,800.00',
  },
];

const TRIGGER_WORDS: Record<string, EntityType> = {
  contact: 'contact',
  customer: 'customer',
  invoice: 'invoice',
  product: 'product',
  order: 'purchase-order',
  po: 'purchase-order',
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  entities?: EntityMention[];
  referencedMemory?: string;
}

const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'What invoices are overdue for Acme Ltd?',
    entities: [{ id: 'cu1', type: 'customer', name: 'Acme Ltd' }],
  },
  {
    id: '2',
    role: 'assistant',
    content:
      'Acme Ltd has 1 overdue invoice:\n\nINV-2026-0042 for £12,450.00 (due 15 Jan 2026, 33 days overdue). This invoice covers the Q4 2025 precision bearing shipment.\n\nWould you like me to send a reminder to their accounts payable contact?',
    referencedMemory: 'Sarah prefers to CC the sales rep when sending payment reminders',
  },
  {
    id: '3',
    role: 'user',
    content: 'Yes, send a reminder to John Smith at Acme',
    entities: [{ id: 'c1', type: 'contact', name: 'John Smith', subtitle: 'john@acme.com' }],
  },
  {
    id: '4',
    role: 'assistant',
    content:
      "I've drafted a payment reminder for INV-2026-0042 addressed to John Smith (john@acme.com), CC'd to your sales rep Mark Davies.\n\nThe email includes the invoice PDF attachment and a direct payment link. Shall I send it now, or would you like to review the draft first?",
    referencedMemory: 'Always attach the original invoice PDF to payment reminders',
  },
];

function detectTrigger(
  text: string,
): { triggerType: EntityType; searchQuery: string; triggerWord: string } | null {
  const words = text.toLowerCase().split(/\s+/);
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (TRIGGER_WORDS[word]) {
      const afterTrigger = words.slice(i + 1).join(' ');
      if (afterTrigger.length >= 2) {
        return {
          triggerType: TRIGGER_WORDS[word],
          searchQuery: afterTrigger,
          triggerWord: word,
        };
      }
    }
  }
  return null;
}

function searchEntities(type: EntityType, query: string): EntityMention[] {
  const q = query.toLowerCase();
  return MOCK_ENTITIES.filter(
    (e) =>
      e.type === type &&
      (e.name.toLowerCase().includes(q) || (e.subtitle && e.subtitle.toLowerCase().includes(q))),
  ).slice(0, 5);
}

export function CopilotDrawer() {
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [inlineEntities, setInlineEntities] = useState<EntityMention[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState<EntityMention[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [autocompleteType, setAutocompleteType] = useState<EntityType>('contact');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInputChange = useCallback((value: string) => {
    setInputText(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const detected = detectTrigger(value);
      if (detected) {
        setAutocompleteType(detected.triggerType);
        setAutocompleteLoading(true);
        setShowAutocomplete(true);
        setSelectedIndex(0);

        // Simulate 300ms debounced search
        setTimeout(() => {
          const results = searchEntities(detected.triggerType, detected.searchQuery);
          setAutocompleteResults(results);
          setAutocompleteLoading(false);
        }, 200);
      } else {
        setShowAutocomplete(false);
        setAutocompleteResults([]);
      }
    }, 300);
  }, []);

  const handleSelectEntity = useCallback(
    (entity: EntityMention) => {
      setInlineEntities((prev) => [...prev, entity]);

      // Replace the trigger word + search query with a placeholder
      const detected = detectTrigger(inputText);
      if (detected) {
        const idx = inputText.toLowerCase().lastIndexOf(detected.triggerWord);
        const before = inputText.slice(0, idx).trimEnd();
        setInputText(before ? before + ' ' : '');
      }

      setShowAutocomplete(false);
      setAutocompleteResults([]);
      inputRef.current?.focus();
    },
    [inputText],
  );

  const handleRemoveEntity = useCallback((id: string) => {
    setInlineEntities((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text && inlineEntities.length === 0) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text || inlineEntities.map((e) => e.name).join(', '),
      entities: inlineEntities.length > 0 ? [...inlineEntities] : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setInlineEntities([]);

    // Simulated assistant response
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content:
          "I'm processing your request. In a live environment, I'd use the referenced entities to look up the relevant data and provide a detailed response.",
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1000);
  }, [inputText, inlineEntities]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showAutocomplete) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < autocompleteResults.length - 1 ? prev + 1 : 0));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : autocompleteResults.length - 1));
          return;
        }
        if (e.key === 'Enter' && autocompleteResults.length > 0) {
          e.preventDefault();
          handleSelectEntity(autocompleteResults[selectedIndex]);
          return;
        }
        if (e.key === 'Tab' && autocompleteResults.length > 0) {
          e.preventDefault();
          handleSelectEntity(autocompleteResults[0]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowAutocomplete(false);
          return;
        }
      }

      // Backspace removes last entity chip if input is empty
      if (e.key === 'Backspace' && inputText === '' && inlineEntities.length > 0) {
        e.preventDefault();
        setInlineEntities((prev) => prev.slice(0, -1));
        return;
      }

      // Send message on Enter (no shift)
      if (e.key === 'Enter' && !e.shiftKey && !showAutocomplete) {
        e.preventDefault();
        handleSend();
      }
    },
    [
      showAutocomplete,
      autocompleteResults,
      selectedIndex,
      inputText,
      inlineEntities,
      handleSelectEntity,
      handleSend,
    ],
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed] text-white transition-all hover:bg-[#6d28d9] hover:shadow-md"
          aria-label="Open AI Co-Pilot"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[420px]">
        {/* Header */}
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7c3aed]">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            Nexa Co-Pilot
            <span className="ml-auto rounded-full bg-[#d1fae5] px-2 py-0.5 text-[10px] font-medium text-[#065f46]">
              Online
            </span>
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col gap-1',
                  msg.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-[#7c3aed] text-white rounded-br-md'
                      : 'bg-card text-foreground border border-border rounded-bl-md',
                  )}
                >
                  {/* Entity chips if present */}
                  {msg.entities && msg.entities.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {msg.entities.map((e) => (
                        <span
                          key={e.id}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                            msg.role === 'user'
                              ? 'bg-white/20 text-white'
                              : 'bg-[#ede9fe] text-[#6d28d9]',
                          )}
                        >
                          {e.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Referenced memory indicator */}
                {msg.referencedMemory && (
                  <div className="flex max-w-[85%] items-start gap-1.5 rounded-lg bg-[#f5f3ff] px-2.5 py-1.5 text-[11px] text-[#6d28d9]">
                    <Pin className="mt-0.5 h-3 w-3 shrink-0 rotate-45" />
                    <span className="italic">{msg.referencedMemory}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 border-t border-border bg-card p-3">
          {/* Autocomplete dropdown */}
          <div className="relative">
            {showAutocomplete && (
              <EntityAutocompleteDropdown
                results={autocompleteResults.map((e) => ({ entity: e }))}
                loading={autocompleteLoading}
                selectedIndex={selectedIndex}
                entityType={autocompleteType}
                contextScope={inlineEntities.find((e) => e.type === 'customer')?.name}
                onSelect={handleSelectEntity}
                onClose={() => setShowAutocomplete(false)}
              />
            )}

            {/* Entity chips + text input */}
            <div className="flex flex-wrap items-end gap-1.5 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-[#7c3aed]/30 focus-within:border-[#7c3aed] transition-shadow">
              {inlineEntities.map((entity) => (
                <EntityChip
                  key={entity.id}
                  entity={entity}
                  onRemove={() => handleRemoveEntity(entity.id)}
                />
              ))}
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => {
                  handleInputChange(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  inlineEntities.length > 0
                    ? 'Continue typing...'
                    : "Ask anything... (type 'invoice', 'contact' to mention)"
                }
                rows={1}
                className="min-h-[24px] max-h-[96px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() && inlineEntities.length === 0}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#7c3aed] text-white transition-colors hover:bg-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Hint text */}
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Type entity names (invoice, contact, customer) to reference ERP data
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
