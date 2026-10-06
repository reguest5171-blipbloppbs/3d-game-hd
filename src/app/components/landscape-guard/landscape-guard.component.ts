import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GameStateService } from '../../services/game-state.service';
import { AssetCacheService } from '../../services/asset-cache.service';
import { World3dService } from '../../game/world-3d.service';

@Component({
  selector: 'app-landscape-guard',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- 1. MANDATORY FULLSCREEN LANDSCAPE GUARD SCREEN (Zero CPU when active) -->
    @if (!isLandscapeAndFullscreen()) {
      <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 sm:p-8 bg-slate-950/98 text-white text-center select-none overflow-y-auto backdrop-blur-sm"
      >
        <!-- Top Section: Header Badge & Game Title -->
        <div class="flex flex-col items-center pt-2 sm:pt-4">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <mat-icon class="text-base animate-pulse">fullscreen</mat-icon>
            <span>Wajib Layar Penuh (Landscape Mode)</span>
          </div>

          <h1 class="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2">
            <span class="text-amber-400">Harvest Moon:</span> Whispering Tree 3D
          </h1>
          <p class="text-xs text-white/70 max-w-md mt-1">
            Pengalaman mobile RPG Tree of Tranquility 3D dengan virtual joystick dan kontrol presisi.
          </p>
        </div>

        <!-- Center Section: Device Rotation Animation & Status -->
        <div class="flex flex-col items-center my-4 max-w-lg w-full">
          <!-- Animated Device / Orientation Graphic -->
          <div class="relative w-24 h-24 mb-3 flex items-center justify-center">
            <div class="absolute inset-0 rounded-full bg-amber-500/10 animate-ping" style="animation-duration: 3s;"></div>
            <div class="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/30 to-emerald-500/30 border border-amber-400/40 flex items-center justify-center shadow-xl shadow-amber-950/50">
              <mat-icon class="text-4xl text-amber-300 animate-spin" style="animation-duration: 6s;">
                screen_rotation
              </mat-icon>
            </div>
          </div>

          <div class="text-sm font-bold text-amber-200 uppercase tracking-wide mb-1">
            Putar Perangkat ke Posisi Landscape
          </div>
          <div class="text-xs text-white/60 mb-5 max-w-sm">
            Game sepenuhnya dihentikan (<strong>0% CPU</strong>) saat di luar fullscreen landscape untuk menghemat baterai & memori.
          </div>

          <!-- ASSET DOWNLOAD & LOCAL CACHE PROGRESS PANEL -->
          <div class="w-full bg-slate-900/90 border border-white/10 rounded-2xl p-4 mb-4 text-left shadow-2xl">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <mat-icon class="text-emerald-400 text-sm">inventory_2</mat-icon>
                <span class="text-xs font-bold text-white uppercase tracking-wider">Status Memuat Aset Lokal</span>
              </div>
              <div class="flex items-center gap-1 text-xs font-black text-amber-400">
                <span>{{ assetCache.progress() }}%</span>
              </div>
            </div>

            <!-- Glowing Progress Bar -->
            <div class="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-white/10 p-0.5 mb-2">
              <div
                class="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-400 to-teal-300 transition-all duration-300 relative shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                [style.width.%]="assetCache.progress()"
              >
                <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>

            <!-- Stage & Details -->
            <div class="flex flex-col gap-1 text-[11px]">
              <div class="flex items-center justify-between text-white/90">
                <span class="font-medium text-amber-200">{{ assetCache.currentStage() }}</span>
                <span class="text-white/50 text-[10px]">{{ assetCache.itemStats().cached }} / {{ assetCache.itemStats().total }} Verifikasi</span>
              </div>
              <div class="text-white/50 truncate text-[10px]">
                {{ assetCache.detailText() }}
              </div>
            </div>

            <!-- Local Storage Permanence Badge -->
            <div class="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px]">
              <div class="flex items-center gap-1.5 text-emerald-300">
                <mat-icon class="text-xs">save</mat-icon>
                <span>Tersimpan di IndexedDB Lokal</span>
              </div>
              <span class="text-white/40">Tidak hilang saat reload web</span>
            </div>
          </div>

          <!-- Action Buttons Group -->
          <div class="flex flex-col sm:flex-row items-center gap-3 w-full">
            <!-- Fullscreen Button -->
            <button
              type="button"
              (click)="requestFullscreenAndLandscape()"
              class="w-full flex-1 py-3 px-5 rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 hover:brightness-110 transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
            >
              <mat-icon class="text-lg">fullscreen</mat-icon>
              <span>Masuk Fullscreen Landscape</span>
            </button>

            <!-- Copy Game URL Button -->
            <button
              type="button"
              (click)="copyGameUrl()"
              class="w-full sm:w-auto py-3 px-4 rounded-2xl border border-white/20 bg-slate-800/90 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 hover:bg-slate-700 transition-all cursor-pointer"
            >
              @if (isUrlCopied()) {
                <mat-icon class="text-emerald-400 text-base">check_circle</mat-icon>
                <span class="text-emerald-300 font-black">URL Tersalin!</span>
              } @else {
                <mat-icon class="text-amber-300 text-base">content_copy</mat-icon>
                <span>Salin URL Game</span>
              }
            </button>
          </div>
        </div>

        <!-- Footer Section -->
        <div class="flex flex-col items-center gap-1 pb-2">
          <div class="text-[10px] text-white/40">
            Aktifkan fitur Auto-Rotate / Kunci Rotasi ponsel Anda ke Landscape
          </div>
          <div class="text-[9px] text-white/25">
            Harvest Moon: Whispering Tree 3D · High Performance WebGL Edition
          </div>
        </div>
      </div>
    }

    <!-- 2. GAME ENTRY LOADING SPLASH SCREEN (Logo Memuat sebelum masuk game) -->
    @if (isLandscapeAndFullscreen() && (!assetCache.isLoaded() || gameState.isAppLoading())) {
      <div
        class="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 bg-slate-950 text-white text-center select-none transition-opacity duration-500"
      >
        <!-- Sprout / Whispering Tree Animated Icon -->
        <div class="relative w-28 h-28 mb-5 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style="animation-duration: 2.5s;"></div>
          <div class="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-b from-emerald-500/30 to-amber-500/20 border-2 border-emerald-400/50 flex items-center justify-center shadow-2xl shadow-emerald-950/80">
            <mat-icon class="text-5xl text-emerald-300 animate-bounce" style="animation-duration: 2s;">
              spa
            </mat-icon>
          </div>
        </div>

        <!-- Title & Subtitle -->
        <h2 class="text-2xl font-black tracking-wider text-white mb-1">
          <span class="text-amber-400">Harvest Moon:</span> Whispering Tree 3D
        </h2>
        <div class="text-xs font-semibold text-emerald-300/90 uppercase tracking-widest mb-6">
          Solaria Island · Memuat Dunia 3D
        </div>

        <!-- Mini Progress Bar inside Loading Splash -->
        <div class="w-64 max-w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10 p-0.5 mb-3">
          <div
            class="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-200"
            [style.width.%]="assetCache.progress()"
          ></div>
        </div>

        <div class="text-xs text-white/70 font-medium">
          {{ assetCache.currentStage() }}
        </div>
        <div class="text-[10px] text-white/40 mt-1">
          {{ assetCache.detailText() }}
        </div>
      </div>
    }
  `
})
export class LandscapeGuardComponent implements OnInit, OnDestroy {
  public gameState = inject(GameStateService);
  public assetCache = inject(AssetCacheService);
  private world3d = inject(World3dService);
  private platformId = inject(PLATFORM_ID);

  public isLandscapeAndFullscreen = signal<boolean>(false);
  public isUrlCopied = signal<boolean>(false);

  private copyTimeout: ReturnType<typeof setTimeout> | null = null;
  private resizeHandler = () => this.checkLandscapeAndFullscreenState();

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.assetCache.preloadAllAssets();
      this.checkLandscapeAndFullscreenState();

      document.addEventListener('fullscreenchange', this.resizeHandler);
      document.addEventListener('webkitfullscreenchange', this.resizeHandler);
      document.addEventListener('mozfullscreenchange', this.resizeHandler);
      window.addEventListener('resize', this.resizeHandler);
      window.addEventListener('orientationchange', this.resizeHandler);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('fullscreenchange', this.resizeHandler);
      document.removeEventListener('webkitfullscreenchange', this.resizeHandler);
      document.removeEventListener('mozfullscreenchange', this.resizeHandler);
      window.removeEventListener('resize', this.resizeHandler);
      window.removeEventListener('orientationchange', this.resizeHandler);
    }
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }

  @HostListener('window:resize')
  @HostListener('window:orientationchange')
  public checkLandscapeAndFullscreenState(): void {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isLandscape = width >= height;

    // Check if in fullscreen mode
    const doc = document as unknown as {
      fullscreenElement?: Element;
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
    };
    const isFullscreen = Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    // On mobile devices (width < 1024), we require both landscape orientation and ideally fullscreen.
    // On desktop browsers, landscape orientation is standard; entering fullscreen unlocks full immersion.
    const isMobile = width < 1024 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const valid = isMobile ? (isLandscape && (isFullscreen || height < 500)) : isLandscape;

    this.isLandscapeAndFullscreen.set(valid);
    this.gameState.isFullscreenLandscape.set(valid);

    if (valid) {
      // Resume 3D game loop
      if (this.assetCache.isLoaded()) {
        setTimeout(() => {
          this.gameState.isAppLoading.set(false);
          this.world3d.resumeLoop();
        }, 400);
      }
    } else {
      // IMMEDIATELY pause 3D loop for 0% CPU consumption
      this.world3d.pauseLoop();
    }
  }

  public requestFullscreenAndLandscape(): void {
    if (!isPlatformBrowser(this.platformId) || typeof document === 'undefined') return;

    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };

    const reqFullscreen =
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen;

    if (reqFullscreen && !document.fullscreenElement) {
      try {
        reqFullscreen.call(docEl).catch((err) => {
          console.debug('Fullscreen lock notice:', err);
        });
      } catch (err) {
        console.debug('Fullscreen call error:', err);
      }
    }

    const screenOrientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (screenOrientation && typeof screenOrientation.lock === 'function') {
      try {
        screenOrientation.lock('landscape').catch((err) => {
          console.debug('Orientation lock notice:', err);
        });
      } catch (err) {
        console.debug('Orientation lock error:', err);
      }
    }

    setTimeout(() => {
      this.checkLandscapeAndFullscreenState();
    }, 200);
  }

  public copyGameUrl(): void {
    if (typeof window === 'undefined') return;
    const url = window.location.href;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.triggerCopiedState();
      }).catch(() => {
        this.fallbackCopy(url);
      });
    } else {
      this.fallbackCopy(url);
    }
  }

  private fallbackCopy(text: string): void {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.triggerCopiedState();
    } catch (err) {
      console.debug('Copy fallback failed:', err);
    }
  }

  private triggerCopiedState(): void {
    this.isUrlCopied.set(true);
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    this.copyTimeout = setTimeout(() => {
      this.isUrlCopied.set(false);
    }, 3000);
  }
}
