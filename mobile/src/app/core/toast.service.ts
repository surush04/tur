import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal('');
  private timer = 0;

  show(text: string) {
    this.message.set(text);
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.message.set(''), 2200);
  }
}
