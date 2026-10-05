import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-inventory-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gameState.isInventoryOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none animate-in fade-in duration-150"
      >
        <!-- Fullscreen backdrop button -->
        <button
          type="button"
          aria-label="Tutup latar belakang"
          (click)="close()"
          class="absolute inset-0 bg-black/75 cursor-default"
        ></button>

        <!-- Modal Container (Horizontal shelf layout, guaranteed on-screen close button) -->
        <div
          role="dialog"
          aria-modal="true"
          class="relative w-full max-w-2xl rounded-3xl border-2 border-amber-300/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[85vh] overflow-hidden z-10"
        >
          <!-- FIXED HEADER WITH GUARANTEED VISIBLE CLOSE BUTTON -->
          <div class="flex items-center justify-between border-b border-white/20 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                <mat-icon class="text-xl">backpack</mat-icon>
              </div>
              <div>
                <h2 class="text-sm sm:text-base font-black text-amber-200 uppercase tracking-wide leading-tight">
                  Tas Penyimpanan (Rucksack)
                </h2>
                <div class="text-[11px] text-white/70">
                  {{ gameState.inventory().length }} Jenis Barang · Geser horizontal untuk melihat semua isi tas
                </div>
              </div>
            </div>

            <!-- PROMINENT CLOSE BUTTON: Anchored firmly in header, NEVER goes offscreen -->
            <button
              type="button"
              (click)="close()"
              class="px-3.5 py-1.5 rounded-full border-2 border-amber-300/40 bg-white/10 hover:bg-white/25 active:bg-amber-500/40 text-white flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
              title="Tutup Tas (Close Rucksack)"
            >
              <mat-icon class="text-base text-rose-300">close</mat-icon>
              <span>Tutup</span>
            </button>
          </div>

          <!-- HORIZONTAL SCROLLABLE SHELF (Kontainer Horizontal & Bisa Digeser) -->
          <div class="relative w-full">
            @if (gameState.inventory().length === 0) {
              <div class="py-12 text-center text-white/50 text-xs flex flex-col items-center gap-2">
                <mat-icon class="text-3xl text-white/30">inventory_2</mat-icon>
                <span>Tas kosong! Kumpulkan hasil panen di kebun, memancing di dermaga, atau beli bibit di toko.</span>
              </div>
            } @else {
              <!-- Desktop Left/Right Arrow Controls -->
              <button
                (click)="scrollLeft()"
                type="button"
                class="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-8 h-8 rounded-full border border-white/30 bg-black/80 text-white items-center justify-center hover:bg-amber-600 transition-transform active:scale-90 shadow-lg cursor-pointer"
                title="Geser ke kiri"
              >
                <mat-icon class="text-sm">chevron_left</mat-icon>
              </button>

              <button
                (click)="scrollRight()"
                type="button"
                class="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-8 h-8 rounded-full border border-white/30 bg-black/80 text-white items-center justify-center hover:bg-amber-600 transition-transform active:scale-90 shadow-lg cursor-pointer"
                title="Geser ke kanan"
              >
                <mat-icon class="text-sm">chevron_right</mat-icon>
              </button>

              <!-- Horizontal Shelf Track -->
              <div
                #scrollContainer
                class="flex flex-row items-stretch gap-3 overflow-x-auto py-2 px-1 scroll-smooth no-scrollbar touch-pan-x"
              >
                @for (item of gameState.inventory(); track item.id) {
                  <div
                    class="flex-shrink-0 w-36 sm:w-44 p-3.5 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 flex flex-col justify-between transition-colors shadow-sm relative group"
                  >
                    <!-- Top: Icon & Count Badge -->
                    <div class="flex items-center justify-between mb-2">
                      <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                        <mat-icon class="text-xl">{{ item.icon }}</mat-icon>
                      </div>
                      <span class="text-xs font-black text-amber-200 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30 tabular-nums">
                        x{{ item.count }}
                      </span>
                    </div>

                    <!-- Item Name & Description -->
                    <div class="flex flex-col gap-1 mb-2">
                      <div class="text-xs font-bold text-white truncate" [title]="item.name">
                        {{ item.name }}
                      </div>
                      <div class="text-[10px] text-white/60 line-clamp-2 leading-tight">
                        {{ item.description }}
                      </div>
                    </div>

                    <!-- Sell Value Footer -->
                    <div class="mt-auto pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                      <span class="text-white/50">Nilai Jual:</span>
                      <span class="font-bold text-emerald-400 tabular-nums">{{ item.sellValue }} G</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- FOOTER TIP & CONTROLS -->
          <div class="flex items-center justify-between pt-2 border-t border-white/15 text-[11px] text-white/70">
            <div class="flex items-center gap-1.5">
              <mat-icon class="text-xs text-amber-300">swipe</mat-icon>
              <span>Geser ke kiri / kanan untuk melihat barang lainnya</span>
            </div>
            <button
              (click)="close()"
              type="button"
              class="text-amber-300 font-bold hover:underline cursor-pointer active:scale-95"
            >
              Tutup Tas ✕
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class InventoryModalComponent {
  public gameState = inject(GameStateService);

  @ViewChild('scrollContainer') scrollContainerRef?: ElementRef<HTMLDivElement>;

  @HostListener('window:keydown.escape')
  public onEscape(): void {
    if (this.gameState.isInventoryOpen()) {
      this.close();
    }
  }

  public close(): void {
    this.gameState.isInventoryOpen.set(false);
  }

  public scrollLeft(): void {
    if (this.scrollContainerRef) {
      this.scrollContainerRef.nativeElement.scrollBy({ left: -180, behavior: 'smooth' });
    }
  }

  public scrollRight(): void {
    if (this.scrollContainerRef) {
      this.scrollContainerRef.nativeElement.scrollBy({ left: 180, behavior: 'smooth' });
    }
  }
}
