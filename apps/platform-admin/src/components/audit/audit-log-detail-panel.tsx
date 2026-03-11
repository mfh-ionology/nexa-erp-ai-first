// ---------------------------------------------------------------------------
// Audit Log Detail Panel — Side panel showing full audit entry details
// Source: API Contracts §21.7, FR214, BR-PLT-016
// Story: E13b.6 Task 4.1
// ---------------------------------------------------------------------------

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, Copy, Check, Loader2, User, Activity, Globe, Clock, FileJson } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatAuditTimestamp, actionBadgeClass } from '@/lib/audit-log-utils';
import type { AuditLogDetail } from '@/hooks/use-audit-log';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AuditLogDetailPanelProps {
  detail: AuditLogDetail | null | undefined;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Copy Button
// ---------------------------------------------------------------------------

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {
        // Clipboard API unavailable or permission denied — no-op
      },
    );
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
      title={`Copy ${label ?? 'value'}`}
      aria-label={`Copy ${label ?? 'value'}`}
    >
      <span>{value}</span>
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section Component
// ---------------------------------------------------------------------------

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="rounded-md border border-border bg-muted/20 px-4 py-3">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Detail Row
// ---------------------------------------------------------------------------

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogDetailPanel({
  detail,
  isLoading,
  isOpen,
  onClose,
}: AuditLogDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close + focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Auto-focus the panel when it opens (WCAG 2.1 SC 2.4.3)
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    // Focus the close button as the first interactive element
    const closeBtn = panelRef.current.querySelector<HTMLElement>(
      '[data-testid="audit-detail-close"]',
    );
    if (closeBtn) {
      closeBtn.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        data-testid="audit-detail-backdrop"
      />

      {/* Side Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Audit Log Entry Detail"
        data-testid="audit-detail-panel"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col',
          'bg-card shadow-xl transition-transform duration-200',
          'animate-slide-in-right',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            ) : detail ? (
              <>
                <h2 className="text-lg font-semibold text-foreground truncate">{detail.action}</h2>
                <p className="text-xs text-muted-foreground">
                  {formatAuditTimestamp(detail.timestamp)}
                </p>
              </>
            ) : (
              <h2 className="text-lg font-semibold text-foreground">Entry Not Found</h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 rounded-md p-1 text-muted-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Close panel"
            data-testid="audit-detail-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div
              className="flex h-64 items-center justify-center"
              data-testid="audit-detail-loading"
            >
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !detail ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No detail available.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Admin User Section */}
              <Section icon={User} title="Admin User">
                <DetailRow label="Name">{detail.platformUser.displayName}</DetailRow>
                <DetailRow label="Email">{detail.platformUser.email}</DetailRow>
              </Section>

              {/* Action Section */}
              <Section icon={Activity} title="Action">
                <DetailRow label="Action">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      actionBadgeClass(detail.action),
                    )}
                  >
                    {detail.action}
                  </span>
                </DetailRow>
                <DetailRow label="Target Type">
                  {detail.targetType ?? <span className="text-muted-foreground">—</span>}
                </DetailRow>
                <DetailRow label="Target ID">
                  {detail.targetId ? (
                    <CopyButton value={detail.targetId} label="target ID" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </DetailRow>
              </Section>

              {/* Details JSON Section */}
              <Section icon={FileJson} title="Details">
                {detail.details ? (
                  <pre
                    className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 font-mono text-xs text-foreground"
                    data-testid="audit-detail-json"
                  >
                    {JSON.stringify(detail.details, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">No additional details recorded.</p>
                )}
              </Section>

              {/* Request Info Section */}
              <Section icon={Globe} title="Request Info">
                <DetailRow label="IP Address">{detail.ipAddress}</DetailRow>
                <DetailRow label="User Agent">
                  {detail.userAgent ? (
                    <span className="break-all text-xs">{detail.userAgent}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </DetailRow>
              </Section>

              {/* Timestamps Section */}
              <Section icon={Clock} title="Timestamps">
                <DetailRow label="Timestamp">{formatAuditTimestamp(detail.timestamp)}</DetailRow>
                <DetailRow label="Created At">{formatAuditTimestamp(detail.createdAt)}</DetailRow>
              </Section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
