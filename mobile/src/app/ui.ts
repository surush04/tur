import { Component, computed, effect, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { apiOrigin } from '../environments/environment';

@Component({
  selector: 'app-photo',
  template: `
    <div class="photo">
      @if (resolved() && !failed()) {
        <img [src]="resolved()" [alt]="alt()" (error)="failed.set(true)" />
      } @else {
        <div class="photo-fallback" role="img" [attr.aria-label]="alt()"></div>
      }
    </div>
  `,
})
export class Photo {
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  readonly failed = signal(false);
  readonly resolved = computed(() => {
    const value = this.src();
    if (!value) return null;
    return value.startsWith('/') ? `${apiOrigin()}${value}` : value;
  });

  constructor() {
    effect(() => {
      this.src();
      this.failed.set(false);
    });
  }
}

@Component({
  selector: 'app-back',
  imports: [IonIcon],
  template: `<button class="icon-btn plain" type="button" (click)="location.back()" [attr.aria-label]="label()"><ion-icon name="chevron-back"></ion-icon></button>`,
})
export class BackButton {
  readonly label = input('Back');
  readonly location = inject(Location);
}
