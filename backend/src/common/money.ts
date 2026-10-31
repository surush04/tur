const MONEY = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export function toDirams(amount: string): bigint {
  const value = amount.trim();
  if (!MONEY.test(value)) {
    throw new Error('INVALID_MONEY');
  }
  const [whole, frac = ''] = value.split('.');
  const padded = (frac + '00').slice(0, 2);
  return BigInt(whole) * 100n + BigInt(padded);
}

export function fromDirams(dirams: bigint): string {
  if (dirams < 0n) {
    throw new Error('INVALID_MONEY');
  }
  const whole = dirams / 100n;
  const frac = (dirams % 100n).toString().padStart(2, '0');
  return `${whole.toString()}.${frac}`;
}

export function addMoney(left: string, right: string): string {
  return fromDirams(toDirams(left) + toDirams(right));
}

export function mulMoney(amount: string, quantity: number): string {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000) {
    throw new Error('INVALID_QUANTITY');
  }
  return fromDirams(toDirams(amount) * BigInt(quantity));
}

export function compareMoney(left: string, right: string): number {
  const diff = toDirams(left) - toDirams(right);
  if (diff === 0n) return 0;
  return diff > 0n ? 1 : -1;
}

export function normalizeMoney(amount: string): string {
  return fromDirams(toDirams(amount));
}

export function decToString(value: { toString(): string } | string | null | undefined): string | null {
  if (value == null) return null;
  const raw = value.toString();
  if (MONEY.test(raw)) return normalizeMoney(raw);
  const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return raw;
  const fraction = (match[3] ?? '').replace(/0+$/, '').slice(0, 6);
  return `${match[1]}${match[2]}${fraction ? `.${fraction}` : ''}`;
}
