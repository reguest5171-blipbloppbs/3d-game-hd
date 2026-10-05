import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-perf-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gameState.isPerfModalOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none animate-in fade-in duration-150"
      >
        <!-- Backdrop button -->
        <button
          type="button"
          aria-label="Tutup latar belakang"
          (click)="close()"
          class="absolute inset-0 bg-black/80 cursor-default"
        ></button>

        <!-- Modal Container (Transparent without blur) -->
        <div
          role="dialog"
          aria-modal="true"
          class="relative w-full max-w-xl rounded-3xl border-2 border-emerald-400/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto z-10"
        >
          <!-- Sticky Header -->
          <div class="sticky top-0 z-20 flex items-center justify-between border-b border-white/20 pb-2.5 bg-neutral-950/95 -mt-1 pt-1">
            <div class="flex items-center gap-2">
              <mat-icon class="text-emerald-400 text-xl">speed</mat-icon>
              <div>
                <h2 class="text-sm sm:text-base font-black text-emerald-300 uppercase tracking-wide leading-tight">
                  Statistik Performa & Perangkat
                </h2>
                <div class="text-[10px] text-white/70">
                  Harvest Moon: Whispering Tree 3D · Low-End Engine Diagnostics
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- Live FPS indicator badge -->
              <div
                class="px-2.5 py-0.5 rounded-full border text-[10px] font-black tracking-tight"
                [class.border-emerald-400]="gameState.fps() >= 50"
                [class.bg-emerald-950/60]="gameState.fps() >= 50"
                [class.text-emerald-300]="gameState.fps() >= 50"
                [class.border-amber-400]="gameState.fps() < 50 && gameState.fps() >= 30"
                [class.bg-amber-950/60]="gameState.fps() < 50 && gameState.fps() >= 30"
                [class.text-amber-300]="gameState.fps() < 50 && gameState.fps() >= 30"
                [class.border-rose-400]="gameState.fps() < 30"
                [class.bg-rose-950/60]="gameState.fps() < 30"
                [class.text-rose-300]="gameState.fps() < 30"
              >
                ● {{ gameState.fps() }} FPS
              </div>

              <!-- Close button -->
              <button
                (click)="close()"
                type="button"
                class="px-2.5 py-1 rounded-full border border-white/30 bg-white/10 hover:bg-white/25 active:bg-emerald-500/40 text-white flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
                title="Tutup Diagnostik"
              >
                <mat-icon class="text-sm">close</mat-icon>
                <span>Tutup</span>
              </button>
            </div>
          </div>

          <!-- Section 1: Real-time Rendering Metrics -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div class="p-2.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col">
              <span class="text-[10px] text-white/60 uppercase font-bold">Framerate</span>
              <span class="text-lg font-black text-emerald-400 tabular-nums">
                {{ gameState.fps() }} <span class="text-xs font-normal">FPS</span>
              </span>
              <span class="text-[9px] text-white/50">Delta: {{ gameState.frameTimeMs() }} ms</span>
            </div>

            <div class="p-2.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col">
              <span class="text-[10px] text-white/60 uppercase font-bold">Draw Calls</span>
              <span class="text-lg font-black text-sky-400 tabular-nums">
                {{ gameState.drawCalls() }}
              </span>
              <span class="text-[9px] text-white/50">Dioptimasi < 45</span>
            </div>

            <div class="p-2.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col">
              <span class="text-[10px] text-white/60 uppercase font-bold">Triangles</span>
              <span class="text-lg font-black text-amber-300 tabular-nums">
                {{ gameState.triangles() | number }}
              </span>
              <span class="text-[9px] text-white/50">Poligon Rendah</span>
            </div>

            <div class="p-2.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col">
              <span class="text-[10px] text-white/60 uppercase font-bold">VRAM Objects</span>
              <span class="text-lg font-black text-purple-300 tabular-nums">
                {{ gameState.geometriesCount() }} Geo
              </span>
              <span class="text-[9px] text-white/50">{{ gameState.texturesCount() }} Tekstur</span>
            </div>
          </div>

          <!-- Section 2: Info Hardware & Perangkat -->
          <div class="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2">
            <div class="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <mat-icon class="text-base text-amber-400">devices</mat-icon>
              <span>Informasi Perangkat & Layar</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">GPU / Renderer:</span>
                <span class="font-bold text-white text-right max-w-[200px] truncate" [title]="gameState.gpuInfo()">
                  {{ gameState.gpuInfo() }}
                </span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Resolusi Layar:</span>
                <span class="font-bold text-white">{{ getScreenRes() }}</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Ukuran Viewport:</span>
                <span class="font-bold text-white">{{ getViewportRes() }}</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Device Pixel Ratio:</span>
                <span class="font-bold text-emerald-300">{{ getPixelRatio() }} (Dibatasi maks 1.25x)</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">CPU Cores / Threads:</span>
                <span class="font-bold text-white">{{ getCpuCores() }}</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Estimasi RAM:</span>
                <span class="font-bold text-white">{{ getMemory() }}</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Touch Screen:</span>
                <span class="font-bold text-white">{{ getMaxTouch() }}</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Orientasi:</span>
                <span class="font-bold text-white">{{ getOrientation() }}</span>
              </div>
            </div>
          </div>

          <!-- Section 3: Fitur Mesin Game & Optimasi -->
          <div class="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2">
            <div class="flex items-center gap-1.5 text-xs font-bold text-sky-300">
              <mat-icon class="text-base text-sky-400">memory</mat-icon>
              <span>Fitur & Status Sistem Game</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Lokasi Area:</span>
                <span class="font-bold text-emerald-300">{{ gameState.areaName() }}</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Kamera 3D:</span>
                <span class="font-bold text-white">Elevated 38° Isometric Follow</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Optimasi Low-End:</span>
                <span class="font-bold text-emerald-400">Aktif (Zero Blur, Shaded Lambert, No PostFX)</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Mesin Audio:</span>
                <span class="font-bold text-white">Synthesizer Web Audio API (Nol Download)</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Opacity HUD:</span>
                <span class="font-bold text-white">{{ (gameState.hudOpacity() * 100) | number:'1.0-0' }}%</span>
              </div>

              <div class="flex justify-between border-b border-white/5 py-0.5">
                <span class="text-white/60">Ukuran Kontroler:</span>
                <span class="font-bold text-white">{{ (gameState.controlScale() * 100) | number:'1.0-0' }}%</span>
              </div>
            </div>
          </div>

          <!-- Bottom Actions: Copy Button & Close -->
          <div class="flex items-center justify-between pt-1 border-t border-white/15">
            <button
              (click)="copyStatsReport()"
              class="px-4 py-2.5 rounded-2xl border flex items-center gap-2 text-xs font-black transition-all active:scale-95 shadow-md"
              [class.border-emerald-400]="!copied()"
              [class.bg-emerald-600]="!copied()"
              [class.text-white]="!copied()"
              [class.border-amber-400]="copied()"
              [class.bg-amber-500]="copied()"
              [class.text-slate-950]="copied()"
            >
              <mat-icon class="text-base">{{ copied() ? 'check_circle' : 'content_copy' }}</mat-icon>
              <span>{{ copied() ? 'Tersalin ke Clipboard!' : 'Salin Info Performa & Perangkat' }}</span>
            </button>

            <button
              (click)="close()"
              class="px-5 py-2.5 rounded-2xl border border-white/20 bg-white/10 active:bg-white/20 text-white text-xs font-bold transition-all active:scale-95"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class PerfModalComponent {
  public gameState = inject(GameStateService);

  public copied = signal<boolean>(false);

  public close(): void {
    this.gameState.isPerfModalOpen.set(false);
  }

  public getScreenRes(): string {
    if (typeof window === 'undefined') return 'N/A';
    return `${window.screen.width} x ${window.screen.height}`;
  }

  public getViewportRes(): string {
    if (typeof window === 'undefined') return 'N/A';
    return `${window.innerWidth} x ${window.innerHeight}`;
  }

  public getPixelRatio(): string {
    if (typeof window === 'undefined') return '1.0x';
    return `${(window.devicePixelRatio || 1).toFixed(2)}x`;
  }

  public getCpuCores(): string {
    if (typeof navigator === 'undefined' || !navigator.hardwareConcurrency) return 'Unknown';
    return `${navigator.hardwareConcurrency} Cores`;
  }

  public getMemory(): string {
    if (typeof navigator === 'undefined') return 'N/A';
    const nav = navigator as Navigator & { deviceMemory?: number };
    return nav.deviceMemory ? `≥ ${nav.deviceMemory} GB` : 'N/A';
  }

  public getMaxTouch(): string {
    if (typeof navigator === 'undefined') return 'N/A';
    return navigator.maxTouchPoints > 0 ? `Ya (${navigator.maxTouchPoints} Titik)` : 'Mouse / Non-Touch';
  }

  public getOrientation(): string {
    if (typeof window === 'undefined') return 'Landscape';
    return window.innerWidth >= window.innerHeight ? 'Landscape' : 'Portrait';
  }

  public copyStatsReport(): void {
    const report = [
      `=== HARVEST MOON: WHISPERING TREE 3D - LAPORAN PERFORMA ===`,
      `Tanggal: ${new Date().toLocaleString()}`,
      ``,
      `--- STATISTIK PERFORMA REALTIME ---`,
      `Framerate: ${this.gameState.fps()} FPS`,
      `Frame Time: ${this.gameState.frameTimeMs()} ms`,
      `Draw Calls: ${this.gameState.drawCalls()}`,
      `Triangles: ${this.gameState.triangles().toLocaleString()}`,
      `Geometries in VRAM: ${this.gameState.geometriesCount()}`,
      `Textures in VRAM: ${this.gameState.texturesCount()}`,
      ``,
      `--- SPESIFIKASI PERANGKAT & LAYAR ---`,
      `GPU Renderer: ${this.gameState.gpuInfo()}`,
      `Resolusi Layar: ${this.getScreenRes()}`,
      `Ukuran Viewport: ${this.getViewportRes()}`,
      `Device Pixel Ratio: ${this.getPixelRatio()}`,
      `CPU Cores: ${this.getCpuCores()}`,
      `Estimasi RAM: ${this.getMemory()}`,
      `Max Touch Points: ${this.getMaxTouch()}`,
      `Orientasi: ${this.getOrientation()}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      ``,
      `--- FITUR GAME ENGINE ---`,
      `Area Aktif: ${this.gameState.areaName()}`,
      `Waktu Game: Hari ${this.gameState.day()}, ${this.gameState.season()} (${this.gameState.timeFormatted()})`,
      `Cuaca: ${this.gameState.weather()}`,
      `Target FPS: 60 FPS (V-Sync)`,
      `Optimasi Perangkat Bawah: Aktif (Rasio Piksel Terkunci 1.25x, Zero Blur, Geometri Low-Poly)`,
      `Mesin Audio: Web Audio API Synthesizer (Nol Beban Jaringan)`,
      `Opacity HUD: ${(this.gameState.hudOpacity() * 100).toFixed(0)}%`,
      `Skala Kontrol: ${(this.gameState.controlScale() * 100).toFixed(0)}%`,
      `============================================================`
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(report).then(() => {
        this.onCopiedSuccess();
      }).catch(() => {
        this.fallbackCopy(report);
      });
    } else {
      this.fallbackCopy(report);
    }
  }

  private fallbackCopy(text: string): void {
    if (typeof document === 'undefined') return;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      this.onCopiedSuccess();
    } catch (err) {
      console.error('Fallback copy error:', err);
    }
    document.body.removeChild(textArea);
  }

  private onCopiedSuccess(): void {
    this.copied.set(true);
    this.gameState.showToast('Laporan performa & perangkat berhasil disalin!');
    setTimeout(() => {
      this.copied.set(false);
    }, 2800);
  }
}
