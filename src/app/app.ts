import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { World3dService } from './game/world-3d.service';
import { GameStateService } from './services/game-state.service';
import { VirtualJoystickComponent } from './components/virtual-joystick/virtual-joystick.component';
import { ActionButtonComponent } from './components/action-button/action-button.component';
import { HudComponent } from './components/hud/hud.component';
import { DialogueComponent } from './components/dialogue/dialogue.component';
import { ShopModalComponent } from './components/shop-modal/shop-modal.component';
import { InventoryModalComponent } from './components/inventory-modal/inventory-modal.component';
import { SleepModalComponent } from './components/sleep-modal/sleep-modal.component';
import { LandscapeGuardComponent } from './components/landscape-guard/landscape-guard.component';
import { MapModalComponent } from './components/map-modal/map-modal.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { PerfModalComponent } from './components/perf-modal/perf-modal.component';
import { ToolModalComponent } from './components/tool-modal/tool-modal.component';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    MatIconModule,
    HudComponent,
    VirtualJoystickComponent,
    ActionButtonComponent,
    DialogueComponent,
    ShopModalComponent,
    InventoryModalComponent,
    SleepModalComponent,
    LandscapeGuardComponent,
    MapModalComponent,
    SettingsModalComponent,
    PerfModalComponent,
    ToolModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('viewport', { static: true }) viewportRef!: ElementRef<HTMLDivElement>;

  public gameState = inject(GameStateService);
  private world3d = inject(World3dService);
  private platformId = inject(PLATFORM_ID);

  public isLoaded = signal<boolean>(false);
  public showGuide = signal<boolean>(true);

  private currentRenderedArea = '';

  constructor() {
    // Effect to update 3D area when gameState.currentArea changes
    effect(() => {
      const area = this.gameState.currentArea();
      if (this.isLoaded() && area !== this.currentRenderedArea) {
        this.currentRenderedArea = area;
        this.world3d.buildCurrentArea(area);
      }
    });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Initialize Three.js WebGL Engine
      this.world3d.init(this.viewportRef.nativeElement);
      this.currentRenderedArea = this.gameState.currentArea();
      this.isLoaded.set(true);

      // Dismiss initial tutorial after 6s or tap
      setTimeout(() => {
        this.showGuide.set(false);
      }, 7000);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.world3d.destroy();
    }
  }

  public dismissGuide(): void {
    this.showGuide.set(false);
  }
}
