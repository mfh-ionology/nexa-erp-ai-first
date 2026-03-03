'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, FileText, Plus, X, Loader2 } from 'lucide-react';

interface EmailComposeDialogProps {
  documentTitle?: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
}

export function EmailComposeDialog({
  documentTitle = 'Invoice INV-00234',
  defaultTo = 'accounts@customer.co.uk',
  defaultSubject = 'Invoice INV-00234 from Acme Ltd',
  defaultBody = 'Dear Mr Smith,\n\nPlease find attached invoice INV-00234 for \u00a34,250.00 dated 1 March 2026.\n\nPayment is due by 15 March 2026.\n\nKind regards,\nAcme Ltd',
}: EmailComposeDialogProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [template, setTemplate] = useState('sales-invoice');

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setOpen(false);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
        >
          <Mail className="h-4 w-4" /> Email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-base">Send {documentTitle} via Email</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-2">
            <Label className="text-xs">From</Label>
            <Select defaultValue="accounts">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accounts">accounts@acme.co.uk</SelectItem>
                <SelectItem value="info">info@acme.co.uk</SelectItem>
                <SelectItem value="sales">sales@acme.co.uk</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">To</Label>
            <div className="flex gap-2">
              <Input value={to} onChange={(e) => setTo(e.target.value)} className="flex-1" />
              <Button variant="ghost" size="sm" className="shrink-0 text-xs text-muted-foreground">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Cc</Label>
            <div className="flex gap-2">
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1"
                placeholder="Optional"
              />
              <Button variant="ghost" size="sm" className="shrink-0 text-xs text-muted-foreground">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Body</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#7c3aed]"
            />
          </div>

          {/* Attachment */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Attachments
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-border p-2">
              <FileText className="h-4 w-4 text-[#ef4444]" />
              <span className="flex-1 text-sm text-foreground">
                Invoice-INV-00234.pdf (auto-generated)
              </span>
              <button className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button variant="ghost" size="sm" className="mt-1.5 text-xs text-muted-foreground">
              <Plus className="h-3 w-3" /> Attach File
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs shrink-0">Template:</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales-invoice">Sales Invoice</SelectItem>
                <SelectItem value="reminder">Payment Reminder</SelectItem>
                <SelectItem value="statement">Statement</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              Reset to Template
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {sending ? 'Sending...' : 'Send Email'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
