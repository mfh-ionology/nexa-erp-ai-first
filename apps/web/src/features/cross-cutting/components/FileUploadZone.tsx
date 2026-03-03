/**
 * Drag-and-drop file upload zone with click-to-browse fallback.
 *
 * Client-side validation rejects:
 * - Files exceeding maxSizeBytes (default 50 MB per BR-SYS-006)
 * - Executable MIME types per BR-SYS-007
 */

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

// Executable MIME types / extensions blocked per BR-SYS-007
const BLOCKED_EXTENSIONS = new Set(['.exe', '.bat', '.sh', '.cmd', '.com', '.msi', '.ps1', '.vbs']);
const BLOCKED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-sh',
  'application/x-bat',
]);

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50 MB

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  accept?: string;
  maxSizeBytes?: number;
}

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

export function FileUploadZone({
  onFilesSelected,
  isUploading,
  accept,
  maxSizeBytes = DEFAULT_MAX_SIZE,
}: FileUploadZoneProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSizeBytes) {
        const maxMB = Math.round(maxSizeBytes / (1024 * 1024));
        return t('crossCutting.attachments.fileTooLarge', { maxMB: String(maxMB) });
      }
      const ext = getExtension(file.name);
      if (BLOCKED_EXTENSIONS.has(ext)) {
        return t('crossCutting.attachments.blockedFileType');
      }
      if (BLOCKED_MIME_TYPES.has(file.type)) {
        return t('crossCutting.attachments.blockedFileType');
      }
      return null;
    },
    [maxSizeBytes, t],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      setValidationError(null);
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      // Warn if multiple files were selected — only the first will be uploaded
      if (fileArray.length > 1) {
        setValidationError(t('crossCutting.attachments.singleFileOnly'));
      }

      const first = fileArray[0]!;
      const error = validateFile(first);
      if (error) {
        setValidationError(error);
        return;
      }

      onFilesSelected([first]);
    },
    [validateFile, onFilesSelected, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (isUploading) return;
      handleFiles(e.dataTransfer.files);
    },
    [isUploading, handleFiles],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!isUploading) setIsDragOver(true);
    },
    [isUploading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!isUploading) fileInputRef.current?.click();
  }, [isUploading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [isUploading],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) handleFiles(files);
      e.target.value = '';
    },
    [handleFiles],
  );

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('crossCutting.attachments.dropZoneLabel')}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-primary bg-purple-50'
            : 'border-muted-foreground/25 hover:border-primary/50'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isUploading}
        />
        <Upload className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragOver
            ? t('crossCutting.attachments.dropZoneActive')
            : t('crossCutting.attachments.dropZoneLabel')}
        </p>
      </div>

      {validationError && <p className="text-sm text-destructive">{validationError}</p>}
    </div>
  );
}
