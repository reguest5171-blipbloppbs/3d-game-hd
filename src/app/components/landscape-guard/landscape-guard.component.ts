import { ChangeDetectionStrategy, Component, HostListener, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-landscape-guard',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- PORTRAIT ORIENTATION ENFORCER -->
    @if (isPortrait()) {
      <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950/95 text-white text-center select-none"
      >
        <!-- Rotating device icon animation -->
        <div class="relative w-20 h-20 mb-4 flex items-center justify-center">
          <mat-icon class="text-6xl text-amber-300 animate-spin" style="animation-duration: 4s;">
            screen_rotation
          </mat-icon>
        </div>

        <h1 class="text-xl font-black text-amber-300 uppercase tracking-wider mb-2">
          Putar ke Mode Landscape
        </h1>

        <p class="text-xs sm:text-sm text-white/80 max-w-sm mb-6 leading-relaxed">
          Game <strong>Harvest Moon: Whispering Tree 3D</strong> dibuat khusus untuk mobile web dalam orientasi <strong>Landscape</strong> dengan virtual joystick dan sudut kamera Tree of Tranquility.
        </p>

        <button
          (click)="requestFullscreenAndLandscape()"
          class="px-5 py-3 rounded-2xl border border-amber-400 bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wide flex items-center gap-2 active:scale-95 transition-transform shadow-lg"
        >
          <mat-icon class="text-lg">fullscreen</mat-icon>
          <span>Layar Penuh (Fullscreen)</span>
        </button>

        <div class="text-[10px] text-white/50 mt-4">
          (Bila menggunakan browser ponsel, pastikan auto-rotate di ponsel aktif)
        </div>
      </div>
    }
  `
})
export class LandscapeGuardComponent implements OnInit {
  public isPortrait = signal<boolean>(false);

  ngOnInit(): void {
    this.checkOrientation();
  }

  @HostListener('window:resize')
  @HostListener('window:orientationchange')
  public checkOrientation(): void {
    if (typeof window === 'undefined') return;
    const isPort = window.innerHeight > window.innerWidth && window.innerWidth < 768;
    this.isPortrait.set(isPort);
  }

  public requestFullscreenAndLandscape(): void {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.debug('Fullscreen lock error:', err);
      });
    }
    const screenOrientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (screenOrientation && typeof screenOrientation.lock === 'function') {
      screenOrientation.lock('landscape').catch((err) => {
        console.debug('Orientation lock error:', err);
      });
    }
  }
}
