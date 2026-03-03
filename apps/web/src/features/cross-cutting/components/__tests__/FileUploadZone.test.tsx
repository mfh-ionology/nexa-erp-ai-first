import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FileUploadZone } from '../FileUploadZone';

describe('FileUploadZone', () => {
  const defaultProps = {
    onFilesSelected: vi.fn(),
    isUploading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering ---

  describe('rendering', () => {
    it('renders drop zone with aria-label', () => {
      render(<FileUploadZone {...defaultProps} />);

      expect(screen.getByLabelText('crossCutting.attachments.dropZoneLabel')).toBeInTheDocument();
    });

    it('renders with role="button"', () => {
      render(<FileUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole('button');
      expect(dropZone).toBeInTheDocument();
    });

    it('has tabIndex={0} for keyboard accessibility', () => {
      render(<FileUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole('button');
      expect(dropZone).toHaveAttribute('tabindex', '0');
    });

    it('renders hidden file input', () => {
      render(<FileUploadZone {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput.className).toContain('hidden');
    });

    it('renders label text', () => {
      render(<FileUploadZone {...defaultProps} />);

      expect(screen.getByText('crossCutting.attachments.dropZoneLabel')).toBeInTheDocument();
    });
  });

  // --- Drag and drop ---

  describe('drag and drop', () => {
    it('shows active state on dragOver', () => {
      render(<FileUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole('button');
      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });

      expect(screen.getByText('crossCutting.attachments.dropZoneActive')).toBeInTheDocument();
    });

    it('resets state on dragLeave', () => {
      render(<FileUploadZone {...defaultProps} />);

      const dropZone = screen.getByRole('button');
      fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
      fireEvent.dragLeave(dropZone);

      expect(screen.getByText('crossCutting.attachments.dropZoneLabel')).toBeInTheDocument();
    });

    it('calls onFilesSelected when valid file is dropped', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const dropZone = screen.getByRole('button');
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const dataTransfer = { files: [file] };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFilesSelected).toHaveBeenCalledWith([file]);
    });

    it('does not call onFilesSelected when uploading', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} isUploading />);

      const dropZone = screen.getByRole('button');
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const dataTransfer = { files: [file] };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFilesSelected).not.toHaveBeenCalled();
    });
  });

  // --- Click to browse ---

  describe('click to browse', () => {
    it('triggers file input on click', () => {
      render(<FileUploadZone {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropZone = screen.getByRole('button');
      fireEvent.click(dropZone);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not trigger file input when uploading', () => {
      render(<FileUploadZone {...defaultProps} isUploading />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropZone = screen.getByRole('button');
      fireEvent.click(dropZone);

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('calls onFilesSelected when file is selected via input', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(onFilesSelected).toHaveBeenCalledWith([file]);
    });
  });

  // --- Keyboard accessibility ---

  describe('keyboard accessibility', () => {
    it('triggers file input on Enter key', () => {
      render(<FileUploadZone {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropZone = screen.getByRole('button');
      fireEvent.keyDown(dropZone, { key: 'Enter' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('triggers file input on Space key', () => {
      render(<FileUploadZone {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropZone = screen.getByRole('button');
      fireEvent.keyDown(dropZone, { key: ' ' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not trigger file input on other keys', () => {
      render(<FileUploadZone {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropZone = screen.getByRole('button');
      fireEvent.keyDown(dropZone, { key: 'Tab' });

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  // --- File validation ---

  describe('file validation', () => {
    it('rejects files exceeding 50MB', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const dropZone = screen.getByRole('button');
      // Create a file object, then override size (File constructor doesn't let us set size directly)
      const bigFile = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
      Object.defineProperty(bigFile, 'size', { value: 51 * 1024 * 1024 });
      const dataTransfer = { files: [bigFile] };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFilesSelected).not.toHaveBeenCalled();
      expect(screen.getByText('crossCutting.attachments.fileTooLarge')).toBeInTheDocument();
    });

    it('rejects executable .exe files', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const dropZone = screen.getByRole('button');
      const exeFile = new File(['MZ'], 'malware.exe', { type: 'application/x-msdownload' });
      const dataTransfer = { files: [exeFile] };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFilesSelected).not.toHaveBeenCalled();
      expect(screen.getByText('crossCutting.attachments.blockedFileType')).toBeInTheDocument();
    });

    it('rejects .bat files by extension', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const dropZone = screen.getByRole('button');
      const batFile = new File(['echo'], 'script.bat', { type: '' });
      const dataTransfer = { files: [batFile] };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFilesSelected).not.toHaveBeenCalled();
      expect(screen.getByText('crossCutting.attachments.blockedFileType')).toBeInTheDocument();
    });

    it('rejects .sh files by extension', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const dropZone = screen.getByRole('button');
      const shFile = new File(['#!/bin/bash'], 'run.sh', { type: 'application/x-sh' });
      const dataTransfer = { files: [shFile] };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFilesSelected).not.toHaveBeenCalled();
    });

    it('accepts valid files under size limit', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const dropZone = screen.getByRole('button');
      const validFile = new File(['content'], 'report.pdf', { type: 'application/pdf' });
      const dataTransfer = { files: [validFile] };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFilesSelected).toHaveBeenCalledWith([validFile]);
    });

    it('respects custom maxSizeBytes prop', () => {
      const onFilesSelected = vi.fn();
      render(
        <FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} maxSizeBytes={1024} />,
      );

      const dropZone = screen.getByRole('button');
      const bigFile = new File(['x'.repeat(2048)], 'big.txt', { type: 'text/plain' });
      const dataTransfer = { files: [bigFile] };

      fireEvent.drop(dropZone, { dataTransfer });

      expect(onFilesSelected).not.toHaveBeenCalled();
    });

    it('clears validation error when valid file is selected', () => {
      const onFilesSelected = vi.fn();
      render(<FileUploadZone {...defaultProps} onFilesSelected={onFilesSelected} />);

      const dropZone = screen.getByRole('button');

      // First drop invalid file
      const bigFile = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
      Object.defineProperty(bigFile, 'size', { value: 51 * 1024 * 1024 });
      fireEvent.drop(dropZone, { dataTransfer: { files: [bigFile] } });
      expect(screen.getByText('crossCutting.attachments.fileTooLarge')).toBeInTheDocument();

      // Then drop valid file — error should be cleared
      const validFile = new File(['content'], 'ok.pdf', { type: 'application/pdf' });
      fireEvent.drop(dropZone, { dataTransfer: { files: [validFile] } });
      expect(screen.queryByText('crossCutting.attachments.fileTooLarge')).not.toBeInTheDocument();
    });
  });

  // --- Disabled state ---

  describe('disabled state during upload', () => {
    it('has reduced opacity when uploading', () => {
      render(<FileUploadZone {...defaultProps} isUploading />);

      const dropZone = screen.getByRole('button');
      expect(dropZone.className).toContain('pointer-events-none');
      expect(dropZone.className).toContain('opacity-50');
    });

    it('disables file input when uploading', () => {
      render(<FileUploadZone {...defaultProps} isUploading />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeDisabled();
    });
  });
});
