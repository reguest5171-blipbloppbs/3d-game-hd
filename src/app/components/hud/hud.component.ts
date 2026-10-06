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

    <!-- PHOTO PREVIEW MODAL -->
    @if (photoPreviewUrl()) {
      <div class="fixed inset-0 z-55 bg-black/85 flex items-center justify-center pointer-events-auto p-4 select-none animate-in fade-in duration-200">
        <div class="w-full max-w-lg md:max-w-xl bg-neutral-900 border border-white/10 rounded-3xl p-4 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-300">
          <div class="flex justify-between items-center text-white border-b border-white/10 pb-2">
            <span class="text-xs font-black tracking-wider uppercase text-amber-300">Pratinjau Foto Anda</span>
            <button type="button" (click)="closePreview()" class="text-white/60 hover:text-white active:scale-90 transition-transform">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Beautiful framed image -->
          <div class="relative w-full aspect-[16/9] bg-black rounded-2xl overflow-hidden border border-white/10 shadow-inner">
            <img [src]="photoPreviewUrl()" class="w-full h-full object-cover" alt="Captured Solaria View">
          </div>

          <!-- Footer Action Buttons -->
          <div class="flex items-center justify-end gap-3 mt-1">
            <button
              type="button"
              (click)="downloadPreview()"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-400 bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-600 active:to-emerald-700 text-white text-xs font-black tracking-wide shadow-md active:scale-95 transition-transform"
            >
              <mat-icon>download</mat-icon>
              <span>SIMPAN KE GALERI</span>
            </button>

            <button
              type="button"
              (click)="closePreview()"
              class="px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 active:scale-95 text-xs font-bold transition-transform cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    }

    <!-- PHOTO MODE CONFIGURATION PANEL OVERLAY -->
    @if (gameState.isPhotoModeOpen()) {
      <div class="fixed inset-0 z-40 bg-black/10 flex flex-col justify-between pointer-events-auto select-none p-4 animate-in fade-in duration-300">
        <!-- TOP STATUS HEADER -->
        <div class="flex items-center justify-between w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-2.5 text-white">
          <div class="flex items-center gap-2">
            <mat-icon class="text-amber-400">photo_camera</mat-icon>
            <span class="text-xs font-black tracking-wider uppercase">Photo Mode (Free Camera)</span>
          </div>
          <span class="text-[10px] font-bold text-white/50 hidden sm:inline">Tekan lama tombol kamera untuk membuka pengaturan bebas ini</span>
        </div>

        <!-- RIGHT SIDE: QUICK PRESET ANGLES PANEL -->
        <div class="absolute right-4 top-20 flex flex-col gap-2 bg-black/40 border border-white/15 p-3 rounded-2xl max-w-[150px] shadow-lg animate-in slide-in-from-right duration-300">
          <span class="text-[9px] font-black tracking-wider text-amber-300 uppercase mb-1">Sudut Kamera</span>
          <button type="button" (click)="setPhotoPreset('default')" class="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 text-[10px] text-white font-bold text-left transition-all cursor-pointer">
            Fokus Karakter
          </button>
          <button type="button" (click)="setPhotoPreset('map')" class="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 text-[10px] text-white font-bold text-left transition-all cursor-pointer">
            Peta Penuh (Far)
          </button>
          <button type="button" (click)="setPhotoPreset('bridge')" class="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 text-[10px] text-white font-bold text-left transition-all cursor-pointer">
            Jembatan Ngarai
          </button>
          <button type="button" (click)="setPhotoPreset('house')" class="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 text-[10px] text-white font-bold text-left transition-all cursor-pointer">
            Rumah Kebun
          </button>
        </div>

        <!-- BOTTOM PANEL: CONTROLS & ADJUSTMENTS -->
        <div class="w-full bg-black/40 border border-white/15 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-2xl animate-in slide-in-from-bottom duration-300 mt-auto">
          <!-- ADJUSTMENT SLIDERS -->
          <div class="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-white">
            <!-- Focus Position X & Z -->
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-[10px] font-bold text-white/70">
                <span>Pan Barat/Timur (X)</span>
                <span class="text-amber-300 font-mono">{{ photoFocusX().toFixed(1) }}</span>
              </div>
              <input type="range" min="-30" max="30" step="0.5" [value]="photoFocusX()" (input)="onFocusXChange($event)" class="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500">
            </div>

            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-[10px] font-bold text-white/70">
                <span>Pan Utara/Selatan (Z)</span>
                <span class="text-amber-300 font-mono">{{ photoFocusZ().toFixed(1) }}</span>
              </div>
              <input type="range" min="-30" max="30" step="0.5" [value]="photoFocusZ()" (input)="onFocusZChange($event)" class="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500">
            </div>

            <!-- Zoom / Distance -->
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-[10px] font-bold text-white/70">
                <span>Tinggi Zoom (Out)</span>
                <span class="text-amber-300 font-mono">{{ photoDistance().toFixed(1) }}m</span>
              </div>
              <input type="range" min="3" max="50" step="0.5" [value]="photoDistance()" (input)="onDistanceChange($event)" class="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500">
            </div>

            <!-- Yaw & Pitch -->
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-[10px] font-bold text-white/70">
                <span>Rotasi Orbit (Yaw)</span>
                <span class="text-amber-300 font-mono">{{ photoYawDeg() }}°</span>
              </div>
              <input type="range" min="0" max="360" step="1" [value]="photoYawDeg()" (input)="onYawChange($event)" class="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500">
            </div>

            <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <div class="flex justify-between text-[10px] font-bold text-white/70">
                <span>Kemiringan (Pitch)</span>
                <span class="text-amber-300 font-mono">{{ photoPitchDeg() }}°</span>
              </div>
              <input type="range" min="5" max="88" step="1" [value]="photoPitchDeg()" (input)="onPitchChange($event)" class="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500">
            </div>
          </div>

          <!-- ACTIONS -->
          <div class="flex items-center gap-3 w-full md:w-auto justify-end border-t border-white/10 md:border-t-0 pt-3 md:pt-0 shrink-0">
            <!-- Capture Button -->
            <button
              type="button"
              (click)="capturePhoto()"
              class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-white text-xs font-black tracking-wide shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <mat-icon>photo_camera</mat-icon>
              <span>AMBIL FOTO</span>
            </button>

            <!-- Exit Button -->
            <button
              type="button"
              (click)="exitPhotoMode()"
              class="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white/90 active:bg-white/15 text-xs font-black tracking-wide shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <mat-icon class="text-sm">close</mat-icon>
              <span>KELUAR</span>
            </button>
          </div>
        </div>
      </div>
    }

    <div
      class="absolute inset-0 pointer-events-none select-none p-3 sm:p-4 flex flex-col justify-between transition-opacity duration-200"
      [style.opacity]="gameState.isPhotoModeOpen() ? 0 : gameState.hudOpacity()"
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
                <!-- Take Screenshot Button (Pointer down/up detect long-press) -->
                <button
                  type="button"
                  (pointerdown)="onBtnPointerDown()"
                  (pointerup)="onBtnPointerUp()"
                  (touchstart)="onBtnTouchStart()"
                  (touchend)="onBtnTouchEnd($event)"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-white text-xs font-black tracking-wide shadow-lg cursor-pointer transition-all active:scale-95 group focus:outline-none select-none"
                  title="Tekan untuk foto instan, TEKAN LAMA untuk Mode Kamera Bebas!"
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
  public photoPreviewUrl = signal<string | null>(null);

  // Getters/setters wrapping World3dService Photo Mode Properties
  public photoFocusX(): number {
    return this.world3d.photoFocus.x;
  }
  public photoFocusZ(): number {
    return this.world3d.photoFocus.z;
  }
  public photoDistance(): number {
    return this.world3d.photoDistance;
  }
  public photoYawDeg(): number {
    return Math.round((this.world3d.photoYaw * 180) / Math.PI);
  }
  public photoPitchDeg(): number {
    return Math.round((this.world3d.photoPitch * 180) / Math.PI);
  }

  public onFocusXChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.world3d.photoFocus.x = val;
  }
  public onFocusZChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.world3d.photoFocus.z = val;
  }
  public onDistanceChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.world3d.photoDistance = val;
  }
  public onYawChange(e: Event): void {
    const deg = parseFloat((e.target as HTMLInputElement).value);
    this.world3d.photoYaw = (deg * Math.PI) / 180;
  }
  public onPitchChange(e: Event): void {
    const deg = parseFloat((e.target as HTMLInputElement).value);
    this.world3d.photoPitch = (deg * Math.PI) / 180;
  }

  // Pointer/Touch Long-Press Event Detection for Photo Mode
  private longPressTimeout: ReturnType<typeof setTimeout> | null = null;
  private isLongPressActive = false;

  public onBtnPointerDown(): void {
    this.isLongPressActive = false;
    if (this.longPressTimeout) clearTimeout(this.longPressTimeout);
    this.longPressTimeout = setTimeout(() => {
      this.isLongPressActive = true;
      this.openPhotoMode();
    }, 450); // 450ms long press
  }

  public onBtnPointerUp(): void {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
    if (!this.isLongPressActive) {
      this.takeScreenshot();
    }
  }

  public onBtnTouchStart(): void {
    this.isLongPressActive = false;
    if (this.longPressTimeout) clearTimeout(this.longPressTimeout);
    this.longPressTimeout = setTimeout(() => {
      this.isLongPressActive = true;
      this.openPhotoMode();
    }, 450);
  }

  public onBtnTouchEnd(e: TouchEvent): void {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
    if (!this.isLongPressActive) {
      this.takeScreenshot();
    }
    e.preventDefault();
  }

  public openPhotoMode(): void {
    this.audio.playSelect();
    this.showScreenshotBtn.set(false);
    this.world3d.enterPhotoMode();
    this.gameState.isPhotoModeOpen.set(true);
    this.gameState.showToast('📸 Mode Kamera Bebas diaktifkan!');
  }

  public exitPhotoMode(): void {
    this.audio.playSelect();
    this.gameState.isPhotoModeOpen.set(false);
  }

  public setPhotoPreset(preset: 'default' | 'map' | 'bridge' | 'house'): void {
    this.audio.playSelect();
    if (preset === 'default') {
      this.world3d.enterPhotoMode();
    } else if (preset === 'map') {
      this.world3d.photoFocus.set(10.0, 0.0, 0.0);
      this.world3d.photoDistance = 45.0;
      this.world3d.photoYaw = 0.0;
      this.world3d.photoPitch = 1.45; // ~83° top-down
    } else if (preset === 'bridge') {
      this.world3d.photoFocus.set(19.5, 4.0, -12.5);
      this.world3d.photoDistance = 14.5;
      this.world3d.photoYaw = 0.8;
      this.world3d.photoPitch = 0.45;
    } else if (preset === 'house') {
      this.world3d.photoFocus.set(-1.0, 1.0, -4.5);
      this.world3d.photoDistance = 15.5;
      this.world3d.photoYaw = -0.7;
      this.world3d.photoPitch = 0.50;
    }
  }

  public capturePhoto(): void {
    this.audio.playCamera();
    this.isFlashing.set(true);
    setTimeout(() => {
      this.isFlashing.set(false);
    }, 250);

    const url = this.world3d.captureScreenshot();
    if (url) {
      this.photoPreviewUrl.set(url);
    } else {
      this.gameState.showToast('Gagal mengambil foto.');
    }
  }

  public closePreview(): void {
    this.audio.playSelect();
    this.photoPreviewUrl.set(null);
  }

  public downloadPreview(): void {
    const url = this.photoPreviewUrl();
    if (!url) return;
    try {
      const link = document.createElement('a');
      const filename = `Solaria_Photo_${Date.now()}.png`;
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.gameState.showToast('📸 Foto berhasil disimpan ke galeri!');
      this.closePreview();
    } catch (err) {
      console.error('Download photo failed', err);
      this.gameState.showToast('Foto berhasil ditangkap!');
    }
  }

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

  // Dev Map Editor Methods
  public Math = Math;
  private isEditorMouseDown = false;

  public onEditorPointerDown(e: PointerEvent): void {
    this.isEditorMouseDown = true;
    this.sendRaycastToService(e);
  }

  public onEditorPointerMove(e: PointerEvent): void {
    this.sendRaycastToService(e);
  }

  public onEditorPointerUp(e: PointerEvent): void {
    this.isEditorMouseDown = false;
    this.sendRaycastToService(e);
  }

  private sendRaycastToService(e: PointerEvent): void {
    if (typeof window === 'undefined') return;
    const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    this.world3d.updateEditorRaycast(mouseX, mouseY, this.isEditorMouseDown);
  }

  public setEditorTool(tool: 'sculpt_raise' | 'sculpt_lower' | 'place_prop' | 'delete_prop'): void {
    this.audio.playSelect();
    this.gameState.devEditorTool.set(tool);
  }

  public setEditorProp(prop: string): void {
    this.audio.playSelect();
    this.gameState.devSelectedProp.set(prop);
  }

  public onBrushRadiusChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.gameState.devBrushRadius.set(val);
  }

  public onBrushStrengthChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.gameState.devBrushStrength.set(val);
  }

  public closeDevEditor(): void {
    this.audio.playSelect();
    this.gameState.isDevEditorOpen.set(false);
  }

  public exportMap(): void {
    this.world3d.exportMapData();
  }

  public onFileImport(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.world3d.importMapData(reader.result);
      }
    };
    reader.readAsText(file);
  }
}
