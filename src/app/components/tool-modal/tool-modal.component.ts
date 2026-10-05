import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ToolType } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-tool-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gameState.isToolMenuOpen()) {
      <div
        class="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center p-3 sm:p-6 pointer-events-auto select-none animate-in fade-in duration-150"
      >
        <!-- Full-screen backdrop button -->
        <button
          type="button"
          aria-label="Tutup latar belakang"
          (click)="close()"
          class="absolute inset-0 bg-black/75 cursor-default"
        ></button>

        <!-- Modal Card -->
        <div
          role="dialog"
          aria-modal="true"
          class="relative w-full max-w-2xl rounded-3xl border-2 border-sky-400/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[85vh] overflow-hidden z-10"
        >
          <!-- FIXED STICKY HEADER WITH GUARANTEED VISIBLE CLOSE BUTTON -->
          <div class="flex items-center justify-between border-b border-white/20 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                <mat-icon class="text-xl">handyman</mat-icon>
              </div>
              <div>
                <h2 class="text-sm sm:text-base font-black text-sky-200 uppercase tracking-wide leading-tight">
                  Rak & Kontainer Alat (Toolbox)
                </h2>
                <div class="text-[11px] text-white/70">
                  Pilih alat kerja · Geser horizontal untuk melihat semua perlengkapan
                </div>
              </div>
            </div>

            <!-- PROMINENT CLOSE BUTTON: Anchored firmly in header, NEVER goes off-screen -->
            <button
              (click)="close()"
              type="button"
              class="px-3.5 py-1.5 rounded-full border-2 border-sky-300/40 bg-white/10 hover:bg-white/25 active:bg-sky-500/40 text-white flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
              title="Tutup Kontainer Alat (Close Tool Container)"
            >
              <mat-icon class="text-base text-rose-300">close</mat-icon>
              <span>Tutup</span>
            </button>
          </div>

          <!-- HORIZONTAL SCROLLABLE TOOL SHELF (Kontainer Horizontal & Bisa Digeser) -->
          <div class="relative w-full">
            <!-- Left & Right Desktop Scroll Arrow Controls -->
            <button
              (click)="scrollLeft()"
              type="button"
              class="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-8 h-8 rounded-full border border-white/30 bg-black/80 text-white items-center justify-center hover:bg-sky-600 transition-transform active:scale-90 shadow-lg cursor-pointer"
              title="Geser ke kiri"
            >
              <mat-icon class="text-sm">chevron_left</mat-icon>
            </button>

            <button
              (click)="scrollRight()"
              type="button"
              class="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-8 h-8 rounded-full border border-white/30 bg-black/80 text-white items-center justify-center hover:bg-sky-600 transition-transform active:scale-90 shadow-lg cursor-pointer"
              title="Geser ke kanan"
            >
              <mat-icon class="text-sm">chevron_right</mat-icon>
            </button>

            <!-- Scrollable Track (horizontal, touch-friendly, smooth scrolling) -->
            <div
              #scrollContainer
              class="flex flex-row items-stretch gap-3 overflow-x-auto py-2 px-1 scroll-smooth no-scrollbar touch-pan-x"
            >
              @for (tool of gameState.toolsList; track tool.id) {
                <button
                  type="button"
                  (click)="selectTool(tool.id)"
                  class="flex-shrink-0 w-32 sm:w-36 p-3 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-95 cursor-pointer relative overflow-hidden group"
                  [class.border-sky-400]="gameState.selectedTool() === tool.id"
                  [class.bg-sky-950/70]="gameState.selectedTool() === tool.id"
                  [class.shadow-lg]="gameState.selectedTool() === tool.id"
                  [class.shadow-sky-500/20]="gameState.selectedTool() === tool.id"
                  [class.border-white/15]="gameState.selectedTool() !== tool.id"
                  [class.bg-white/5]="gameState.selectedTool() !== tool.id"
                  [class.hover:bg-white/10]="gameState.selectedTool() !== tool.id"
                >
                  <!-- Active Indicator Ribbon / Glow -->
                  @if (gameState.selectedTool() === tool.id) {
                    <div class="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none">
                      <div class="bg-sky-400 text-slate-950 text-[8px] font-black text-center py-0.5 w-16 absolute top-2 right-[-18px] rotate-45 shadow">
                        AKTIF
                      </div>
                    </div>
                  }

                  <!-- Tool Icon -->
                  <div class="flex items-center justify-between mb-2">
                    <div
                      class="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      [class.bg-sky-500/30]="gameState.selectedTool() === tool.id"
                      [class.text-sky-300]="gameState.selectedTool() === tool.id"
                      [class.bg-white/10]="gameState.selectedTool() !== tool.id"
                      [class.text-white/80]="gameState.selectedTool() !== tool.id"
                    >
                      <mat-icon class="text-2xl">{{ tool.icon }}</mat-icon>
                    </div>

                    <span class="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border border-white/20 bg-black/40 text-white/70">
                      Lv. 1
                    </span>
                  </div>

                  <!-- Tool Name & Details -->
                  <div class="flex flex-col gap-1 mb-2">
                    <div
                      class="text-xs font-black tracking-tight"
                      [class.text-sky-200]="gameState.selectedTool() === tool.id"
                      [class.text-white]="gameState.selectedTool() !== tool.id"
                    >
                      {{ tool.name }}
                    </div>
                    <div class="text-[10px] text-white/60 line-clamp-2 leading-tight">
                      {{ getToolDescription(tool.id) }}
                    </div>
                  </div>

                  <!-- Bottom Selection Status Button -->
                  <div
                    class="w-full py-1 rounded-xl text-center text-[10px] font-bold transition-colors mt-auto"
                    [class.bg-sky-500]="gameState.selectedTool() === tool.id"
                    [class.text-slate-950]="gameState.selectedTool() === tool.id"
                    [class.bg-white/10]="gameState.selectedTool() !== tool.id"
                    [class.text-white/70]="gameState.selectedTool() !== tool.id"
                  >
                    {{ gameState.selectedTool() === tool.id ? '✓ Dipakai' : 'Pilih Alat' }}
                  </div>
                </button>
              }
            </div>
          </div>

          <!-- FOOTER: Info & Gesture Tip -->
          <div class="flex items-center justify-between pt-2 border-t border-white/15 text-[11px] text-white/70">
            <div class="flex items-center gap-1.5">
              <mat-icon class="text-xs text-amber-300">swipe</mat-icon>
              <span>Geser ke kiri / kanan untuk melihat alat lainnya</span>
            </div>
            <button
              (click)="close()"
              type="button"
              class="text-sky-300 font-bold hover:underline cursor-pointer active:scale-95"
            >
              Kembali ke Game ✕
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ToolModalComponent {
  public gameState = inject(GameStateService);
  private audio = inject(AudioService);

  @ViewChild('scrollContainer') scrollContainerRef?: ElementRef<HTMLDivElement>;

  @HostListener('window:keydown.escape')
  public onEscape(): void {
    if (this.gameState.isToolMenuOpen()) {
      this.close();
    }
  }

  public selectTool(id: ToolType): void {
    this.gameState.setTool(id);
    this.audio.playSelect();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    // Auto close after 250ms or keep open for multiple inspections
    setTimeout(() => {
      this.close();
    }, 200);
  }

  public close(): void {
    this.gameState.isToolMenuOpen.set(false);
  }

  public scrollLeft(): void {
    if (this.scrollContainerRef) {
      this.scrollContainerRef.nativeElement.scrollBy({ left: -160, behavior: 'smooth' });
    }
  }

  public scrollRight(): void {
    if (this.scrollContainerRef) {
      this.scrollContainerRef.nativeElement.scrollBy({ left: 160, behavior: 'smooth' });
    }
  }

  public getToolDescription(id: ToolType): string {
    switch (id) {
      case 'hoe':
        return 'Mencangkul tanah gembur untuk membuat petak tanaman.';
      case 'water_can':
        return 'Menyiram tanaman agar tumbuh sehat dan tidak kering.';
      case 'seeds':
        return 'Menabur benih tanaman di petak yang telah dicangkul.';
      case 'sickle':
        return 'Membersihkan gulma, ilalang & rumput liar.';
      case 'fishing_rod':
        return 'Memancing ikan segar di tepi dermaga Harmonica.';
      case 'hand':
        return 'Memetik panen matang, mengelus hewan ternak & berbicara.';
      default:
        return 'Peralatan berkebun Solaria Island.';
    }
  }
}
