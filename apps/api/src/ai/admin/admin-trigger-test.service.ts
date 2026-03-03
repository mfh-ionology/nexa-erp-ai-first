// ---------------------------------------------------------------------------
// AdminTriggerTestService — L0→L1→L2 trigger phrase routing simulation
// E5c-4 Task 4: AC #5
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ActiveSkillRow {
  id: string;
  name: string;
  displayName: string;
  moduleKey: string | null;
  triggerPhrases: string[];
  negativeTriggers: string[];
  requiredTools: string[];
  skillContent: string;
  priority: number;
}

export interface TestTriggerResult {
  matchedModule: string | null;
  matchedSkill: {
    id: string;
    name: string;
    displayName: string;
    confidence: number;
  } | null;
  l0Confidence: number;
  l1Confidence: number;
  requiredTools: string[];
  skillContentPreview: string;
  noMatch: boolean;
  suggestions: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Tokenise a string into lowercase word tokens (letters/digits only). */
function tokenise(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

/** Jaccard similarity of two token sets: |A ∩ B| / |A ∪ B|. Returns 0–1. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Case-insensitive substring match check. */
function substringMatch(phrase: string, trigger: string): boolean {
  return phrase.toLowerCase().includes(trigger.toLowerCase());
}

// ─── Service ───────────────────────────────────────────────────────────────

export class AdminTriggerTestService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Simulate L0→L1→L2 progressive disclosure routing.
   *
   * L0: Module routing — score each module by aggregate trigger phrase matches
   * L1: Skill selection — within matched module, score individual skills
   * L2: Skill details — return matched skill info + confidence scores
   *
   * Pure in-memory computation (no external AI call). Must complete within 3s (NFR44).
   */
  async testTrigger(phrase: string): Promise<TestTriggerResult> {
    // Load active skills with the fields needed for routing.
    // Safety cap at 1000 to prevent unbounded memory usage (NFR44: <3s).
    const MAX_SKILLS_FOR_ROUTING = 1000;

    const skills = await this.db.aiSkill.findMany({
      where: { isActive: true },
      take: MAX_SKILLS_FOR_ROUTING,
      orderBy: { priority: 'desc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        moduleKey: true,
        triggerPhrases: true,
        negativeTriggers: true,
        requiredTools: true,
        skillContent: true,
        priority: true,
      },
    });

    const phraseTokens = tokenise(phrase);

    // ── L0: Module routing ──────────────────────────────────────────────

    // Group skills by moduleKey
    const moduleSkills = new Map<string, ActiveSkillRow[]>();
    const allModuleKeys: string[] = [];

    for (const skill of skills) {
      const key = skill.moduleKey ?? '__unassigned__';
      const existing = moduleSkills.get(key);
      if (existing) {
        existing.push(skill as ActiveSkillRow);
      } else {
        moduleSkills.set(key, [skill as ActiveSkillRow]);
        if (skill.moduleKey) allModuleKeys.push(skill.moduleKey);
      }
    }

    // Score each module: aggregate best trigger phrase match across its skills
    let bestModuleKey: string | null = null;
    let bestModuleScore = 0;

    for (const [moduleKey, moduleSkillList] of moduleSkills) {
      let moduleScore = 0;

      for (const skill of moduleSkillList) {
        for (const trigger of skill.triggerPhrases) {
          // Combine substring match bonus + Jaccard similarity
          const triggerTokens = tokenise(trigger);
          const jaccard = jaccardSimilarity(phraseTokens, triggerTokens);
          const substring = substringMatch(phrase, trigger) ? 0.3 : 0;
          const score = Math.min(jaccard + substring, 1.0);

          if (score > moduleScore) {
            moduleScore = score;
          }
        }
      }

      if (moduleScore > bestModuleScore) {
        bestModuleScore = moduleScore;
        bestModuleKey = moduleKey;
      }
    }

    // L0 threshold check
    const L0_THRESHOLD = 0.1;
    if (bestModuleScore < L0_THRESHOLD || bestModuleKey === null) {
      this.logger.debug({ phrase, bestModuleScore }, 'Trigger test: no module match');
      return {
        matchedModule: null,
        matchedSkill: null,
        l0Confidence: bestModuleScore,
        l1Confidence: 0,
        requiredTools: [],
        skillContentPreview: '',
        noMatch: true,
        suggestions: allModuleKeys.sort(),
      };
    }

    const l0Confidence = bestModuleScore;
    const matchedModuleDisplay = bestModuleKey === '__unassigned__' ? null : bestModuleKey;

    // ── L1: Skill selection ─────────────────────────────────────────────

    const candidateSkills = moduleSkills.get(bestModuleKey)!;
    let bestSkill: ActiveSkillRow | null = null;
    let bestSkillScore = -Infinity;

    for (const skill of candidateSkills) {
      let skillScore = 0;

      // (a) Trigger phrases match — best Jaccard across all trigger phrases
      for (const trigger of skill.triggerPhrases) {
        const triggerTokens = tokenise(trigger);
        const jaccard = jaccardSimilarity(phraseTokens, triggerTokens);
        const substring = substringMatch(phrase, trigger) ? 0.3 : 0;
        const score = Math.min(jaccard + substring, 1.0);

        if (score > skillScore) {
          skillScore = score;
        }
      }

      // (b) Negative triggers penalty
      for (const neg of skill.negativeTriggers) {
        if (substringMatch(phrase, neg)) {
          skillScore -= 0.5;
          break; // Only penalise once
        }
      }

      // (c) Priority weight — higher priority = slight boost (normalised 0–0.1)
      const priorityBoost = (skill.priority / 1000) * 0.1;
      skillScore += priorityBoost;

      if (skillScore > bestSkillScore) {
        bestSkillScore = skillScore;
        bestSkill = skill;
      }
    }

    // Normalise L1 confidence to 0–1 range (clamp after priority boost / negative penalty)
    const l1Confidence = bestSkill ? Math.max(0, Math.min(1, bestSkillScore)) : 0;

    // L1 threshold check — reject matches with negligible confidence
    const L1_THRESHOLD = 0.1;
    if (!bestSkill || l1Confidence < L1_THRESHOLD) {
      this.logger.debug(
        { phrase, bestModuleKey, l1Confidence },
        'Trigger test: no skill match in module',
      );
      return {
        matchedModule: matchedModuleDisplay,
        matchedSkill: null,
        l0Confidence,
        l1Confidence,
        requiredTools: [],
        skillContentPreview: '',
        noMatch: true,
        suggestions: allModuleKeys.sort(),
      };
    }

    // ── L2: Skill details ───────────────────────────────────────────────

    this.logger.debug(
      {
        phrase,
        matchedModule: matchedModuleDisplay,
        matchedSkill: bestSkill.name,
        l0Confidence,
        l1Confidence,
      },
      'Trigger test: match found',
    );

    return {
      matchedModule: matchedModuleDisplay,
      matchedSkill: {
        id: bestSkill.id,
        name: bestSkill.name,
        displayName: bestSkill.displayName,
        confidence: l1Confidence,
      },
      l0Confidence,
      l1Confidence,
      requiredTools: bestSkill.requiredTools,
      skillContentPreview: bestSkill.skillContent.slice(0, 200),
      noMatch: false,
      suggestions: [],
    };
  }
}
