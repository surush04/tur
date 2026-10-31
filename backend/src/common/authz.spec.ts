import { assertRoleChange } from './authz';

describe('role changes', () => {
  const base = {
    actorRole: 'ADMIN',
    actorId: 'admin',
    targetId: 'user',
    targetRole: 'USER',
    nextRole: 'GUIDE',
    adminCount: 2,
  };

  it('allows an admin to change another user', () => {
    expect(assertRoleChange(base)).toBeNull();
  });

  it('blocks self promotion and non-admins', () => {
    expect(assertRoleChange({ ...base, actorRole: 'USER', nextRole: 'ADMIN' })).toBe('FORBIDDEN');
    expect(assertRoleChange({ ...base, actorId: 'admin', targetId: 'admin', nextRole: 'ADMIN' })).toBe('SELF');
  });

  it('keeps the last administrator', () => {
    expect(
      assertRoleChange({
        ...base,
        targetRole: 'ADMIN',
        nextRole: 'USER',
        adminCount: 1,
      }),
    ).toBe('LAST_ADMIN');
  });
});
