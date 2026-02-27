import { useState } from 'react';
import { Pencil, Star, Trash2 } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/action-bar/confirmation-dialog';
import { cn } from '@/lib/utils';

import type { SavedViewDto } from '../types';
import type { useViewMutations } from '../hooks/use-view-mutations';
import type { ViewState } from '../hooks/use-view-state';

interface ViewItemProps {
  view: SavedViewDto;
  isActive: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  mutations: ReturnType<typeof useViewMutations>;
  viewState: ViewState;
  onSelect: (viewId: string) => void;
}

export function ViewItem({
  view,
  isActive,
  isOwner,
  isAdmin,
  mutations,
  viewState: _viewState,
  onSelect,
}: ViewItemProps) {
  const { t } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(view.name);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canModify = isOwner || isAdmin;

  function handleStarToggle(e: React.MouseEvent) {
    e.stopPropagation();
    mutations.toggleFav.mutate(view.id);
  }

  function handleSetDefault(e: React.MouseEvent) {
    e.stopPropagation();
    mutations.setDef.mutate(view.id);
  }

  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditName(view.name);
    setIsEditing(true);
  }

  function handleEditSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = editName.trim();
    if (trimmed && trimmed !== view.name) {
      mutations.updateView.mutate(
        { id: view.id, data: { name: trimmed } },
        {
          onSuccess: () => {
            setIsEditing(false);
          },
        },
      );
    } else {
      setIsEditing(false);
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setIsEditing(false);
    }
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteOpen(true);
  }

  function handleDeleteConfirm() {
    mutations.removeView.mutate(view.id, {
      onSuccess: () => {
        setDeleteOpen(false);
      },
    });
  }

  function handleSelect() {
    if (!isEditing) {
      onSelect(view.id);
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
          'hover:bg-accent/50',
          isActive && 'border-l-2 border-primary bg-primary/5',
        )}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        onClick={handleSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect();
          }
        }}
      >
        {/* Star toggle */}
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          onClick={handleStarToggle}
          aria-label={t(view.isFavourite ? 'views.actions.unfavourite' : 'views.actions.favourite')}
        >
          <Star
            className={cn(
              'size-3.5',
              view.isFavourite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
            )}
          />
        </Button>

        {/* View name or inline edit */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="flex gap-1">
              <Input
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                }}
                onKeyDown={handleEditKeyDown}
                className="h-6 text-sm px-1.5 py-0"
                maxLength={100}
                /* eslint-disable-next-line jsx-a11y/no-autofocus -- inline rename needs immediate focus */
                autoFocus
                onClick={(e) => {
                  e.stopPropagation();
                }}
              />
            </form>
          ) : (
            <span className="truncate block">{view.name}</span>
          )}
        </div>

        {/* Default badge */}
        {view.isDefault && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
            {t('views.badge.default')}
          </Badge>
        )}

        {/* Hover actions */}
        {(isHovered || isActive) && canModify && !isEditing && (
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Set as default */}
            {!view.isDefault && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleSetDefault}
                aria-label={t('views.actions.setDefault')}
                title={t('views.actions.setDefault')}
              >
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 cursor-pointer">
                  {t('views.actions.setDefaultShort')}
                </Badge>
              </Button>
            )}

            {/* Edit */}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleEditClick}
              aria-label={t('views.actions.edit')}
            >
              <Pencil className="size-3 text-muted-foreground" />
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleDeleteClick}
              aria-label={t('views.actions.delete')}
            >
              <Trash2 className="size-3 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        // eslint-disable-next-line i18next/no-literal-string -- i18n key passed to t() inside component
        titleKey="views.confirm.deleteTitle"
        // eslint-disable-next-line i18next/no-literal-string -- i18n key passed to t() inside component
        descriptionKey="views.confirm.deleteDescription"
        entityName={view.name}
        onConfirm={handleDeleteConfirm}
        isLoading={mutations.removeView.isPending}
        variant="destructive"
      />
    </>
  );
}
