import React from 'react';
import { Link } from '@tanstack/react-router';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';

import type { BreadcrumbSegment } from './types';

export interface PageHeaderProps {
  /** Page title (already translated by caller) */
  title: string;
  /** Optional subtitle (e.g., record number) */
  subtitle?: string;
  /** Breadcrumb segments */
  breadcrumbs: BreadcrumbSegment[];
  /** Optional status badge rendered next to the title */
  statusBadge?: React.ReactNode;
  /** Optional action bar slot (right-aligned) */
  actionBarSlot?: React.ReactNode;
  /** Whether the page is loading */
  isLoading?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  statusBadge,
  actionBarSlot,
  isLoading,
}: PageHeaderProps) {
  return (
    <header className="space-y-2">
      {breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((segment, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <React.Fragment key={segment.label}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast || !segment.path ? (
                      <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={segment.path}>{segment.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <>
              <h1
                className="page-title truncate"
              >
                {title}
              </h1>
              {subtitle && (
                <span className="text-sm text-muted-foreground truncate">
                  {subtitle}
                </span>
              )}
              {statusBadge}
            </>
          )}
        </div>

        {actionBarSlot && (
          <div className="flex items-center gap-2 shrink-0">
            {actionBarSlot}
          </div>
        )}
      </div>
    </header>
  );
}
