import React, { useEffect, useRef, useState } from 'react';
import { useGameState } from './services/game-state';
import { world3dService, World3dGameStateProxy } from './game/world-3d';
import { LandscapeGuard } from './components/LandscapeGuard';
import { VirtualJoystick } from './components/VirtualJoystick';
import { ActionButton } from './components/ActionButton';
import { Hud } from './components/Hud';
import { Dialogue } from './components/Dialogue';
import { ShopModal } from './components/ShopModal';
import { InventoryModal } from './components/InventoryModal';
import { SleepModal } from './components/SleepModal';
import { ToolModal } from './components/ToolModal';
import { MapModal } from './components/MapModal';
import { SettingsModal } from './components/SettingsModal';
import { PerfModal } from './components/PerfModal';
import { DevEditor } from './components/DevEditor';

export const App: React.FC = () => {
  const gameState = useGameState();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  // Maintain a live Ref to avoid stale closures inside Three.js continuous follow loop callback proxy
  const latestStateRef = useRef(gameState);
  useEffect(() => {
    latestStateRef.current = gameState;
  }, [gameState]);

  // Handle pointer Down, Move, Up, and Leave inside the Viewport for Dev Map Sculpting / Prop Painting / 3D Orbit Camera Drag
  const [isPointerDown, setIsPointerDown] = useState(false);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  const onViewportPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!gameState.isDevEditorOpen) return;
    setIsPointerDown(true);
    lastPointerPosRef.current = { x: event.clientX, y: event.clientY };
    if (!gameState.isDevFreeCamera) {
      handleViewportPointer(event, true);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onViewportPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!gameState.isDevEditorOpen) return;
    if (gameState.isDevFreeCamera && isPointerDown && lastPointerPosRef.current) {
      const deltaX = event.clientX - lastPointerPosRef.current.x;
      const deltaY = event.clientY - lastPointerPosRef.current.y;
      lastPointerPosRef.current = { x: event.clientX, y: event.clientY };

      if (event.buttons === 2 || event.shiftKey) {
        // Right click / shift drag = Pan camera focus
        world3dService.panDevCamera(-deltaX * 0.04, -deltaY * 0.04);
      } else {
        // Left click drag = Rotate 3D orbit yaw/pitch
        world3dService.rotateDevCamera(-deltaX * 0.008, deltaY * 0.008);
      }
    } else if (!gameState.isDevFreeCamera) {
      handleViewportPointer(event, isPointerDown);
    }
  };

  const onViewportPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!gameState.isDevEditorOpen) return;
    setIsPointerDown(false);
    lastPointerPosRef.current = null;
    if (!gameState.isDevFreeCamera) {
      handleViewportPointer(event, false);
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
  };

  const onViewportPointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!gameState.isDevEditorOpen) return;
    setIsPointerDown(false);
    lastPointerPosRef.current = null;
    if (!gameState.isDevFreeCamera) {
      handleViewportPointer(event, false);
    }
  };

  const onViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (gameState.isDevEditorOpen && gameState.isDevFreeCamera) {
      world3dService.zoomDevCamera(e.deltaY * 0.02);
    }
  };

  const handleViewportPointer = (event: React.PointerEvent<HTMLDivElement>, isDown: boolean) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    world3dService.updateEditorRaycast(mouseX, mouseY, isDown);
  };

  // 1. Initialize Three.js WebGL Diorama Engine once on Component Mount
  useEffect(() => {
    if (!viewportRef.current) return;

    // Create the bulletproof, dynamic Proxy that forwards all gets/sets to React state via latestStateRef
    const proxy: World3dGameStateProxy = {
      hour: () => latestStateRef.current.hour,
      minute: () => latestStateRef.current.minute,
      weather: () => latestStateRef.current.weather,
      currentArea: () => latestStateRef.current.currentArea,
      selectedTool: () => latestStateRef.current.selectedTool,
      isRunning: () => latestStateRef.current.isRunning,
      isPhotoModeOpen: () => latestStateRef.current.isPhotoModeOpen,
      isDevEditorOpen: () => latestStateRef.current.isDevEditorOpen,
      isDevGridVisible: () => latestStateRef.current.isDevGridVisible,
      isDevFreeCamera: () => latestStateRef.current.isDevFreeCamera,
      devSelectedProp: () => latestStateRef.current.devSelectedProp,
      setDevSelectedProp: (v) => latestStateRef.current.setDevSelectedProp(v),
      devEditorTool: () => latestStateRef.current.devEditorTool,
      devBrushRadius: () => latestStateRef.current.devBrushRadius,
      devBrushStrength: () => latestStateRef.current.devBrushStrength,
      animals: () => latestStateRef.current.animals,
      farmPlots: () => latestStateRef.current.farmPlots,
      npcs: () => latestStateRef.current.npcs,
      isFading: () => latestStateRef.current.isFading,
      shadowsEnabled: () => latestStateRef.current.shadowsEnabled,
      tiltShiftEnabled: () => latestStateRef.current.tiltShiftEnabled,

      fps: { set: (v) => latestStateRef.current.setFps(v) },
      frameTimeMs: { set: (v) => latestStateRef.current.setFrameTimeMs(v) },
      drawCalls: { set: (v) => latestStateRef.current.setDrawCalls(v) },
      triangles: { set: (v) => latestStateRef.current.setTriangles(v) },
      geometriesCount: { set: (v) => latestStateRef.current.setGeometriesCount(v) },
      texturesCount: { set: (v) => latestStateRef.current.setTexturesCount(v) },
      totalChunks: { set: (v) => latestStateRef.current.setTotalChunks(v) },
      visibleChunks: { set: (v) => latestStateRef.current.setVisibleChunks(v) },
      playerCoords: { set: (coords) => latestStateRef.current.setPlayerCoords(coords) },
      currentAction: { set: (act) => latestStateRef.current.setCurrentAction(act) },
      warpToArea: (area, message) => latestStateRef.current.warpToArea(area, message),
      showToast: (msg) => latestStateRef.current.showToast(msg),
      isAppLoading: { set: (loading) => latestStateRef.current.setIsAppLoading(loading) },
      gpuInfo: { set: (v) => latestStateRef.current.setGpuInfo(v) },
      isGamePaused: { set: (v) => latestStateRef.current.setIsGamePaused(v) },
    };

    world3dService.init(viewportRef.current, proxy);
    setIsLoaded(true);

    if (!gameState.isFullscreenLandscape) {
      world3dService.pauseLoop();
    } else {
      gameState.setIsAppLoading(false);
    }

    // Dismiss Initial Tutorial Info Banner after 7 seconds
    const guideTimer = setTimeout(() => {
      setShowGuide(false);
    }, 7000);

    return () => {
      clearTimeout(guideTimer);
      world3dService.destroy();
    };
  }, []);

  // 2. React Area switching trigger
  const [lastWarpedArea, setLastWarpedArea] = useState('');
  useEffect(() => {
    if (isLoaded && gameState.currentArea !== lastWarpedArea) {
      setLastWarpedArea(gameState.currentArea);
      world3dService.buildCurrentArea(gameState.currentArea);
    }
  }, [isLoaded, gameState.currentArea, lastWarpedArea]);

  // 3. React Fullscreen landscape freeze (Pause loop for 0% CPU consumption on blur)
  useEffect(() => {
    if (isLoaded) {
      if (gameState.isFullscreenLandscape) {
        world3dService.resumeLoop();
      } else {
        world3dService.pauseLoop();
      }
    }
  }, [isLoaded, gameState.isFullscreenLandscape]);

  // 4. React Grid Helper toggle
  useEffect(() => {
    if (isLoaded) {
      const showGrid = gameState.isDevEditorOpen && gameState.isDevGridVisible;
      (world3dService as any).toggleDevGrid?.(showGrid);
    }
  }, [isLoaded, gameState.isDevEditorOpen, gameState.isDevGridVisible]);

  return (
    <main className="relative w-full h-screen overflow-hidden bg-slate-900 select-none">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={viewportRef}
        className="absolute inset-0 w-full h-full z-0 touch-none"
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerLeave={onViewportPointerLeave}
        onWheel={onViewportWheel}
      ></div>

      {/* Transparent HUD Layer */}
      <Hud />

      {/* Bottom Controls Layer (Visible when NOT in photo mode or dev editor) */}
      {!gameState.isPhotoModeOpen && !gameState.isDevEditorOpen && (
        <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none flex items-end justify-between p-3 sm:p-5 safe-area-inset">
          {/* Left: Virtual Joystick */}
          <div className="pointer-events-auto">
            <VirtualJoystick />
          </div>

          {/* Center: Quick Guide Info (dismissible) */}
          {showGuide && (
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-black/40 text-white/90 text-[10px] font-semibold tracking-tight shadow-md cursor-pointer pointer-events-auto transition-opacity"
            >
              <span className="material-icons text-sm text-amber-300">touch_app</span>
              <span>Gunakan Joystick untuk jalan · Tombol Kanan untuk Aksi (Cangkul, Siram, Bicara)</span>
              <span className="text-white/40">✕</span>
            </button>
          )}

          {/* Right: Contextual Action Button */}
          <div className="pointer-events-auto">
            <ActionButton />
          </div>
        </div>
      )}

      {/* Area Switching Blackout Screen */}
      {gameState.isFading && (
        <div className="fixed inset-0 z-55 flex flex-col items-center justify-center bg-black transition-opacity duration-300 pointer-events-auto select-none">
          <div className="flex flex-col items-center gap-3">
            <span
              className="material-icons text-4xl text-amber-300 animate-spin"
              style={{ animationDuration: '3s' }}
            >
              spa
            </span>
            <div className="text-base font-black text-amber-200 uppercase tracking-widest">
              {gameState.fadeMessage}
            </div>
            <div className="text-xs text-white/60 font-medium">
              Solaria Island
            </div>
          </div>
        </div>
      )}

      {/* Overlays & Modals */}
      <Dialogue />
      <ShopModal />
      <InventoryModal />
      <ToolModal />
      <SleepModal />
      <MapModal />
      <SettingsModal />
      <PerfModal />
      <DevEditor />

      {/* Mobile orientation guard */}
      <LandscapeGuard />
    </main>
  );
};

export default App;
