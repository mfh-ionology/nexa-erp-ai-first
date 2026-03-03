import { useEffect, useState } from 'react';
import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

import { PATTERN_STYLES } from '../constants';
import type { Skill } from '../types';

import { TriggerPhraseInput } from './trigger-phrase-input';

export interface SkillOverrideInput {
  isActive: boolean;
  triggerPhrasesOverride: string[];
  priorityOverride: number;
}

interface SkillDetailSheetProps {
  skill: Skill | null;
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (override: SkillOverrideInput) => void;
  onResetDefault: (skillId: string) => void;
}

export function SkillDetailSheet({
  skill,
  open,
  isAdmin,
  onClose,
  onSave,
  onResetDefault,
}: SkillDetailSheetProps) {
  const { t } = useI18n('ai');

  // Local editable state for admin overrides
  const [isActive, setIsActive] = useState(true);
  const [triggerPhrases, setTriggerPhrases] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);

  // Reset local state when the skill changes
  useEffect(() => {
    if (skill) {
      setIsActive(skill.isActive);
      setTriggerPhrases([...skill.triggerPhrases]);
      setPriority(skill.priority);
    }
  }, [skill]);

  if (!skill) return null;

  const patternStyle = PATTERN_STYLES[skill.orchestrationPattern] ?? {
    bg: 'bg-secondary',
    text: 'text-secondary-foreground',
  };

  const patternKey = `skills.patterns.${skill.orchestrationPattern}` as const;

  const handleSave = () => {
    onSave({
      isActive,
      triggerPhrasesOverride: triggerPhrases,
      priorityOverride: priority,
    });
  };

  const handleResetDefault = () => {
    onResetDefault(skill.id);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full overflow-hidden sm:max-w-[440px]" side="right">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-serif text-lg">
                {skill.displayName || skill.name}
              </SheetTitle>
              <SheetDescription className="mt-1">
                {skill.description ?? t('skills.detail.title')}
              </SheetDescription>
            </div>
            {/* Active/inactive toggle — ADMIN only */}
            {isAdmin ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {isActive ? t('skills.active') : t('skills.inactive')}
                </span>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  className="data-[state=checked]:bg-[#7c3aed]"
                  aria-label={t('skills.active')}
                />
              </div>
            ) : (
              <span
                className="flex shrink-0 items-center gap-1.5 text-xs font-medium"
                aria-label={skill.isActive ? t('skills.active') : t('skills.inactive')}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    skill.isActive ? 'bg-[#10b981]' : 'bg-[#9ca3af]'
                  }`}
                  aria-hidden="true"
                />
                {skill.isActive ? t('skills.active') : t('skills.inactive')}
              </span>
            )}
          </div>
          {skill.hasOverride && (
            <Badge variant="secondary" className="mt-1 w-fit rounded-full text-[10px]">
              {t('skills.overrideApplied')}
            </Badge>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-6 pb-4">
            {/* Trigger Phrases */}
            {isAdmin ? (
              <TriggerPhraseInput
                phrases={triggerPhrases}
                onChange={setTriggerPhrases}
                variant="positive"
                label={t('skills.detail.triggerPhrases')}
              />
            ) : (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('skills.detail.triggerPhrases')}
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skill.triggerPhrases.map((phrase) => (
                    <span
                      key={phrase}
                      className="inline-flex items-center rounded-full bg-[#d1fae5] px-2.5 py-0.5 text-xs font-medium text-[#065f46]"
                    >
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/*
             * Negative Triggers — read-only for all roles.
             *
             * AC12 specifies negative triggers as "editable" for ADMIN, but the
             * backend override schema (upsertOverrideBodySchema in
             * skill-overrides.schema.ts) only accepts: isActive,
             * triggerPhrasesOverride, priorityOverride.  There is no
             * `negativeTriggersOverride` field.  Making these editable in the UI
             * would silently discard edits on save.
             *
             * TODO: Add `negativeTriggersOverride` to the backend override
             * schema (skill-overrides.schema.ts), service, and Prisma model,
             * then make this section editable for ADMIN using TriggerPhraseInput
             * with variant="negative".
             */}
            {skill.negativeTriggers.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('skills.detail.negativeTriggers')}
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skill.negativeTriggers.map((phrase) => (
                    <span
                      key={phrase}
                      className="inline-flex items-center rounded-full bg-[#fee2e2] px-2.5 py-0.5 text-xs font-medium text-[#991b1b]"
                    >
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Priority — ADMIN editable */}
            {isAdmin && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('skills.detail.priority')}
                </span>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="mt-2 w-24 rounded-lg focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30"
                  min={0}
                  max={100}
                  aria-label={t('skills.detail.priority')}
                />
              </div>
            )}

            {/* Skill Instructions — always read-only */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('skills.instructions')}
              </span>
              <div className="mt-2 rounded-lg bg-secondary p-3">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                  {skill.skillContent || t('skills.detail.noInstructions')}
                </pre>
              </div>
            </div>

            {/* Required Tools — read-only */}
            {skill.requiredTools.length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('skills.requiredTools')}
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skill.requiredTools.map((tool) => (
                    <Badge key={tool} variant="outline" className="rounded-full text-xs">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Examples — read-only JSON */}
            {skill.examples && Object.keys(skill.examples).length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('skills.examples')}
                </span>
                <div className="mt-2 rounded-lg bg-secondary p-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                    {JSON.stringify(skill.examples, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Parameters — read-only JSON */}
            {skill.parameters && Object.keys(skill.parameters).length > 0 && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('skills.parameters')}
                </span>
                <div className="mt-2 rounded-lg bg-secondary p-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                    {JSON.stringify(skill.parameters, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <Separator />

            {/* Pattern & Version — read-only metadata */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('skills.pattern')}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${patternStyle.bg} ${patternStyle.text}`}
                >
                  {t(patternKey)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('skills.detail.version')}
                </span>
                <span className="text-xs font-medium text-foreground">{skill.version}</span>
              </div>

              {!isAdmin && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('skills.detail.priority')}
                  </span>
                  <span className="text-xs font-medium text-foreground">{skill.priority}</span>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer — admin gets Save + Reset; staff gets Close only */}
        <SheetFooter className="border-t border-border">
          {isAdmin ? (
            <div className="flex w-full items-center justify-between">
              <Button
                variant="outline"
                onClick={handleResetDefault}
                className="rounded-lg"
                disabled={!skill.hasOverride}
              >
                {t('skills.resetToDefault')}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="rounded-lg">
                  {t('common:cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6] disabled:opacity-40"
                >
                  {t('skills.detail.saveOverride')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={onClose} className="w-full rounded-lg">
              {t('common:close')}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
