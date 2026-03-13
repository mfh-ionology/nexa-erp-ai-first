// ---------------------------------------------------------------------------
// Favourite Pages Seeder — Nav Redesign Task 20
// Seeds default favourite page pins for new users on first access.
// Filters by enabledModules so users only see pages they can access.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';

interface DefaultFavourite {
  path: string;
  label: string;
  iconKey: string;
}

/** Default pages pinned for new users — filtered by enabledModules */
const DEFAULT_FAVOURITES: DefaultFavourite[] = [
  { path: '/', label: 'Dashboard', iconKey: 'LayoutDashboard' },
  { path: '/ar/invoices', label: 'Invoices', iconKey: 'FileText' },
  { path: '/sales/orders', label: 'Sales Orders', iconKey: 'ShoppingCart' },
];

/** Map path prefixes to module keys for enabledModules filtering */
const PATH_TO_MODULE: Record<string, string> = {
  '/ar': 'ar',
  '/ap': 'ap',
  '/finance': 'finance',
  '/sales': 'sales',
  '/purchasing': 'purchasing',
  '/inventory': 'inventory',
  '/crm': 'crm',
  '/hr': 'hr',
  '/manufacturing': 'manufacturing',
  '/ai': 'ai',
  '/system': 'system',
};

function getModuleForPath(path: string): string | null {
  if (path === '/') return null; // Dashboard — always allowed
  for (const [prefix, moduleKey] of Object.entries(PATH_TO_MODULE)) {
    if (path.startsWith(prefix)) return moduleKey;
  }
  return null;
}

/**
 * Seed default favourite pages for a user, filtered by their enabledModules.
 * No-op if user already has favourites.
 */
export async function seedDefaultFavourites(
  prisma: PrismaClient,
  userId: string,
  companyId: string,
  enabledModules: string[],
): Promise<void> {
  const existing = await prisma.userFavouritePage.count({
    where: { userId, companyId },
  });
  if (existing > 0) return;

  // Normalise enabledModules to lowercase for comparison
  const normalised = enabledModules.map((m) => m.toLowerCase());

  const filtered = DEFAULT_FAVOURITES.filter((fav) => {
    const moduleKey = getModuleForPath(fav.path);
    if (moduleKey === null) return true; // Dashboard always included
    return normalised.includes(moduleKey);
  });

  if (filtered.length === 0) return;

  await prisma.userFavouritePage.createMany({
    data: filtered.map((fav, index) => ({
      userId,
      companyId,
      path: fav.path,
      label: fav.label,
      iconKey: fav.iconKey,
      displayOrder: index,
    })),
  });
}
