/**
 * PanelDetailSheet — simplified task detail sheet for the embedded TaskPanel.
 *
 * Thin wrapper around TaskDetailSheet with:
 *   - window.confirm for delete (instead of AlertDialog)
 *   - No activity timeline
 */

import type { Task } from '../types';
import { TaskDetailSheet } from './TaskDetailSheet';

interface PanelDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PanelDetailSheet({ task, open, onOpenChange }: PanelDetailSheetProps) {
  return (
    <TaskDetailSheet
      task={task}
      open={open}
      onOpenChange={onOpenChange}
      deleteMode="confirm"
      showTimeline={false}
    />
  );
}
