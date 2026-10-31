import { mulMoney } from './money';

export interface BookableInput {
  published: boolean;
  status: string;
  capacity: number;
  bookedSeats: number;
  travelers: number;
  startDate: string;
  today: string;
}

export function assertBookable(input: BookableInput): string | null {
  if (!input.published) return 'UNPUBLISHED';
  if (input.status !== 'OPEN') return 'CLOSED';
  if (input.startDate < input.today) return 'DATE';
  if (!Number.isInteger(input.travelers) || input.travelers < 1 || input.travelers > 20) {
    return 'TRAVELERS';
  }
  if (input.bookedSeats < 0 || input.capacity < 1) return 'CAPACITY';
  if (input.bookedSeats + input.travelers > input.capacity) return 'CAPACITY';
  return null;
}

export function quoteTotal(pricePerPerson: string, travelers: number): string {
  if (!Number.isInteger(travelers) || travelers < 1) {
    throw new Error('TRAVELERS');
  }
  return mulMoney(pricePerPerson, travelers);
}

export function canTransition(from: string, to: string, actor: 'USER' | 'ADMIN'): boolean {
  if (from === to) return false;
  if (actor === 'USER') {
    return (from === 'PENDING' || from === 'CONFIRMED') && to === 'CANCELLED';
  }
  if (from === 'PENDING' && (to === 'CONFIRMED' || to === 'CANCELLED')) return true;
  if (from === 'CONFIRMED' && (to === 'COMPLETED' || to === 'CANCELLED')) return true;
  return false;
}

export function releasesSeats(from: string, to: string): boolean {
  return (from === 'PENDING' || from === 'CONFIRMED') && to === 'CANCELLED';
}
