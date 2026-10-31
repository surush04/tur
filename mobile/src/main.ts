import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { registerIcons } from './app/icons';
import { environment } from './environments/environment';

registerIcons();
console.log(`[API] apiUrl = ${environment.apiUrl}`);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
