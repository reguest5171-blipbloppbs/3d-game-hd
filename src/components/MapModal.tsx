import React, { useState } from 'react';
import { useGameState } from '../services/game-state';
import { AreaId } from '../models/game.models';


interface MapAreaNode {
  id: AreaId;
  name: string;
  sub: string;
  icon: string;
  xPercent: number; // 0..100
  yPercent: number; // 0..100
  desc: string;
}

export const MapModal: React.FC = () => {
  const gameState = useGameState();
  const [selectedNode, setSelectedNode] = useState<MapAreaNode | null>(null);
  const [copied, setCopied] = useState(false);

  const areaNodes: MapAreaNode[] = [
    {
      id: 'farm',
      name: 'Kebun Solaria',
      sub: 'Solaria Farmstead',
      icon: 'agriculture',
      xPercent: 50,
      yPercent: 56,
      desc: 'Pusat bercocok tanam: petak tanah, sumur air, kincir angin, kandang sapi & domba, dan kotak penjualan hasil panen.'
    },
    {
      id: 'house',
      name: 'Rumah Petani',
      sub: "Farmer's Cottage",
      icon: 'home',
      xPercent: 34,
      yPercent: 58,
      desc: 'Interior pondok kayu dengan kasur untuk tidur & memajukan hari, perapian hangat, dan meja makan.'
    },
    {
      id: 'town',
      name: 'Kota & Dermaga',
      sub: 'Harmonica Town',
      icon: 'holiday_village',
      xPercent: 78,
      yPercent: 62,
      desc: 'Alun-alun kota dengan air mancur batu, warga pulau, dan Dermaga Seagull untuk memancing ikan laut.'
    },
    {
      id: 'shop',
      name: 'Toko Maya',
      sub: 'General Store',
      icon: 'storefront',
      xPercent: 74,
      yPercent: 38,
      desc: 'Toko bibit tanaman yang dikelola Maya: Turnip, Strawberry, Jagung, dan Labu Emas.'
    },
    {
      id: 'goddess_tree',
      name: 'Pohon Keramat',
      sub: 'Whispering Tree',
      icon: 'nature_people',
      xPercent: 50,
      yPercent: 20,
      desc: 'Tebing tinggi di utara pulau tempat Pohon Keramat raksasa dan peri Fin menaungi kedamaian Solaria.'
    }
  ];

  const close = () => {
    gameState.setIsMapOpen(false);
  };

  const openSettings = () => {
    gameState.setIsMapOpen(false);
    gameState.setIsSettingsOpen(true);
  };

  const exitFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.debug('Exit fullscreen error:', err);
      });
      gameState.showToast('Keluar dari layar penuh.');
    } else {
      gameState.showToast('Layar sedang tidak dalam mode fullscreen.');
    }
  };

  const copyCoordinates = () => {
    const c = gameState.playerCoords;
    const area = gameState.areaName;
    const text = `X: ${c.x.toFixed(1)}, Y: ${c.y.toFixed(1)}m (Ketinggian), Z: ${c.z.toFixed(1)} [${area}]`;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        gameState.showToast(`Koordinat tersalin: ${text}`);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    if (typeof document === 'undefined') return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      gameState.showToast(`Koordinat tersalin: ${text}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      gameState.showToast('Gagal menyalin koordinat.');
    }
    document.body.removeChild(ta);
  };

  const openDevEditor = () => {
    gameState.setIsMapOpen(false);
    gameState.setIsDevEditorOpen(true);
  };

  if (!gameState.isMapOpen) return null;

  const activeNode = selectedNode || areaNodes.find(n => n.id === gameState.currentArea) || areaNodes[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none animate-in fade-in duration-150">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Tutup latar belakang"
        onClick={close}
        className="absolute inset-0 bg-black/75 cursor-default"
      ></button>

      {/* Map Container */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl rounded-3xl border-2 border-amber-300/80 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-3 max-h-[92vh] overflow-y-auto z-10"
      >
        {/* Top Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/20 pb-2.5 bg-neutral-950/95 -mt-1 pt-1">
          <div className="flex items-center gap-2">
            <span className="material-icons text-amber-400 text-xl">map</span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wide leading-tight">
                Peta Pulau Solaria (Island Map)
              </h2>
              <div className="text-[10px] text-white/70">
                Posisi saat ini: <strong className="text-emerald-400">{gameState.areaName}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Gold info */}
            <div className="flex items-center gap-1 px-3 py-1 rounded-2xl border border-amber-400/40 bg-amber-950/60 text-amber-300 shadow-sm">
              <span className="material-icons text-base text-amber-400">monetization_on</span>
              <span className="text-xs sm:text-sm font-black tabular-nums tracking-wide">
                {gameState.gold} G
              </span>
            </div>

            {/* Settings */}
            <button
              onClick={openSettings}
              className="w-8 h-8 rounded-full border border-sky-300/40 bg-sky-950/50 active:bg-sky-800/60 text-sky-200 flex items-center justify-center transition-transform active:scale-95 shadow-sm"
              title="Buka Pengaturan Kontrol & Suara"
            >
              <span className="material-icons text-base">settings</span>
            </button>

            {/* Exit Fullscreen */}
            <button
              onClick={exitFullscreen}
              className="w-8 h-8 rounded-full border border-rose-300/40 bg-rose-950/50 active:bg-rose-800/60 text-rose-200 flex items-center justify-center transition-transform active:scale-95 shadow-sm"
              title="Keluar dari Layar Penuh"
            >
              <span className="material-icons text-base">fullscreen_exit</span>
            </button>

            {/* Close */}
            <button
              onClick={close}
              type="button"
              className="px-2.5 py-1 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center gap-1 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Tutup Peta"
            >
              <span className="material-icons text-sm">close</span>
              <span>Tutup</span>
            </button>
          </div>
        </div>

        {/* Topography vector map */}
        <div className="relative w-full h-56 sm:h-72 rounded-2xl border border-white/20 bg-gradient-to-b from-sky-900/60 via-emerald-950/40 to-sky-950/80 overflow-hidden shadow-inner">
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 400 250">
            <path d="M10,20 Q50,10 90,20 T170,20 T250,20 T330,20 T400,20" fill="none" stroke="#38bdf8" strokeWidth="1" />
            <path d="M0,230 Q60,220 120,230 T240,230 T360,230" fill="none" stroke="#38bdf8" strokeWidth="1" />
            <path
              d="M 60,110 C 70,50 160,25 240,35 C 310,45 360,90 350,160 C 340,210 260,230 180,225 C 100,220 50,170 60,110 Z"
              fill="#2e7d32"
              stroke="#66bb6a"
              strokeWidth="2"
            />
            <path
              d="M 54,110 C 64,45 160,20 245,30 C 318,40 370,88 358,165 C 346,218 262,238 178,232 C 92,226 44,173 54,110 Z"
              fill="none"
              stroke="#fde047"
              strokeWidth="3"
              opacity="0.6"
            />
            <line x1="190" y1="130" x2="190" y2="85" stroke="#fef08a" strokeWidth="2.5" strokeDasharray="4" />
            <line x1="190" y1="130" x2="300" y2="150" stroke="#fef08a" strokeWidth="2.5" strokeDasharray="4" />
            <line x1="190" y1="130" x2="130" y2="135" stroke="#fef08a" strokeWidth="2.5" strokeDasharray="4" />
            <line x1="190" y1="130" x2="200" y2="45" stroke="#fef08a" strokeWidth="2.5" strokeDasharray="4" />
          </svg>

          {/* Interactive nodes */}
          {areaNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNode(node)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center group transition-transform active:scale-95"
              style={{ left: `${node.xPercent}%`, top: `${node.yPercent}%` }}
            >
              <div
                className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center shadow-lg transition-all ${
                  gameState.currentArea === node.id
                    ? 'border-emerald-300 bg-emerald-600 scale-110'
                    : activeNode.id === node.id
                    ? 'border-white/90 bg-neutral-800 scale-105'
                    : 'border-white/50 bg-black/70'
                }`}
              >
                <span className="material-icons text-xl text-white">{node.icon}</span>
              </div>

              <div
                className={`mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-tight whitespace-nowrap shadow-md ${
                  gameState.currentArea === node.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-black/70 text-white'
                }`}
              >
                {node.name}
              </div>

              {gameState.currentArea === node.id && (
                <div className="absolute -top-3 flex items-center gap-0.5 bg-amber-400 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-full animate-bounce shadow">
                  <span>📍 ANDA</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* GPS Coordinates & Actions */}
        <div className="px-3.5 py-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-950/40 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
              <span className="material-icons text-base text-emerald-400 animate-pulse">my_location</span>
              <span>Koordinat 3D:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px] font-bold">
              <div className="px-2 py-0.5 rounded-lg border border-sky-400/40 bg-sky-950/70 text-sky-200 flex items-center gap-1">
                <span className="text-[9px] text-sky-400 font-normal">X</span>
                <span>{gameState.playerCoords.x > 0 ? '+' : ''}{gameState.playerCoords.x.toFixed(1)}</span>
              </div>

              <div className="px-2 py-0.5 rounded-lg border border-amber-400/40 bg-amber-950/70 text-amber-200 flex items-center gap-1">
                <span className="text-[9px] text-amber-400 font-normal">Y (Tinggi)</span>
                <span>{gameState.playerCoords.y > 0 ? '+' : ''}{gameState.playerCoords.y.toFixed(1)} m</span>
              </div>

              <div className="px-2 py-0.5 rounded-lg border border-indigo-400/40 bg-indigo-950/70 text-indigo-200 flex items-center gap-1">
                <span className="text-[9px] text-indigo-400 font-normal">Z</span>
                <span>{gameState.playerCoords.z > 0 ? '+' : ''}{gameState.playerCoords.z.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={openDevEditor}
              className="px-3 py-1.5 rounded-xl border border-amber-400 bg-amber-500 hover:bg-amber-600 text-white active:scale-95 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow focus:outline-none"
              title="Buka Alat Sculpting & Editor Objek (Dev Mode)"
            >
              <span className="material-icons text-sm">handyman</span>
              <span>Map Editor</span>
            </button>

            <button
              type="button"
              onClick={copyCoordinates}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-black transition-all active:scale-95 cursor-pointer shadow focus:outline-none ${
                copied
                  ? 'border-emerald-400 bg-emerald-600 text-white'
                  : 'border-amber-400/50 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
              }`}
              title="Salin Koordinat (X, Y Ketinggian, Z) ke Clipboard"
            >
              <span className="material-icons text-sm">{copied ? 'check_circle' : 'content_copy'}</span>
              <span>{copied ? 'Tersalin!' : 'Salin'}</span>
            </button>
          </div>
        </div>

        {/* Selected area details */}
        <div className="p-3 rounded-2xl border border-white/15 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <span className="material-icons">{activeNode.icon}</span>
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>{activeNode.name}</span>
                {gameState.currentArea === activeNode.id && (
                  <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded">
                    LOKASI ANDA
                  </span>
                )}
              </div>
              <div className="text-[10px] text-white/70 mt-0.5">
                {activeNode.desc}
              </div>
            </div>
          </div>

          <div className="text-[10px] font-medium text-amber-200/80 text-right max-w-[120px]">
            Jalur jalan kaki dapat diakses langsung di dunia 3D.
          </div>
        </div>
      </div>
    </div>
  );
};
