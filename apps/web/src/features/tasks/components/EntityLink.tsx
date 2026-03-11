import { Link } from '@tanstack/react-router';
import { getEntityDisplayName, getEntityRoute } from '../utils/entity-routes';

interface EntityLinkProps {
  entityType: string;
  entityId: string;
}

/** Truncates a UUID to its first 8 chars for display. */
function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function EntityLink({ entityType, entityId }: EntityLinkProps) {
  const href = getEntityRoute(entityType, entityId);
  const label = `${getEntityDisplayName(entityType)} ${shortId(entityId)}`;

  if (!href) {
    return <span className="font-mono text-xs text-muted-foreground">{label}</span>;
  }

  return (
    <Link
      to={href}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      className="font-mono text-xs text-[#7c3aed] transition-colors hover:text-[#5b21b6] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30 rounded"
    >
      {label}
    </Link>
  );
}
