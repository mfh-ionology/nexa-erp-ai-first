'use client';

import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Paperclip,
  Download,
  Trash2,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  X,
} from 'lucide-react';

interface Attachment {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'image' | 'spreadsheet' | 'document' | 'generic';
  uploadedBy: string;
  timeAgo: string;
}

const mimeIcon: Record<string, { icon: typeof FileText; color: string }> = {
  pdf: { icon: FileText, color: '#ef4444' },
  image: { icon: Image, color: '#3b82f6' },
  spreadsheet: { icon: FileSpreadsheet, color: '#10b981' },
  document: { icon: FileText, color: '#7c3aed' },
  generic: { icon: File, color: '#9ca3af' },
};

const initialAttachments: Attachment[] = [
  {
    id: '1',
    name: 'Invoice-Scan.pdf',
    size: '12 KB',
    type: 'pdf',
    uploadedBy: 'Sarah',
    timeAgo: '2h ago',
  },
  {
    id: '2',
    name: 'Receipt-Photo.jpg',
    size: '2.4 MB',
    type: 'image',
    uploadedBy: 'Mike',
    timeAgo: '1d ago',
  },
  {
    id: '3',
    name: 'Budget-Breakdown.xlsx',
    size: '48 KB',
    type: 'spreadsheet',
    uploadedBy: 'Sarah',
    timeAgo: '3d ago',
  },
];

export function AttachmentPanel() {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const simulateUpload = useCallback(() => {
    setUploading(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setUploading(false);
          setAttachments((prev) => [
            {
              id: `new-${Date.now()}`,
              name: 'report.pdf',
              size: '156 KB',
              type: 'pdf',
              uploadedBy: 'Sarah',
              timeAgo: 'Just now',
            },
            ...prev,
          ]);
          return 0;
        }
        return p + 12;
      });
    }, 200);
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
        >
          <Paperclip className="h-4 w-4" />
          <span className="sr-only">Attachments</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] p-0 sm:max-w-[400px]">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm font-semibold">
            Attachments ({attachments.length})
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              simulateUpload();
            }}
            onClick={simulateUpload}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
              isDragOver
                ? 'border-[#7c3aed] bg-[#f5f3ff]'
                : 'border-border hover:border-[#7c3aed]/50 hover:bg-[#f5f3ff]/50'
            }`}
          >
            <Paperclip className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">Max 25MB per file</p>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-[#f5f3ff] p-3">
              <FileText className="h-4 w-4 shrink-0 text-[#7c3aed]" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Uploading report.pdf</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-[#7c3aed] transition-all duration-200"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-mono tabular-nums text-muted-foreground">
                {Math.min(progress, 100)}%
              </span>
            </div>
          )}

          {/* File list */}
          {attachments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No attachments yet. Drag files here to attach them.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {attachments.map((att) => {
                const { icon: Icon, color } = mimeIcon[att.type];
                return (
                  <div
                    key={att.id}
                    className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-[#f5f3ff]/50"
                  >
                    <Icon className="h-5 w-5 shrink-0" style={{ color }} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{att.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded by {att.uploadedBy} &middot; {att.timeAgo}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{att.size}</span>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        aria-label="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeAttachment(att.id)}
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-[#ef4444]"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
