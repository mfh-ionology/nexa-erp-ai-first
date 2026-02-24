import { describe, it, expect } from 'vitest';

import { getEntityActionConfig, getGlobalActions } from './action-config';

describe('getEntityActionConfig', () => {
  // --- CustomerInvoice ---

  it('returns Approve + Save Draft as primary for customerInvoice DRAFT', () => {
    const config = getEntityActionConfig('customerInvoice', 'DRAFT');
    const keys = config.primary.map((a) => a.key);
    expect(keys).toEqual(['approve', 'saveDraft']);
  });

  it('returns Cancel in overflow status section for customerInvoice DRAFT', () => {
    const config = getEntityActionConfig('customerInvoice', 'DRAFT');
    const statusActions = config.overflow.filter((a) => a.section === 'status');
    expect(statusActions.map((a) => a.key)).toContain('cancel');
  });

  it('returns Delete in overflow record section for customerInvoice DRAFT', () => {
    const config = getEntityActionConfig('customerInvoice', 'DRAFT');
    const recordActions = config.overflow.filter((a) => a.section === 'record');
    expect(recordActions.map((a) => a.key)).toContain('delete');
  });

  it('returns document actions (print, email, exportPdf, duplicate) for customerInvoice DRAFT', () => {
    const config = getEntityActionConfig('customerInvoice', 'DRAFT');
    const docActions = config.overflow.filter((a) => a.section === 'document');
    expect(docActions.map((a) => a.key)).toEqual(['print', 'email', 'exportPdf', 'duplicate']);
  });

  it('returns no primary actions for customerInvoice POSTED', () => {
    const config = getEntityActionConfig('customerInvoice', 'POSTED');
    expect(config.primary).toHaveLength(0);
  });

  it('returns Void in overflow for customerInvoice POSTED', () => {
    const config = getEntityActionConfig('customerInvoice', 'POSTED');
    const statusActions = config.overflow.filter((a) => a.section === 'status');
    expect(statusActions.map((a) => a.key)).toContain('void');
  });

  it('returns createCreditNote in record section for customerInvoice POSTED', () => {
    const config = getEntityActionConfig('customerInvoice', 'POSTED');
    const recordActions = config.overflow.filter((a) => a.section === 'record');
    expect(recordActions.map((a) => a.key)).toContain('createCreditNote');
  });

  it('returns Email to Customer as primary for customerInvoice APPROVED', () => {
    const config = getEntityActionConfig('customerInvoice', 'APPROVED');
    expect(config.primary.map((a) => a.key)).toEqual(['emailToCustomer']);
  });

  it('returns Post and Cancel in overflow status section for customerInvoice APPROVED', () => {
    const config = getEntityActionConfig('customerInvoice', 'APPROVED');
    const statusActions = config.overflow.filter((a) => a.section === 'status');
    expect(statusActions.map((a) => a.key)).toContain('post');
    expect(statusActions.map((a) => a.key)).toContain('cancel');
  });

  // --- SalesOrder ---

  it('returns Cancel in overflow status section for salesOrder DRAFT', () => {
    const config = getEntityActionConfig('salesOrder', 'DRAFT');
    const statusActions = config.overflow.filter((a) => a.section === 'status');
    expect(statusActions.map((a) => a.key)).toContain('cancel');
  });

  it('returns Approve + Save Draft as primary for salesOrder DRAFT', () => {
    const config = getEntityActionConfig('salesOrder', 'DRAFT');
    const keys = config.primary.map((a) => a.key);
    expect(keys).toEqual(['approve', 'saveDraft']);
  });

  it('returns Create Dispatch as primary for salesOrder APPROVED', () => {
    const config = getEntityActionConfig('salesOrder', 'APPROVED');
    expect(config.primary.map((a) => a.key)).toEqual(['createDispatch']);
  });

  it('returns Create Dispatch as primary for salesOrder IN_PROGRESS', () => {
    const config = getEntityActionConfig('salesOrder', 'IN_PROGRESS');
    expect(config.primary.map((a) => a.key)).toEqual(['createDispatch']);
  });

  it('returns Convert to Invoice in overflow for salesOrder IN_PROGRESS', () => {
    const config = getEntityActionConfig('salesOrder', 'IN_PROGRESS');
    const recordActions = config.overflow.filter((a) => a.section === 'record');
    expect(recordActions.map((a) => a.key)).toContain('convertToInvoice');
  });

  it('returns Convert to Invoice as primary for salesOrder FULLY_SHIPPED', () => {
    const config = getEntityActionConfig('salesOrder', 'FULLY_SHIPPED');
    expect(config.primary.map((a) => a.key)).toEqual(['convertToInvoice']);
  });

  it('returns Close as primary for salesOrder FULLY_INVOICED', () => {
    const config = getEntityActionConfig('salesOrder', 'FULLY_INVOICED');
    expect(config.primary.map((a) => a.key)).toEqual(['close']);
  });

  it('returns Cancel (destructive) and Convert to Invoice in overflow for salesOrder APPROVED', () => {
    const config = getEntityActionConfig('salesOrder', 'APPROVED');
    const statusActions = config.overflow.filter((a) => a.section === 'status');
    expect(statusActions.map((a) => a.key)).toContain('cancel');
    const recordActions = config.overflow.filter((a) => a.section === 'record');
    expect(recordActions.map((a) => a.key)).toContain('convertToInvoice');
  });

  // --- SalesQuote ---

  it('returns Cancel in overflow status section for salesQuote DRAFT', () => {
    const config = getEntityActionConfig('salesQuote', 'DRAFT');
    const statusActions = config.overflow.filter((a) => a.section === 'status');
    expect(statusActions.map((a) => a.key)).toContain('cancel');
  });

  // --- PurchaseOrder ---

  it('returns Receive Goods as primary for purchaseOrder SENT', () => {
    const config = getEntityActionConfig('purchaseOrder', 'SENT');
    expect(config.primary.map((a) => a.key)).toEqual(['receiveGoods']);
  });

  it('returns Receive Goods as primary for purchaseOrder PARTIALLY_RECEIVED', () => {
    const config = getEntityActionConfig('purchaseOrder', 'PARTIALLY_RECEIVED');
    expect(config.primary.map((a) => a.key)).toEqual(['receiveGoods']);
  });

  it('returns Create Bill as primary for purchaseOrder FULLY_RECEIVED', () => {
    const config = getEntityActionConfig('purchaseOrder', 'FULLY_RECEIVED');
    expect(config.primary.map((a) => a.key)).toEqual(['createBill']);
  });

  it('returns Close as primary for purchaseOrder FULLY_INVOICED', () => {
    const config = getEntityActionConfig('purchaseOrder', 'FULLY_INVOICED');
    expect(config.primary.map((a) => a.key)).toEqual(['close']);
  });

  it('returns Cancel in overflow status section for purchaseOrder DRAFT', () => {
    const config = getEntityActionConfig('purchaseOrder', 'DRAFT');
    const statusActions = config.overflow.filter((a) => a.section === 'status');
    expect(statusActions.map((a) => a.key)).toContain('cancel');
  });

  // --- JournalEntry ---

  it('returns Post + Save Draft as primary for journalEntry DRAFT', () => {
    const config = getEntityActionConfig('journalEntry', 'DRAFT');
    const keys = config.primary.map((a) => a.key);
    expect(keys).toEqual(['post', 'saveDraft']);
  });

  it('returns Reverse in overflow for journalEntry POSTED', () => {
    const config = getEntityActionConfig('journalEntry', 'POSTED');
    const statusActions = config.overflow.filter((a) => a.section === 'status');
    expect(statusActions.map((a) => a.key)).toContain('reverse');
  });

  it('returns no primary actions for journalEntry POSTED', () => {
    const config = getEntityActionConfig('journalEntry', 'POSTED');
    expect(config.primary).toHaveLength(0);
  });

  // --- Unknown entity / fallback ---

  it('returns generic fallback config for unknown entity type', () => {
    const config = getEntityActionConfig('unknownWidget', 'DRAFT');
    expect(config.primary.map((a) => a.key)).toEqual(['save']);
    expect(config.overflow.map((a) => a.key)).toContain('delete');
  });

  it('returns empty action set for unknown status on known entity', () => {
    const config = getEntityActionConfig('customerInvoice', 'UNKNOWN_STATUS');
    expect(config.primary).toHaveLength(0);
    expect(config.overflow).toHaveLength(0);
  });

  // --- i18n label keys ---

  it('all returned actions have valid i18n label keys', () => {
    const entities = ['customerInvoice', 'salesOrder', 'salesQuote', 'purchaseOrder', 'journalEntry'];
    const statuses = ['DRAFT', 'APPROVED', 'POSTED', 'SENT', 'ACCEPTED', 'IN_PROGRESS', 'PARTIALLY_SHIPPED', 'FULLY_SHIPPED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'];

    for (const entity of entities) {
      for (const status of statuses) {
        const config = getEntityActionConfig(entity, status);
        for (const action of [...config.primary, ...config.overflow]) {
          expect(action.labelKey).toBeTruthy();
          expect(action.labelKey.startsWith('actionBar.')).toBe(true);
        }
      }
    }
  });

  // --- Destructive actions ---

  it('destructive actions have requiresConfirmation: true', () => {
    const entities = ['customerInvoice', 'salesOrder', 'salesQuote', 'purchaseOrder', 'journalEntry'];
    const statuses = ['DRAFT', 'APPROVED', 'POSTED', 'SENT', 'ACCEPTED', 'IN_PROGRESS', 'PARTIALLY_SHIPPED', 'FULLY_SHIPPED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'];

    for (const entity of entities) {
      for (const status of statuses) {
        const config = getEntityActionConfig(entity, status);
        const allActions = [...config.primary, ...config.overflow];
        const destructive = allActions.filter((a) => a.variant === 'destructive');
        for (const action of destructive) {
          expect(action.requiresConfirmation).toBe(true);
        }
      }
    }
  });
});

describe('getGlobalActions', () => {
  it('returns AI and History actions for customerInvoice', () => {
    const actions = getGlobalActions('customerInvoice');
    const aiActions = actions.filter((a) => a.section === 'ai');
    const historyActions = actions.filter((a) => a.section === 'history');

    expect(aiActions.length).toBeGreaterThanOrEqual(3);
    expect(historyActions.length).toBeGreaterThanOrEqual(2);
  });

  it('returns AI actions with expected keys', () => {
    const actions = getGlobalActions('customerInvoice');
    const keys = actions.filter((a) => a.section === 'ai').map((a) => a.key);
    expect(keys).toContain('aiExplain');
    expect(keys).toContain('aiSuggest');
    expect(keys).toContain('aiFindSimilar');
  });

  it('returns History actions with expected keys', () => {
    const actions = getGlobalActions('customerInvoice');
    const keys = actions.filter((a) => a.section === 'history').map((a) => a.key);
    expect(keys).toContain('viewAuditLog');
    expect(keys).toContain('statusTimeline');
  });

  it('returns global actions for any entity type', () => {
    const actions = getGlobalActions('anyRandomEntity');
    expect(actions.length).toBeGreaterThan(0);
  });

  it('all global actions have valid i18n label keys', () => {
    const actions = getGlobalActions('customerInvoice');
    for (const action of actions) {
      expect(action.labelKey).toBeTruthy();
      expect(action.labelKey.startsWith('actionBar.')).toBe(true);
    }
  });
});
