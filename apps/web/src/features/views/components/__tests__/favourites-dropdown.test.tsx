/* eslint-disable @typescript-eslint/naming-convention */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { FavouriteViewDto } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

const mockSetActiveView = vi.fn();
vi.mock('@/stores/view-store', () => ({
  useViewStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setActiveView: mockSetActiveView }),
}));

const mockUseFavourites = vi.fn();
vi.mock('../../hooks/use-favourites', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  useFavourites: () => mockUseFavourites(),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeFav(overrides: Partial<FavouriteViewDto> = {}): FavouriteViewDto {
  return {
    id: 'fav-1',
    name: 'My View',
    groupName: 'System',
    scope: 'PERSONAL',
    createdBy: 'user-1',
    dataViewId: 'dv-1',
    isFavourite: true,
    favouriteOrder: 1,
    isDefault: false,
    filterLogic: 'AND',
    sortConfig: [],
    columnConfig: [],
    conditions: [],
    viewKey: 'USERS',
    ...overrides,
  };
}

async function importComponent() {
  const mod = await import('../favourites-dropdown');
  return mod.FavouritesDropdown;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FavouritesDropdown', () => {
  let FavouritesDropdown: Awaited<ReturnType<typeof importComponent>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    FavouritesDropdown = await importComponent();
  });

  it('renders star icon button', () => {
    mockUseFavourites.mockReturnValue({
      favourites: [],
      groupedFavourites: {},
      isLoading: false,
    });

    render(<FavouritesDropdown />);

    const button = screen.getByRole('button', { name: /views\.favourites/i });
    expect(button).toBeInTheDocument();
  });

  it('clicking star opens popover with grouped favourites', async () => {
    const user = userEvent.setup();
    const favs: FavouriteViewDto[] = [
      makeFav({
        id: 'fav-1',
        name: 'Active Users',
        groupName: 'System',
        viewKey: 'USERS',
        favouriteOrder: 1,
      }),
      makeFav({
        id: 'fav-2',
        name: 'All Invoices',
        groupName: 'Finance',
        viewKey: 'INVOICES',
        favouriteOrder: 1,
      }),
    ];
    mockUseFavourites.mockReturnValue({
      favourites: favs,
      groupedFavourites: {
        Finance: [favs[1]],
        System: [favs[0]],
      },
      isLoading: false,
    });

    render(<FavouritesDropdown />);

    const button = screen.getByRole('button', { name: /views\.favourites/i });
    await user.click(button);

    // Group headers should appear
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();

    // View names should appear
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('All Invoices')).toBeInTheDocument();
  });

  it('clicking a favourite navigates to correct route', async () => {
    const user = userEvent.setup();
    const fav = makeFav({
      id: 'fav-1',
      name: 'My Users View',
      groupName: 'System',
      viewKey: 'USERS',
    });
    mockUseFavourites.mockReturnValue({
      favourites: [fav],
      groupedFavourites: { System: [fav] },
      isLoading: false,
    });

    render(<FavouritesDropdown />);

    const trigger = screen.getByRole('button', { name: /views\.favourites/i });
    await user.click(trigger);

    const favButton = screen.getByText('My Users View');
    await user.click(favButton);

    // Should set the active view in Zustand store
    expect(mockSetActiveView).toHaveBeenCalledWith('USERS', 'fav-1', 'My Users View');
    // Should navigate to the USERS route
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/system/users' });
  });

  it('empty state shown when no favourites', async () => {
    const user = userEvent.setup();
    mockUseFavourites.mockReturnValue({
      favourites: [],
      groupedFavourites: {},
      isLoading: false,
    });

    render(<FavouritesDropdown />);

    const button = screen.getByRole('button', { name: /views\.favourites/i });
    await user.click(button);

    expect(screen.getByText('views.noFavourites')).toBeInTheDocument();
  });

  it('shows loading state when favourites are loading', async () => {
    const user = userEvent.setup();
    mockUseFavourites.mockReturnValue({
      favourites: [],
      groupedFavourites: {},
      isLoading: true,
    });

    render(<FavouritesDropdown />);

    const button = screen.getByRole('button', { name: /views\.favourites/i });
    await user.click(button);

    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('favourite with unknown viewKey route is disabled', async () => {
    const user = userEvent.setup();
    const fav = makeFav({
      id: 'fav-1',
      name: 'Unknown Route View',
      groupName: 'Other',
      viewKey: 'NONEXISTENT_KEY',
    });
    mockUseFavourites.mockReturnValue({
      favourites: [fav],
      groupedFavourites: { Other: [fav] },
      isLoading: false,
    });

    render(<FavouritesDropdown />);

    const trigger = screen.getByRole('button', { name: /views\.favourites/i });
    await user.click(trigger);

    const favText = screen.getByText('Unknown Route View');
    // getByText returns the <span>, but the disabled attr is on the parent <button>
    const favButton = favText.closest('button');
    expect(favButton).toBeDisabled();
  });
});
