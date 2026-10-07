import React, { useState } from 'react';
import { useGameState } from '../services/game-state';

export const PerfModal: React.FC = () => {
  const gameState = useGameState();
  const [copied, setCopied] = useState(false);

  const close = () => {
    gameState.setIsPerfModalOpen(false);
  };

  const getScreenRes = () => {
    if (typeof window === 'undefined') return 'N/A';
    return `${window.screen.width} x ${window.screen.height}`;
  };

  const getViewportRes = () => {
    if (typeof window === 'undefined') return 'N/A';
    return `${window.innerWidth} x ${window.innerHeight}`;
  };

  const getPixelRatio = () => {
    if (typeof window === 'undefined') return '1.0x';
    return `${(window.devicePixelRatio || 1).toFixed(2)}x`;
  };

  const getCpuCores = () => {
    if (typeof navigator === 'undefined' || !navigator.hardwareConcurrency) return 'Unknown';
    return `${navigator.hardwareConcurrency} Cores`;
  };

  const getMemory = () => {
    if (typeof navigator === 'undefined') return 'N/A';
    const nav = navigator as any;
    return nav.deviceMemory ? `≥ ${nav.deviceMemory} GB` : 'N/A';
  };

  const getMaxTouch = () => {
    if (typeof navigator === 'undefined') return 'N/A';
    return navigator.maxTouchPoints > 0 ? `Ya (${navigator.maxTouchPoints} Titik)` : 'Mouse / Non-Touch';
  };

  const getOrientation = () => {
    if (typeof window === 'undefined') return 'Landscape';
    return window.innerWidth >= window.innerHeight ? 'Landscape' : 'Portrait';
  };

  const copyStatsReport = () => {
    const report = [
      `=== HARVEST MOON: WHISPERING TREE 3D - LAPORAN PERFORMA ===`,
      `Tanggal: ${new Date().toLocaleString()}`,
      ``,
      `--- STATISTIK PERFORMA REALTIME ---`,
      `Framerate: ${gameState.fps} FPS`,
      `Frame Time: ${gameState.frameTimeMs} ms`,
      `Draw Calls: ${gameState.drawCalls}`,
      `Triangles: ${gameState.triangles.toLocaleString()}`,
      `Geometries in VRAM: ${gameState.geometriesCount}`,
      `Textures in VRAM: ${gameState.texturesCount}`,
      ``,
      `--- SPESIFIKASI PERANGKAT & LAYAR ---`,
      `GPU Renderer: ${gameState.gpuInfo}`,
      `Resolusi Layar: ${getScreenRes()}`,
      `Ukuran Viewport: ${getViewportRes()}`,
      `Device Pixel Ratio: ${getPixelRatio()}`,
      `CPU Cores: ${getCpuCores()}`,
      `Estimasi RAM: ${getMemory()}`,
      `Max Touch Points: ${getMaxTouch()}`,
      `Orientasi: ${getOrientation()}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      ``,
      `--- FITUR GAME ENGINE ---`,
      `Area Aktif: ${gameState.areaName}`,
      `Waktu Game: Hari ${gameState.day}, ${gameState.season} (${gameState.timeFormatted})`,
      `Cuaca: ${gameState.weather}`,
      `Target FPS: 60 FPS (V-Sync)`,
      `Optimasi Perangkat Bawah: Aktif (Rasio Piksel Terkunci 1.25x, Zero Blur, Geometri Low-Poly)`,
      `Mesin Audio: Web Audio API Synthesizer (Nol Beban Jaringan)`,
      `Opacity HUD: ${(gameState.hudOpacity * 100).toFixed(0)}%`,
      `Skala Kontrol: ${(gameState.controlScale * 100).toFixed(0)}%`,
      `============================================================`
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(report).then(() => {
        onCopiedSuccess();
      }).catch(() => {
        fallbackCopy(report);
      });
    } else {
      fallbackCopy(report);
    }
  };

  const fallbackCopy = (text: string) => {
    if (typeof document === 'undefined') return;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      onCopiedSuccess();
    } catch (err) {
      console.error('Fallback copy error:', err);
    }
    document.body.removeChild(textArea);
  };

  const onCopiedSuccess = () => {
    setCopied(true);
    gameState.showToast('Laporan performa & perangkat berhasil disalin!');
    setTimeout(() => {
      setCopied(false);
    }, 2800);
  };

  if (!gameState.isPerfModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none animate-in fade-in duration-150">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Tutup latar belakang"
        onClick={close}
        className="absolute inset-0 bg-black/80 cursor-default"
      ></button>

      {/* Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl rounded-3xl border-2 border-emerald-400/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto z-10"
      >
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/20 pb-2.5 bg-neutral-950/95 -mt-1 pt-1">
          <div className="flex items-center gap-2">
            <span className="material-icons text-emerald-400 text-xl">speed</span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-emerald-300 uppercase tracking-wide leading-tight">
                Statistik Performa & Perangkat
              </h2>
              <div className="text-[10px] text-white/70">
                Harvest Moon: Whispering Tree 3D · Low-End Engine Diagnostics
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live FPS badge */}
            <div
              className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black tracking-tight ${
                gameState.fps >= 50
                  ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300'
                  : gameState.fps >= 30
                  ? 'border-amber-400 bg-amber-950/60 text-amber-300'
                  : 'border-rose-400 bg-rose-950/60 text-rose-300'
              }`}
            >
              ● {gameState.fps} FPS
            </div>

            {/* Close button */}
            <button
              onClick={close}
              type="button"
              className="px-2.5 py-1 rounded-full border border-white/30 bg-white/10 hover:bg-white/25 active:bg-emerald-500/40 text-white flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
              title="Tutup Diagnostik"
            >
              <span className="material-icons text-sm">close</span>
              <span>Tutup</span>
            </button>
          </div>
        </div>

        {/* Section 1: Real-time Rendering Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col">
            <span className="text-[10px] text-white/60 uppercase font-bold">Framerate</span>
            <span className="text-lg font-black text-emerald-400 tabular-nums">
              {gameState.fps} <span className="text-xs font-normal">FPS</span>
            </span>
            <span className="text-[9px] text-white/50">Delta: {gameState.frameTimeMs} ms</span>
          </div>

          <div className="p-2.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col">
            <span className="text-[10px] text-white/60 uppercase font-bold">Draw Calls</span>
            <span className="text-lg font-black text-sky-400 tabular-nums">
              {gameState.drawCalls}
            </span>
            <span className="text-[9px] text-white/50">Dioptimasi &lt; 45</span>
          </div>

          <div className="p-2.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col">
            <span className="text-[10px] text-white/60 uppercase font-bold">Triangles</span>
            <span className="text-lg font-black text-amber-300 tabular-nums">
              {gameState.triangles.toLocaleString()}
            </span>
            <span className="text-[9px] text-white/50">Poligon Rendah</span>
          </div>

          <div className="p-2.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col">
            <span className="text-[10px] text-white/60 uppercase font-bold">VRAM Objects</span>
            <span className="text-lg font-black text-purple-300 tabular-nums">
              {gameState.geometriesCount} Geo
            </span>
            <span className="text-[9px] text-white/50">{gameState.texturesCount} Tekstur</span>
          </div>
        </div>

        {/* Section 2: Info Hardware & Perangkat */}
        <div className="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <span className="material-icons text-base text-amber-400">devices</span>
            <span>Informasi Perangkat & Layar</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">GPU / Renderer:</span>
              <span className="font-bold text-white text-right max-w-[200px] truncate" title={gameState.gpuInfo}>
                {gameState.gpuInfo}
              </span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Resolusi Layar:</span>
              <span className="font-bold text-white">{getScreenRes()}</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Ukuran Viewport:</span>
              <span className="font-bold text-white">{getViewportRes()}</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Device Pixel Ratio:</span>
              <span className="font-bold text-emerald-300">{getPixelRatio()} (Dibatasi maks 1.25x)</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">CPU Cores / Threads:</span>
              <span className="font-bold text-white">{getCpuCores()}</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Estimasi RAM:</span>
              <span className="font-bold text-white">{getMemory()}</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Touch Screen:</span>
              <span className="font-bold text-white">{getMaxTouch()}</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Orientasi:</span>
              <span className="font-bold text-white">{getOrientation()}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Fitur Mesin Game & Optimasi */}
        <div className="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
            <span className="material-icons text-base text-sky-400">memory</span>
            <span>Fitur & Status Sistem Game</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Lokasi Area:</span>
              <span className="font-bold text-emerald-300">{gameState.areaName}</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Kamera 3D:</span>
              <span className="font-bold text-white">Elevated 38° Isometric Follow</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Optimasi Draw Calls:</span>
              <span className="font-bold text-emerald-400">Merged Static Geometries (&lt;45 Calls)</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Kamera Bayangan:</span>
              <span className="font-bold text-amber-300">Precision Frustum Focused (18x18m)</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Efek Tilt-Shift Miniatur:</span>
              <span className={`font-bold ${gameState.tiltShiftEnabled ? 'text-violet-300' : 'text-white/50'}`}>
                {gameState.tiltShiftEnabled ? 'Aktif (Diorama Blur Shader)' : 'Mati (Direct Render)'}
              </span>
            </div>

            {gameState.totalChunks > 0 && (
              <div className="flex justify-between border-b border-white/5 py-0.5">
                <span className="text-white/60">Vegetation Chunk Culling:</span>
                <span className="font-bold text-emerald-300 tabular-nums">
                  {gameState.visibleChunks} / {gameState.totalChunks} Chunk Aktif (Grid 24x24m)
                </span>
              </div>
            )}

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Mesin Audio:</span>
              <span className="font-bold text-white">Synthesizer Web Audio API (Nol Download)</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Opacity HUD:</span>
              <span className="font-bold text-white">{Math.round(gameState.hudOpacity * 100)}%</span>
            </div>

            <div className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-white/60">Ukuran Kontroler:</span>
              <span className="font-bold text-white">{Math.round(gameState.controlScale * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-white/15">
          <button
            onClick={copyStatsReport}
            className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2 text-xs font-black transition-all active:scale-95 shadow-md ${
              copied
                ? 'border-amber-400 bg-amber-500 text-slate-950'
                : 'border-emerald-400 bg-emerald-600 text-white'
            }`}
          >
            <span className="material-icons text-base">{copied ? 'check_circle' : 'content_copy'}</span>
            <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Info Performa & Perangkat'}</span>
          </button>

          <button
            onClick={close}
            className="px-5 py-2.5 rounded-2xl border border-white/20 bg-white/10 active:bg-white/20 text-white text-xs font-bold transition-all active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
