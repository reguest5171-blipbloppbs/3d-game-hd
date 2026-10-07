import React, { useRef, useEffect } from 'react';
import { useGameState } from '../services/game-state';
import { audioService } from '../services/audio';

interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'seed' | 'produce';
  desc: string;
  icon: string;
  season?: string;
}

export const ShopModal: React.FC = () => {
  const gameState = useGameState();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const shopCatalog: ShopItem[] = [
    { id: 'seed_turnip', name: 'Bibit Turnip', price: 20, type: 'seed', desc: 'Tumbuh dalam 2 hari. Panen kilat musim semi.', icon: 'grass', season: 'Semi' },
    { id: 'seed_strawberry', name: 'Bibit Strawberry', price: 50, type: 'seed', desc: 'Tumbuh dalam 3 hari. Buah manis berharga tinggi.', icon: 'spa', season: 'Semi' },
    { id: 'seed_corn', name: 'Bibit Jagung Manis', price: 80, type: 'seed', desc: 'Tumbuh dalam 4 hari. Panen melimpah musim panas.', icon: 'grain', season: 'Panas' },
    { id: 'seed_pumpkin', name: 'Bibit Labu Emas', price: 120, type: 'seed', desc: 'Tumbuh dalam 5 hari. Nilai jual istimewa 320 G.', icon: 'star', season: 'Gugur' },
    { id: 'fertilizer', name: 'Pupuk Super Solaria', price: 30, type: 'produce', desc: 'Menjaga kelembaban tanah agar tanaman lebih sehat.', icon: 'compost', season: 'Semua' },
    { id: 'fodder', name: 'Pakan Ternak Segar', price: 25, type: 'produce', desc: 'Makanan bergizi untuk Sapi, Domba & Ayam.', icon: 'grass', season: 'Semua' }
  ];

  const close = () => {
    gameState.setIsShopOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState.isShopOpen) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.isShopOpen]);

  const buy = (item: ShopItem) => {
    if (gameState.gold < item.price) {
      gameState.showToast('Gold tidak cukup!');
      return;
    }

    gameState.setGold(g => g - item.price);
    gameState.addToInventory({
      id: item.id,
      name: item.name,
      count: 1,
      type: item.type,
      sellValue: Math.floor(item.price * 0.5),
      description: item.desc,
      icon: item.icon
    });

    audioService.playCoin();
    gameState.showToast(`Membeli 1x ${item.name}!`);
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -190, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 190, behavior: 'smooth' });
    }
  };

  if (!gameState.isShopOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none animate-in fade-in duration-150">
      {/* Fullscreen backdrop */}
      <button
        type="button"
        aria-label="Tutup latar belakang"
        onClick={close}
        className="absolute inset-0 bg-black/75 cursor-default"
      ></button>

      {/* Shop Modal Window */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl rounded-3xl border-2 border-amber-300/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[85vh] overflow-hidden z-10"
      >
        {/* FIXED HEADER */}
        <div className="flex items-center justify-between border-b border-white/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <span className="material-icons text-xl">storefront</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-amber-300 tracking-wide uppercase leading-tight">
                Toko Maya (Gilded Oak Goods)
              </h2>
              <div className="text-[11px] text-white/70">
                Katalog bibit & persediaan · Geser horizontal untuk melihat semua produk
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Player Gold */}
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-200 bg-amber-950/70 px-3 py-1.5 rounded-full border border-amber-500/40 shadow-sm">
              <span className="material-icons text-sm text-amber-400">monetization_on</span>
              <span className="tabular-nums">{gameState.gold} G</span>
            </div>

            {/* CLOSE BUTTON */}
            <button
              type="button"
              onClick={close}
              className="px-3.5 py-1.5 rounded-full border-2 border-amber-300/40 bg-white/10 hover:bg-white/25 active:bg-amber-500/40 text-white flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
              title="Tutup Toko"
            >
              <span className="material-icons text-base text-rose-300">close</span>
              <span>Tutup</span>
            </button>
          </div>
        </div>

        {/* HORIZONTAL SCROLLABLE SHELF */}
        <div className="relative w-full">
          {/* Left/Right Desktop Controls */}
          <button
            onClick={scrollLeft}
            type="button"
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-8 h-8 rounded-full border border-white/30 bg-black/80 text-white items-center justify-center hover:bg-amber-600 transition-transform active:scale-90 shadow-lg cursor-pointer"
            title="Geser ke kiri"
          >
            <span className="material-icons text-sm">chevron_left</span>
          </button>

          <button
            onClick={scrollRight}
            type="button"
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-8 h-8 rounded-full border border-white/30 bg-black/80 text-white items-center justify-center hover:bg-amber-600 transition-transform active:scale-90 shadow-lg cursor-pointer"
            title="Geser ke kanan"
          >
            <span className="material-icons text-sm">chevron_right</span>
          </button>

          {/* Shelf Track */}
          <div
            ref={scrollContainerRef}
            className="flex flex-row items-stretch gap-3 overflow-x-auto py-2 px-1 scroll-smooth no-scrollbar touch-pan-x"
          >
            {shopCatalog.map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 w-40 sm:w-48 p-3.5 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 flex flex-col justify-between transition-colors shadow-sm relative group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform">
                    <span className="material-icons text-2xl">{item.icon}</span>
                  </div>
                  {item.season && (
                    <span className="text-[9px] font-bold text-amber-200 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30">
                      {item.season}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1 mb-3">
                  <div className="text-xs font-bold text-white truncate" title={item.name}>
                    {item.name}
                  </div>
                  <div className="text-[10px] text-white/65 line-clamp-2 leading-tight">
                    {item.desc}
                  </div>
                </div>

                <div className="mt-auto pt-2 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-black text-amber-300">
                    <span className="text-[10px] text-white/50 font-normal">Harga:</span>
                    <span className="tabular-nums">{item.price} G</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => buy(item)}
                    disabled={gameState.gold < item.price}
                    className="w-full py-1.5 rounded-xl text-xs font-bold border border-amber-400/70 bg-amber-500/30 hover:bg-amber-500/50 active:bg-amber-500/70 text-amber-200 disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    Beli
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER NOTICE */}
        <div className="flex items-center justify-between pt-2 border-t border-white/15 text-[11px] text-white/70">
          <div className="flex items-center gap-1.5">
            <span className="material-icons text-xs text-amber-300">swipe</span>
            <span>Geser untuk melihat semua persediaan toko</span>
          </div>
          <button
            onClick={close}
            type="button"
            className="text-amber-300 font-bold hover:underline cursor-pointer active:scale-95"
          >
            Keluar Toko ✕
          </button>
        </div>
      </div>
    </div>
  );
};
