import type { FastifyInstance } from 'fastify';

import { settingsRoutesPlugin } from './settings.routes.js';
import { accountsRoutesPlugin } from './accounts.routes.js';
import { periodsRoutesPlugin } from './periods.routes.js';
import { accountMappingsRoutesPlugin } from './account-mappings.routes.js';
import { journalsRoutesPlugin } from './journals.routes.js';
import { reportsRoutesPlugin } from './reports.routes.js';
import { bankAccountsRoutesPlugin } from './bank-accounts.routes.js';
import { bankImportRoutesPlugin } from './bank-import.routes.js';
import { openBankingRoutesPlugin } from './open-banking.routes.js';
import { bankReconciliationRoutesPlugin } from './bank-reconciliation.routes.js';
import { autoMatchRoutesPlugin } from './auto-match.routes.js';
import { vatReturnsRoutesPlugin } from './vat-returns.routes.js';
import { hmrcMtdRoutesPlugin } from './hmrc-mtd.routes.js';
import { budgetVersionsRoutesPlugin } from './budget-versions.routes.js';
import { budgetKeysRoutesPlugin } from './budget-keys.routes.js';
import { budgetsRoutesPlugin } from './budgets.routes.js';
import { budgetDimensionSplitsRoutesPlugin } from './budget-dimension-splits.routes.js';
import { journalTemplatesRoutesPlugin } from './journal-templates.routes.js';
import { openingBalancesRoutesPlugin } from './opening-balances.routes.js';
import { exchangeRatesRoutesPlugin } from './exchange-rates.routes.js';
import { monthEndRoutesPlugin } from './month-end.routes.js';
import { yearEndRoutesPlugin } from './year-end.routes.js';
import { dashboardRoutesPlugin } from './dashboard.routes.js';
import { dimensionTypesRoutesPlugin } from './dimension-types.routes.js';
import { dimensionValuesRoutesPlugin } from './dimension-values.routes.js';
import { dimensionRequirementsRoutesPlugin } from './dimension-requirements.routes.js';
import { dimensionDefaultsRoutesPlugin } from './dimension-defaults.routes.js';

async function financeModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(settingsRoutesPlugin);
  await fastify.register(accountsRoutesPlugin);
  await fastify.register(periodsRoutesPlugin);
  await fastify.register(accountMappingsRoutesPlugin);
  await fastify.register(journalsRoutesPlugin);
  await fastify.register(journalTemplatesRoutesPlugin);
  await fastify.register(reportsRoutesPlugin);
  await fastify.register(bankAccountsRoutesPlugin);
  await fastify.register(bankImportRoutesPlugin);
  await fastify.register(openBankingRoutesPlugin);
  await fastify.register(bankReconciliationRoutesPlugin);
  await fastify.register(autoMatchRoutesPlugin);
  await fastify.register(vatReturnsRoutesPlugin);
  await fastify.register(hmrcMtdRoutesPlugin);
  await fastify.register(budgetVersionsRoutesPlugin);
  await fastify.register(budgetKeysRoutesPlugin);
  await fastify.register(budgetsRoutesPlugin);
  await fastify.register(budgetDimensionSplitsRoutesPlugin);
  await fastify.register(openingBalancesRoutesPlugin);
  await fastify.register(exchangeRatesRoutesPlugin);
  await fastify.register(monthEndRoutesPlugin);
  await fastify.register(yearEndRoutesPlugin);
  await fastify.register(dashboardRoutesPlugin);

  // Dimension Management (Phase 2 Wave 2)
  await fastify.register(dimensionTypesRoutesPlugin);
  await fastify.register(dimensionValuesRoutesPlugin);
  await fastify.register(dimensionRequirementsRoutesPlugin);
  await fastify.register(dimensionDefaultsRoutesPlugin);
}

export const financeModulePlugin = financeModule;
