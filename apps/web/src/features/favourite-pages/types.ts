/**
 * Favourite pages feature types.
 *
 * Mirrors the backend FavouritePage model and creation input.
 */

export interface FavouritePage {
  id: string;
  userId: string;
  companyId: string;
  path: string;
  label: string;
  iconKey: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFavouritePageInput {
  path: string;
  label: string;
  iconKey: string;
}
