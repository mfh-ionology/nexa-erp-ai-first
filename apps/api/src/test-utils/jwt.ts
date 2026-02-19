import { SignJWT } from 'jose';

const TEST_JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';

const secretBytes = new TextEncoder().encode(TEST_JWT_SECRET);

export { TEST_JWT_SECRET, TEST_USER_ID, TEST_COMPANY_ID };

/**
 * Generate a test JWT for integration tests.
 * Defaults to ADMIN role with SYSTEM module enabled.
 */
export async function makeTestJwt(overrides: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({
    tenantId: TEST_COMPANY_ID,
    role: 'ADMIN',
    enabledModules: ['SYSTEM'],
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(TEST_USER_ID)
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(secretBytes);
}

export function authHeaders(jwt: string, companyId: string = TEST_COMPANY_ID) {
  return {
    authorization: `Bearer ${jwt}`,
    'x-company-id': companyId,
  };
}
