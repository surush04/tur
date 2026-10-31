import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
      @if (toast.message()) { <div class="toast" role="status">{{ toast.message() }}</div> }
    </ion-app>
  `,
})
export class App {
  readonly toast = inject(ToastService);
}
