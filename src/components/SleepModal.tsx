import React from 'react';
import { useGameState } from '../services/game-state';

export const SleepModal: React.FC = () => {
  const gameState = useGameState();

  const startDay = () => {
    gameState.setIsSleepSummaryOpen(false);
  };

  if (!gameState.isSleepSummaryOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 pointer-events-auto">
      <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-300/80 bg-black/90 text-white p-6 shadow-2xl flex flex-col gap-4 text-center">
        {/* Sun Icon */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="material-icons text-4xl text-amber-400 animate-spin"
            style={{ animationDuration: '12s' }}
          >
            wb_sunny
          </span>
          <h2 className="text-lg font-black text-amber-300 uppercase tracking-wider">
            Selamat Pagi! (Day {gameState.sleepSummary?.day})
          </h2>
          <p className="text-xs text-white/70">
            Musim {gameState.season} · Cuaca: {gameState.weather}
          </p>
        </div>

        {/* Earnings Card */}
        <div className="p-4 rounded-2xl border border-amber-400/40 bg-amber-950/30 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-white/80">
            <span>Barang Terjual (Shipped):</span>
            <span className="font-bold">{gameState.sleepSummary?.itemsSold || 0} item</span>
          </div>

          <div className="flex items-center justify-between text-sm font-black text-amber-300 pt-2 border-t border-white/10">
            <span>Pendapatan Hari Ini:</span>
            <span className="tabular-nums">+{gameState.sleepSummary?.earned || 0} G</span>
          </div>
        </div>

        <div className="text-[11px] text-white/60">
          Stamina pulih sepenuhnya. Tanaman yang disiram telah bertumbuh!
        </div>

        <button
          onClick={startDay}
          className="w-full py-3 rounded-2xl border border-amber-400 bg-amber-500 text-slate-950 font-black text-sm uppercase tracking-wide active:scale-98 transition-transform shadow-lg"
        >
          Mulai Hari Baru (Start Day)
        </button>
      </div>
    </div>
  );
};
