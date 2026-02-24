import { Children, cloneElement, isValidElement, type ReactNode } from 'react';

import type { FieldVisibilityMap } from '@/hooks/use-field-visibility';

interface PermissionFieldProps {
  fieldPath: string;
  visibility: FieldVisibilityMap;
  children: ReactNode;
}

/**
 * Wrapper component that applies field-level permission visibility.
 *
 * - HIDDEN: renders null (field removed from DOM)
 * - READ_ONLY: clones children with disabled={true} and aria-readonly="true"
 * - VISIBLE (or not in map): renders children unchanged
 */
export function PermissionField({
  fieldPath,
  visibility,
  children,
}: PermissionFieldProps) {
  const vis = visibility[fieldPath] ?? 'VISIBLE';

  if (vis === 'HIDDEN') {
    return null;
  }

  if (vis === 'READ_ONLY') {
    return (
      <>
        {Children.map(children, (child) => {
          if (isValidElement(child)) {
            return cloneElement(
              child as React.ReactElement<Record<string, unknown>>,
              {
                disabled: true,
                'aria-readonly': true,
              },
            );
          }
          return child;
        })}
      </>
    );
  }

  return <>{children}</>;
}
