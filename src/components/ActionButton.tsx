import React, { useRef } from 'react';
import { useGameState } from '../services/game-state';
import { world3dService } from '../game/world-3d';

export const ActionButton: React.FC = () => {
  const gameState = useGameState();
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const hasSwipedRef = useRef(false);

  const onActionPress = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    gameState.executeCurrentAction();
    world3dService.rebuildFarmPlots();
  };

  const toggleRun = () => {
    gameState.setIsRunning(!gameState.isRunning);
  };

  const currentToolIcon = () => {
    const cur = gameState.selectedTool;
    const t = gameState.toolsList.find(item => item.id === cur);
    return t ? t.icon : 'handyman';
  };

  const currentToolName = () => {
    const cur = gameState.selectedTool;
    const t = gameState.toolsList.find(item => item.id === cur);
    return t ? t.name : 'Tool';
  };

  const openToolMenu = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    gameState.setIsToolMenuOpen(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const onTouchStartTool = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      touchStartXRef.current = t.clientX;
      touchStartYRef.current = t.clientY;
      isLongPressTriggeredRef.current = false;
      hasSwipedRef.current = false;

      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        gameState.setIsToolMenuOpen(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(30);
        }
      }, 400);
    }
  };

  const onTouchMoveTool = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (e.touches.length > 0 && !isLongPressTriggeredRef.current) {
      const t = e.touches[0];
      const dx = t.clientX - touchStartXRef.current;
      const dy = t.clientY - touchStartYRef.current;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 22 && !hasSwipedRef.current) {
        clearLongPressTimer();
        hasSwipedRef.current = true;
        gameState.cycleToolPrev();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }
    }
  };

  const onTouchEndTool = () => {
    clearLongPressTimer();
    if (!isLongPressTriggeredRef.current && !hasSwipedRef.current) {
      gameState.cycleToolNext();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    }
  };

  const onMouseDownTool = (e: React.MouseEvent<HTMLButtonElement>) => {
    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    isLongPressTriggeredRef.current = false;
    hasSwipedRef.current = false;

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      gameState.setIsToolMenuOpen(true);
    }, 450);
  };

  const onMouseUpTool = (e: React.MouseEvent<HTMLButtonElement>) => {
    const dx = e.clientX - touchStartXRef.current;
    const dy = e.clientY - touchStartYRef.current;
    const dist = Math.sqrt(dx * dx + dy * dy);

    clearLongPressTimer();

    if (!isLongPressTriggeredRef.current) {
      if (dist > 20) {
        gameState.cycleToolPrev();
      } else {
        gameState.cycleToolNext();
      }
    }
  };

  return (
    <div
      className="relative flex items-end gap-3 pointer-events-auto select-none touch-manipulation origin-bottom-right transition-transform duration-100"
      style={{
        opacity: gameState.hudOpacity,
        transform: `scale(${gameState.controlScale})`,
        transformOrigin: 'bottom right',
        marginRight: `${-gameState.actionOffsetX}px`,
        marginBottom: `${gameState.actionOffsetY}px`
      }}
    >
      {/* Secondary Action Cluster: Tool button & Run toggle */}
      <div className="flex flex-col gap-2 items-center">
        {/* Sprint / Run Toggle Button */}
        <button
          onClick={toggleRun}
          className={`w-11 h-11 rounded-full border border-white/30 bg-black/25 active:bg-white/20 flex flex-col items-center justify-center text-white transition-transform active:scale-90 ${
            gameState.isRunning ? 'border-emerald-400 text-emerald-300' : ''
          }`}
          title="Toggle Sprint / Run"
        >
          <span className="material-icons text-xl">
            {gameState.isRunning ? 'directions_run' : 'directions_walk'}
          </span>
          <span className="text-[8px] font-bold tracking-tighter uppercase leading-none mt-0.5">
            {gameState.isRunning ? 'RUN' : 'WALK'}
          </span>
        </button>

        {/* TOOL SWITCHER BUTTON */}
        <div className="relative">
          <button
            onTouchStart={onTouchStartTool}
            onTouchMove={onTouchMoveTool}
            onTouchEnd={onTouchEndTool}
            onTouchCancel={clearLongPressTimer}
            onMouseDown={onMouseDownTool}
            onMouseUp={onMouseUpTool}
            className="w-13 h-13 rounded-full border-2 border-sky-300/70 bg-black/35 active:bg-sky-500/30 flex flex-col items-center justify-center text-white transition-transform active:scale-90 shadow-md touch-none"
            title="Tap: Ganti Alat · Tahan / Ketuk Titik Kotak: Buka Rak Alat Lengkap"
          >
            <span className="material-icons text-2xl text-sky-200">{currentToolIcon()}</span>
            <span className="text-[9px] font-bold text-sky-100 uppercase tracking-tight leading-none mt-0.5">
              {currentToolName()}
            </span>
          </button>

          {/* Quick Access Button to Open Horizontal Tool Rack Directly */}
          <button
            type="button"
            onClick={(e) => openToolMenu(e)}
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full border border-sky-300 bg-sky-700/90 active:bg-sky-500 text-white flex items-center justify-center shadow-md transition-transform active:scale-90 cursor-pointer"
            title="Buka Kontainer & Rak Alat Lengkap"
          >
            <span className="material-icons text-[12px]">apps</span>
          </button>
        </div>
      </div>

      {/* MAIN ALL-IN-ONE CONTEXTUAL ACTION BUTTON */}
      <button
        onClick={onActionPress}
        className="relative min-w-[76px] h-20 px-4 rounded-3xl border-2 border-amber-300/80 bg-black/35 active:bg-amber-500/40 text-white flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg overflow-hidden group"
      >
        {/* Subtle pulsing ring on active interaction */}
        {gameState.currentAction.type !== 'interact' && (
          <div className="absolute inset-0 rounded-3xl border border-amber-400/30 opacity-60 animate-pulse pointer-events-none"></div>
        )}

        {/* Dynamic Context Icon */}
        <span className="material-icons text-3xl text-amber-300 drop-shadow-sm group-active:scale-110 transition-transform">
          {gameState.currentAction.icon}
        </span>

        {/* Dynamic Context Label */}
        <span className="text-[11px] font-black tracking-wide uppercase text-white drop-shadow-sm leading-tight mt-0.5">
          {gameState.currentAction.label}
        </span>

        {/* Sublabel / Info */}
        {gameState.currentAction.subLabel && (
          <span className="text-[8px] font-medium text-amber-200/90 tracking-tight leading-none mt-0.5 max-w-[84px] truncate">
            {gameState.currentAction.subLabel}
          </span>
        )}
      </button>
    </div>
  );
};
