/**
 * Company Profile Page — minimal shell for E6.12.
 *
 * Displays breadcrumbs, company name title, and an overflow menu
 * with Export Config / Import Config actions (ADMIN-only).
 * Full company settings will be built in a later epic.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, MoreHorizontal, Upload } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/templates/page-header';
import { queryKeys } from '@/lib/query-keys';
import { fetchCompanies } from '@/lib/system-api';
import { useAuthStore } from '@/stores/auth-store';

import { ExportDialog } from './components/export-dialog';
import { ImportDialog } from './components/import-dialog';

export function CompanyProfilePage() {
  const { t } = useI18n();
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const permissions = useAuthStore((s) => s.permissions);

  // Reuse the already-cached companies query for the company name
  const { data: companies } = useQuery({
    queryKey: queryKeys.system.companies(),
    queryFn: fetchCompanies,
  });
  const activeCompany = companies?.find((c) => c.id === activeCompanyId);
  const companyName = activeCompany?.name ?? t('companyConfig.pageTitle');
  const companySlug = activeCompany?.slug ?? 'export';

  // Dialog state
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Role check — overflow actions only for ADMIN / SUPER_ADMIN
  const isAdmin = permissions?.isSuperAdmin || permissions?.role === 'ADMIN';

  // Breadcrumbs
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('companyConfig.pageTitle') },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={companyName}
        subtitle={t('companyConfig.pageDescription')}
        breadcrumbs={breadcrumbs}
        actionBarSlot={
          isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t('actionBar.moreActions')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t('companyConfig.overflowSection.data')}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setExportOpen(true)}>
                    <Download className="size-4" />
                    {t('companyConfig.action.export')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setImportOpen(true)}>
                    <Upload className="size-4" />
                    {t('companyConfig.action.import')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      {/* Placeholder content — will be expanded in a later epic */}
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t('companyConfig.placeholder')}
          </p>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} companySlug={companySlug} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
