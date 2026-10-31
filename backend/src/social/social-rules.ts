export function isOperatorRole(role: string): boolean {
  return role === 'PROVIDER' || role === 'GUIDE' || role === 'ADMIN';
}

export function canReadGroupChat(isMember: boolean): boolean {
  return isMember;
}

export function visibleToOperators(visibility: 'PUBLIC' | 'PRIVATE'): boolean {
  return visibility === 'PUBLIC';
}

export function contactRateLimited(recentCount: number): boolean {
  return recentCount >= 5;
}

export function initialVideoStatus(role: string): 'PENDING' | 'PUBLISHED' {
  return role === 'USER' ? 'PENDING' : 'PUBLISHED';
}

/** A group inquiry never holds tour seats. Confirmation is a status, not a reservation. */
export function inquiryReservesSeats(): boolean {
  return false;
}
