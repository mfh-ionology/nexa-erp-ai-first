'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MessageSquare, Pin, PinOff, Pencil, Bot } from 'lucide-react';

type NoteType = 'GENERAL' | 'INTERNAL' | 'CUSTOMER_VISIBLE' | 'SYSTEM';

interface Note {
  id: string;
  author: string;
  timeAgo: string;
  content: string;
  type: NoteType;
  pinned: boolean;
  isSystem: boolean;
  isOwn: boolean;
}

const typeBadge: Record<NoteType, { label: string; bg: string; text: string } | null> = {
  GENERAL: null,
  INTERNAL: { label: 'INTERNAL', bg: '#fef3c7', text: '#d97706' },
  CUSTOMER_VISIBLE: { label: 'CUSTOMER VISIBLE', bg: '#dbeafe', text: '#3b82f6' },
  SYSTEM: { label: 'SYSTEM', bg: '#f3f4f6', text: '#6b7280' },
};

const initialNotes: Note[] = [
  {
    id: '1',
    author: 'Sarah',
    timeAgo: '10 min ago',
    content: 'Customer confirmed payment will be made by Friday.',
    type: 'INTERNAL',
    pinned: true,
    isSystem: false,
    isOwn: true,
  },
  {
    id: '2',
    author: 'System',
    timeAgo: '2h ago',
    content: 'Invoice emailed to accounts@customer.co.uk',
    type: 'SYSTEM',
    pinned: false,
    isSystem: true,
    isOwn: false,
  },
  {
    id: '3',
    author: 'Mike',
    timeAgo: 'Yesterday',
    content:
      "Spoke to customer about the balance. They'll pay after the 15th. Follow up next week.",
    type: 'GENERAL',
    pinned: false,
    isSystem: false,
    isOwn: false,
  },
  {
    id: '4',
    author: 'Sarah',
    timeAgo: '2 days ago',
    content: 'Sent proforma to customer for review.',
    type: 'GENERAL',
    pinned: false,
    isSystem: false,
    isOwn: true,
  },
  {
    id: '5',
    author: 'System',
    timeAgo: '3 days ago',
    content: 'Invoice created from Sales Quote SQ-00012.',
    type: 'SYSTEM',
    pinned: false,
    isSystem: true,
    isOwn: false,
  },
];

export function NotesPanel() {
  const [notes, setNotes] = useState(initialNotes);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'GENERAL' | 'INTERNAL' | 'CUSTOMER_VISIBLE'>('GENERAL');

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const togglePin = (id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  };

  const postNote = () => {
    if (!newNote.trim()) return;
    setNotes((prev) => [
      {
        id: `note-${Date.now()}`,
        author: 'Sarah',
        timeAgo: 'Just now',
        content: newNote.trim(),
        type: noteType,
        pinned: false,
        isSystem: false,
        isOwn: true,
      },
      ...prev,
    ]);
    setNewNote('');
    setNoteType('GENERAL');
  };

  const noteTypeOptions: { value: 'GENERAL' | 'INTERNAL' | 'CUSTOMER_VISIBLE'; label: string }[] = [
    { value: 'GENERAL', label: 'General' },
    { value: 'INTERNAL', label: 'Internal' },
    { value: 'CUSTOMER_VISIBLE', label: 'Customer Visible' },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="sr-only">Notes</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] p-0 sm:max-w-[400px]">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm font-semibold">Notes ({notes.length})</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {/* Add note form */}
          <div className="rounded-lg border border-border p-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Type something..."
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {noteTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNoteType(opt.value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      noteType === opt.value
                        ? 'bg-[#7c3aed] text-white'
                        : 'bg-secondary text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                onClick={postNote}
                disabled={!newNote.trim()}
                className="h-7 bg-[#7c3aed] text-xs text-white hover:bg-[#5b21b6]"
              >
                Post Note
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Timeline (newest first)
            </p>
            <div className="flex flex-col gap-3">
              {sortedNotes.map((note) => {
                const badge = typeBadge[note.type];
                return (
                  <div key={note.id} className="flex flex-col gap-1">
                    {/* Author line */}
                    <div className="flex items-center gap-2">
                      {note.pinned && <Pin className="h-3 w-3 text-[#7c3aed]" />}
                      {note.isSystem ? (
                        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7c3aed] text-[9px] font-bold text-white">
                          {note.author[0]}
                        </div>
                      )}
                      <span className="text-xs font-medium text-foreground">{note.author}</span>
                      <span className="text-xs text-muted-foreground">&middot; {note.timeAgo}</span>
                      {note.pinned && !note.isSystem && (
                        <button
                          onClick={() => togglePin(note.id)}
                          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                        >
                          <PinOff className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {/* Note card */}
                    <div
                      className={`group rounded-lg border border-border p-3 ${note.isSystem ? 'bg-secondary/50 italic' : ''}`}
                    >
                      <p className="text-sm leading-relaxed text-foreground">{note.content}</p>
                      <div className="mt-2 flex items-center justify-between">
                        {badge && (
                          <span
                            className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                            style={{ backgroundColor: badge.bg, color: badge.text }}
                          >
                            {badge.label}
                          </span>
                        )}
                        {!note.isSystem && !note.pinned && (
                          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => togglePin(note.id)}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                              aria-label="Pin note"
                            >
                              <Pin className="h-3 w-3" />
                            </button>
                            {note.isOwn && (
                              <button
                                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                                aria-label="Edit note"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
