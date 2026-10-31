const ROLES = ['USER', 'GUIDE', 'PROVIDER', 'ADMIN'] as const;
export type AppRole = (typeof ROLES)[number];

export function isRole(value: string): value is AppRole {
  return (ROLES as readonly string[]).includes(value);
}

export function assertRoleChange(input: {
  actorRole: string;
  actorId: string;
  targetId: string;
  targetRole: string;
  nextRole: string;
  adminCount: number;
}): string | null {
  if (input.actorRole !== 'ADMIN') return 'FORBIDDEN';
  if (!isRole(input.nextRole)) return 'ROLE';
  if (input.actorId === input.targetId) return 'SELF';
  if (input.targetRole === 'ADMIN' && input.nextRole !== 'ADMIN' && input.adminCount <= 1) {
    return 'LAST_ADMIN';
  }
  return null;
}
