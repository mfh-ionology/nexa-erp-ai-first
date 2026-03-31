import type { FastifyInstance } from 'fastify';

import { settingsRoutesPlugin } from './settings.routes.js';
import { accountsRoutesPlugin } from './accounts.routes.js';
import { periodsRoutesPlugin } from './periods.routes.js';
import { accountMappingsRoutesPlugin } from './account-mappings.routes.js';
import { journalsRoutesPlugin } from './journals.routes.js';
import { reportsRoutesPlugin } from './reports.routes.js';
import { bankAccountsRoutesPlugin } from './bank-accounts.routes.js';
import { bankImportRoutesPlugin } from './bank-import.routes.js';
import { bankReconciliationRoutesPlugin } from './bank-reconciliation.routes.js';
import { vatReturnsRoutesPlugin } from './vat-returns.routes.js';
import { hmrcMtdRoutesPlugin } from './hmrc-mtd.routes.js';
import { budgetsRoutesPlugin } from './budgets.routes.js';
import { journalTemplatesRoutesPlugin } from './journal-templates.routes.js';
import { openingBalancesRoutesPlugin } from './opening-balances.routes.js';
import { exchangeRatesRoutesPlugin } from './exchange-rates.routes.js';
import { monthEndRoutesPlugin } from './month-end.routes.js';

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
  await fastify.register(bankReconciliationRoutesPlugin);
  await fastify.register(vatReturnsRoutesPlugin);
  await fastify.register(hmrcMtdRoutesPlugin);
  await fastify.register(budgetsRoutesPlugin);
  await fastify.register(openingBalancesRoutesPlugin);
  await fastify.register(exchangeRatesRoutesPlugin);
  await fastify.register(monthEndRoutesPlugin);
}

export const financeModulePlugin = financeModule;
