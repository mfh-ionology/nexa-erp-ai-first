/**
 * Tests for the secure-storage wrapper around expo-secure-store.
 */

import * as SecureStore from 'expo-secure-store';

import { resetMockState } from '../test-setup';

import { setToken, getToken, deleteToken, STORAGE_KEYS } from './secure-storage';

describe('secure-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockState();
  });

  describe('setToken', () => {
    it('stores a value in SecureStore', async () => {
      await setToken('test-key', 'test-value');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'test-key',
        'test-value',
      );
    });

    it('stores a refresh token using STORAGE_KEYS', async () => {
      await setToken(STORAGE_KEYS.REFRESH_TOKEN, 'my-refresh-token');

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'nexa_refresh_token',
        'my-refresh-token',
      );
    });
  });

  describe('getToken', () => {
    it('retrieves a stored value', async () => {
      await setToken('test-key', 'stored-value');
      const result = await getToken('test-key');

      expect(result).toBe('stored-value');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('test-key');
    });

    it('returns null for missing keys', async () => {
      const result = await getToken('nonexistent-key');

      expect(result).toBeNull();
    });
  });

  describe('deleteToken', () => {
    it('removes a value from SecureStore', async () => {
      await setToken('test-key', 'to-be-deleted');
      await deleteToken('test-key');

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('test-key');

      const result = await getToken('test-key');
      expect(result).toBeNull();
    });

    it('handles deleting a non-existent key gracefully', async () => {
      await expect(deleteToken('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('STORAGE_KEYS', () => {
    it('has expected key constants', () => {
      expect(STORAGE_KEYS.REFRESH_TOKEN).toBe('nexa_refresh_token');
      expect(STORAGE_KEYS.BIOMETRIC_ENABLED).toBe('nexa_biometric_enabled');
      expect(STORAGE_KEYS.USER_ID).toBe('nexa_user_id');
      expect(STORAGE_KEYS.PUSH_TOKEN).toBe('nexa_push_token');
    });
  });
});
