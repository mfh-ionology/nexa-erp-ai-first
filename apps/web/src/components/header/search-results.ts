import {
  FileText,
  Sparkles,
  type LucideIcon,
  LayoutDashboard,
  BookOpen,
  BookText,
  Calendar,
  ArrowLeftRight,
  PiggyBank,
  UserCheck,
  CreditCard,
  FileX,
  ScrollText,
  Truck,
  FileQuestion,
  ClipboardList,
  PackageCheck,
  Box,
  Warehouse,
  ArrowRightLeft,
  ClipboardCheck,
  UserPlus,
  Target,
  Megaphone,
  Contact,
  Users,
  FileSignature,
  CalendarOff,
  Banknote,
  Star,
  FileCode,
  Cog,
  Network,
  FileBarChart,
  Settings,
} from 'lucide-react';

import { fuzzyMatch } from '@/lib/fuzzy-match';
import {
  NAVIGATION_MODULES,
  type NavigationItem,
} from '@/lib/navigation-config';

import type { SearchResultItem } from '@/components/copilot/types';

// ── Icon mapping from navigation config icon strings ──────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Settings,
  Users,
  Building2: Warehouse,
  BookOpen,
  BookText,
  Calendar,
  ArrowLeftRight,
  PiggyBank,
  UserCheck,
  FileText,
  CreditCard,
  FileX,
  ScrollText,
  Truck,
  FileQuestion,
  ClipboardList,
  PackageCheck,
  Box,
  Warehouse,
  ArrowRightLeft,
  ClipboardCheck,
  UserPlus,
  Target,
  Megaphone,
  Contact,
  FileSignature,
  CalendarOff,
  Banknote,
  Star,
  FileCode,
  Cog,
  Network,
  FileBarChart,
  LayoutDashboard,
};

// ── Flatten all navigation items ──────────────────────────────────────────────

interface FlatNavItem extends NavigationItem {
  moduleKey: string;
  resolvedIcon: LucideIcon;
}

const ALL_NAV_ITEMS: FlatNavItem[] = NAVIGATION_MODULES.flatMap((mod) =>
  mod.items.map((item) => ({
    ...item,
    moduleKey: mod.key,
    resolvedIcon: ICON_MAP[item.icon] ?? FileText,
  })),
);


function fuzzyScore(query: string, target: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  if (lowerTarget === lowerQuery) return 100;
  if (lowerTarget.startsWith(lowerQuery)) return 80;
  if (lowerTarget.includes(lowerQuery)) return 60;
  return 0;
}

// ── Page results ──────────────────────────────────────────────────────────────

/**
 * Fuzzy-match the query against the sidebar navigation items.
 * Returns matching pages sorted by relevance, limited to 3 results (spec §2.4).
 */
export function getPageResults(query: string): SearchResultItem[] {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const matches: Array<{ item: FlatNavItem; score: number }> = [];

  for (const item of ALL_NAV_ITEMS) {
    // Match against the key's last segment (e.g., "invoices" from "ar.invoices")
    const keyLabel = item.key.split('.').pop() ?? '';
    const pathLabel = item.path.split('/').filter(Boolean).join(' ');

    const keyScore = fuzzyScore(trimmed, keyLabel);
    const pathScore = fuzzyScore(trimmed, pathLabel);
    const fuzzyKeyMatch = fuzzyMatch(trimmed, keyLabel) ? 40 : 0;
    const fuzzyPathMatch = fuzzyMatch(trimmed, pathLabel) ? 30 : 0;

    const bestScore = Math.max(keyScore, pathScore, fuzzyKeyMatch, fuzzyPathMatch);
    if (bestScore > 0) {
      matches.push({ item, score: bestScore });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => ({
      id: `page-${item.key}`,
      category: 'page' as const,
      label: item.key.split('.').pop() ?? item.key,
      labelKey: item.labelKey,
      icon: item.resolvedIcon,
      href: item.path,
    }));
}

// ── Entity result placeholders ────────────────────────────────────────────────

/** Map entity prefix to i18n key for the entity type name */
const ENTITY_TYPE_I18N_MAP: Record<string, string> = {
  INV: 'search.entity.type.invoice',
  PO: 'search.entity.type.purchaseOrder',
  SO: 'search.entity.type.salesOrder',
  CUS: 'search.entity.type.customer',
  SUP: 'search.entity.type.supplier',
  QUO: 'search.entity.type.quote',
  QU: 'search.entity.type.quote',
  CN: 'search.entity.type.creditNote',
  DN: 'search.entity.type.deliveryNote',
  GR: 'search.entity.type.goodsReceipt',
  WO: 'search.entity.type.workOrder',
};

/**
 * Placeholder entity search results for MVP.
 * Real entity search will be wired to GET /search?q=... in E7.
 * Returns up to 5 results (spec §2.4).
 */
export function getEntityResultPlaceholders(
  query: string,
  t: (key: string) => string,
): SearchResultItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Extract the prefix to show contextual placeholders
  const prefixMatch = trimmed.match(/^([A-Z]{2,3})-?/i);
  const prefix = prefixMatch?.[1]?.toUpperCase() ?? '';

  const entityTypeKey = ENTITY_TYPE_I18N_MAP[prefix] ?? 'search.entity.type.record';
  const entityType = t(entityTypeKey);
  const name1 = t('search.entity.placeholder.name1');
  const name2 = t('search.entity.placeholder.name2');

  // Generate up to 5 placeholders (spec §2.4)
  const placeholders: SearchResultItem[] = [];
  const refs = ['0042', '0043', '0044', '0045', '0046'];
  const names = [name1, name2, name1, name2, name1];

  for (let i = 0; i < 5; i++) {
    placeholders.push({
      id: `entity-placeholder-${i + 1}`,
      category: 'entity' as const,
      label: `${prefix}-2026-${refs[i]}`,
      labelKey: 'search.entitySearchComingSoon',
      description: `${entityType} — ${names[i]}`,
      icon: FileText,
      href: undefined,
    });
  }

  return placeholders;
}

// ── AI suggestions ────────────────────────────────────────────────────────────

/**
 * Static AI prompt suggestions based on query content.
 * Uses i18n keys for display labels.
 * Limited to 2 results (spec §2.4).
 */
export function getAiSuggestions(
  query: string,
  t: (key: string, params?: Record<string, unknown>) => string,
): SearchResultItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();

  // Context-aware suggestions based on keywords in the query
  const suggestions: SearchResultItem[] = [];

  if (lower.includes('invoice') || lower.includes('inv')) {
    suggestions.push(
      {
        id: 'ai-show-overdue',
        category: 'ai' as const,
        label: t('search.ai.showOverdue'),
        icon: Sparkles,
        aiPrompt: t('search.ai.promptText.showOverdue'),
      },
      {
        id: 'ai-create-invoice',
        category: 'ai' as const,
        label: t('search.ai.createInvoice'),
        icon: Sparkles,
        aiPrompt: lower.includes('for')
          ? `Create an invoice ${trimmed.slice(trimmed.toLowerCase().indexOf('for'))}`.trim()
          : t('search.ai.promptText.createInvoice'),
      },
    );
  }

  if (lower.includes('revenue') || lower.includes('sales') || lower.includes('money')) {
    suggestions.push({
      id: 'ai-revenue',
      category: 'ai' as const,
      label: t('search.ai.revenueSummary'),
      icon: Sparkles,
      aiPrompt: t('search.ai.promptText.revenue'),
    });
  }

  if (lower.includes('stock') || lower.includes('inventory') || lower.includes('item')) {
    suggestions.push({
      id: 'ai-low-stock',
      category: 'ai' as const,
      label: t('search.ai.lowStock'),
      icon: Sparkles,
      aiPrompt: t('search.ai.promptText.lowStock'),
    });
  }

  if (lower.includes('order') || lower.includes('purchase')) {
    suggestions.push({
      id: 'ai-pending-orders',
      category: 'ai' as const,
      label: t('search.ai.pendingOrders'),
      icon: Sparkles,
      aiPrompt: t('search.ai.promptText.pendingOrders'),
    });
  }

  // Deduplicate by id and limit to 2 (spec §2.4)
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  }).slice(0, 2);
}
