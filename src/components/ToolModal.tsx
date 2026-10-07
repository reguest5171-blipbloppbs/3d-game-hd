import React, { useRef, useEffect } from 'react';
import { useGameState } from '../services/game-state';
import { ToolType } from '../models/game.models';
import { audioService } from '../services/audio';

export const ToolModal: React.FC = () => {
  const gameState = useGameState();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    gameState.setIsToolMenuOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState.isToolMenuOpen) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.isToolMenuOpen]);

  const selectTool = (id: ToolType) => {
    gameState.setTool(id);
    audioService.playSelect();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    setTimeout(() => {
      close();
    }, 200);
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -160, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 160, behavior: 'smooth' });
    }
  };

  const getToolDescription = (id: ToolType): string => {
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
  };

  if (!gameState.isToolMenuOpen) return null;

  return (
    <div className="fixed inset-0 z-55 flex flex-col justify-end sm:justify-center items-center p-3 sm:p-6 pointer-events-auto select-none animate-in fade-in duration-150">
      {/* Full-screen backdrop */}
      <button
        type="button"
        aria-label="Tutup latar belakang"
        onClick={close}
        className="absolute inset-0 bg-black/75 cursor-default"
      ></button>

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl rounded-3xl border-2 border-sky-400/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[85vh] overflow-hidden z-10"
      >
        {/* FIXED HEADER WITH CLOSE BUTTON */}
        <div className="flex items-center justify-between border-b border-white/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
              <span className="material-icons text-xl">handyman</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-sky-200 uppercase tracking-wide leading-tight">
                Rak & Kontainer Alat (Toolbox)
              </h2>
              <div className="text-[11px] text-white/70">
                Pilih alat kerja · Geser horizontal untuk melihat semua perlengkapan
              </div>
            </div>
          </div>

          <button
            onClick={close}
            className="px-3.5 py-1.5 rounded-full border-2 border-sky-300/40 bg-white/10 hover:bg-white/25 active:bg-sky-500/40 text-white flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
            title="Tutup Kontainer Alat"
          >
            <span className="material-icons text-base text-rose-300">close</span>
            <span>Tutup</span>
          </button>
        </div>

        {/* HORIZONTAL SHELF */}
        <div className="relative w-full">
          <button
            onClick={scrollLeft}
            type="button"
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-8 h-8 rounded-full border border-white/30 bg-black/80 text-white items-center justify-center hover:bg-sky-600 transition-transform active:scale-90 shadow-lg cursor-pointer"
            title="Geser ke kiri"
          >
            <span className="material-icons text-sm">chevron_left</span>
          </button>

          <button
            onClick={scrollRight}
            type="button"
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-8 h-8 rounded-full border border-white/30 bg-black/80 text-white items-center justify-center hover:bg-sky-600 transition-transform active:scale-90 shadow-lg cursor-pointer"
            title="Geser ke kanan"
          >
            <span className="material-icons text-sm">chevron_right</span>
          </button>

          <div
            ref={scrollContainerRef}
            className="flex flex-row items-stretch gap-3 overflow-x-auto py-2 px-1 scroll-smooth no-scrollbar touch-pan-x"
          >
            {gameState.toolsList.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => selectTool(tool.id)}
                className={`flex-shrink-0 w-32 sm:w-36 p-3 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-95 cursor-pointer relative overflow-hidden group ${
                  gameState.selectedTool === tool.id
                    ? 'border-sky-400 bg-sky-950/70 shadow-lg shadow-sky-500/20'
                    : 'border-white/15 bg-white/5 hover:bg-white/10'
                }`}
              >
                {/* Active Indicator Banner */}
                {gameState.selectedTool === tool.id && (
                  <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none">
                    <div className="bg-sky-400 text-slate-950 text-[8px] font-black text-center py-0.5 w-16 absolute top-2 right-[-18px] rotate-45 shadow">
                      AKTIF
                    </div>
                  </div>
                )}

                {/* Tool Icon */}
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                      gameState.selectedTool === tool.id
                        ? 'bg-sky-500/30 text-sky-300'
                        : 'bg-white/10 text-white/80'
                    }`}
                  >
                    <span className="material-icons text-2xl">{tool.icon}</span>
                  </div>

                  <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border border-white/20 bg-black/40 text-white/70">
                    Lv. 1
                  </span>
                </div>

                {/* Tool Name & description */}
                <div className="flex flex-col gap-1 mb-2">
                  <div
                    className={`text-xs font-black tracking-tight ${
                      gameState.selectedTool === tool.id ? 'text-sky-200' : 'text-white'
                    }`}
                  >
                    {tool.name}
                  </div>
                  <div className="text-[10px] text-white/60 line-clamp-2 leading-tight">
                    {getToolDescription(tool.id)}
                  </div>
                </div>

                {/* Status bottom text */}
                <div
                  className={`w-full py-1 rounded-xl text-center text-[10px] font-bold transition-colors mt-auto ${
                    gameState.selectedTool === tool.id
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-white/10 text-white/70'
                  }`}
                >
                  {gameState.selectedTool === tool.id ? '✓ Dipakai' : 'Pilih Alat'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between pt-2 border-t border-white/15 text-[11px] text-white/70">
          <div className="flex items-center gap-1.5">
            <span className="material-icons text-xs text-amber-300">swipe</span>
            <span>Geser ke kiri / kanan untuk melihat alat lainnya</span>
          </div>
          <button
            onClick={close}
            type="button"
            className="text-sky-300 font-bold hover:underline cursor-pointer active:scale-95"
          >
            Kembali ke Game ✕
          </button>
        </div>
      </div>
    </div>
  );
};
