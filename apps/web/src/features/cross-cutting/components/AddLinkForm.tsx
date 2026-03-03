/**
 * Dialog form for creating a new record link.
 *
 * - Entity type selector with registered entity types
 * - Entity search: debounced typeahead with dropdown results
 * - Link type selector
 * - Direction display: "This record → [selected entity]"
 * - Validation: both entities required, link type required
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, ArrowRight, LinkIcon, Loader2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useEntitySearch } from '@/hooks/use-entity-search';

import { useCreateRecordLink } from '../hooks/use-record-links';
import type { RecordLinkType } from '../types';
import { VALID_ENTITY_TYPES, getEntityTypeLabelKey } from '../utils/entity-display';

const LINK_TYPE_OPTIONS: RecordLinkType[] = [
  'CREATED_FROM',
  'FULFILLS',
  'PAYMENT_FOR',
  'CREDIT_FOR',
  'RELATES_TO',
  'PARENT_CHILD',
];

const LINK_TYPE_LABEL_KEYS: Record<RecordLinkType, string> = {
  CREATED_FROM: 'crossCutting.recordLinks.typeCreatedFrom',
  FULFILLS: 'crossCutting.recordLinks.typeFulfils',
  PAYMENT_FOR: 'crossCutting.recordLinks.typePaymentFor',
  CREDIT_FOR: 'crossCutting.recordLinks.typeCreditFor',
  RELATES_TO: 'crossCutting.recordLinks.typeRelatesTo',
  PARENT_CHILD: 'crossCutting.recordLinks.typeParentChild',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddLinkFormProps {
  sourceEntityType: string;
  sourceEntityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinkCreated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddLinkForm({
  sourceEntityType,
  sourceEntityId,
  open,
  onOpenChange,
  onLinkCreated,
}: AddLinkFormProps) {
  const { t } = useI18n();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [targetEntityType, setTargetEntityType] = useState<string>('');
  const [targetEntityId, setTargetEntityId] = useState<string>('');
  const [targetDisplayName, setTargetDisplayName] = useState<string>('');
  const [linkType, setLinkType] = useState<RecordLinkType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const createLink = useCreateRecordLink(sourceEntityType, sourceEntityId);

  // Entity search via existing hook
  const { results, isLoading: isSearching } = useEntitySearch({
    type: targetEntityType || null,
    q: searchQuery,
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTargetEntityType('');
      setTargetEntityId('');
      setTargetDisplayName('');
      setLinkType('');
      setSearchQuery('');
      setShowResults(false);
    }
  }, [open]);

  // Close results dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEntityTypeChange = useCallback((value: string) => {
    setTargetEntityType(value);
    // Reset entity selection when type changes
    setTargetEntityId('');
    setTargetDisplayName('');
    setSearchQuery('');
    setShowResults(false);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setTargetEntityId('');
    setTargetDisplayName('');
    setShowResults(true);
  }, []);

  const handleSelectEntity = useCallback((entityId: string, displayName: string) => {
    setTargetEntityId(entityId);
    setTargetDisplayName(displayName);
    setSearchQuery(displayName);
    setShowResults(false);
  }, []);

  const isValid = targetEntityType && targetEntityId && linkType;

  const handleSubmit = useCallback(() => {
    if (!isValid || !linkType) return;

    createLink.mutate(
      {
        sourceEntityType,
        sourceEntityId,
        targetEntityType,
        targetEntityId,
        linkType,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onLinkCreated?.();
        },
      },
    );
  }, [
    isValid,
    linkType,
    sourceEntityType,
    sourceEntityId,
    targetEntityType,
    targetEntityId,
    createLink,
    onOpenChange,
    onLinkCreated,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('crossCutting.recordLinks.addLink')}</DialogTitle>
          <DialogDescription>{t('crossCutting.recordLinks.addLinkDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Entity type selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="entity-type-select">
              {t('crossCutting.recordLinks.entityType')}
            </label>
            <Select value={targetEntityType} onValueChange={handleEntityTypeChange}>
              <SelectTrigger id="entity-type-select">
                <SelectValue placeholder={t('crossCutting.recordLinks.selectEntityType')} />
              </SelectTrigger>
              <SelectContent>
                {VALID_ENTITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(getEntityTypeLabelKey(type))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity search (typeahead) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="entity-search-input">
              {t('crossCutting.recordLinks.searchEntity')}
            </label>
            <div className="relative" ref={dropdownRef}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="entity-search-input"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (results.length > 0) setShowResults(true);
                }}
                placeholder={t('crossCutting.recordLinks.searchPlaceholder')}
                className="pl-9"
                disabled={!targetEntityType}
                autoComplete="off"
              />

              {/* Search results dropdown */}
              {showResults && targetEntityType && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
                  {isSearching ? (
                    <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      {t('crossCutting.recordLinks.searching')}
                    </div>
                  ) : results.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      {searchQuery.length < 2
                        ? t('crossCutting.recordLinks.typeToSearch')
                        : t('crossCutting.recordLinks.noResults')}
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto py-1">
                      {results.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                          onClick={() => handleSelectEntity(result.id, result.displayName)}
                        >
                          <span className="font-medium font-mono">{result.displayName}</span>
                          {result.subtitle && (
                            <span className="ml-2 text-muted-foreground">{result.subtitle}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Link type selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="link-type-select">
              {t('crossCutting.recordLinks.linkType')}
            </label>
            <Select
              value={linkType}
              onValueChange={(v: string) => setLinkType(v as RecordLinkType)}
            >
              <SelectTrigger id="link-type-select">
                <SelectValue placeholder={t('crossCutting.recordLinks.selectLinkType')} />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(LINK_TYPE_LABEL_KEYS[type])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Direction display */}
          {targetEntityId && linkType && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{t(getEntityTypeLabelKey(sourceEntityType))}</span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{targetDisplayName}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || createLink.isPending}>
            {t('crossCutting.recordLinks.addLink')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
