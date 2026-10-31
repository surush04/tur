import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { IonContent } from '@ionic/angular';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { ApiService } from '../core/api.service';
import { TPipe } from '../core/i18n';
import { BackButton, Photo } from '../ui';

interface MapPoint {
  id: string;
  slug: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  kind: string;
  coverImageUrl?: string | null;
  region?: string;
}

@Component({
  selector: 'app-map',
  imports: [IonContent, RouterLink, TPipe, BackButton, Photo],
  template: `
    <ion-content>
      <div class="page stack">
        <div class="spread">
          <app-back [label]="'common.back' | t"></app-back>
          <h1>{{ 'map.title' | t }}</h1>
          <button class="chip" type="button" (click)="mode.set(mode() === 'map' ? 'list' : 'map')">{{ mode() === 'map' ? ('map.list' | t) : ('map.map' | t) }}</button>
        </div>
        <p class="warn">{{ 'map.note' | t }}</p>
        @if (denied()) { <p class="error-box">{{ 'map.denied' | t }}</p> }
        <button class="ghost" type="button" (click)="locate()">{{ 'map.locate' | t }}</button>
        @if (mode() === 'map') { <div class="map-frame" #frame></div> }
        @if (selected(); as point) {
          <a class="tour-card" [routerLink]="point.kind === 'accommodation' ? ['/tabs/stay', point.slug] : point.kind === 'tour' ? ['/tabs/tour', point.slug] : ['/tabs/destination', point.slug]">
            <div class="media"><app-photo [src]="point.coverImageUrl" [alt]="point.name"></app-photo></div>
            <div class="body">
              <h3>{{ point.name }}</h3>
              <p class="muted">{{ point.region }}</p>
              <button class="text-btn" type="button" (click)="navigate($event, point)">{{ 'map.navigate' | t }}</button>
            </div>
          </a>
        }
        @if (mode() === 'list') {
          @for (point of points(); track point.id) {
            <button class="soft-card" type="button" (click)="selected.set(point)"><div class="body"><h3>{{ point.name }}</h3><p class="muted">{{ point.kind }}</p></div></button>
          }
        }
      </div>
    </ion-content>
  `,
})
export class MapPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly mode = signal<'map' | 'list'>('map');
  readonly denied = signal(false);
  readonly points = signal<MapPoint[]>([]);
  readonly selected = signal<MapPoint | null>(null);
  private readonly frame = viewChild<ElementRef<HTMLDivElement>>('frame');
  private map?: L.Map;
  private userLayer?: L.CircleMarker;

  ngAfterViewInit() {
    this.api.mapPoints().subscribe((data) => {
      const points = [...data.destinations, ...data.tours, ...data.accommodations].filter((point) => point.latitude && point.longitude) as MapPoint[];
      this.points.set(points);
      this.draw(points);
      const focus = this.route.snapshot.queryParamMap.get('focus');
      const match = points.find((point) => point.slug === focus);
      if (match) this.focus(match);
    });
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private draw(points: MapPoint[]) {
    const element = this.frame()?.nativeElement;
    if (!element || this.map) return;
    this.map = L.map(element, { zoomControl: false }).setView([38.8, 70.8], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    const cluster = L.markerClusterGroup();
    for (const point of points) {
      const marker = L.marker([Number(point.latitude), Number(point.longitude)], {
        icon: L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [18, 18] }),
      });
      marker.on('click', () => this.focus(point));
      cluster.addLayer(marker);
    }
    this.map.addLayer(cluster);
    window.setTimeout(() => this.map?.invalidateSize(), 200);
  }

  focus(point: MapPoint) {
    this.selected.set(point);
    if (point.latitude && point.longitude) this.map?.setView([Number(point.latitude), Number(point.longitude)], 9);
  }

  async locate() {
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 });
      this.denied.set(false);
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      this.userLayer?.remove();
      if (this.map) {
        this.userLayer = L.circleMarker([lat, lng], { radius: 8, color: '#174B3A', fillColor: '#DCC9A3', fillOpacity: 1 }).addTo(this.map);
        this.map.setView([lat, lng], 10);
      }
    } catch {
      this.denied.set(true);
    }
  }

  navigate(event: Event, point: MapPoint) {
    event.preventDefault();
    event.stopPropagation();
    if (!point.latitude || !point.longitude) return;
    const url = `https://www.openstreetmap.org/directions?to=${point.latitude}%2C${point.longitude}`;
    window.open(url, '_blank', 'noopener');
  }
}
