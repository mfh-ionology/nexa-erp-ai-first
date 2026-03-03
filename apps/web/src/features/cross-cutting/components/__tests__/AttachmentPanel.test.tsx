import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Attachment, UploadProgress } from '../../types';

// --- Mock hooks ---
const mockAttachments: Attachment[] = [
  {
    id: 'att-1',
    entityType: 'CustomerInvoice',
    entityId: 'inv-123',
    fileName: 'report.pdf',
    fileSize: 2500000,
    mimeType: 'application/pdf',
    storageKey: 'uploads/report.pdf',
    storageBucket: 'nexa-attachments',
    description: null,
    uploadedBy: 'user-1',
    uploadedAt: '2025-06-01T10:00:00Z',
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'att-2',
    entityType: 'CustomerInvoice',
    entityId: 'inv-123',
    fileName: 'invoice-scan.jpg',
    fileSize: 156000,
    mimeType: 'image/jpeg',
    storageKey: 'uploads/invoice-scan.jpg',
    storageBucket: 'nexa-attachments',
    description: null,
    uploadedBy: 'user-2',
    uploadedAt: '2025-06-02T14:30:00Z',
    createdAt: '2025-06-02T14:30:00Z',
    updatedAt: '2025-06-02T14:30:00Z',
  },
];

const mockUpload = vi.fn();
const mockCancelUpload = vi.fn();
const mockResetProgress = vi.fn();
const mockDownloadMutate = vi.fn();
const mockDeleteMutate = vi.fn();

const defaultProgress: UploadProgress = {
  fileName: '',
  progress: 0,
  status: 'idle',
};

vi.mock('../../hooks/use-attachments', () => ({
  useAttachments: vi.fn(() => ({
    attachments: mockAttachments,
    total: mockAttachments.length,
    isLoading: false,
    error: null,
  })),
  useUploadAttachment: vi.fn(() => ({
    upload: mockUpload,
    cancelUpload: mockCancelUpload,
    resetProgress: mockResetProgress,
    isUploading: false,
    progress: defaultProgress,
  })),
  useDownloadAttachment: vi.fn(() => ({
    mutate: mockDownloadMutate,
  })),
  useDeleteAttachment: vi.fn(() => ({
    mutate: mockDeleteMutate,
  })),
}));

// --- Mock permissions ---
vi.mock('@/hooks/use-permissions', () => ({
  usePermission: vi.fn(() => ({
    canAccess: true,
    canNew: true,
    canView: true,
    canEdit: true,
    canDelete: true,
    isSuperAdmin: false,
  })),
}));

// --- Radix UI polyfills for Sheet ---
beforeEach(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('AttachmentPanel', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    entityType: 'CustomerInvoice',
    entityId: 'inv-123',
    resourceCode: 'finance.invoices.detail',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders panel title', async () => {
    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} />);

    expect(screen.getByText('crossCutting.attachments.title')).toBeInTheDocument();
  });

  it('renders attachment count badge', async () => {
    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders file upload zone', async () => {
    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} />);

    expect(screen.getByLabelText('crossCutting.attachments.dropZoneLabel')).toBeInTheDocument();
  });

  it('renders attachment list with file names', async () => {
    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} />);

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('invoice-scan.jpg')).toBeInTheDocument();
  });

  it('renders download buttons for each attachment', async () => {
    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} />);

    const downloadButtons = screen.getAllByLabelText('crossCutting.attachments.download');
    expect(downloadButtons).toHaveLength(2);
  });

  it('renders delete buttons when user has MANAGER permission', async () => {
    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} />);

    const deleteButtons = screen.getAllByLabelText('crossCutting.attachments.delete');
    expect(deleteButtons).toHaveLength(2);
  });

  it('hides delete buttons when user lacks MANAGER permission', async () => {
    const { usePermission } = await import('@/hooks/use-permissions');
    (usePermission as ReturnType<typeof vi.fn>).mockReturnValue({
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: false,
      isSuperAdmin: false,
    });

    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} />);

    expect(screen.queryByLabelText('crossCutting.attachments.delete')).not.toBeInTheDocument();
  });

  it('shows empty state when no attachments', async () => {
    const { useAttachments } = await import('../../hooks/use-attachments');
    (useAttachments as ReturnType<typeof vi.fn>).mockReturnValue({
      attachments: [],
      total: 0,
      isLoading: false,
      error: null,
    });

    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} />);

    expect(screen.getByText('crossCutting.attachments.emptyState')).toBeInTheDocument();
  });

  it('shows progress bar during upload', async () => {
    const { useUploadAttachment } = await import('../../hooks/use-attachments');
    (useUploadAttachment as ReturnType<typeof vi.fn>).mockReturnValue({
      upload: mockUpload,
      cancelUpload: mockCancelUpload,
      resetProgress: mockResetProgress,
      isUploading: true,
      progress: {
        fileName: 'uploading.pdf',
        progress: 45,
        status: 'uploading',
      },
    });

    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} />);

    expect(screen.getByText('uploading.pdf')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('does not render when open is false', async () => {
    const { AttachmentPanel } = await import('../AttachmentPanel');
    render(<AttachmentPanel {...defaultProps} open={false} />);

    expect(screen.queryByText('crossCutting.attachments.title')).not.toBeInTheDocument();
  });
});
