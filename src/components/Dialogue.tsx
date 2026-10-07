import React from 'react';
import { useGameState } from '../services/game-state';

export const Dialogue: React.FC = () => {
  const gameState = useGameState();

  if (!gameState.activeDialogue) return null;

  return (
    <div className="absolute inset-x-0 bottom-4 sm:bottom-6 mx-auto max-w-xl px-4 z-40 pointer-events-auto">
      {/* Dialogue Box */}
      <div className="rounded-3xl border-2 border-amber-300/60 bg-black/85 text-white p-4 shadow-2xl flex flex-col gap-3">
        {/* NPC Header */}
        <div className="flex items-center gap-3">
          {/* NPC Avatar Circle */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md border border-white/30"
            style={{ backgroundColor: gameState.activeDialogue.npc?.color || '#3b82f6' }}
          >
            {gameState.activeDialogue.npc?.name?.charAt(0)}
          </div>

          {/* NPC Info */}
          <div>
            <div className="text-sm font-black text-amber-300 tracking-wide">
              {gameState.activeDialogue.npc?.name}
            </div>
            <div className="text-[11px] font-medium text-white/70">
              {gameState.activeDialogue.npc?.title}
            </div>
          </div>

          {/* Heart Rating */}
          <div className="ml-auto flex items-center gap-0.5 text-rose-400">
            <span className="material-icons text-sm">favorite</span>
            <span className="text-xs font-bold">{gameState.activeDialogue.npc?.hearts}/5</span>
          </div>
        </div>

        {/* Dialogue Text Body */}
        <div className="text-sm sm:text-base font-normal leading-relaxed text-white/95 px-1 min-h-[44px]">
          {gameState.activeDialogue.text}
        </div>

        {/* Choice / Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/15">
          {gameState.activeDialogue.options?.map((opt) => (
            <button
              key={opt.label}
              onClick={opt.action}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-amber-300/40 bg-amber-500/20 active:bg-amber-500/40 text-amber-200 transition-all active:scale-95 shadow-sm"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
