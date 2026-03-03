/**
 * Tab adapter for NotesPanel — renders notes as tab content within RecordDetailPage.
 *
 * Usage with RecordDetailPage tabs prop:
 * ```tsx
 * import { NotesTab } from '@/features/cross-cutting';
 * import { MessageSquare } from 'lucide-react';
 *
 * const tabs: TabDefinition[] = [
 *   { key: 'details', labelKey: 'common.details', content: <DetailsTab /> },
 *   {
 *     key: 'notes',
 *     labelKey: 'common.notes',
 *     icon: 'MessageSquare',
 *     content: <NotesTab entityType={entityType} entityId={entityId} resourceCode={resourceCode} />,
 *   },
 * ];
 * ```
 */

import { NotesPanel } from './NotesPanel';

interface NotesTabProps {
  entityType: string;
  entityId: string;
  resourceCode: string;
}

export function NotesTab({ entityType, entityId, resourceCode }: NotesTabProps) {
  return <NotesPanel entityType={entityType} entityId={entityId} resourceCode={resourceCode} />;
}
