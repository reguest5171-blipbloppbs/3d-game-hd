import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';

interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'seed' | 'produce';
  desc: string;
  icon: string;
  season?: string;
}

@Component({
  selector: 'app-shop-modal',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (gameState.isShopOpen()) {
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

        <!-- Shop Modal Window (Horizontal shelf layout, guaranteed on-screen close button) -->
        <div
          role="dialog"
          aria-modal="true"
          class="relative w-full max-w-2xl rounded-3xl border-2 border-amber-300/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[85vh] overflow-hidden z-10"
        >
          <!-- FIXED HEADER WITH GUARANTEED VISIBLE CLOSE BUTTON -->
          <div class="flex items-center justify-between border-b border-white/20 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                <mat-icon class="text-xl">storefront</mat-icon>
              </div>
              <div>
                <h2 class="text-sm sm:text-base font-black text-amber-300 tracking-wide uppercase leading-tight">
                  Toko Maya (Gilded Oak Goods)
                </h2>
                <div class="text-[11px] text-white/70">
                  Katalog bibit & persediaan · Geser horizontal untuk melihat semua produk
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 sm:gap-3">
              <!-- Player Gold Display -->
              <div class="flex items-center gap-1.5 text-xs font-black text-amber-200 bg-amber-950/70 px-3 py-1.5 rounded-full border border-amber-500/40 shadow-sm">
                <mat-icon class="text-sm text-amber-400">monetization_on</mat-icon>
                <span class="tabular-nums">{{ gameState.gold() }} G</span>
              </div>

              <!-- PROMINENT CLOSE BUTTON: Anchored firmly in header, NEVER goes offscreen -->
              <button
                type="button"
                (click)="close()"
                class="px-3.5 py-1.5 rounded-full border-2 border-amber-300/40 bg-white/10 hover:bg-white/25 active:bg-amber-500/40 text-white flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
                title="Tutup Toko (Close Shop)"
              >
                <mat-icon class="text-base text-rose-300">close</mat-icon>
                <span>Tutup</span>
              </button>
            </div>
          </div>

          <!-- HORIZONTAL SCROLLABLE SHELF (Kontainer Horizontal & Bisa Digeser) -->
          <div class="relative w-full">
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
              @for (item of shopCatalog; track item.id) {
                <div
                  class="flex-shrink-0 w-40 sm:w-48 p-3.5 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 flex flex-col justify-between transition-colors shadow-sm relative group"
                >
                  <!-- Top: Icon & Season Badge -->
                  <div class="flex items-center justify-between mb-2">
                    <div class="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform">
                      <mat-icon class="text-2xl">{{ item.icon }}</mat-icon>
                    </div>
                    @if (item.season) {
                      <span class="text-[9px] font-bold text-amber-200 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30">
                        {{ item.season }}
                      </span>
                    }
                  </div>

                  <!-- Name & Description -->
                  <div class="flex flex-col gap-1 mb-3">
                    <div class="text-xs font-bold text-white truncate" [title]="item.name">
                      {{ item.name }}
                    </div>
                    <div class="text-[10px] text-white/65 line-clamp-2 leading-tight">
                      {{ item.desc }}
                    </div>
                  </div>

                  <!-- Price & Buy Button -->
                  <div class="mt-auto pt-2 border-t border-white/10 flex flex-col gap-2">
                    <div class="flex items-center justify-between text-xs font-black text-amber-300">
                      <span class="text-[10px] text-white/50 font-normal">Harga:</span>
                      <span class="tabular-nums">{{ item.price }} G</span>
                    </div>

                    <button
                      type="button"
                      (click)="buy(item)"
                      [disabled]="gameState.gold() < item.price"
                      class="w-full py-1.5 rounded-xl text-xs font-bold border border-amber-400/70 bg-amber-500/30 hover:bg-amber-500/50 active:bg-amber-500/70 text-amber-200 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      Beli
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- FOOTER NOTICE -->
          <div class="flex items-center justify-between pt-2 border-t border-white/15 text-[11px] text-white/70">
            <div class="flex items-center gap-1.5">
              <mat-icon class="text-xs text-amber-300">swipe</mat-icon>
              <span>Geser untuk melihat semua persediaan toko</span>
            </div>
            <button
              (click)="close()"
              type="button"
              class="text-amber-300 font-bold hover:underline cursor-pointer active:scale-95"
            >
              Keluar Toko ✕
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ShopModalComponent {
  public gameState = inject(GameStateService);
  private audio = inject(AudioService);

  @ViewChild('scrollContainer') scrollContainerRef?: ElementRef<HTMLDivElement>;

  @HostListener('window:keydown.escape')
  public onEscape(): void {
    if (this.gameState.isShopOpen()) {
      this.close();
    }
  }

  public shopCatalog: ShopItem[] = [
    { id: 'seed_turnip', name: 'Bibit Turnip', price: 20, type: 'seed', desc: 'Tumbuh dalam 2 hari. Panen kilat musim semi.', icon: 'grass', season: 'Semi' },
    { id: 'seed_strawberry', name: 'Bibit Strawberry', price: 50, type: 'seed', desc: 'Tumbuh dalam 3 hari. Buah manis berharga tinggi.', icon: 'spa', season: 'Semi' },
    { id: 'seed_corn', name: 'Bibit Jagung Manis', price: 80, type: 'seed', desc: 'Tumbuh dalam 4 hari. Panen melimpah musim panas.', icon: 'grain', season: 'Panas' },
    { id: 'seed_pumpkin', name: 'Bibit Labu Emas', price: 120, type: 'seed', desc: 'Tumbuh dalam 5 hari. Nilai jual istimewa 320 G.', icon: 'star', season: 'Gugur' },
    { id: 'fertilizer', name: 'Pupuk Super Solaria', price: 30, type: 'produce', desc: 'Menjaga kelembaban tanah agar tanaman lebih sehat.', icon: 'compost', season: 'Semua' },
    { id: 'fodder', name: 'Pakan Ternak Segar', price: 25, type: 'produce', desc: 'Makanan bergizi untuk sapi dan domba ternak.', icon: 'grass', season: 'Semua' }
  ];

  public buy(item: ShopItem): void {
    if (this.gameState.gold() < item.price) {
      this.gameState.showToast('Gold tidak cukup!');
      return;
    }

    this.gameState.gold.update(g => g - item.price);
    this.gameState.addToInventory({
      id: item.id,
      name: item.name,
      count: 1,
      type: item.type,
      sellValue: Math.floor(item.price * 0.5),
      description: item.desc,
      icon: item.icon
    });

    this.audio.playCoin();
    this.gameState.showToast(`Membeli 1x ${item.name}!`);
  }

  public close(): void {
    this.gameState.isShopOpen.set(false);
  }

  public scrollLeft(): void {
    if (this.scrollContainerRef) {
      this.scrollContainerRef.nativeElement.scrollBy({ left: -190, behavior: 'smooth' });
    }
  }

  public scrollRight(): void {
    if (this.scrollContainerRef) {
      this.scrollContainerRef.nativeElement.scrollBy({ left: 190, behavior: 'smooth' });
    }
  }
}
