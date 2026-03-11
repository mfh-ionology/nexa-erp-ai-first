/* eslint-disable i18next/no-literal-string */
/**
 * Template Editor — create/edit form for document templates.
 *
 * AC7: Template Management UI — Editor Form
 * - Document type selector (disabled on edit)
 * - Template name, description, page settings, branding toggles
 * - HTML template editor (textarea, JetBrains Mono, min-height 400px)
 * - Collapsible CSS / header / footer editors
 * - isDefault checkbox
 * - React Hook Form + Zod resolver
 * - Concept D visual fidelity
 */

import { useCallback, useMemo } from 'react';
import { ChevronDown, Save, X } from 'lucide-react';
import { z } from 'zod';
import type { Control, SubmitHandler } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  useZodForm,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/lib/form-utils';

import type {
  DocumentTemplateDetail,
  DocumentType,
  CreateDocumentTemplateRequest,
  UpdateDocumentTemplateRequest,
} from './api';
import { DOCUMENT_TYPES, useCreateDocumentTemplate, useUpdateDocumentTemplate } from './api';
import { DOCUMENT_TYPE_LABELS } from './constants';

const PAGE_SIZES = ['A4', 'A5', 'Letter'] as const;
const ORIENTATIONS = ['portrait', 'landscape'] as const;
const LOGO_POSITIONS = ['top-left', 'top-center', 'top-right'] as const;

// ─── Schema ────────────────────────────────────────────────────────────────

const templateFormSchema = z.object({
  documentType: z.string().min(1, 'Document type is required'),
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  description: z.string().max(2000).optional().or(z.literal('')),
  htmlTemplate: z.string().min(1, 'HTML template is required'),
  headerHtml: z.string().optional().or(z.literal('')),
  footerHtml: z.string().optional().or(z.literal('')),
  cssStyles: z.string().optional().or(z.literal('')),
  pageSize: z.enum(PAGE_SIZES).default('A4'),
  orientation: z.enum(ORIENTATIONS).default('portrait'),
  marginTop: z.coerce.number().min(0).max(100).default(20),
  marginBottom: z.coerce.number().min(0).max(100).default(20),
  marginLeft: z.coerce.number().min(0).max(100).default(15),
  marginRight: z.coerce.number().min(0).max(100).default(15),
  showLogo: z.boolean().default(true),
  logoPosition: z.enum(LOGO_POSITIONS).default('top-left'),
  showBankDetails: z.boolean().default(true),
  showVatNumber: z.boolean().default(true),
  showCompanyReg: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

// ─── Props ─────────────────────────────────────────────────────────────────

export interface TemplateEditorProps {
  /** Template to edit — undefined for create mode */
  template?: DocumentTemplateDetail;
  /** Pre-fill for clone mode — requires full detail to populate htmlTemplate */
  cloneFrom?: DocumentTemplateDetail;
  /** Called after successful save */
  onSuccess: () => void;
  /** Called on cancel */
  onCancel: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function TemplateEditor({ template, cloneFrom, onSuccess, onCancel }: TemplateEditorProps) {
  const isEdit = !!template;

  // ── Default values ──
  const defaultValues = useMemo<TemplateFormValues>(() => {
    const base: TemplateFormValues = {
      documentType: '',
      name: '',
      description: '',
      htmlTemplate: '',
      headerHtml: '',
      footerHtml: '',
      cssStyles: '',
      pageSize: 'A4',
      orientation: 'portrait',
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 15,
      marginRight: 15,
      showLogo: true,
      logoPosition: 'top-left',
      showBankDetails: true,
      showVatNumber: true,
      showCompanyReg: true,
      isDefault: false,
    };

    if (template) {
      return {
        ...base,
        documentType: template.documentType,
        name: template.name,
        description: template.description ?? '',
        htmlTemplate: template.htmlTemplate,
        headerHtml: template.headerHtml ?? '',
        footerHtml: template.footerHtml ?? '',
        cssStyles: template.cssStyles ?? '',
        pageSize: template.pageSize as (typeof PAGE_SIZES)[number],
        orientation: template.orientation as (typeof ORIENTATIONS)[number],
        marginTop: template.marginTop,
        marginBottom: template.marginBottom,
        marginLeft: template.marginLeft,
        marginRight: template.marginRight,
        showLogo: template.showLogo,
        logoPosition: template.logoPosition as (typeof LOGO_POSITIONS)[number],
        showBankDetails: template.showBankDetails,
        showVatNumber: template.showVatNumber,
        showCompanyReg: template.showCompanyReg,
        isDefault: template.isDefault,
      };
    }

    if (cloneFrom) {
      return {
        ...base,
        documentType: cloneFrom.documentType,
        name: `${cloneFrom.name} (Copy)`,
        description: cloneFrom.description ?? '',
        htmlTemplate: cloneFrom.htmlTemplate,
        headerHtml: cloneFrom.headerHtml ?? '',
        footerHtml: cloneFrom.footerHtml ?? '',
        cssStyles: cloneFrom.cssStyles ?? '',
        pageSize: cloneFrom.pageSize as (typeof PAGE_SIZES)[number],
        orientation: cloneFrom.orientation as (typeof ORIENTATIONS)[number],
        marginTop: cloneFrom.marginTop,
        marginBottom: cloneFrom.marginBottom,
        marginLeft: cloneFrom.marginLeft,
        marginRight: cloneFrom.marginRight,
        showLogo: cloneFrom.showLogo,
        logoPosition: cloneFrom.logoPosition as (typeof LOGO_POSITIONS)[number],
        showBankDetails: cloneFrom.showBankDetails,
        showVatNumber: cloneFrom.showVatNumber,
        showCompanyReg: cloneFrom.showCompanyReg,
        isDefault: false,
      };
    }

    return base;
  }, [template, cloneFrom]);

  const form = useZodForm({
    schema: templateFormSchema,
    defaultValues,
  });

  // ── Mutations ──
  const createTemplate = useCreateDocumentTemplate();
  const updateTemplate = useUpdateDocumentTemplate(template?.id ?? '');

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  // ── Submit ──
  const onSubmit: SubmitHandler<TemplateFormValues> = useCallback(
    (values) => {
      if (isEdit) {
        const data: UpdateDocumentTemplateRequest = {
          name: values.name,
          description: values.description || undefined,
          htmlTemplate: values.htmlTemplate,
          headerHtml: values.headerHtml || undefined,
          footerHtml: values.footerHtml || undefined,
          cssStyles: values.cssStyles || undefined,
          pageSize: values.pageSize,
          orientation: values.orientation,
          marginTop: values.marginTop,
          marginBottom: values.marginBottom,
          marginLeft: values.marginLeft,
          marginRight: values.marginRight,
          showLogo: values.showLogo,
          logoPosition: values.logoPosition,
          showBankDetails: values.showBankDetails,
          showVatNumber: values.showVatNumber,
          showCompanyReg: values.showCompanyReg,
          isDefault: values.isDefault,
        };
        updateTemplate.mutate(data, { onSuccess });
      } else {
        const data: CreateDocumentTemplateRequest = {
          documentType: values.documentType as DocumentType,
          name: values.name,
          description: values.description || undefined,
          htmlTemplate: values.htmlTemplate,
          headerHtml: values.headerHtml || undefined,
          footerHtml: values.footerHtml || undefined,
          cssStyles: values.cssStyles || undefined,
          pageSize: values.pageSize,
          orientation: values.orientation,
          marginTop: values.marginTop,
          marginBottom: values.marginBottom,
          marginLeft: values.marginLeft,
          marginRight: values.marginRight,
          showLogo: values.showLogo,
          logoPosition: values.logoPosition,
          showBankDetails: values.showBankDetails,
          showVatNumber: values.showVatNumber,
          showCompanyReg: values.showCompanyReg,
          isDefault: values.isDefault,
        };
        createTemplate.mutate(data, { onSuccess });
      }
    },
    [isEdit, createTemplate, updateTemplate, onSuccess],
  );

  const showLogo = form.watch('showLogo');

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isEdit ? 'Edit Template' : cloneFrom ? 'Clone Template' : 'New Template'}
        </h2>
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5">
          <X className="size-4" />
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-6">
          {/* ── Document Type & Name ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((dt) => (
                        <SelectItem key={dt} value={dt}>
                          {DOCUMENT_TYPE_LABELS[dt]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Standard Invoice" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* ── Description ── */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Optional description of this template..."
                    className="resize-none"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── Page Settings ── */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">Page Settings</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <FormField
                control={form.control}
                name="pageSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page Size</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAGE_SIZES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orientation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orientation</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ORIENTATIONS.map((o) => (
                          <SelectItem key={o} value={o} className="capitalize">
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marginTop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Top (mm)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marginBottom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bottom (mm)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marginLeft"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Left (mm)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marginRight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Right (mm)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* ── Branding Toggles ── */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">Branding</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="showLogo"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="cursor-pointer">Show Logo</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {showLogo && (
                <FormField
                  control={form.control}
                  name="logoPosition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo Position</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LOGO_POSITIONS.map((p) => (
                            <SelectItem key={p} value={p} className="capitalize">
                              {p.replace(/-/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="showBankDetails"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="cursor-pointer">Show Bank Details</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showVatNumber"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="cursor-pointer">Show VAT Number</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showCompanyReg"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="cursor-pointer">Show Company Reg</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* ── HTML Template Editor ── */}
          <FormField
            control={form.control}
            name="htmlTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HTML Template *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter Handlebars HTML template..."
                    className="min-h-[400px] resize-y font-mono text-sm leading-relaxed"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── Collapsible: CSS Styles ── */}
          <CollapsibleEditor
            label="CSS Styles"
            name="cssStyles"
            control={form.control}
            placeholder="/* Custom CSS styles */"
          />

          {/* ── Collapsible: Header HTML ── */}
          <CollapsibleEditor
            label="Header HTML"
            name="headerHtml"
            control={form.control}
            placeholder="<!-- Header HTML (rendered on every page) -->"
          />

          {/* ── Collapsible: Footer HTML ── */}
          <CollapsibleEditor
            label="Footer HTML"
            name="footerHtml"
            control={form.control}
            placeholder="<!-- Footer HTML (rendered on every page) -->"
          />

          {/* ── isDefault ── */}
          <FormField
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="cursor-pointer !mt-0">
                  Set as default template for this document type
                </FormLabel>
              </FormItem>
            )}
          />

          {/* ── Actions ── */}
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
            >
              <Save className="size-4" />
              {isPending ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ─── Collapsible Editor Section ────────────────────────────────────────────

function CollapsibleEditor({
  label,
  name,
  control,
  placeholder,
}: {
  label: string;
  name: 'cssStyles' | 'headerHtml' | 'footerHtml';
  control: Control<TemplateFormValues>;
  placeholder: string;
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-between px-0 hover:bg-transparent"
        >
          <Label className="cursor-pointer text-sm font-medium">{label}</Label>
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <FormField
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem className="mt-2">
              <FormControl>
                <Textarea
                  placeholder={placeholder}
                  className="min-h-[150px] resize-y font-mono text-sm leading-relaxed"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
