import { test, expect } from '@playwright/test';

test('Debug: check print-preferences route module and tree', async ({ page }) => {
  page.on('console', (msg) => {
    console.log(`  PAGE: [${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.log(`  PAGE ERROR: ${err.message}`);
  });

  // Login
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Email').fill('admin@nexa-erp.dev');
  await page.getByLabel('Password').fill('NexaDev2026!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

  // Deep debug the route tree
  const result = await page.evaluate(async () => {
    try {
      // 1. Import the route tree gen file directly
      const routeTreeMod = await import('/src/routeTree.gen.ts');
      const routeTree = routeTreeMod.routeTree;

      // 2. Check if the route tree has the print-preferences route
      const routeTreeStr = JSON.stringify(Object.keys(routeTreeMod), null, 2);

      // 3. Check the route module's Route export
      const routeMod = await import('/src/routes/_authenticated/system/print-preferences.tsx');
      const hasRouteExport = 'Route' in routeMod;
      const routeType = typeof routeMod.Route;
      const routeId = routeMod.Route?.id || routeMod.Route?.options?.id || 'unknown';

      // 4. Check the router and its internal route tree
      const { router } = await import('/src/router.ts');

      // 5. Count all routes in the tree
      const allRouteIds = Object.keys(router.routesById || {});
      const allPaths = Object.keys(router.routesByPath || {});

      // 6. Check if _addFileChildren was properly called
      const authRoute = router.routesById?.['/_authenticated'];
      const authChildRoutes = authRoute?.children
        ? Object.entries(authRoute.children).map(([k, v]: [string, any]) => ({
            key: k,
            id: v?.id,
            path: v?.path,
          }))
        : [];

      return {
        routeTreeExports: Object.keys(routeTreeMod),
        hasRouteExport,
        routeType,
        routeId,
        totalRoutes: allRouteIds.length,
        totalPaths: allPaths.length,
        authChildCount: authChildRoutes.length,
        authChildren: authChildRoutes.filter((c: any) =>
          c.id?.includes('system') || c.path?.includes('system')
        ),
      };
    } catch (e: any) {
      return { error: e.message, stack: e.stack };
    }
  });

  console.log('Deep route debug:', JSON.stringify(result, null, 2));
});
