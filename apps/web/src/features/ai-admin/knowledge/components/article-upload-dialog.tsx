/* eslint-disable i18next/no-literal-string */
/**
 * Article Upload Dialog — drag-drop file upload or direct paste for knowledge articles.
 *
 * AC-3: Upload Document dialog with drag-drop zone, text paste alternative,
 * category selector, title field, processing indicator.
 * Concept D: animate-step-in, 12px radius.
 */

import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';
import { FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/lib/form-utils';
import { useZodForm } from '@/lib/form-utils';
import { cn } from '@/lib/utils';

import type { KnowledgeCategory } from '../../api/types';
import { useCreateKnowledgeArticle } from '../../api/use-knowledge-articles';

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: KnowledgeCategory; label: string }[] = [
  { value: 'BUSINESS_PROCESS', label: 'Business Processes' },
  { value: 'TERMINOLOGY', label: 'Terminology' },
  { value: 'INDUSTRY_RULES', label: 'Industry Rules' },
  { value: 'CUSTOM_FIELDS', label: 'Custom Fields' },
  { value: 'HISTORICAL_PATTERN', label: 'Historical Patterns' },
];

const ACCEPTED_EXTENSIONS = '.txt,.md,.pdf';
const ACCEPTED_TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/x-markdown']);

// ─── Schema ─────────────────────────────────────────────────────────────────

const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or fewer'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(100_000, 'Content must be 100,000 characters or fewer'),
  category: z.enum(
    ['BUSINESS_PROCESS', 'TERMINOLOGY', 'INDUSTRY_RULES', 'CUSTOM_FIELDS', 'HISTORICAL_PATTERN'],
    { message: 'Category is required' },
  ),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

// ─── Component ──────────────────────────────────────────────────────────────

interface ArticleUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArticleUploadDialog({ open, onOpenChange }: ArticleUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const createArticle = useCreateKnowledgeArticle();

  const form = useZodForm<UploadFormValues>({
    schema: uploadSchema,
    defaultValues: {
      title: '',
      content: '',
      category: undefined,
    },
  });

  const resetDialog = useCallback(() => {
    form.reset();
    setFileName(null);
    setFileError(null);
  }, [form]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetDialog();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetDialog],
  );

  // ── File handling ──

  const processFile = useCallback(
    (file: File) => {
      setFileError(null);
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (ext === '.pdf') {
        setFileError(
          'PDF text extraction is not yet supported. Please copy the text content from your PDF and paste it in the text area below.',
        );
        return;
      }

      if (!ACCEPTED_TEXT_TYPES.has(file.type) && ext !== '.txt' && ext !== '.md') {
        setFileError('Unsupported file type. Please upload .txt or .md files.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        form.setValue('content', text, { shouldValidate: true });
        // Auto-fill title from filename if empty
        if (!form.getValues('title')) {
          const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
          form.setValue('title', nameWithoutExt, { shouldValidate: true });
        }
        setFileName(file.name);
      };
      reader.onerror = () => {
        setFileError('Failed to read file. Please try again or paste content directly.');
      };
      reader.readAsText(file);
    },
    [form],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile],
  );

  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleKeyDownUpload = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }, []);

  // ── Submit ──

  const onSubmit = useCallback(
    async (values: UploadFormValues) => {
      try {
        await createArticle.mutateAsync({
          title: values.title,
          content: values.content,
          category: values.category,
        });
        handleOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to upload article');
      }
    },
    [createArticle, handleOpenChange],
  );

  const hasContent = !!form.watch('content');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="animate-step-in rounded-xl sm:max-w-lg max-md:top-0 max-md:left-0 max-md:translate-x-0 max-md:translate-y-0 max-md:max-w-full max-md:h-[100dvh] max-md:rounded-none max-md:overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Upload Document</DialogTitle>
          <DialogDescription>
            Upload a text file or paste content directly to create a knowledge article.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Drag-drop zone */}
            <div className="space-y-2">
              <div
                role="button"
                tabIndex={0}
                aria-label="Drop files here or click to browse"
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
                  isDragOver
                    ? 'border-[#7c3aed] bg-[#f5f3ff]'
                    : 'border-muted-foreground/25 hover:border-[#7c3aed]/50',
                  createArticle.isPending && 'pointer-events-none opacity-50',
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleClickUpload}
                onKeyDown={handleKeyDownUpload}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={createArticle.isPending}
                />
                {fileName ? (
                  <>
                    <FileText className="size-8 text-[#7c3aed]" />
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">Click or drop to replace</p>
                  </>
                ) : (
                  <>
                    <Upload className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drop files here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">Supports .txt, .md files</p>
                  </>
                )}
              </div>
              {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            </div>

            {/* Or separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or paste content</span>
              </div>
            </div>

            {/* Content textarea */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Paste your document content here..."
                      className="min-h-[120px] resize-y"
                      disabled={createArticle.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Article title"
                      disabled={createArticle.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={createArticle.isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createArticle.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
                disabled={createArticle.isPending || !hasContent}
              >
                {createArticle.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Chunking & embedding…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Upload & Create
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
