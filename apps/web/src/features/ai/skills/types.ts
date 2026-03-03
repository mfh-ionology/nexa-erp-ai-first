export interface Skill {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  moduleKey: string;
  packKey: string | null;
  triggerPhrases: string[];
  negativeTriggers: string[];
  orchestrationPattern: string;
  skillContent: string | null;
  requiredTools: string[];
  parameters: Record<string, unknown> | null;
  examples: Record<string, unknown> | null;
  priority: number;
  version: string;
  isActive: boolean;
  hasOverride?: boolean;
}

export interface SkillOverride {
  skillId: string;
  companyId: string;
  isActive: boolean | null;
  triggerPhrasesOverride: string[];
  priorityOverride: number | null;
}
