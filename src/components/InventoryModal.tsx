import React, { useRef, useEffect } from 'react';
import { useGameState } from '../services/game-state';

export const InventoryModal: React.FC = () => {
  const gameState = useGameState();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    gameState.setIsInventoryOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState.isInventoryOpen) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.isInventoryOpen]);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -180, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 180, behavior: 'smooth' });
    }
  };

  if (!gameState.isInventoryOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none animate-in fade-in duration-150">
      {/* Fullscreen backdrop */}
      <button
        type="button"
        aria-label="Tutup latar belakang"
        onClick={close}
        className="absolute inset-0 bg-black/75 cursor-default"
      ></button>

      {/* Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl rounded-3xl border-2 border-amber-300/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[85vh] overflow-hidden z-10"
      >
        {/* FIXED HEADER WITH GUARANTEED VISIBLE CLOSE BUTTON */}
        <div className="flex items-center justify-between border-b border-white/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <span className="material-icons text-xl">backpack</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-amber-200 uppercase tracking-wide leading-tight">
                Tas Penyimpanan (Rucksack)
              </h2>
              <div className="text-[11px] text-white/70">
                {gameState.inventory.length} Jenis Barang · Geser horizontal untuk melihat semua isi tas
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            className="px-3.5 py-1.5 rounded-full border-2 border-amber-300/40 bg-white/10 hover:bg-white/25 active:bg-amber-500/40 text-white flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
            title="Tutup Tas"
          >
            <span className="material-icons text-base text-rose-300">close</span>
            <span>Tutup</span>
          </button>
        </div>

        {/* HORIZONTAL SCROLLABLE SHELF */}
        <div className="relative w-full">
          {gameState.inventory.length === 0 ? (
            <div className="py-12 text-center text-white/50 text-xs flex flex-col items-center gap-2">
              <span className="material-icons text-3xl text-white/30">inventory_2</span>
              <span>Tas kosong! Kumpulkan hasil panen di kebun, memancing di dermaga, atau beli bibit di toko.</span>
            </div>
          ) : (
            <>
              {/* Desktop Scroll Arrows */}
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

              {/* Shelf track */}
              <div
                ref={scrollContainerRef}
                className="flex flex-row items-stretch gap-3 overflow-x-auto py-2 px-1 scroll-smooth no-scrollbar touch-pan-x"
              >
                {gameState.inventory.map((item) => (
                  <div
                    key={item.id}
                    className="flex-shrink-0 w-36 sm:w-44 p-3.5 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 flex flex-col justify-between transition-colors shadow-sm relative group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                        <span className="material-icons text-xl">{item.icon}</span>
                      </div>
                      <span className="text-xs font-black text-amber-200 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30 tabular-nums">
                        x{item.count}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 mb-2">
                      <div className="text-xs font-bold text-white truncate" title={item.name}>
                        {item.name}
                      </div>
                      <div className="text-[10px] text-white/60 line-clamp-2 leading-tight">
                        {item.description}
                      </div>
                    </div>

                    <div className="mt-auto pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                      <span className="text-white/50">Nilai Jual:</span>
                      <span className="font-bold text-emerald-400 tabular-nums">{item.sellValue} G</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between pt-2 border-t border-white/15 text-[11px] text-white/70">
          <div className="flex items-center gap-1.5">
            <span className="material-icons text-xs text-amber-300">swipe</span>
            <span>Geser ke kiri / kanan untuk melihat barang lainnya</span>
          </div>
          <button
            onClick={close}
            type="button"
            className="text-amber-300 font-bold hover:underline cursor-pointer active:scale-95"
          >
            Tutup Tas ✕
          </button>
        </div>
      </div>
    </div>
  );
};
