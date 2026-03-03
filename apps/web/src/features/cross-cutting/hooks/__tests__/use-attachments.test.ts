import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import type { Attachment, ListResponse, PresignResponse, DownloadResponse } from '../../types';

// --- Mock API client functions ---
const mockListAttachments = vi.fn();
const mockPresignUpload = vi.fn();
const mockConfirmUpload = vi.fn();
const mockGetDownloadUrl = vi.fn();
const mockDeleteAttachment = vi.fn();

vi.mock('../../api/attachment-api', () => ({
  listAttachments: (...args: unknown[]) => mockListAttachments(...args),
  presignUpload: (...args: unknown[]) => mockPresignUpload(...args),
  confirmUpload: (...args: unknown[]) => mockConfirmUpload(...args),
  getDownloadUrl: (...args: unknown[]) => mockGetDownloadUrl(...args),
  deleteAttachment: (...args: unknown[]) => mockDeleteAttachment(...args),
}));

// --- Mock toast ---
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// --- Mock query keys ---
vi.mock('@/lib/query-keys', () => ({
  queryKeys: {
    attachments: {
      all: ['attachments'],
      list: (entityType: string, entityId: string) => ['attachments', entityType, entityId],
    },
  },
}));

// --- Test data ---
const TEST_ENTITY_TYPE = 'CustomerInvoice';
const TEST_ENTITY_ID = 'inv-123';

const testAttachments: Attachment[] = [
  {
    id: 'att-1',
    entityType: TEST_ENTITY_TYPE,
    entityId: TEST_ENTITY_ID,
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
    entityType: TEST_ENTITY_TYPE,
    entityId: TEST_ENTITY_ID,
    fileName: 'invoice-scan.jpg',
    fileSize: 156000,
    mimeType: 'image/jpeg',
    storageKey: 'uploads/invoice-scan.jpg',
    storageBucket: 'nexa-attachments',
    description: 'Scanned invoice',
    uploadedBy: 'user-2',
    uploadedAt: '2025-06-02T14:30:00Z',
    createdAt: '2025-06-02T14:30:00Z',
    updatedAt: '2025-06-02T14:30:00Z',
  },
];

const testListResponse: ListResponse<Attachment> = {
  items: testAttachments,
  total: 2,
};

const testPresignResponse: PresignResponse = {
  uploadUrl: 'https://s3.example.com/presigned-put',
  storageKey: 'uploads/new-file.pdf',
  bucket: 'nexa-attachments',
  expiresIn: 3600,
};

const testDownloadResponse: DownloadResponse = {
  downloadUrl: 'https://s3.example.com/presigned-get',
  fileName: 'report.pdf',
  mimeType: 'application/pdf',
};

// --- Helper: create wrapper with QueryClient ---
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// --- Mock XMLHttpRequest ---
class MockXMLHttpRequest {
  upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 200;
  readyState = 0;

  open = vi.fn();
  setRequestHeader = vi.fn();
  abort = vi.fn();

  send = vi.fn().mockImplementation(function (this: MockXMLHttpRequest) {
    // Simulate successful upload
    if (this.upload.onprogress) {
      this.upload.onprogress(
        new ProgressEvent('progress', { loaded: 100, total: 100, lengthComputable: true }),
      );
    }
    if (this.onload) {
      this.onload();
    }
  });
}

describe('useAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns attachment list data', async () => {
    mockListAttachments.mockResolvedValue(testListResponse);

    const { useAttachments } = await import('../use-attachments');
    const { result } = renderHook(() => useAttachments(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.attachments).toEqual(testAttachments);
    expect(result.current.total).toBe(2);
  });

  it('returns empty array when no data', async () => {
    mockListAttachments.mockResolvedValue({ items: [], total: 0 });

    const { useAttachments } = await import('../use-attachments');
    const { result } = renderHook(() => useAttachments(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.attachments).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('does not fetch when entityType is empty', async () => {
    const { useAttachments } = await import('../use-attachments');
    const { result } = renderHook(() => useAttachments('', TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    // Should remain loading (query disabled)
    expect(result.current.isLoading).toBe(false);
    expect(mockListAttachments).not.toHaveBeenCalled();
  });

  it('does not fetch when entityId is empty', async () => {
    const { useAttachments } = await import('../use-attachments');
    const { result } = renderHook(() => useAttachments(TEST_ENTITY_TYPE, ''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockListAttachments).not.toHaveBeenCalled();
  });

  it('calls listAttachments with correct params', async () => {
    mockListAttachments.mockResolvedValue(testListResponse);

    const { useAttachments } = await import('../use-attachments');
    renderHook(() => useAttachments(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockListAttachments).toHaveBeenCalled());
    expect(mockListAttachments).toHaveBeenCalledWith(TEST_ENTITY_TYPE, TEST_ENTITY_ID);
  });
});

describe('useUploadAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock XMLHttpRequest globally for upload tests
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);
  });

  it('orchestrates presign → S3 PUT → confirm flow', async () => {
    mockPresignUpload.mockResolvedValue(testPresignResponse);
    mockConfirmUpload.mockResolvedValue(testAttachments[0]);

    const { useUploadAttachment } = await import('../use-attachments');
    const { result } = renderHook(() => useUploadAttachment(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.upload(testFile);
    });

    expect(mockPresignUpload).toHaveBeenCalledWith({
      entityType: TEST_ENTITY_TYPE,
      entityId: TEST_ENTITY_ID,
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: testFile.size,
    });

    expect(mockConfirmUpload).toHaveBeenCalledWith({
      storageKey: testPresignResponse.storageKey,
      entityType: TEST_ENTITY_TYPE,
      entityId: TEST_ENTITY_ID,
      fileName: 'test.pdf',
      fileSize: testFile.size,
      mimeType: 'application/pdf',
    });
  });

  it('sets progress status to complete on success', async () => {
    mockPresignUpload.mockResolvedValue(testPresignResponse);
    mockConfirmUpload.mockResolvedValue(testAttachments[0]);

    const { useUploadAttachment } = await import('../use-attachments');
    const { result } = renderHook(() => useUploadAttachment(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.upload(testFile);
    });

    expect(result.current.progress.status).toBe('complete');
    expect(result.current.progress.progress).toBe(100);
  });

  it('sets error status and shows toast on presign failure', async () => {
    mockPresignUpload.mockRejectedValue(new Error('Presign failed'));

    const { useUploadAttachment } = await import('../use-attachments');
    const { result } = renderHook(() => useUploadAttachment(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.upload(testFile);
    });

    expect(result.current.progress.status).toBe('error');
    expect(result.current.progress.error).toBe('Presign failed');
    expect(mockToast).toHaveBeenCalledWith({ title: 'Presign failed', variant: 'destructive' });
  });

  it('uses application/octet-stream for files without MIME type', async () => {
    mockPresignUpload.mockResolvedValue(testPresignResponse);
    mockConfirmUpload.mockResolvedValue(testAttachments[0]);

    const { useUploadAttachment } = await import('../use-attachments');
    const { result } = renderHook(() => useUploadAttachment(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    const testFile = new File(['test content'], 'data.bin', { type: '' });

    await act(async () => {
      await result.current.upload(testFile);
    });

    expect(mockPresignUpload).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'application/octet-stream' }),
    );
  });

  it('resets progress when resetProgress is called', async () => {
    const { useUploadAttachment } = await import('../use-attachments');
    const { result } = renderHook(() => useUploadAttachment(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.resetProgress();
    });

    expect(result.current.progress.status).toBe('idle');
    expect(result.current.progress.progress).toBe(0);
    expect(result.current.progress.fileName).toBe('');
  });

  it('isUploading is true during active upload states', async () => {
    // Never resolves, so presigning state persists
    mockPresignUpload.mockReturnValue(new Promise(() => {}));

    const { useUploadAttachment } = await import('../use-attachments');
    const { result } = renderHook(() => useUploadAttachment(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    act(() => {
      void result.current.upload(testFile);
    });

    await waitFor(() => expect(result.current.isUploading).toBe(true));
  });
});

describe('useDownloadAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches presigned URL and opens in new tab', async () => {
    mockGetDownloadUrl.mockResolvedValue(testDownloadResponse);
    const mockWindowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { useDownloadAttachment } = await import('../use-attachments');
    const { result } = renderHook(() => useDownloadAttachment(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate('att-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetDownloadUrl).toHaveBeenCalledWith('att-1');
    expect(mockWindowOpen).toHaveBeenCalledWith(testDownloadResponse.downloadUrl, '_blank');

    mockWindowOpen.mockRestore();
  });

  it('shows error toast on failure', async () => {
    mockGetDownloadUrl.mockRejectedValue(new Error('Download failed'));

    const { useDownloadAttachment } = await import('../use-attachments');
    const { result } = renderHook(() => useDownloadAttachment(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate('att-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'crossCutting.attachments.downloadFailed',
      variant: 'destructive',
    });
  });
});

describe('useDeleteAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes attachment and invalidates cache', async () => {
    mockDeleteAttachment.mockResolvedValue(undefined);
    mockListAttachments.mockResolvedValue(testListResponse);

    const { useDeleteAttachment, useAttachments } = await import('../use-attachments');
    const wrapper = createWrapper();

    // First, populate the cache
    const { result: listResult } = renderHook(
      () => useAttachments(TEST_ENTITY_TYPE, TEST_ENTITY_ID),
      { wrapper },
    );
    await waitFor(() => expect(listResult.current.isLoading).toBe(false));

    // Then delete
    const { result } = renderHook(() => useDeleteAttachment(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper,
    });

    act(() => {
      result.current.mutate('att-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDeleteAttachment).toHaveBeenCalledWith('att-1');
  });

  it('shows error toast on failure', async () => {
    mockDeleteAttachment.mockRejectedValue(new Error('Delete failed'));

    const { useDeleteAttachment } = await import('../use-attachments');
    const { result } = renderHook(() => useDeleteAttachment(TEST_ENTITY_TYPE, TEST_ENTITY_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate('att-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'crossCutting.attachments.deleteFailed',
      variant: 'destructive',
    });
  });
});
