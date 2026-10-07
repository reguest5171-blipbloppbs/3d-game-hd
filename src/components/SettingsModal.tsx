import React, { useEffect } from 'react';
import { useGameState } from '../services/game-state';
import { audioService } from '../services/audio';

export const SettingsModal: React.FC = () => {
  const gameState = useGameState();

  const close = () => {
    gameState.setIsSettingsOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState.isSettingsOpen) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.isSettingsOpen]);

  const toggleSound = () => {
    audioService.toggleSound();
    gameState.saveSettings();
  };

  const testSound = () => {
    audioService.playHarvest();
  };

  const toggleShadows = () => {
    gameState.setShadowsEnabled(!gameState.shadowsEnabled);
    gameState.saveSettings();
  };

  const toggleTiltShift = () => {
    gameState.setTiltShiftEnabled(!gameState.tiltShiftEnabled);
    gameState.saveSettings();
  };

  const onOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    gameState.setHudOpacity(val);
    gameState.saveSettings();
  };

  const adjustJoystickX = (delta: number) => {
    const next = Math.max(-50, Math.min(50, gameState.joystickOffsetX + delta));
    gameState.setJoystickOffsetX(next);
    gameState.saveSettings();
  };

  const adjustActionX = (delta: number) => {
    const next = Math.max(-50, Math.min(50, gameState.actionOffsetX + delta));
    gameState.setActionOffsetX(next);
    gameState.saveSettings();
  };

  const adjustOffsetY = (delta: number) => {
    const next = Math.max(-40, Math.min(40, gameState.joystickOffsetY + delta));
    gameState.setJoystickOffsetY(next);
    gameState.setActionOffsetY(next);
    gameState.saveSettings();
  };

  const toggleDevEditor = () => {
    const nextVal = !gameState.isDevEditorOpen;
    gameState.setIsDevEditorOpen(nextVal);
    gameState.setIsSettingsOpen(false);
    if (nextVal) {
      gameState.showToast('🛠️ Mode Map Editor diaktifkan! Gunakan kuas untuk memahat tanah.');
    } else {
      gameState.showToast('ℹ️ Mode Map Editor dinonaktifkan.');
    }
  };

  if (!gameState.isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none animate-in fade-in duration-150">
      <button
        type="button"
        aria-label="Tutup latar belakang"
        onClick={close}
        className="absolute inset-0 bg-black/80 cursor-default"
      ></button>

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-3xl border-2 border-sky-300/70 bg-neutral-950/95 text-white p-4 sm:p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto z-10"
      >
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/20 pb-2.5 bg-neutral-950/95 -mt-1 pt-1">
          <div className="flex items-center gap-2">
            <span className="material-icons text-sky-400">settings</span>
            <h2 className="text-sm sm:text-base font-black text-sky-300 uppercase tracking-wide">
              Pengaturan Kontrol & Audio
            </h2>
          </div>

          <button
            onClick={close}
            type="button"
            className="px-3 py-1.5 rounded-full border border-white/30 bg-white/10 hover:bg-white/25 active:bg-sky-500/40 text-white flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
            title="Tutup Pengaturan"
          >
            <span className="material-icons text-sm">close</span>
            <span>Tutup</span>
          </button>
        </div>

        {/* SFX */}
        <div className="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="material-icons text-amber-400 text-lg">volume_up</span>
              <span>Efek Suara Game (SFX)</span>
            </div>
            <button
              onClick={toggleSound}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                audioService.isSoundEnabled()
                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-300'
                  : 'border-rose-400 bg-rose-500/25 text-rose-300'
              }`}
            >
              <span className="material-icons text-sm">{audioService.isSoundEnabled() ? 'check' : 'close'}</span>
              <span>{audioService.isSoundEnabled() ? 'AKTIF (ON)' : 'MATI (MUTED)'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>Suara cangkul, siram air, petik panen, dan suara hewan ternak.</span>
            <button
              onClick={testSound}
              className="px-2 py-1 rounded-lg text-[10px] font-bold border border-white/20 bg-white/10 active:bg-white/20 text-white"
            >
              Tes Suara 🔊
            </button>
          </div>
        </div>

        {/* Per-Pixel Lighting & Graphics Pipeline */}
        <div className="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="material-icons text-amber-400 text-lg">light_mode</span>
              <span>Pencahayaan Shader (Per-Pixel Lighting)</span>
            </div>
            <span className="text-[10px] font-black text-amber-300 uppercase">
              {gameState.perPixelLighting.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'low', label: 'Low (Vertex)' },
              { id: 'high', label: 'High (Per-Pixel)' },
              { id: 'ultra', label: 'Ultra (Specular)' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  gameState.setPerPixelLighting(p.id as any);
                  gameState.saveSettings();
                }}
                className={`py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  gameState.perPixelLighting === p.id
                    ? 'border-amber-400 bg-amber-500/30 text-amber-200'
                    : 'border-white/20 hover:bg-white/10 text-white/70'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-white/60">
            {gameState.perPixelLighting === 'low'
              ? 'Pencahayaan per-vertex ringan, sangat responsif untuk CPU/GPU HP hemat daya.'
              : gameState.perPixelLighting === 'high'
              ? 'Pencahayaan per-pixel Phong realistis dengan bayangan gradien halus.'
              : 'Pencahayaan Ultra dengan bayangan specular dan efek kilau air jernih.'}
          </div>
        </div>

        {/* Anisotropic Filtering / Arbitrary Mipmap */}
        <div className="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="material-icons text-emerald-400 text-lg">texture</span>
              <span>Filtering Tekstur Mipmap (Anisotropic)</span>
            </div>
            <span className="text-[10px] font-black text-emerald-300 uppercase">
              {gameState.anisotropicFiltering}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'off', label: 'Off (Standard)' },
              { id: '4x', label: '4x (Sangat Tajam)' },
              { id: '16x', label: '16x (Ultra Crystal)' }
            ].map((af) => (
              <button
                key={af.id}
                type="button"
                onClick={() => {
                  gameState.setAnisotropicFiltering(af.id as any);
                  gameState.saveSettings();
                }}
                className={`py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  gameState.anisotropicFiltering === af.id
                    ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'
                    : 'border-white/20 hover:bg-white/10 text-white/70'
                }`}
              >
                {af.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-white/60">
            Menajamkan tekstur tanah, rumput, dan jalan setapak dari sudut pandang 3/4 isometric Harvest Moon.
          </div>
        </div>

        {/* Tilt-Shift */}
        <div className="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="material-icons text-violet-400 text-lg">blur_linear</span>
              <span>Efek Tilt-Shift Miniatur</span>
            </div>
            <button
              onClick={toggleTiltShift}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                gameState.tiltShiftEnabled
                  ? 'border-violet-400 bg-violet-500/25 text-violet-300'
                  : 'border-slate-500 bg-white/10 text-white/70'
              }`}
            >
              <span className="material-icons text-sm">{gameState.tiltShiftEnabled ? 'camera' : 'blur_off'}</span>
              <span>{gameState.tiltShiftEnabled ? 'AKTIF (Diorama Blur)' : 'MATI (Off)'}</span>
            </button>
          </div>

          <div className="text-[11px] text-white/60">
            Efek blur halus di tepi atas dan bawah layar menggunakan fragment shader untuk visual miniature aesthetic ala Tree of Tranquility.
          </div>
        </div>

        {/* Opacity */}
        <div className="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="material-icons text-sky-400 text-lg">opacity</span>
              <span>Transparansi HUD & Kontroler (Opacity)</span>
            </div>
            <span className="text-xs font-black text-sky-300 tabular-nums">
              {Math.round(gameState.hudOpacity * 100)}%
            </span>
          </div>

          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={gameState.hudOpacity}
            onChange={onOpacityChange}
            className="w-full accent-sky-400 cursor-pointer h-2 bg-white/20 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[9px] text-white/50">
            <span>Sangat Transparan (20%)</span>
            <span>Rekomendasi (75%)</span>
            <span>Pekat (100%)</span>
          </div>
        </div>

        {/* Button scale */}
        <div className="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="material-icons text-amber-400 text-lg">aspect_ratio</span>
              <span>Ukuran Tombol & Joystick (Button Size)</span>
            </div>
            <span className="text-xs font-black text-amber-300 tabular-nums">
              {Math.round(gameState.controlScale * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[0.85, 1.0, 1.15, 1.30].map((scale) => (
              <button
                key={scale}
                onClick={() => {
                  gameState.setControlScale(scale);
                  gameState.saveSettings();
                }}
                className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  gameState.controlScale === scale
                    ? 'border-amber-400 bg-amber-500/30'
                    : 'border-white/20'
                }`}
              >
                {scale === 0.85 ? 'Kecil (85%)' : scale === 1.0 ? 'Normal (100%)' : scale === 1.15 ? 'Besar (115%)' : 'Ekstra (130%)'}
              </button>
            ))}
          </div>
        </div>

        {/* Map Editor toggle inside settings */}
        <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-950/10 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <span className="material-icons text-amber-400 text-lg">construction</span>
              <span>Developer Map Terrain Editor</span>
            </div>
            <button
              onClick={toggleDevEditor}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                gameState.isDevEditorOpen
                  ? 'border-amber-400 bg-amber-500/25 text-amber-300'
                  : 'border-white/20 text-white/60'
              }`}
            >
              <span className="material-icons text-sm">{gameState.isDevEditorOpen ? 'build' : 'close'}</span>
              <span>{gameState.isDevEditorOpen ? 'AKTIF (ON)' : 'MATI (OFF)'}</span>
            </button>
          </div>
          <div className="text-[11px] text-white/60">
            Aktifkan editor medan tanah 3D untuk memahat ketinggian tanah (*sculpting*) serta menaruh objek dekorasi secara langsung di Pulau Solaria.
          </div>
        </div>

        {/* Position adjustments */}
        <div className="p-3.5 rounded-2xl border border-white/15 bg-white/5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <span className="material-icons text-emerald-400 text-lg">tune</span>
            <span>Penyesuaian Posisi Kontroler (Position Modifier)</span>
          </div>

          {/* Joystick adjustment */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">Posisi Joystick (Kiri / Kanan):</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustJoystickX(-10)}
                className="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
              >
                ◀
              </button>
              <span className="text-xs font-bold tabular-nums w-10 text-center text-emerald-300">
                {gameState.joystickOffsetX > 0 ? '+' : ''}{gameState.joystickOffsetX}px
              </span>
              <button
                onClick={() => adjustJoystickX(10)}
                className="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Action button X adjustment */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">Posisi Tombol Aksi (Kiri / Kanan):</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustActionX(-10)}
                className="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
              >
                ◀
              </button>
              <span className="text-xs font-bold tabular-nums w-10 text-center text-emerald-300">
                {gameState.actionOffsetX > 0 ? '+' : ''}{gameState.actionOffsetX}px
              </span>
              <button
                onClick={() => adjustActionX(10)}
                className="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Height adjustment */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">Ketinggian Tombol (Bawah / Atas):</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustOffsetY(-10)}
                className="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
              >
                ▼
              </button>
              <span className="text-xs font-bold tabular-nums w-10 text-center text-emerald-300">
                {gameState.joystickOffsetY > 0 ? '+' : ''}{gameState.joystickOffsetY}px
              </span>
              <button
                onClick={() => adjustOffsetY(10)}
                className="w-7 h-7 rounded-lg border border-white/20 bg-white/10 active:bg-white/30 flex items-center justify-center font-black"
              >
                ▲
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/15">
          <button
            onClick={() => gameState.resetSettings()}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-400/40 bg-rose-950/40 text-rose-300 active:scale-95 transition-transform"
          >
            Reset ke Default
          </button>

          <button
            onClick={close}
            className="px-5 py-2 rounded-xl text-xs font-bold border border-sky-400 bg-sky-500 text-slate-950 uppercase tracking-wide active:scale-95 transition-transform"
          >
            Simpan & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
