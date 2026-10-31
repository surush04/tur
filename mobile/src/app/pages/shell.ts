import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { AuthService } from '../core/auth.service';
import { TPipe } from '../core/i18n';

@Component({
  selector: 'app-splash',
  imports: [IonContent, TPipe],
  template: `
    <ion-content [fullscreen]="true">
      <section class="splash">
        <p class="tiny">{{ 'brand.name' | t }}</p>
        <h1 class="display">{{ 'brand.name' | t }}</h1>
        <p>{{ 'splash.line' | t }}</p>
      </section>
    </ion-content>
  `,
})
export class SplashPage {
  private readonly router = inject(Router);
  constructor() {
    window.setTimeout(() => {
      const seen = localStorage.getItem('rohi_onboarded') === '1';
      void this.router.navigateByUrl(seen ? '/tabs/home' : '/onboarding');
    }, 1400);
  }
}

@Component({
  selector: 'app-onboarding',
  imports: [IonContent, TPipe],
  template: `
    <ion-content [fullscreen]="true">
      <section class="onboard">
        <p class="tiny">{{ 'brand.name' | t }}</p>
        <h1 class="display">{{ 'home.discover' | t }}</h1>
        <p>{{ 'onb.1' | t }}</p>
        <p>{{ 'onb.2' | t }}</p>
        <p>{{ 'onb.3' | t }}</p>
        <button class="primary full" type="button" (click)="start()">{{ 'onb.start' | t }}</button>
        <button class="ghost full" type="button" (click)="start()">{{ 'onb.skip' | t }}</button>
      </section>
    </ion-content>
  `,
})
export class OnboardingPage {
  private readonly router = inject(Router);
  start() {
    localStorage.setItem('rohi_onboarded', '1');
    void this.router.navigateByUrl('/tabs/home');
  }
}

@Component({
  selector: 'app-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TPipe],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>{{ 'tabs.home' | t }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="reels" href="/tabs/reels">
          <ion-icon name="film-outline"></ion-icon>
          <ion-label>{{ 'tabs.reels' | t }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="explore" href="/tabs/explore">
          <ion-icon name="compass-outline"></ion-icon>
          <ion-label>{{ 'tabs.explore' | t }}</ion-label>
        </ion-tab-button>
        @if (auth.user()) {
          <ion-tab-button tab="groups" href="/tabs/groups">
            <ion-icon name="people-outline"></ion-icon>
            <ion-label>{{ 'tabs.groups' | t }}</ion-label>
          </ion-tab-button>
        }
        <ion-tab-button tab="favorites" href="/tabs/favorites">
          <ion-icon name="bookmark-outline"></ion-icon>
          <ion-label>{{ 'tabs.favorites' | t }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="profile" href="/tabs/profile">
          <ion-icon name="person-outline"></ion-icon>
          <ion-label>{{ 'tabs.profile' | t }}</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  readonly auth = inject(AuthService);
}
