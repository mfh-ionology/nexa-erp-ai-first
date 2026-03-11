import type { PrismaClient } from '@nexa/db';
import { DocumentType, PrintAction, SettingCategory, SettingValueType } from '@nexa/db';
import type { Logger } from 'pino';

export type PreferenceSource = 'USER' | 'COMPANY_DEFAULT' | 'FALLBACK';

export interface ResolvedPreference {
  documentType: DocumentType;
  action: PrintAction;
  source: PreferenceSource;
}

export interface CompanyDefault {
  documentType: DocumentType;
  action: PrintAction;
}

export interface PreferenceInput {
  documentType: DocumentType;
  action: PrintAction;
}

const PRINT_DEFAULT_KEY_PREFIX = 'print.default.';
const ALL_DOCUMENT_TYPES = Object.values(DocumentType);

export class PrintPreferenceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Returns resolved preferences for all document types.
   * Resolution order: user preference → company default → NONE
   */
  async getPreferences(companyId: string, userId: string): Promise<ResolvedPreference[]> {
    const [userPrefs, companySettings] = await Promise.all([
      this.prisma.printPreference.findMany({
        where: { companyId, userId },
      }),
      this.prisma.systemSetting.findMany({
        where: {
          companyId,
          key: { startsWith: PRINT_DEFAULT_KEY_PREFIX },
        },
      }),
    ]);

    const userPrefMap = new Map(userPrefs.map((p) => [p.documentType, p.action]));

    const companyDefaultMap = new Map<DocumentType, PrintAction>();
    for (const setting of companySettings) {
      const docTypeStr = setting.key.slice(PRINT_DEFAULT_KEY_PREFIX.length);
      if (Object.values(DocumentType).includes(docTypeStr as DocumentType)) {
        const action = setting.value as PrintAction;
        if (Object.values(PrintAction).includes(action)) {
          companyDefaultMap.set(docTypeStr as DocumentType, action);
        }
      }
    }

    return ALL_DOCUMENT_TYPES.map((docType) => {
      const userAction = userPrefMap.get(docType);
      if (userAction) {
        return { documentType: docType, action: userAction, source: 'USER' as const };
      }

      const companyAction = companyDefaultMap.get(docType);
      if (companyAction) {
        return { documentType: docType, action: companyAction, source: 'COMPANY_DEFAULT' as const };
      }

      return { documentType: docType, action: PrintAction.NONE, source: 'FALLBACK' as const };
    });
  }

  /**
   * Upsert user preferences. Deletes preferences that match company default (normalise back).
   */
  async updateUserPreferences(
    companyId: string,
    userId: string,
    preferences: PreferenceInput[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Fetch company defaults inside the transaction to avoid race conditions
      const settings = await tx.systemSetting.findMany({
        where: {
          companyId,
          key: { startsWith: PRINT_DEFAULT_KEY_PREFIX },
        },
      });

      const defaultMap = new Map<DocumentType, PrintAction>();
      for (const setting of settings) {
        const docTypeStr = setting.key.slice(PRINT_DEFAULT_KEY_PREFIX.length);
        if (Object.values(DocumentType).includes(docTypeStr as DocumentType)) {
          const action = setting.value as PrintAction;
          if (Object.values(PrintAction).includes(action)) {
            defaultMap.set(docTypeStr as DocumentType, action);
          }
        }
      }

      const toUpsert: PreferenceInput[] = [];
      const toDelete: DocumentType[] = [];

      for (const pref of preferences) {
        const companyDefault = defaultMap.get(pref.documentType) ?? PrintAction.NONE;
        if (pref.action === companyDefault) {
          toDelete.push(pref.documentType);
        } else {
          toUpsert.push(pref);
        }
      }

      if (toDelete.length > 0) {
        await tx.printPreference.deleteMany({
          where: {
            companyId,
            userId,
            documentType: { in: toDelete },
          },
        });
      }

      if (toUpsert.length > 0) {
        await Promise.all(
          toUpsert.map((pref) =>
            tx.printPreference.upsert({
              where: {
                companyId_userId_documentType: {
                  companyId,
                  userId,
                  documentType: pref.documentType,
                },
              },
              create: {
                companyId,
                userId,
                documentType: pref.documentType,
                action: pref.action,
              },
              update: {
                action: pref.action,
              },
            }),
          ),
        );
      }
    });

    this.logger.info(
      { companyId, userId, count: preferences.length },
      'print-preference: user preferences updated',
    );
  }

  /**
   * Returns company-level defaults for all document types.
   * Missing types return NONE as implicit default.
   */
  async getCompanyDefaults(companyId: string): Promise<CompanyDefault[]> {
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        companyId,
        key: { startsWith: PRINT_DEFAULT_KEY_PREFIX },
      },
    });

    const settingMap = new Map<DocumentType, PrintAction>();
    for (const setting of settings) {
      const docTypeStr = setting.key.slice(PRINT_DEFAULT_KEY_PREFIX.length);
      if (Object.values(DocumentType).includes(docTypeStr as DocumentType)) {
        const action = setting.value as PrintAction;
        if (Object.values(PrintAction).includes(action)) {
          settingMap.set(docTypeStr as DocumentType, action);
        }
      }
    }

    return ALL_DOCUMENT_TYPES.map((docType) => ({
      documentType: docType,
      action: settingMap.get(docType) ?? PrintAction.NONE,
    }));
  }

  /**
   * Delete all user print preferences for a given user + company,
   * reverting them to company defaults / NONE fallback.
   */
  async resetUserPreferences(companyId: string, userId: string): Promise<void> {
    await this.prisma.printPreference.deleteMany({
      where: { companyId, userId },
    });

    this.logger.info({ companyId, userId }, 'print-preference: user preferences reset to defaults');
  }

  /**
   * Upsert company defaults via SystemSetting records.
   */
  async updateCompanyDefaults(companyId: string, defaults: PreferenceInput[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        defaults.map((def) => {
          const key = `${PRINT_DEFAULT_KEY_PREFIX}${def.documentType}`;
          return tx.systemSetting.upsert({
            where: {
              companyId_key: {
                companyId,
                key,
              },
            },
            create: {
              companyId,
              key,
              value: def.action,
              valueType: SettingValueType.STRING,
              category: SettingCategory.GENERAL,
            },
            update: {
              value: def.action,
            },
          });
        }),
      );
    });

    this.logger.info(
      { companyId, count: defaults.length },
      'print-preference: company defaults updated',
    );
  }
}
