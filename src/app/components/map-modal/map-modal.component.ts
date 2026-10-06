import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AreaId } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';

interface MapAreaNode {
  id: AreaId;
  name: string;
  sub: string;
  icon: string;
  xPercent: number; // 0..100
  yPercent: number; // 0..100
  desc: string;
}

@Component({
  selector: 'app-map-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gameState.isMapOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none animate-in fade-in duration-150"
      >
        <!-- Backdrop button -->
        <button
          type="button"
          aria-label="Tutup latar belakang"
          (click)="close()"
          class="absolute inset-0 bg-black/75 cursor-default"
        ></button>

        <!-- Map Container (Transparent without blur) -->
        <div
          role="dialog"
          aria-modal="true"
          class="relative w-full max-w-2xl rounded-3xl border-2 border-amber-300/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3 max-h-[92vh] overflow-y-auto z-10"
        >
          <!-- Top Bar: Title, Gold, Settings, Exit Fullscreen, Close (Sticky Header) -->
          <div class="sticky top-0 z-20 flex items-center justify-between border-b border-white/20 pb-2.5 bg-neutral-950/95 -mt-1 pt-1">
            <!-- Map Title -->
            <div class="flex items-center gap-2">
              <mat-icon class="text-amber-400 text-xl">map</mat-icon>
              <div>
                <h2 class="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wide leading-tight">
                  Peta Pulau Solaria (Island Map)
                </h2>
                <div class="text-[10px] text-white/70">
                  Posisi saat ini: <strong class="text-emerald-400">{{ gameState.areaName() }}</strong>
                </div>
              </div>
            </div>

            <!-- Right Controls: Info Uang, Settings, Exit Fullscreen, Close -->
            <div class="flex items-center gap-2">
              <!-- Info Uang (Gold) -->
              <div class="flex items-center gap-1 px-3 py-1 rounded-2xl border border-amber-400/40 bg-amber-950/60 text-amber-300 shadow-sm">
                <mat-icon class="text-base text-amber-400">monetization_on</mat-icon>
                <span class="text-xs sm:text-sm font-black tabular-nums tracking-wide">
                  {{ gameState.gold() }} G
                </span>
              </div>

              <!-- Tombol Pengaturan (Settings Button) -->
              <button
                (click)="openSettings()"
                class="w-8 h-8 rounded-full border border-sky-300/40 bg-sky-950/50 active:bg-sky-800/60 text-sky-200 flex items-center justify-center transition-transform active:scale-95 shadow-sm"
                title="Buka Pengaturan Kontrol & Suara"
              >
                <mat-icon class="text-base">settings</mat-icon>
              </button>

              <!-- Tombol Exit Fullscreen (Logo Exit) -->
              <button
                (click)="exitFullscreen()"
                class="w-8 h-8 rounded-full border border-rose-300/40 bg-rose-950/50 active:bg-rose-800/60 text-rose-200 flex items-center justify-center transition-transform active:scale-95 shadow-sm"
                title="Keluar dari Layar Penuh (Exit Fullscreen)"
              >
                <mat-icon class="text-base">fullscreen_exit</mat-icon>
              </button>

              <!-- Tombol Close Map -->
              <button
                (click)="close()"
                type="button"
                class="px-2.5 py-1 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center gap-1 text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Tutup Peta"
              >
                <mat-icon class="text-sm">close</mat-icon>
                <span>Tutup</span>
              </button>
            </div>
          </div>

          <!-- Stylized Island Map Canvas Container -->
          <div class="relative w-full h-56 sm:h-72 rounded-2xl border border-white/20 bg-gradient-to-b from-sky-900/60 via-emerald-950/40 to-sky-950/80 overflow-hidden shadow-inner">
            <!-- Island Topography / Coastal contours -->
            <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 400 250">
              <!-- Sea waves pattern -->
              <path d="M10,20 Q50,10 90,20 T170,20 T250,20 T330,20 T400,20" fill="none" stroke="#38bdf8" stroke-width="1" />
              <path d="M0,230 Q60,220 120,230 T240,230 T360,230" fill="none" stroke="#38bdf8" stroke-width="1" />
              <!-- Island landmass shape -->
              <path
                d="M 60,110 C 70,50 160,25 240,35 C 310,45 360,90 350,160 C 340,210 260,230 180,225 C 100,220 50,170 60,110 Z"
                fill="#2e7d32"
                stroke="#66bb6a"
                stroke-width="2"
              />
              <!-- Sandy coast ring -->
              <path
                d="M 54,110 C 64,45 160,20 245,30 C 318,40 370,88 358,165 C 346,218 262,238 178,232 C 92,226 44,173 54,110 Z"
                fill="none"
                stroke="#fde047"
                stroke-width="3"
                opacity="0.6"
              />
              <!-- Connecting paths between nodes -->
              <line x1="190" y1="130" x2="190" y2="85" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="4" />
              <line x1="190" y1="130" x2="300" y2="150" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="4" />
              <line x1="190" y1="130" x2="130" y2="135" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="4" />
              <line x1="190" y1="130" x2="200" y2="45" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="4" />
            </svg>

            <!-- Map Location Interactive Nodes -->
            @for (node of areaNodes; track node.id) {
              <button
                type="button"
                (click)="selectedNode.set(node)"
                class="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center group transition-transform active:scale-95"
                [style.left.%]="node.xPercent"
                [style.top.%]="node.yPercent"
              >
                <!-- Node Icon Button -->
                <div
                  class="w-10 h-10 rounded-2xl border-2 flex items-center justify-center shadow-lg transition-all"
                  [class.border-emerald-300]="gameState.currentArea() === node.id"
                  [class.bg-emerald-600]="gameState.currentArea() === node.id"
                  [class.border-white/50]="gameState.currentArea() !== node.id"
                  [class.bg-black/70]="gameState.currentArea() !== node.id"
                  [class.scale-110]="gameState.currentArea() === node.id || selectedNode()?.id === node.id"
                >
                  <mat-icon class="text-xl text-white">{{ node.icon }}</mat-icon>
                </div>

                <!-- Node Label -->
                <div
                  class="mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-tight whitespace-nowrap shadow-md"
                  [class.bg-emerald-500]="gameState.currentArea() === node.id"
                  [class.text-slate-950]="gameState.currentArea() === node.id"
                  [class.bg-black/70]="gameState.currentArea() !== node.id"
                  [class.text-white]="gameState.currentArea() !== node.id"
                >
                  {{ node.name }}
                </div>

                <!-- Current Location Glow Pin -->
                @if (gameState.currentArea() === node.id) {
                  <div class="absolute -top-3 flex items-center gap-0.5 bg-amber-400 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-full animate-bounce shadow">
                    <span>📍 ANDA</span>
                  </div>
                }
              </button>
            }
          </div>

          <!-- GPS Coordinates & Altitude Card with Quick Copy -->
          <div class="px-3.5 py-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-950/40 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
            <!-- Left: Icon & Coordinate Badges -->
            <div class="flex items-center gap-2.5 flex-wrap">
              <div class="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                <mat-icon class="text-base text-emerald-400 animate-pulse">my_location</mat-icon>
                <span>Koordinat 3D:</span>
              </div>

              <!-- Coordinate Chips -->
              <div class="flex items-center gap-1.5 flex-wrap font-mono text-[11px] font-bold">
                <!-- X Position -->
                <div class="px-2 py-0.5 rounded-lg border border-sky-400/40 bg-sky-950/70 text-sky-200 flex items-center gap-1">
                  <span class="text-[9px] text-sky-400 font-normal">X</span>
                  <span>{{ gameState.playerCoords().x > 0 ? '+' : '' }}{{ gameState.playerCoords().x.toFixed(1) }}</span>
                </div>

                <!-- Y Altitude / Height Position -->
                <div class="px-2 py-0.5 rounded-lg border border-amber-400/40 bg-amber-950/70 text-amber-200 flex items-center gap-1">
                  <span class="text-[9px] text-amber-400 font-normal">Y (Tinggi)</span>
                  <span>{{ gameState.playerCoords().y > 0 ? '+' : '' }}{{ gameState.playerCoords().y.toFixed(1) }} m</span>
                </div>

                <!-- Z Position -->
                <div class="px-2 py-0.5 rounded-lg border border-indigo-400/40 bg-indigo-950/70 text-indigo-200 flex items-center gap-1">
                  <span class="text-[9px] text-indigo-400 font-normal">Z</span>
                  <span>{{ gameState.playerCoords().z > 0 ? '+' : '' }}{{ gameState.playerCoords().z.toFixed(1) }}</span>
                </div>
              </div>
            </div>

            <!-- Right Actions Container -->
            <div class="flex items-center gap-1.5 shrink-0">
              <!-- Dev Editor Switch Button -->
              <button
                type="button"
                (click)="openDevEditor()"
                class="px-3 py-1.5 rounded-xl border border-amber-400 bg-amber-500 hover:bg-amber-600 text-white active:scale-95 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow focus:outline-none"
                title="Buka Alat Sculpting & Editor Objek (Dev Mode)"
              >
                <mat-icon class="text-sm">handyman</mat-icon>
                <span>Map Editor</span>
              </button>

              <!-- Copy Coordinates Button -->
              <button
                type="button"
                (click)="copyCoordinates()"
                class="px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-black transition-all active:scale-95 cursor-pointer shadow focus:outline-none"
                [class.border-emerald-400]="copied()"
                [class.bg-emerald-600]="copied()"
                [class.text-white]="copied()"
                [class.border-amber-400/50]="!copied()"
                [class.bg-amber-500/20]="!copied()"
                [class.hover:bg-amber-500/30]="!copied()"
                [class.text-amber-300]="!copied()"
                title="Salin Koordinat (X, Y Ketinggian, Z) ke Clipboard"
              >
                <mat-icon class="text-sm">{{ copied() ? 'check_circle' : 'content_copy' }}</mat-icon>
                <span>{{ copied() ? 'Tersalin!' : 'Salin' }}</span>
              </button>
            </div>
          </div>

          <!-- Selected Area Detail Card -->
          <div class="p-3 rounded-2xl border border-white/15 bg-white/5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                <mat-icon>{{ selectedNode()?.icon || 'place' }}</mat-icon>
              </div>
              <div>
                <div class="text-xs font-bold text-white flex items-center gap-2">
                  <span>{{ selectedNode()?.name || gameState.areaName() }}</span>
                  @if (gameState.currentArea() === (selectedNode()?.id || gameState.currentArea())) {
                    <span class="text-[9px] font-black text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded">
                      LOKASI ANDA
                    </span>
                  }
                </div>
                <div class="text-[10px] text-white/70 mt-0.5">
                  {{ selectedNode()?.desc || 'Jelajahi area ini lewat pintu atau jalur setapak yang terhubung!' }}
                </div>
              </div>
            </div>

            <!-- Fast Travel / Info hint -->
            <div class="text-[10px] font-medium text-amber-200/80 text-right max-w-[120px]">
              Jalur jalan kaki dapat diakses langsung di dunia 3D.
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class MapModalComponent {
  public gameState = inject(GameStateService);

  public selectedNode = signal<MapAreaNode | null>(null);
  public copied = signal<boolean>(false);

  public areaNodes: MapAreaNode[] = [
    {
      id: 'farm',
      name: 'Kebun Solaria',
      sub: 'Solaria Farmstead',
      icon: 'agriculture',
      xPercent: 50,
      yPercent: 56,
      desc: 'Pusat bercocok tanam: petak tanah, sumur air, kincir angin, kandang sapi & domba, dan kotak penjualan hasil panen.'
    },
    {
      id: 'house',
      name: 'Rumah Petani',
      sub: 'Farmer\'s Cottage',
      icon: 'home',
      xPercent: 34,
      yPercent: 58,
      desc: 'Interior pondok kayu dengan kasur untuk tidur & memajukan hari, perapian hangat, dan meja makan.'
    },
    {
      id: 'town',
      name: 'Kota & Dermaga',
      sub: 'Harmonica Town',
      icon: 'holiday_village',
      xPercent: 78,
      yPercent: 62,
      desc: 'Alun-alun kota dengan air mancur batu, warga pulau, dan Dermaga Seagull untuk memancing ikan laut.'
    },
    {
      id: 'shop',
      name: 'Toko Maya',
      sub: 'General Store',
      icon: 'storefront',
      xPercent: 74,
      yPercent: 38,
      desc: 'Toko bibit tanaman yang dikelola Maya: Turnip, Strawberry, Jagung, dan Labu Emas.'
    },
    {
      id: 'goddess_tree',
      name: 'Pohon Keramat',
      sub: 'Whispering Tree',
      icon: 'nature_people',
      xPercent: 50,
      yPercent: 20,
      desc: 'Tebing tinggi di utara pulau tempat Pohon Keramat raksasa dan peri Fin menaungi kedamaian Solaria.'
    }
  ];

  public copyCoordinates(): void {
    const c = this.gameState.playerCoords();
    const area = this.gameState.areaName();
    const text = `X: ${c.x.toFixed(1)}, Y: ${c.y.toFixed(1)}m (Ketinggian), Z: ${c.z.toFixed(1)} [${area}]`;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.copied.set(true);
        this.gameState.showToast(`Koordinat tersalin: ${text}`);
        setTimeout(() => this.copied.set(false), 2000);
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string): void {
    if (typeof document === 'undefined') return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.copied.set(true);
      this.gameState.showToast(`Koordinat tersalin: ${text}`);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.gameState.showToast('Gagal menyalin koordinat.');
    }
    document.body.removeChild(ta);
  }

  public openDevEditor(): void {
    this.gameState.isMapOpen.set(false);
    this.gameState.isDevEditorOpen.set(true);
  }

  public close(): void {
    this.gameState.isMapOpen.set(false);
  }

  public openSettings(): void {
    this.gameState.isMapOpen.set(false);
    this.gameState.isSettingsOpen.set(true);
  }

  public exitFullscreen(): void {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.debug('Exit fullscreen error:', err);
      });
      this.gameState.showToast('Keluar dari layar penuh.');
    } else {
      this.gameState.showToast('Layar sedang tidak dalam mode fullscreen.');
    }
  }
}
