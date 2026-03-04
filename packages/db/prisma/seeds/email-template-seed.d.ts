import type { PrismaClient } from '../../generated/prisma/client';
export interface TemplateData {
  code: string;
  name: string;
  description: string;
  documentType: string;
  subjectTemplate: string;
  bodyHtml: string;
  bodyText: string;
}
export declare const templates: TemplateData[];
export declare function seedEmailTemplates(prisma: PrismaClient, userId: string): Promise<void>;
//# sourceMappingURL=email-template-seed.d.ts.map
