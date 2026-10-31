import { addMoney, compareMoney, decToString, mulMoney, normalizeMoney } from './money';

describe('money', () => {
  it('multiplies catalog prices in dirams', () => {
    expect(mulMoney('350.50', 3)).toBe('1051.50');
    expect(mulMoney('0.10', 3)).toBe('0.30');
    expect(mulMoney('199.99', 2)).toBe('399.98');
  });

  it('adds and compares without floating point drift', () => {
    expect(addMoney('0.10', '0.20')).toBe('0.30');
    expect(compareMoney('1500.00', '1499.99')).toBe(1);
    expect(normalizeMoney('10')).toBe('10.00');
    expect(normalizeMoney('10.5')).toBe('10.50');
  });

  it('keeps map coordinates that are not money amounts', () => {
    expect(decToString('39.075000')).toBe('39.075');
    expect(decToString('350.50')).toBe('350.50');
    expect(decToString('-68.786000')).toBe('-68.786');
  });

  it('rejects malformed amounts and quantities', () => {
    expect(() => mulMoney('10.999', 1)).toThrow('INVALID_MONEY');
    expect(() => mulMoney('01.00', 1)).toThrow('INVALID_MONEY');
    expect(() => mulMoney('10.00', 0.5)).toThrow('INVALID_QUANTITY');
    expect(() => mulMoney('10.00', -1)).toThrow('INVALID_QUANTITY');
  });
});
