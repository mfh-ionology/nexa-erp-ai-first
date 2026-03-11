/* eslint-disable no-console -- seed scripts use console for progress logging */
// ---------------------------------------------------------------------------
// E9.1 Task 7.3 — Notification Template Seed Data
//
// Seeds the default notification templates for common business events.
// All upserts are idempotent — safe to re-run.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '../../generated/prisma/client';

// ---------------------------------------------------------------------------
// Template Definitions
// ---------------------------------------------------------------------------

interface TemplateDef {
  code: string;
  name: string;
  eventName: string;
  titleTemplate: string;
  bodyTemplate: string;
  defaultChannels: ('IN_APP' | 'EMAIL' | 'PUSH')[];
  defaultPriority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl?: string;
}

const TEMPLATES: TemplateDef[] = [
  {
    code: 'APPROVAL_REQUESTED',
    name: 'Approval Requested',
    eventName: 'approval.requested',
    titleTemplate: 'Approval required',
    bodyTemplate: 'A {{entityType}} requires your approval.',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'HIGH',
    actionUrl: '/approvals/{{requestId}}',
  },
  {
    code: 'APPROVAL_COMPLETED',
    name: 'Approval Completed',
    eventName: 'approval.completed',
    titleTemplate: 'Approval completed',
    bodyTemplate: 'Your {{entityType}} has been approved.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
    actionUrl: '/approvals/{{requestId}}',
  },
  {
    code: 'APPROVAL_REJECTED',
    name: 'Approval Rejected',
    eventName: 'approval.rejected',
    titleTemplate: 'Approval rejected',
    bodyTemplate: 'Your {{entityType}} was rejected: {{rejectionReason}}',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'HIGH',
    actionUrl: '/approvals/{{requestId}}',
  },
  {
    code: 'INVOICE_APPROVED',
    name: 'Invoice Approved',
    eventName: 'invoice.approved',
    titleTemplate: 'Invoice approved',
    bodyTemplate: 'Invoice {{invoiceNumber}} has been approved.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
    actionUrl: '/invoices/{{invoiceId}}',
  },
  {
    code: 'PAYMENT_POSTED',
    name: 'Payment Posted',
    eventName: 'payment.posted',
    titleTemplate: 'Payment received',
    bodyTemplate: 'A payment has been posted.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
  },
  {
    code: 'ORDER_CONFIRMED',
    name: 'Order Confirmed',
    eventName: 'order.confirmed',
    titleTemplate: 'Order confirmed',
    bodyTemplate: 'A new order has been confirmed and is ready for fulfilment.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
    actionUrl: '/orders/{{entityId}}',
  },
  {
    code: 'STOCK_REORDER',
    name: 'Stock Reorder Alert',
    eventName: 'stock.reorder.triggered',
    titleTemplate: 'Stock reorder alert',
    bodyTemplate: 'Stock for an item has fallen below the reorder point.',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'HIGH',
  },
  {
    code: 'ACCESS_GROUPS_ASSIGNED',
    name: 'Access Groups Assigned',
    eventName: 'user.accessGroups.assigned',
    titleTemplate: 'Permissions updated',
    bodyTemplate: 'Your access groups have been updated.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
  },
  {
    code: 'ACCESS_GROUPS_REVOKED',
    name: 'Access Groups Revoked',
    eventName: 'user.accessGroups.revoked',
    titleTemplate: 'Permissions changed',
    bodyTemplate: 'Some access groups have been removed from your account.',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'HIGH',
  },
  {
    code: 'APPROVAL_ESCALATED',
    name: 'Approval Escalated',
    eventName: 'approval.escalated',
    titleTemplate: 'Approval escalated',
    bodyTemplate: 'A {{entityType}} approval has been escalated to you.',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'HIGH',
    actionUrl: '/approvals/{{requestId}}',
  },
  {
    code: 'APPROVAL_FORWARDED',
    name: 'Approval Forwarded',
    eventName: 'approval.forwarded',
    titleTemplate: 'Approval forwarded',
    bodyTemplate: 'A {{entityType}} approval has been forwarded to you.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
    actionUrl: '/approvals/{{requestId}}',
  },
  {
    code: 'APPROVAL_CANCELLED',
    name: 'Approval Cancelled',
    eventName: 'approval.cancelled',
    titleTemplate: 'Approval cancelled',
    bodyTemplate: 'The approval request for {{entityType}} has been cancelled.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
    actionUrl: '/approvals/{{requestId}}',
  },
  {
    code: 'DISPATCH_SHIPPED',
    name: 'Dispatch Shipped',
    eventName: 'dispatch.shipped',
    titleTemplate: 'Dispatch shipped',
    bodyTemplate: 'A dispatch has been shipped.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
    actionUrl: '/dispatches/{{entityId}}',
  },
  {
    code: 'ACCESS_GROUP_DELETED',
    name: 'Access Group Deleted',
    eventName: 'accessGroup.deleted',
    titleTemplate: 'Access group removed',
    bodyTemplate: 'An access group has been deleted. Your permissions may have changed.',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'HIGH',
  },
  {
    code: 'AUTOMATION_COMPLETED',
    name: 'Automation Completed',
    eventName: 'ai.automation.completed',
    titleTemplate: 'Automation completed',
    bodyTemplate: 'An automation has completed successfully.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'NORMAL',
    actionUrl: '/ai/admin/automations/runs',
  },
  {
    code: 'AUTOMATION_FAILED',
    name: 'Automation Failed',
    eventName: 'ai.automation.failed',
    titleTemplate: 'Automation failed',
    bodyTemplate: 'An automation has failed.',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'URGENT',
    actionUrl: '/ai/admin/automations/runs',
  },
  {
    code: 'AUTOMATION_PAUSED',
    name: 'Automation Paused',
    eventName: 'ai.automation.paused',
    titleTemplate: 'Automation paused',
    bodyTemplate: 'An automation has been paused after repeated failures.',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'URGENT',
    actionUrl: '/ai/admin/automations/runs',
  },
  // Tasks (Cross-Cutting)
  {
    code: 'TASK_ASSIGNED',
    name: 'Task Assigned',
    eventName: 'task.assigned',
    titleTemplate: 'Task assigned to you',
    bodyTemplate: 'You have been assigned the task "{{taskTitle}}".',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'NORMAL',
    actionUrl: '/tasks',
  },
  {
    code: 'TASK_COMPLETED',
    name: 'Task Completed',
    eventName: 'task.status_changed',
    titleTemplate: 'Task completed',
    bodyTemplate: 'The task "{{taskTitle}}" has been marked as completed.',
    defaultChannels: ['IN_APP'],
    defaultPriority: 'LOW',
    actionUrl: '/tasks',
  },
  {
    code: 'TASK_OVERDUE',
    name: 'Task Overdue',
    eventName: 'task.overdue',
    titleTemplate: 'Task overdue',
    bodyTemplate: 'The task "{{taskTitle}}" is overdue (due {{dueDate}}).',
    defaultChannels: ['IN_APP', 'EMAIL'],
    defaultPriority: 'HIGH',
    actionUrl: '/tasks',
  },
];

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------

export async function seedNotificationTemplates(prisma: PrismaClient): Promise<void> {
  for (const t of TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        eventName: t.eventName,
        titleTemplate: t.titleTemplate,
        bodyTemplate: t.bodyTemplate,
        defaultChannels: t.defaultChannels,
        defaultPriority: t.defaultPriority,
        actionUrl: t.actionUrl ?? null,
        // Note: isActive intentionally NOT set on update to preserve admin deactivation
      },
      create: {
        code: t.code,
        name: t.name,
        eventName: t.eventName,
        titleTemplate: t.titleTemplate,
        bodyTemplate: t.bodyTemplate,
        defaultChannels: t.defaultChannels,
        defaultPriority: t.defaultPriority,
        actionUrl: t.actionUrl ?? null,
        isActive: true,
      },
    });
  }

  console.log(`Seeded ${TEMPLATES.length} notification templates`);
}
