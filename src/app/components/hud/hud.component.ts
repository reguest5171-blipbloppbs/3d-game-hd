import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GameStateService } from '../../services/game-state.service';
import { World3dService } from '../../game/world-3d.service';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-hud',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Camera Flash Effect Overlay -->
    @if (isFlashing()) {
      <div class="fixed inset-0 z-50 bg-white pointer-events-none transition-opacity duration-300 opacity-90 animate-out fade-out"></div>
    }

    <div
      class="absolute inset-0 pointer-events-none select-none p-3 sm:p-4 flex flex-col justify-between transition-opacity duration-200"
      [style.opacity]="gameState.hudOpacity()"
    >
      <!-- TOP BAR -->
      <div class="flex items-start justify-between w-full">
        <!-- TOP LEFT: Clock, Season & Weather (Swipeable/Slidable) + Floating Performance Text -->
        <div class="flex flex-col gap-0.5 pointer-events-auto">
          <div class="flex items-center gap-1.5 flex-wrap">
            <!-- Time & Season Card (Geser / Swipe / Ketuk untuk menampilkan tombol screenshot) -->
            <button
              type="button"
              class="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/25 bg-black/40 text-white shadow-sm cursor-pointer select-none transition-transform duration-200 active:scale-98 hover:border-amber-300/40 text-left focus:outline-none"
              (touchstart)="onTouchStart($event)"
              (touchend)="onTouchEnd($event)"
              (pointerdown)="onPointerDown($event)"
              (pointerup)="onPointerUp($event)"
              (click)="toggleScreenshotTray()"
              (keydown.enter)="toggleScreenshotTray()"
              (keydown.space)="toggleScreenshotTray()"
              title="Geser atau ketuk kontainer waktu untuk memunculkan tombol Screenshot"
            >
              <span class="text-sm font-black text-amber-300 tracking-wide">
                {{ gameState.season() }} {{ gameState.day() }}
              </span>
              <span class="text-white/40">|</span>
              <div class="flex items-center gap-1 text-xs font-semibold tabular-nums text-white/90">
                <mat-icon class="text-base text-yellow-300">
                  {{ gameState.weather() === 'Sunny' ? 'wb_sunny' : 'water_drop' }}
                </mat-icon>
                <span>{{ gameState.timeFormatted() }}</span>
              </div>

              <!-- Indicator icon for slide reveal -->
              <div class="flex items-center justify-center pl-0.5 text-amber-300/80">
                <mat-icon
                  class="text-sm transition-transform duration-300"
                  [class.rotate-180]="showScreenshotBtn()"
                >
                  {{ showScreenshotBtn() ? 'chevron_left' : 'chevron_right' }}
                </mat-icon>
              </div>
            </button>

            <!-- SLIDE-OUT SCREENSHOT BUTTON TRAY -->
            @if (showScreenshotBtn()) {
              <div
                class="flex items-center gap-1.5 transition-all duration-300 transform scale-100"
              >
                <!-- Take Screenshot Button -->
                <button
                  type="button"
                  (click)="takeScreenshot($event)"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-white text-xs font-black tracking-wide shadow-lg cursor-pointer transition-transform active:scale-95 group focus:outline-none"
                  title="Ambil foto pemandangan 3D Pulau Solaria"
                >
                  <mat-icon class="text-base text-white group-hover:scale-110 transition-transform">photo_camera</mat-icon>
                  <span>Screenshot</span>
                </button>

                <!-- Close / Retract Button -->
                <button
                  type="button"
                  (click)="closeScreenshotTray($event)"
                  class="w-7 h-7 rounded-full border border-white/25 bg-black/40 hover:bg-black/60 active:scale-90 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm focus:outline-none"
                  title="Tutup tombol screenshot"
                >
                  <mat-icon class="text-xs">close</mat-icon>
                </button>
              </div>
            }
          </div>

          <!-- FLOATING PERFORMANCE TEXT (NO CONTAINER) BELOW TIME INFO -->
          <button
            type="button"
            (click)="openPerfModal()"
            class="text-[11px] font-mono font-bold tracking-tight text-emerald-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] hover:text-emerald-300 active:scale-95 transition-all text-left select-none cursor-pointer pl-1 mt-0.5"
            title="Ketuk untuk melihat statistik performa & info perangkat"
          >
            {{ gameState.fps() }} FPS · {{ gameState.drawCalls() }} Calls
          </button>
        </div>

        <!-- TOP CENTER: Notification Toast -->
        <div class="flex-1 flex justify-center px-4">
          @if (gameState.toastMessage()) {
            <div
              class="px-4 py-1.5 rounded-full border border-amber-300/40 bg-black/50 text-amber-200 text-xs font-bold tracking-tight shadow-md animate-bounce pointer-events-auto"
            >
              {{ gameState.toastMessage() }}
            </div>
          }
        </div>

        <!-- TOP RIGHT: Location & Coordinates Info (Swipe/Tap -> Switch Mode, Map Icon -> Big Map), Bag & Stamina -->
        <div class="flex flex-col items-end gap-1.5 pointer-events-auto">
          <div class="flex items-center gap-2">
            <!-- INTEGRATED LOCATION / COORDINATES & BIG MAP CONTAINER -->
            <div
              class="flex items-center rounded-2xl border border-emerald-400/40 bg-black/40 shadow-sm overflow-hidden select-none transition-all duration-200 hover:border-emerald-300/60"
            >
              <!-- Location / Coordinate Display & Switcher Button (Swipe or Tap to switch) -->
              <button
                type="button"
                (click)="toggleLocationMode($event)"
                (touchstart)="onLocTouchStart($event)"
                (touchend)="onLocTouchEnd($event)"
                (pointerdown)="onLocPointerDown($event)"
                (pointerup)="onLocPointerUp($event)"
                class="px-3 py-1 text-white text-xs font-bold tracking-tight flex items-center gap-1.5 cursor-pointer active:bg-emerald-950/60 transition-all group focus:outline-none"
                [title]="showCoords() ? 'Mode Koordinat 3D (Geser/Ketuk untuk Nama Lokasi)' : 'Mode Nama Lokasi (Geser/Ketuk untuk Koordinat 3D)'"
              >
                <mat-icon class="text-sm text-emerald-400 group-hover:scale-110 transition-transform">
                  {{ showCoords() ? 'my_location' : 'place' }}
                </mat-icon>

                <div class="flex items-center justify-center min-w-[140px] text-center">
                  @if (!showCoords()) {
                    <span class="animate-in fade-in duration-200 text-white/95">
                      {{ gameState.areaName() }}
                    </span>
                  } @else {
                    <span class="animate-in fade-in duration-200 text-amber-300 font-mono text-[11px] font-extrabold tabular-nums">
                      {{ formattedCoords() }}
                    </span>
                  }
                </div>

                <!-- Swap / Switch Mode Indicator -->
                <mat-icon class="text-xs text-white/40 group-hover:text-amber-300 transition-colors ml-0.5">
                  swap_horiz
                </mat-icon>
              </button>

              <!-- Big Map Modal Trigger Button -->
              <button
                type="button"
                (click)="openMap()"
                class="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 active:bg-amber-500/60 text-amber-300 border-l border-white/20 flex items-center justify-center transition-colors cursor-pointer focus:outline-none group/map"
                title="Buka Peta Besar Pulau Solaria & Pengaturan"
              >
                <mat-icon class="text-xs group-hover/map:scale-110 transition-transform">map</mat-icon>
              </button>
            </div>

            <!-- Bag / Rucksack Button -->
            <button
              type="button"
              (click)="openInventory()"
              class="w-8 h-8 rounded-full border border-white/25 bg-black/35 active:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95 shadow-sm focus:outline-none"
              title="Buka Tas (Bag)"
            >
              <mat-icon class="text-base text-amber-200">backpack</mat-icon>
            </button>
          </div>

          <!-- Stamina Gauge -->
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl border border-red-400/30 bg-black/35 text-white shadow-sm">
            <mat-icon class="text-sm text-red-400">favorite</mat-icon>
            <div class="w-16 h-2 rounded-full bg-black/50 border border-white/10 overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-red-500 to-emerald-400 rounded-full transition-all duration-300"
                [style.width.%]="staminaPercent()"
              ></div>
            </div>
            <span class="text-[9px] font-bold tabular-nums text-white/80">
              {{ gameState.stamina() }}
            </span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class HudComponent {
  public gameState = inject(GameStateService);
  private world3d = inject(World3dService);
  private audio = inject(AudioService);

  public showScreenshotBtn = signal<boolean>(false);
  public isFlashing = signal<boolean>(false);
  public showCoords = signal<boolean>(false);

  public formattedCoords = computed(() => {
    const c = this.gameState.playerCoords();
    return `X:${c.x.toFixed(1)}, Y:${c.y.toFixed(1)}, Z:${c.z.toFixed(1)}`;
  });

  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;

  private locStartX = 0;
  private locStartY = 0;
  private locStartTime = 0;
  private isLocSwiping = false;

  public staminaPercent(): number {
    return (this.gameState.stamina() / this.gameState.maxStamina()) * 100;
  }

  public openMap(): void {
    this.gameState.isMapOpen.set(true);
  }

  public openInventory(): void {
    this.gameState.isInventoryOpen.set(true);
  }

  public openPerfModal(): void {
    this.gameState.isPerfModalOpen.set(true);
  }

  // Touch Swipe Gesture Detection for Time Container
  public onTouchStart(e: TouchEvent): void {
    if (e.touches && e.touches.length > 0) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchStartTime = Date.now();
    }
  }

  public onTouchEnd(e: TouchEvent): void {
    if (e.changedTouches && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - this.touchStartX;
      const deltaY = e.changedTouches[0].clientY - this.touchStartY;
      const duration = Date.now() - this.touchStartTime;

      // Detect horizontal swipe (at least 20px horizontal and more than vertical)
      if (Math.abs(deltaX) > 20 && Math.abs(deltaX) > Math.abs(deltaY) && duration < 600) {
        if (deltaX > 0) {
          // Swiped right -> open screenshot button
          this.showScreenshotBtn.set(true);
          this.audio.playSelect();
        } else {
          // Swiped left -> close screenshot button
          this.showScreenshotBtn.set(false);
          this.audio.playSelect();
        }
      }
    }
  }

  // Pointer swipe support (for mouse/stylus dragging)
  public onPointerDown(e: PointerEvent): void {
    this.touchStartX = e.clientX;
    this.touchStartY = e.clientY;
    this.touchStartTime = Date.now();
  }

  public onPointerUp(e: PointerEvent): void {
    const deltaX = e.clientX - this.touchStartX;
    const deltaY = e.clientY - this.touchStartY;
    const duration = Date.now() - this.touchStartTime;

    if (Math.abs(deltaX) > 25 && Math.abs(deltaX) > Math.abs(deltaY) && duration < 600) {
      if (deltaX > 0) {
        this.showScreenshotBtn.set(true);
        this.audio.playSelect();
      } else {
        this.showScreenshotBtn.set(false);
        this.audio.playSelect();
      }
    }
  }

  public toggleScreenshotTray(): void {
    this.showScreenshotBtn.update(v => !v);
    this.audio.playSelect();
  }

  public closeScreenshotTray(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showScreenshotBtn.set(false);
    this.audio.playSelect();
  }

  public takeScreenshot(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    // Play camera shutter sound
    this.audio.playCamera();

    // Trigger visual camera shutter flash
    this.isFlashing.set(true);
    setTimeout(() => {
      this.isFlashing.set(false);
    }, 250);

    // Capture 3D Canvas
    const dataUrl = this.world3d.captureScreenshot();
    if (dataUrl) {
      try {
        const link = document.createElement('a');
        const filename = `Solaria_${this.gameState.season()}_Day${this.gameState.day()}_${Date.now()}.png`;
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.gameState.showToast('📸 Foto pemandangan berhasil disimpan!');
      } catch (err) {
        console.error('Download screenshot failed', err);
        this.gameState.showToast('📸 Foto berhasil diambil!');
      }
    } else {
      this.gameState.showToast('Gagal mengambil screenshot.');
    }
  }

  // Location / Coordinates Switching Gesture Detection
  public onLocTouchStart(e: TouchEvent): void {
    if (e.touches && e.touches.length > 0) {
      this.locStartX = e.touches[0].clientX;
      this.locStartY = e.touches[0].clientY;
      this.locStartTime = Date.now();
    }
  }

  public onLocTouchEnd(e: TouchEvent): void {
    if (e.changedTouches && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - this.locStartX;
      const deltaY = e.changedTouches[0].clientY - this.locStartY;
      const duration = Date.now() - this.locStartTime;

      if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) && duration < 600) {
        this.isLocSwiping = true;
        this.toggleLocationMode();
        setTimeout(() => { this.isLocSwiping = false; }, 200);
      }
    }
  }

  public onLocPointerDown(e: PointerEvent): void {
    this.locStartX = e.clientX;
    this.locStartY = e.clientY;
    this.locStartTime = Date.now();
  }

  public onLocPointerUp(e: PointerEvent): void {
    const deltaX = e.clientX - this.locStartX;
    const deltaY = e.clientY - this.locStartY;
    const duration = Date.now() - this.locStartTime;

    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) && duration < 600) {
      this.isLocSwiping = true;
      this.toggleLocationMode();
      setTimeout(() => { this.isLocSwiping = false; }, 200);
    }
  }

  public toggleLocationMode(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isLocSwiping) return;
    this.showCoords.update(v => !v);
    this.audio.playSelect();
  }
}
