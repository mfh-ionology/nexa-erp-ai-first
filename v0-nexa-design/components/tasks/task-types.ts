export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  isOverdue: boolean;
  overdueDays?: number;
  record: { type: string; code: string; label: string; href: string } | null;
  assignees: { id: string; name: string; initials: string }[];
  createdAt: string;
  createdBy: string;
  completedAt?: string;
  completedBy?: string;
}

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string; bg: string; border?: string }
> = {
  URGENT: { label: 'URGENT', color: '#dc2626', bg: '#fee2e2' },
  HIGH: { label: 'HIGH', color: '#ef4444', bg: '#ffffff', border: '#fca5a5' },
  NORMAL: { label: 'NORMAL', color: '#d97706', bg: '#fef3c7' },
  LOW: { label: 'LOW', color: '#3b82f6', bg: '#dbeafe' },
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const MOCK_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    title: 'Chase Acme for payment',
    description:
      'Follow up on invoice INV-00234 which is 15 days overdue. Contact accounts@acme.co.uk',
    priority: 'HIGH',
    status: 'OPEN',
    dueDate: '28 Feb',
    isOverdue: true,
    overdueDays: 4,
    record: {
      type: 'CustomerInvoice',
      code: 'INV-00234',
      label: 'Invoice INV-00234 — Acme Ltd',
      href: '/invoices/INV-2026-0042',
    },
    assignees: [
      { id: 'u1', name: 'Sarah Chen', initials: 'SC' },
      { id: 'u2', name: 'Mike Davis', initials: 'MD' },
    ],
    createdAt: '2 Mar 2026 14:30',
    createdBy: 'Mohammed Al-Rashid',
  },
  {
    id: 'task-2',
    title: 'Review credit terms',
    description: 'Review and update credit terms for Baxter & Co following late payments.',
    priority: 'NORMAL',
    status: 'IN_PROGRESS',
    dueDate: '5 Mar',
    isOverdue: false,
    record: {
      type: 'Customer',
      code: 'CUST-0045',
      label: 'Customer CUST-0045 — Baxter & Co',
      href: '/crm',
    },
    assignees: [{ id: 'u1', name: 'Sarah Chen', initials: 'SC' }],
    createdAt: '1 Mar 2026 09:00',
    createdBy: 'Sarah Chen',
  },
  {
    id: 'task-3',
    title: 'Prepare Q1 report',
    description: 'Compile Q1 financial report including all GL entries and reconciliations.',
    priority: 'LOW',
    status: 'OPEN',
    dueDate: '15 Mar',
    isOverdue: false,
    record: null,
    assignees: [{ id: 'u1', name: 'Sarah Chen', initials: 'SC' }],
    createdAt: '25 Feb 2026 11:00',
    createdBy: 'Sarah Chen',
  },
  {
    id: 'task-4',
    title: 'Update supplier address',
    description:
      'Henderson Engineering has moved offices. Update their billing address in the system.',
    priority: 'NORMAL',
    status: 'IN_PROGRESS',
    dueDate: '10 Mar',
    isOverdue: false,
    record: {
      type: 'Supplier',
      code: 'SUP-0012',
      label: 'Supplier SUP-0012 — Henderson Engineering',
      href: '/purchasing',
    },
    assignees: [{ id: 'u3', name: 'David Morris', initials: 'DM' }],
    createdAt: '28 Feb 2026 16:00',
    createdBy: 'David Morris',
  },
  {
    id: 'task-5',
    title: 'Follow up on quotation',
    description: 'Contact Whitfield Industries about sales quotation SQ-00089 before it expires.',
    priority: 'URGENT',
    status: 'OPEN',
    dueDate: '1 Mar',
    isOverdue: true,
    overdueDays: 3,
    record: {
      type: 'SalesQuotation',
      code: 'SQ-00089',
      label: 'Quotation SQ-00089 — Whitfield Industries',
      href: '/sales',
    },
    assignees: [{ id: 'u2', name: 'Mike Davis', initials: 'MD' }],
    createdAt: '27 Feb 2026 10:30',
    createdBy: 'Mike Davis',
  },
  {
    id: 'task-6',
    title: 'Send welcome email',
    description: 'Send welcome email and onboarding pack to new customer Thornton Group.',
    priority: 'NORMAL',
    status: 'COMPLETED',
    dueDate: '1 Mar',
    isOverdue: false,
    record: {
      type: 'Customer',
      code: 'CUST-0032',
      label: 'Customer CUST-0032 — Thornton Group',
      href: '/crm',
    },
    assignees: [{ id: 'u2', name: 'Mike Davis', initials: 'MD' }],
    createdAt: '26 Feb 2026 14:00',
    createdBy: 'Mohammed Al-Rashid',
    completedAt: '1 Mar 2026 10:15',
    completedBy: 'Mike Davis',
  },
  {
    id: 'task-7',
    title: 'Cancelled task example',
    description: 'This task was cancelled as it is no longer relevant.',
    priority: 'LOW',
    status: 'CANCELLED',
    dueDate: null,
    isOverdue: false,
    record: null,
    assignees: [{ id: 'u1', name: 'Sarah Chen', initials: 'SC' }],
    createdAt: '20 Feb 2026 09:00',
    createdBy: 'Sarah Chen',
  },
  {
    id: 'task-8',
    title: 'Approve purchase orders',
    description: 'Two POs from Henderson Engineering await approval.',
    priority: 'NORMAL',
    status: 'IN_PROGRESS',
    dueDate: '6 Mar',
    isOverdue: false,
    record: {
      type: 'PurchaseOrder',
      code: 'PO-00112',
      label: 'PO-00112 — Henderson Engineering',
      href: '/purchasing',
    },
    assignees: [{ id: 'u1', name: 'Sarah Chen', initials: 'SC' }],
    createdAt: '3 Mar 2026 08:00',
    createdBy: 'David Morris',
  },
  {
    id: 'task-9',
    title: 'Reconcile bank statement',
    description: 'Monthly bank reconciliation for February 2026.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    dueDate: '7 Mar',
    isOverdue: false,
    record: null,
    assignees: [{ id: 'u1', name: 'Sarah Chen', initials: 'SC' }],
    createdAt: '3 Mar 2026 09:00',
    createdBy: 'Sarah Chen',
  },
  {
    id: 'task-10',
    title: 'Schedule supplier review meeting',
    description: 'Set up quarterly review with top 5 suppliers.',
    priority: 'LOW',
    status: 'OPEN',
    dueDate: '20 Mar',
    isOverdue: false,
    record: null,
    assignees: [
      { id: 'u3', name: 'David Morris', initials: 'DM' },
      { id: 'u2', name: 'Mike Davis', initials: 'MD' },
    ],
    createdAt: '3 Mar 2026 11:00',
    createdBy: 'David Morris',
  },
  {
    id: 'task-11',
    title: 'Update VAT return',
    description: 'Prepare and submit Q4 VAT return to HMRC.',
    priority: 'HIGH',
    status: 'OPEN',
    dueDate: '2 Mar',
    isOverdue: true,
    overdueDays: 2,
    record: null,
    assignees: [{ id: 'u1', name: 'Sarah Chen', initials: 'SC' }],
    createdAt: '1 Mar 2026 08:00',
    createdBy: 'Sarah Chen',
  },
  {
    id: 'task-12',
    title: 'Initial setup complete',
    description: 'Complete initial system setup for new tenant.',
    priority: 'NORMAL',
    status: 'COMPLETED',
    dueDate: '25 Feb',
    isOverdue: false,
    record: null,
    assignees: [{ id: 'u1', name: 'Sarah Chen', initials: 'SC' }],
    createdAt: '20 Feb 2026 10:00',
    createdBy: 'Sarah Chen',
    completedAt: '25 Feb 2026 16:00',
    completedBy: 'Sarah Chen',
  },
];
