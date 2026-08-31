import { describe, expect, it } from 'vitest';
import { authUser } from './fleetAuth';

describe('authUser', () => {
  it('extracts a Neon user nested beside a session', () => {
    expect(authUser({ data: { session: { token: 'opaque' }, user: { id: 'user_1', email: 'djoreally@example.com' } } }))
      .toMatchObject({ id: 'user_1', email: 'djoreally@example.com' });
  });

  it('accepts Neon session identity fields when no user object is returned', () => {
    expect(authUser({ data: { session: { user_id: 'user_2', email_address: 'djoreally@example.com' } } }))
      .toMatchObject({ user_id: 'user_2', email_address: 'djoreally@example.com' });
  });

  it('does not mistake an opaque session for a verified user identity', () => {
    expect(authUser({ data: { session: { token: 'opaque' } } })).toBeNull();
  });
});
