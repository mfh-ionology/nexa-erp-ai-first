import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// --- Mock TanStack Router ---
const capturedOptions: Record<string, unknown> = {};
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => {
    Object.assign(capturedOptions, opts);
    return { options: opts, useParams: () => ({}) };
  },
  Outlet: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'outlet' }, 'Outlet Content');
  },
}));

// --- Mock route guards ---
const mockBeforeLoad = vi.fn() as ReturnType<typeof vi.fn> & { moduleKey?: string };
vi.mock('@/lib/route-guards', () => ({
  createAdminModuleBeforeLoad: (moduleKey: string) => {
    mockBeforeLoad.moduleKey = moduleKey;
    return mockBeforeLoad;
  },
}));

// Dynamic import after mocks
async function renderLayout() {
  const mod = await import('./users');
  const Component = (mod.Route as unknown as { options: { component: React.ComponentType } })
    .options.component;
  return render(<Component />);
}

describe('UsersLayout', () => {
  it('configures beforeLoad with createAdminModuleBeforeLoad("system")', async () => {
    await import('./users');
    expect((mockBeforeLoad as unknown as { moduleKey: string }).moduleKey).toBe('system');
    expect(capturedOptions.beforeLoad).toBe(mockBeforeLoad);
  });

  it('renders Outlet as the component', async () => {
    await renderLayout();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });
});
