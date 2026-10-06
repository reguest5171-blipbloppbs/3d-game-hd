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
import { AssetCacheService } from './services/asset-cache.service';
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
import { DevEditorComponent } from './components/dev-editor/dev-editor.component';

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
    ToolModalComponent,
    DevEditorComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('viewport', { static: true }) viewportRef!: ElementRef<HTMLDivElement>;

  public gameState = inject(GameStateService);
  public assetCache = inject(AssetCacheService);
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

    // Effect to pause/resume 3D loop when fullscreen landscape state changes
    effect(() => {
      const isFsLand = this.gameState.isFullscreenLandscape();
      if (this.isLoaded()) {
        if (isFsLand) {
          this.world3d.resumeLoop();
        } else {
          this.world3d.pauseLoop();
        }
      }
    });

    // Effect to toggle the developer grid visibility
    effect(() => {
      const isGridVisible = this.gameState.isDevGridVisible();
      const isEditorOpen = this.gameState.isDevEditorOpen();
      if (this.isLoaded()) {
        this.world3d.toggleDevGrid(isEditorOpen && isGridVisible);
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      // 1. Preload local assets with progress tracking
      await this.assetCache.preloadAllAssets();

      // 2. Initialize Three.js WebGL Engine
      this.world3d.init(this.viewportRef.nativeElement);
      this.currentRenderedArea = this.gameState.currentArea();
      this.isLoaded.set(true);

      // 3. If not in fullscreen landscape yet, stay at 0% CPU
      if (!this.gameState.isFullscreenLandscape()) {
        this.world3d.pauseLoop();
      } else {
        this.gameState.isAppLoading.set(false);
      }

      // Dismiss initial tutorial after 7s
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

  // =========================================================================
  // VIEWPORT POINTER EVENTS FOR DEV MAP EDITOR
  // =========================================================================
  private isPointerDown = false;

  public onViewportPointerDown(event: PointerEvent): void {
    if (!this.gameState.isDevEditorOpen()) return;
    this.isPointerDown = true;
    this.handleViewportPointer(event, true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  public onViewportPointerMove(event: PointerEvent): void {
    if (!this.gameState.isDevEditorOpen()) return;
    this.handleViewportPointer(event, this.isPointerDown);
  }

  public onViewportPointerUp(event: PointerEvent): void {
    if (!this.gameState.isDevEditorOpen()) return;
    this.isPointerDown = false;
    this.handleViewportPointer(event, false);
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  }

  public onViewportPointerLeave(event: PointerEvent): void {
    if (!this.gameState.isDevEditorOpen()) return;
    this.isPointerDown = false;
    this.handleViewportPointer(event, false);
  }

  private handleViewportPointer(event: PointerEvent, isDown: boolean): void {
    const rect = this.viewportRef.nativeElement.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.world3d.updateEditorRaycast(mouseX, mouseY, isDown);
  }
}
