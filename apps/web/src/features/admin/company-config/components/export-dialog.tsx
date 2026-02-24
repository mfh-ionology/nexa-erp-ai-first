/**
 * Export Company Configuration Dialog.
 *
 * Fetches the export data on open for a preview summary, then triggers
 * a browser file download when the user clicks "Download JSON".
 */

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

import type { ExportDefaultsResponse } from '../api/types';

// --- Props ---

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companySlug: string;
}

// --- Preview row type ---

interface PreviewItem {
  labelKey: string;
  count: number;
}

// --- Component ---

export function ExportDialog({ open, onOpenChange, companySlug }: ExportDialogProps) {
  const { t } = useI18n();

  // Fetch export data on dialog open for preview counts
  const {
    data: exportData,
    isLoading,
    isFetching,
    error: fetchError,
  } = useQuery({
    queryKey: queryKeys.system.exportDefaults(),
    queryFn: async () => {
      const result = await apiGet<ExportDefaultsResponse>(
        '/system/company-profile/export-defaults',
      );
      return result.data;
    },
    enabled: open,
    staleTime: 30_000, // Cache preview for 30s to avoid refetch on re-open
  });

  // Build preview items from the fetched data
  const previewItems: PreviewItem[] = exportData
    ? [
        {
          labelKey: 'companyConfig.export.preview.accessGroups',
          count: exportData.accessGroups.length,
        },
        {
          labelKey: 'companyConfig.export.preview.permissions',
          count: exportData.accessGroups.reduce((sum, ag) => sum + ag.permissions.length, 0),
        },
        {
          labelKey: 'companyConfig.export.preview.fieldOverrides',
          count: exportData.accessGroups.reduce((sum, ag) => sum + ag.fieldOverrides.length, 0),
        },
        {
          labelKey: 'companyConfig.export.preview.vatCodes',
          count: exportData.vatCodes.length,
        },
        {
          labelKey: 'companyConfig.export.preview.paymentTerms',
          count: exportData.paymentTerms.length,
        },
        {
          labelKey: 'companyConfig.export.preview.numberSeries',
          count: exportData.numberSeries.length,
        },
        {
          labelKey: 'companyConfig.export.preview.currencies',
          count: exportData.currencies.length,
        },
      ]
    : [];

  // Trigger file download using the cached data (no second API call)
  const handleDownload = useCallback(() => {
    if (!exportData) return;

    try {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `company-defaults-${companySlug}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(t('companyConfig.toast.exportSuccess'));
      onOpenChange(false);
    } catch {
      toast.error(t('companyConfig.error.exportFailed'));
    }
  }, [exportData, companySlug, t, onOpenChange]);

  const isDownloadDisabled = isLoading || isFetching || !exportData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('companyConfig.export.title')}</DialogTitle>
          <DialogDescription>
            {t('companyConfig.export.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Preview summary */}
        <Card>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <p className="text-sm text-destructive">
                {t('companyConfig.error.exportFailed')}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {previewItems.map((item) => (
                  <div
                    key={item.labelKey}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-muted-foreground">
                      {t(item.labelKey)}
                    </span>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t('common:cancel')}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isDownloadDisabled}
          >
            {isFetching ? (
              <>
                <Loader2 className="animate-spin" />
                {t('companyConfig.export.downloadButton')}
              </>
            ) : (
              t('companyConfig.export.downloadButton')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
