import {
  useForm,
  type UseFormProps,
  type UseFormReturn,
  type FieldValues,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { i18n, mapZodIssueToTranslationKey } from '@nexa/i18n';

import type { FieldVisibilityMap } from '@/hooks/use-field-visibility';

// Re-export Shadcn Form building blocks for convenience
export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
} from '@/components/ui/form';

/**
 * Pre-configured `useForm` hook with Zod resolver.
 *
 * Wraps react-hook-form's `useForm` with the Zod resolver
 * pre-applied, so consumers only need to pass a Zod schema.
 *
 * @example
 * ```tsx
 * const loginSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * });
 *
 * function LoginForm() {
 *   const form = useZodForm({ schema: loginSchema });
 *   // ...
 * }
 * ```
 */
export function useZodForm<TFormValues extends FieldValues>(
  props: Omit<UseFormProps<TFormValues>, 'resolver'> & {
    schema: z.ZodObject<Record<string, z.ZodType>>;
  },
): UseFormReturn<TFormValues> {
  const { schema, ...formProps } = props;
  // zodResolver supports both Zod 3 and Zod 4 at runtime; the type
  // mismatch between zod/v4/classic and zod/v4/core is a known DTS
  // incompatibility. Cast through `unknown` to the expected first
  // parameter type rather than using `as never` which suppresses all
  // type checking.
  const resolver = zodResolver(
    schema as unknown as Parameters<typeof zodResolver>[0],
  ) as Resolver<TFormValues>;
  return useForm<TFormValues>({
    ...formProps,
    resolver,
  });
}

/**
 * Passthrough helper for creating form schemas.
 *
 * Uses `@nexa/i18n` zod-error-map for localised validation messages.
 * Currently a passthrough — exists as a standardised entry point
 * so all form schemas go through one function.
 */
export function createFormSchema<T extends z.ZodType>(schema: T): T {
  return schema;
}

/**
 * Returns props for a form field based on its permission visibility.
 *
 * Provides a simpler API for forms that don't want to use `<PermissionField>` wrapper.
 * Use with React Hook Form + Zod to conditionally render/disable fields.
 *
 * @example
 * ```tsx
 * const visibility = useFieldVisibility('sales.orders.detail');
 * const costProps = getFieldProps('costPrice', visibility);
 * if (costProps.hidden) return null;
 * return <Input disabled={costProps.disabled} aria-readonly={costProps.ariaReadOnly} />;
 * ```
 */
export function getFieldProps(
  fieldPath: string,
  visibility: FieldVisibilityMap,
): { hidden: boolean; disabled: boolean; ariaReadOnly?: boolean } {
  const vis = visibility[fieldPath] ?? 'VISIBLE';
  return {
    hidden: vis === 'HIDDEN',
    disabled: vis === 'READ_ONLY',
    ariaReadOnly: vis === 'READ_ONLY' ? true : undefined,
  };
}

/**
 * Create a Zod 4 error map that resolves validation messages
 * via the `@nexa/i18n` translation system.
 *
 * Maps Zod issue codes to `validation:*` translation keys using
 * `mapZodIssueToTranslationKey`, then resolves them with `i18n.t()`.
 *
 * Set as the global Zod error map at application init:
 * ```ts
 * import { z } from 'zod';
 * z.config({ customError: createZodI18nErrorMap() });
 * ```
 */
export function createZodI18nErrorMap() {
  return (issue: { code?: string; path?: PropertyKey[]; message?: string; minimum?: number | bigint; maximum?: number | bigint; origin?: string; format?: string; expected?: string; input?: unknown }) => {
    const mappedIssue = {
      code: issue.code ?? 'custom',
      message: issue.message ?? '',
      path: issue.path ?? [],
      minimum: issue.minimum,
      maximum: issue.maximum,
      origin: issue.origin,
      format: issue.format,
      // Map Zod 4's invalid_type `expected` to `received` for mapZodIssueToTranslationKey
      received: issue.input === undefined ? 'undefined' : issue.input === null ? 'null' : undefined,
    };

    const { key, params } = mapZodIssueToTranslationKey(mappedIssue);

    // Resolve translation key; if the key isn't found, return undefined
    // to let Zod's default locale handle it
    const translated = i18n.t(key, params ?? {});

    // i18next returns the key itself when translation is missing
    if (translated === key) {
      return undefined;
    }

    return translated;
  };
}
