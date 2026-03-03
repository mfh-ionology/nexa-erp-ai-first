import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptRenderer } from './prompt-renderer.js';
import type { PromptRenderContext } from './prompt-renderer.js';

// ─── Mock Logger ────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as any;

// ─── Mock PrismaClient ──────────────────────────────────────────────────────

function createMockDb(
  overrides: {
    prompt?: any;
    activeVersion?: any;
  } = {},
) {
  // Extract versions from prompt if provided, for the separate version query
  const promptData = overrides.prompt;
  const versions = promptData?.versions ?? [];
  const activeVersionNum = promptData?.activeVersion ?? 1;
  const matchingVersion =
    overrides.activeVersion ?? versions.find((v: any) => v.version === activeVersionNum) ?? null;

  return {
    aiPrompt: {
      findUnique: vi.fn().mockResolvedValue(promptData ?? null),
    },
    aiPromptVersion: {
      findFirst: vi.fn().mockResolvedValue(matchingVersion),
    },
    // Satisfy createVariableResolver — it needs a PrismaClient-like object
    // with model accessors for DbFieldHandler. For unit tests we don't need
    // those to work, but the factory must not crash.
  } as any;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePromptData({
  systemPrompt = 'You are an assistant for {{company.name}}.',
  userTemplate = 'Hello {{currentUser.name}}, today is {{today}}.',
  activeVersion = 1,
  variables = [] as any[],
  versions = undefined as any[] | undefined,
} = {}) {
  const defaultVersions = versions ?? [
    {
      id: 'version-1',
      promptId: 'prompt-1',
      version: activeVersion,
      systemPrompt,
      userTemplate,
      parameters: {},
      changeReason: null,
      createdBy: 'system',
      createdAt: new Date(),
    },
  ];

  return {
    id: 'prompt-1',
    name: 'test-prompt',
    description: 'A test prompt',
    category: 'general',
    systemPrompt,
    userTemplate,
    parameters: {},
    outputFormat: null,
    activeVersion,
    isActive: true,
    createdBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
    versions: defaultVersions,
    variables,
  };
}

function makeContext(overrides: Partial<PromptRenderContext> = {}): PromptRenderContext {
  return {
    companyId: 'company-1',
    userId: 'user-1',
    userName: 'John Doe',
    userRole: 'ADMIN',
    companyName: 'Acme Ltd',
    baseCurrency: 'GBP',
    ...overrides,
  };
}

function makeVariable(
  overrides: Partial<{
    id: string;
    promptId: string;
    variableName: string;
    displayName: string;
    description: string | null;
    sourceType: string;
    sourceConfig: any;
    defaultValue: string | null;
    isRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 'var-1',
    promptId: 'prompt-1',
    variableName: 'testVar',
    displayName: 'Test Variable',
    description: null,
    sourceType: 'CONSTANT',
    sourceConfig: { value: 'hello' },
    defaultValue: null,
    isRequired: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PromptRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('render()', () => {
    it('should render a prompt with SYSTEM and CONSTANT variables resolved', async () => {
      const variables = [
        makeVariable({
          id: 'v1',
          variableName: 'company.name',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.name' },
        }),
        makeVariable({
          id: 'v2',
          variableName: 'currentUser.name',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'currentUser.name' },
        }),
        makeVariable({
          id: 'v3',
          variableName: 'today',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'today' },
        }),
      ];

      const prompt = makePromptData({ variables });
      const db = createMockDb({ prompt });
      const renderer = new PromptRenderer(db, mockLogger);

      const result = await renderer.render('prompt-1', makeContext());

      expect(result.systemPrompt).toBe('You are an assistant for Acme Ltd.');
      expect(result.userTemplate).toContain('Hello John Doe, today is');
      // today should be a date in YYYY-MM-DD format
      expect(result.userTemplate).toMatch(/today is \d{4}-\d{2}-\d{2}/);
      expect(result.unresolvedCount).toBe(0);
      expect(result.resolvedVariables['company.name']).toBe('Acme Ltd');
      expect(result.resolvedVariables['currentUser.name']).toBe('John Doe');
      expect(result.renderTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should use default values for unresolved optional variables', async () => {
      const variables = [
        makeVariable({
          id: 'v1',
          variableName: 'company.name',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.name' },
        }),
        makeVariable({
          id: 'v2',
          variableName: 'currentUser.name',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'currentUser.name' },
        }),
        makeVariable({
          id: 'v3',
          variableName: 'today',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'today' },
        }),
        makeVariable({
          id: 'v4',
          variableName: 'unknownVar',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'nonexistent.key' },
          defaultValue: 'fallback-value',
          isRequired: false,
        }),
      ];

      const prompt = makePromptData({
        userTemplate: 'User: {{currentUser.name}}, Extra: {{unknownVar}}',
        variables,
      });
      const db = createMockDb({ prompt });
      const renderer = new PromptRenderer(db, mockLogger);

      const result = await renderer.render('prompt-1', makeContext());

      expect(result.userTemplate).toBe('User: John Doe, Extra: fallback-value');
      // unknownVar resolved to its default, so it counts as resolved in the map
      expect(result.resolvedVariables['unknownVar']).toBe('fallback-value');
    });

    it('should throw when prompt is not found', async () => {
      const db = createMockDb({ prompt: null });
      const renderer = new PromptRenderer(db, mockLogger);

      await expect(renderer.render('nonexistent', makeContext())).rejects.toThrow(
        'Prompt not found: nonexistent',
      );
    });

    it('should throw UnresolvableRequiredParamError in autonomous mode for required unresolvable vars', async () => {
      const variables = [
        makeVariable({
          id: 'v1',
          variableName: 'missingRequired',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'nonexistent.key' },
          isRequired: true,
        }),
      ];

      const prompt = makePromptData({
        userTemplate: 'Value: {{missingRequired}}',
        variables,
      });
      const db = createMockDb({ prompt });
      const renderer = new PromptRenderer(db, mockLogger);

      await expect(renderer.render('prompt-1', makeContext({ autonomous: true }))).rejects.toThrow(
        'Required variable',
      );
    });

    it('should load templates from the active version, not prompt base', async () => {
      const variables: any[] = [];
      const prompt = makePromptData({
        systemPrompt: 'BASE system prompt',
        userTemplate: 'BASE user template',
        activeVersion: 2,
        versions: [
          {
            id: 'v1',
            promptId: 'prompt-1',
            version: 1,
            systemPrompt: 'V1 system prompt',
            userTemplate: 'V1 user template',
            parameters: {},
            changeReason: null,
            createdBy: 'system',
            createdAt: new Date(),
          },
          {
            id: 'v2',
            promptId: 'prompt-1',
            version: 2,
            systemPrompt: 'V2 system prompt',
            userTemplate: 'V2 user template',
            parameters: {},
            changeReason: 'Updated',
            createdBy: 'system',
            createdAt: new Date(),
          },
        ],
        variables,
      });
      const db = createMockDb({ prompt });
      const renderer = new PromptRenderer(db, mockLogger);

      const result = await renderer.render('prompt-1', makeContext());

      expect(result.systemPrompt).toBe('V2 system prompt');
      expect(result.userTemplate).toBe('V2 user template');
    });

    it('should fall back to prompt base templates when active version is not found', async () => {
      const prompt = makePromptData({
        systemPrompt: 'BASE system',
        userTemplate: 'BASE user',
        activeVersion: 99,
        versions: [], // No versions at all
        variables: [],
      });
      const db = createMockDb({ prompt });
      const renderer = new PromptRenderer(db, mockLogger);

      const result = await renderer.render('prompt-1', makeContext());

      expect(result.systemPrompt).toBe('BASE system');
      expect(result.userTemplate).toBe('BASE user');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ promptId: 'prompt-1', activeVersion: 99 }),
        expect.stringContaining('Active prompt version not found'),
      );
    });

    it('should track renderTimeMs', async () => {
      const prompt = makePromptData({ variables: [] });
      const db = createMockDb({ prompt });
      const renderer = new PromptRenderer(db, mockLogger);

      const result = await renderer.render('prompt-1', makeContext());

      expect(typeof result.renderTimeMs).toBe('number');
      expect(result.renderTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should render with multiple variable types resolved', async () => {
      const variables = [
        makeVariable({
          id: 'v1',
          variableName: 'company.name',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.name' },
        }),
        makeVariable({
          id: 'v2',
          variableName: 'greeting',
          sourceType: 'CONSTANT',
          sourceConfig: { value: 'Welcome' },
        }),
        makeVariable({
          id: 'v3',
          variableName: 'today',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'today' },
        }),
      ];

      const prompt = makePromptData({
        systemPrompt: '{{greeting}} to {{company.name}}',
        userTemplate: 'Date: {{today}}',
        variables,
      });
      const db = createMockDb({ prompt });
      const renderer = new PromptRenderer(db, mockLogger);

      const result = await renderer.render('prompt-1', makeContext());

      expect(result.systemPrompt).toBe('Welcome to Acme Ltd');
      expect(result.userTemplate).toMatch(/^Date: \d{4}-\d{2}-\d{2}$/);
      expect(result.unresolvedCount).toBe(0);
      expect(Object.keys(result.resolvedVariables)).toHaveLength(3);
    });
  });

  describe('renderTemplate()', () => {
    it('should render an ad-hoc template with variables', async () => {
      const db = createMockDb();
      const renderer = new PromptRenderer(db, mockLogger);

      const variables = [
        makeVariable({
          variableName: 'company.name',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.name' },
        }),
      ];

      const result = await renderer.renderTemplate(
        'Report for {{company.name}}',
        variables as any,
        {
          companyId: 'c1',
          userId: 'u1',
          companyName: 'Acme Ltd',
          autonomous: false,
        },
      );

      expect(result).toBe('Report for Acme Ltd');
    });
  });
});
