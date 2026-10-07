import React, { useState, useEffect, useRef } from 'react';
import { useGameState } from '../services/game-state';
import { world3dService } from '../game/world-3d';
import { audioService } from '../services/audio';


export const Hud: React.FC = () => {
  const gameState = useGameState();
  const [showScreenshotBtn, setShowScreenshotBtn] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // Free camera properties
  const [photoX, setPhotoX] = useState(world3dService.photoFocus.x);
  const [photoZ, setPhotoZ] = useState(world3dService.photoFocus.z);
  const [photoDist, setPhotoDist] = useState(world3dService.photoDistance);
  const [photoYawDeg, setPhotoYawDeg] = useState(Math.round((world3dService.photoYaw * 180) / Math.PI));
  const [photoPitchDeg, setPhotoPitchDeg] = useState(Math.round((world3dService.photoPitch * 180) / Math.PI));

  // Sync internal slider states with service on photo mode toggle
  useEffect(() => {
    if (gameState.isPhotoModeOpen) {
      setPhotoX(world3dService.photoFocus.x);
      setPhotoZ(world3dService.photoFocus.z);
      setPhotoDist(world3dService.photoDistance);
      setPhotoYawDeg(Math.round((world3dService.photoYaw * 180) / Math.PI));
      setPhotoPitchDeg(Math.round((world3dService.photoPitch * 180) / Math.PI));
    }
  }, [gameState.isPhotoModeOpen]);

  const onFocusXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPhotoX(val);
    world3dService.photoFocus.x = val;
  };

  const onFocusZChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPhotoZ(val);
    world3dService.photoFocus.z = val;
  };

  const onDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPhotoDist(val);
    world3dService.photoDistance = val;
  };

  const onYawChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const deg = parseFloat(e.target.value);
    setPhotoYawDeg(deg);
    world3dService.photoYaw = (deg * Math.PI) / 180;
  };

  const onPitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const deg = parseFloat(e.target.value);
    setPhotoPitchDeg(deg);
    world3dService.photoPitch = (deg * Math.PI) / 180;
  };

  // Long press screenshot timer
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActiveRef = useRef(false);

  const onBtnPointerDown = () => {
    isLongPressActiveRef.current = false;
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      openPhotoMode();
    }, 450);
  };

  const onBtnPointerUp = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (!isLongPressActiveRef.current) {
      takeScreenshot();
    }
  };

  const openPhotoMode = () => {
    audioService.playSelect();
    setShowScreenshotBtn(false);
    (world3dService as any).enterPhotoMode?.();
    gameState.setIsPhotoModeOpen(true);
    gameState.showToast('📸 Mode Kamera Bebas diaktifkan!');
  };

  const exitPhotoMode = () => {
    audioService.playSelect();
    gameState.setIsPhotoModeOpen(false);
  };

  const setPhotoPreset = (preset: 'default' | 'map' | 'bridge' | 'house') => {
    audioService.playSelect();
    if (preset === 'default') {
      (world3dService as any).enterPhotoMode?.();
    } else if (preset === 'map') {
      world3dService.photoFocus.set(10.0, 0.0, 0.0);
      world3dService.photoDistance = 45.0;
      world3dService.photoYaw = 0.0;
      world3dService.photoPitch = 1.45;
    } else if (preset === 'bridge') {
      world3dService.photoFocus.set(19.5, 4.0, -12.5);
      world3dService.photoDistance = 14.5;
      world3dService.photoYaw = 0.8;
      world3dService.photoPitch = 0.45;
    } else if (preset === 'house') {
      world3dService.photoFocus.set(-1.0, 1.0, -4.5);
      world3dService.photoDistance = 15.5;
      world3dService.photoYaw = -0.7;
      world3dService.photoPitch = 0.50;
    }

    setPhotoX(world3dService.photoFocus.x);
    setPhotoZ(world3dService.photoFocus.z);
    setPhotoDist(world3dService.photoDistance);
    setPhotoYawDeg(Math.round((world3dService.photoYaw * 180) / Math.PI));
    setPhotoPitchDeg(Math.round((world3dService.photoPitch * 180) / Math.PI));
  };

  const bakeMetadataOnImage = (
    base64: string,
    yawDeg: number,
    x: number,
    z: number,
    dist: number,
    callback: (bakedUrl: string) => void
  ) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);

        // Scale font and outline based on canvas width to maintain perfect proportional size on all resolutions
        const fontSize = Math.max(14, Math.round(canvas.width * 0.024));
        ctx.font = `900 ${fontSize}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.22));
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';

        const compassText = `KOMPAS: ${yawDeg}° ${getCompassDirection(yawDeg)}`;
        const coordsText = `FOKUS: X: ${x.toFixed(1)}M, Z: ${z.toFixed(1)}M | TINGGI: ${dist.toFixed(1)}M`;

        const marginX = Math.round(canvas.width * 0.03);
        const marginY = Math.round(canvas.height * 0.04);
        const lineHeight = Math.round(fontSize * 1.35);

        const posY2 = canvas.height - marginY;
        ctx.strokeText(coordsText, marginX, posY2);
        ctx.fillText(coordsText, marginX, posY2);

        const posY1 = posY2 - lineHeight;
        ctx.strokeText(compassText, marginX, posY1);
        ctx.fillText(compassText, marginX, posY1);

        callback(canvas.toDataURL('image/png'));
      } else {
        callback(base64);
      }
    };
    img.onerror = () => callback(base64);
    img.src = base64;
  };

  const capturePhoto = () => {
    audioService.playCamera();
    setIsFlashing(true);
    setTimeout(() => {
      setIsFlashing(false);
    }, 250);

    const url = world3dService.captureScreenshot();
    if (url) {
      bakeMetadataOnImage(url, photoYawDeg, photoX, photoZ, photoDist, (bakedUrl) => {
        setPhotoPreviewUrl(bakedUrl);
      });
    } else {
      gameState.showToast('Gagal mengambil foto.');
    }
  };

  const downloadPreview = () => {
    if (!photoPreviewUrl) return;
    try {
      const link = document.createElement('a');
      const filename = `Solaria_Photo_${Date.now()}.png`;
      link.download = filename;
      link.href = photoPreviewUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      gameState.showToast('📸 Foto berhasil disimpan ke galeri!');
      setPhotoPreviewUrl(null);
    } catch (err) {
      console.error('Download photo failed', err);
      gameState.showToast('Foto berhasil ditangkap!');
    }
  };

  const getCompassDirection = (deg: number) => {
    const d = ((deg % 360) + 360) % 360;
    if (d >= 337.5 || d < 22.5) return 'UTARA (N)';
    if (d >= 22.5 && d < 67.5) return 'TIMUR LAUT (NE)';
    if (d >= 67.5 && d < 112.5) return 'TIMUR (E)';
    if (d >= 112.5 && d < 157.5) return 'TENGGARA (SE)';
    if (d >= 157.5 && d < 202.5) return 'SELATAN (S)';
    if (d >= 202.5 && d < 247.5) return 'BARAT DAYA (SW)';
    if (d >= 247.5 && d < 292.5) return 'BARAT (W)';
    return 'BARAT LAUT (NW)';
  };

  const takeScreenshot = () => {
    audioService.playCamera();
    setIsFlashing(true);
    setTimeout(() => {
      setIsFlashing(false);
    }, 250);

    const dataUrl = world3dService.captureScreenshot();
    if (dataUrl) {
      const currentYawDeg = Math.round((world3dService.photoYaw * 180) / Math.PI) || 0;
      const currentX = world3dService.photoFocus.x || gameState.playerCoords.x || 0;
      const currentZ = world3dService.photoFocus.z || gameState.playerCoords.z || 0;
      const currentDist = world3dService.photoDistance || 12.8;

      bakeMetadataOnImage(dataUrl, currentYawDeg, currentX, currentZ, currentDist, (bakedUrl) => {
        try {
          const link = document.createElement('a');
          const filename = `Solaria_${gameState.season}_Day${gameState.day}_${Date.now()}.png`;
          link.download = filename;
          link.href = bakedUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          gameState.showToast('📸 Foto pemandangan berhasil disimpan!');
        } catch (err) {
          console.error('Download screenshot failed', err);
          gameState.showToast('📸 Foto berhasil diambil!');
        }
      });
    } else {
      gameState.showToast('Gagal mengambil screenshot.');
    }
  };

  // Swipe gesture for Top-Left Card
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartTimeRef.current = Date.now();
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
      const duration = Date.now() - touchStartTimeRef.current;

      if (Math.abs(deltaX) > 20 && Math.abs(deltaX) > Math.abs(deltaY) && duration < 600) {
        if (deltaX > 0) {
          setShowScreenshotBtn(true);
          audioService.playSelect();
        } else {
          setShowScreenshotBtn(false);
          audioService.playSelect();
        }
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    touchStartTimeRef.current = Date.now();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const deltaX = e.clientX - touchStartXRef.current;
    const deltaY = e.clientY - touchStartYRef.current;
    const duration = Date.now() - touchStartTimeRef.current;

    if (Math.abs(deltaX) > 25 && Math.abs(deltaX) > Math.abs(deltaY) && duration < 600) {
      if (deltaX > 0) {
        setShowScreenshotBtn(true);
        audioService.playSelect();
      } else {
        setShowScreenshotBtn(false);
        audioService.playSelect();
      }
    }
  };

  const toggleLocationMode = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowCoords(v => !v);
    audioService.playSelect();
  };

  const formattedCoords = () => {
    const c = gameState.playerCoords;
    return `X:${c.x.toFixed(1)}, Y:${c.y.toFixed(1)}, Z:${c.z.toFixed(1)}`;
  };

  if (gameState.isDevEditorOpen) return null;

  return (
    <>
      {/* Shutter flash overlay */}
      {isFlashing && (
        <div className="fixed inset-0 z-55 bg-white pointer-events-none transition-opacity duration-300 opacity-90 animate-out fade-out"></div>
      )}

      {/* Photo Preview Modal */}
      {photoPreviewUrl && (
        <div className="fixed inset-0 z-55 bg-black/85 flex items-center justify-center pointer-events-auto p-4 select-none animate-in fade-in duration-200">
          <div className="w-full max-w-lg md:max-w-xl bg-neutral-900 border border-white/10 rounded-3xl p-4 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center text-white border-b border-white/10 pb-2">
              <span className="text-xs font-black tracking-wider uppercase text-amber-300">Pratinjau Foto Anda</span>
              <button type="button" onClick={() => setPhotoPreviewUrl(null)} className="text-white/60 hover:text-white active:scale-90 transition-transform">
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="relative w-full aspect-[16/9] bg-black rounded-2xl overflow-hidden border border-white/10 shadow-inner">
              <img src={photoPreviewUrl} className="w-full h-full object-cover" alt="Captured Solaria View" referrerPolicy="no-referrer" />
            </div>

            <div className="flex items-center justify-end gap-3 mt-1">
              <button
                type="button"
                onClick={downloadPreview}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-400 bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-600 active:to-emerald-700 text-white text-xs font-black tracking-wide shadow-md active:scale-95 transition-transform"
              >
                <span className="material-icons text-sm">download</span>
                <span>SIMPAN KE GALERI</span>
              </button>

              <button
                type="button"
                onClick={() => setPhotoPreviewUrl(null)}
                className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 active:scale-95 text-xs font-bold transition-transform cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free camera photo mode panel */}
      {gameState.isPhotoModeOpen && (
        <div className="fixed inset-0 z-40 bg-black/10 flex flex-col justify-between pointer-events-auto select-none p-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <span className="material-icons text-amber-400">photo_camera</span>
              <span className="text-xs font-black tracking-wider uppercase">Photo Mode (Free Camera)</span>
            </div>
            <span className="text-[10px] font-bold text-white/50 hidden sm:inline">Tekan lama tombol kamera untuk membuka pengaturan bebas ini</span>
          </div>

          <div className="absolute right-4 top-20 flex flex-col gap-2 bg-black/40 border border-white/15 p-3 rounded-2xl max-w-[150px] shadow-lg animate-in slide-in-from-right duration-300">
            <span className="text-[9px] font-black tracking-wider text-amber-300 uppercase mb-1">Sudut Kamera</span>
            <button type="button" onClick={() => setPhotoPreset('default')} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 text-[10px] text-white font-bold text-left transition-all cursor-pointer">
              Fokus Karakter
            </button>
            <button type="button" onClick={() => setPhotoPreset('map')} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 text-[10px] text-white font-bold text-left transition-all cursor-pointer">
              Peta Penuh (Far)
            </button>
            <button type="button" onClick={() => setPhotoPreset('bridge')} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 text-[10px] text-white font-bold text-left transition-all cursor-pointer">
              Jembatan Ngarai
            </button>
            <button type="button" onClick={() => setPhotoPreset('house')} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 active:scale-95 text-[10px] text-white font-bold text-left transition-all cursor-pointer">
              Rumah Kebun
            </button>
          </div>

          <div className="w-full bg-black/40 border border-white/15 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-2xl animate-in slide-in-from-bottom duration-300 mt-auto">
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-white">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold text-white/70">
                  <span>Pan Barat/Timur (X)</span>
                  <span className="text-amber-300 font-mono">{photoX.toFixed(1)}</span>
                </div>
                <input type="range" min="-30" max="30" step="0.5" value={photoX} onChange={onFocusXChange} className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500" />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold text-white/70">
                  <span>Pan Utara/Selatan (Z)</span>
                  <span className="text-amber-300 font-mono">{photoZ.toFixed(1)}</span>
                </div>
                <input type="range" min="-30" max="30" step="0.5" value={photoZ} onChange={onFocusZChange} className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500" />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold text-white/70">
                  <span>Tinggi Zoom (Out)</span>
                  <span className="text-amber-300 font-mono">{photoDist.toFixed(1)}m</span>
                </div>
                <input type="range" min="3" max="120" step="0.5" value={photoDist} onChange={onDistanceChange} className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500" />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold text-white/70">
                  <span>Rotasi Orbit (Yaw)</span>
                  <span className="text-amber-300 font-mono">{photoYawDeg}°</span>
                </div>
                <input type="range" min="0" max="360" step="1" value={photoYawDeg} onChange={onYawChange} className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500" />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                <div className="flex justify-between text-[10px] font-bold text-white/70">
                  <span>Kemiringan (Pitch)</span>
                  <span className="text-amber-300 font-mono">{photoPitchDeg}°</span>
                </div>
                <input type="range" min="5" max="88" step="1" value={photoPitchDeg} onChange={onPitchChange} className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500" />
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t border-white/10 md:border-t-0 pt-3 md:pt-0 shrink-0">
              <button
                type="button"
                onClick={capturePhoto}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-white text-xs font-black tracking-wide shadow-md active:scale-95 transition-transform cursor-pointer"
              >
                <span className="material-icons text-sm">photo_camera</span>
                <span>AMBIL FOTO</span>
              </button>

              <button
                type="button"
                onClick={exitPhotoMode}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white/90 active:bg-white/15 text-xs font-black tracking-wide shadow-md active:scale-95 transition-transform cursor-pointer"
              >
                <span className="material-icons text-sm">close</span>
                <span>KELUAR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main HUD */}
      {!gameState.isPhotoModeOpen && (
        <div
          className="absolute inset-0 pointer-events-none select-none p-3 sm:p-4 flex flex-col justify-between transition-opacity duration-200"
          style={{ opacity: gameState.hudOpacity }}
        >
          {/* Top Bar row */}
          <div className="flex items-start justify-between w-full">
            {/* Top Left: Clock Card */}
            <div className="flex flex-col gap-0.5 pointer-events-auto">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/25 bg-black/40 text-white shadow-sm cursor-pointer select-none transition-transform duration-200 active:scale-98 hover:border-amber-300/40 text-left focus:outline-none"
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                  onPointerDown={onPointerDown}
                  onPointerUp={onPointerUp}
                  onClick={() => {
                    setShowScreenshotBtn(v => !v);
                    audioService.playSelect();
                  }}
                  title="Geser atau ketuk kontainer waktu untuk memunculkan tombol Screenshot"
                >
                  <span className="text-sm font-black text-amber-300 tracking-wide">
                    {gameState.season} {gameState.day}
                  </span>
                  <span className="text-white/40">|</span>
                  <div className="flex items-center gap-1 text-xs font-semibold tabular-nums text-white/90">
                    <span className="material-icons text-base text-yellow-300">
                      {gameState.weather === 'Sunny' ? 'wb_sunny' : 'water_drop'}
                    </span>
                    <span>{gameState.timeFormatted}</span>
                  </div>

                  <div className="flex items-center justify-center pl-0.5 text-amber-300/80">
                    <span
                      className={`material-icons text-sm transition-transform duration-300 ${
                        showScreenshotBtn ? 'rotate-180' : ''
                      }`}
                    >
                      {showScreenshotBtn ? 'chevron_left' : 'chevron_right'}
                    </span>
                  </div>
                </button>

                {showScreenshotBtn && (
                  <div className="flex items-center gap-1.5 transition-all duration-300 transform scale-100">
                    <button
                      type="button"
                      onPointerDown={onBtnPointerDown}
                      onPointerUp={onBtnPointerUp}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-white text-xs font-black tracking-wide shadow-lg cursor-pointer transition-all active:scale-95 group focus:outline-none select-none"
                      title="Tekan untuk foto instan, TEKAN LAMA untuk Mode Kamera Bebas!"
                    >
                      <span className="material-icons text-base text-white group-hover:scale-110 transition-transform">photo_camera</span>
                      <span>Screenshot</span>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowScreenshotBtn(false);
                        audioService.playSelect();
                      }}
                      className="w-7 h-7 rounded-full border border-white/25 bg-black/40 hover:bg-black/60 active:scale-90 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-sm focus:outline-none"
                      title="Tutup tombol screenshot"
                    >
                      <span className="material-icons text-xs">close</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Performance Diagnostics */}
              <button
                type="button"
                onClick={() => {
                  gameState.setIsPerfModalOpen(true);
                }}
                className="text-[11px] font-mono font-bold tracking-tight text-emerald-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] hover:text-emerald-300 active:scale-95 transition-all text-left select-none cursor-pointer pl-1 mt-0.5"
                title="Ketuk untuk melihat statistik performa & info perangkat"
              >
                {gameState.fps} FPS · {gameState.drawCalls} Calls
              </button>
            </div>

            {/* Top Center: Notification Toast */}
            <div className="flex-1 flex justify-center px-4">
              {gameState.toastMessage && (
                <div className="px-4 py-1.5 rounded-full border border-amber-300/40 bg-black/50 text-amber-200 text-xs font-bold tracking-tight shadow-md animate-bounce pointer-events-auto">
                  {gameState.toastMessage}
                </div>
              )}
            </div>

            {/* Top Right: Location Switcher, Backpack, Stamina */}
            <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-2xl border border-emerald-400/40 bg-black/40 shadow-sm overflow-hidden select-none transition-all duration-200 hover:border-emerald-300/60">
                  <button
                    type="button"
                    onClick={(e) => toggleLocationMode(e)}
                    className="px-3 py-1 text-white text-xs font-bold tracking-tight flex items-center gap-1.5 cursor-pointer active:bg-emerald-950/60 transition-all group focus:outline-none"
                    title={showCoords ? 'Mode Koordinat 3D' : 'Mode Nama Lokasi'}
                  >
                    <span className="material-icons text-sm text-emerald-400 group-hover:scale-110 transition-transform">
                      {showCoords ? 'my_location' : 'place'}
                    </span>

                    <div className="flex items-center justify-center min-w-[140px] text-center">
                      {!showCoords ? (
                        <span className="animate-in fade-in duration-200 text-white/95">
                          {gameState.areaName}
                        </span>
                      ) : (
                        <span className="animate-in fade-in duration-200 text-amber-300 font-mono text-[11px] font-extrabold tabular-nums">
                          {formattedCoords()}
                        </span>
                      )}
                    </div>

                    <span className="material-icons text-xs text-white/40 group-hover:text-amber-300 transition-colors ml-0.5">
                      swap_horiz
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => gameState.setIsMapOpen(true)}
                    className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 active:bg-amber-500/60 text-amber-300 border-l border-white/20 flex items-center justify-center transition-colors cursor-pointer focus:outline-none group/map"
                    title="Buka Peta Besar Pulau Solaria & Pengaturan"
                  >
                    <span className="material-icons text-xs group-hover/map:scale-110 transition-transform">map</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => gameState.setIsInventoryOpen(true)}
                  className="w-8 h-8 rounded-full border border-white/25 bg-black/35 active:bg-white/20 text-white flex items-center justify-center transition-transform active:scale-95 shadow-sm focus:outline-none"
                  title="Buka Tas (Bag)"
                >
                  <span className="material-icons text-base text-amber-200">backpack</span>
                </button>
              </div>

              {/* Stamina Bar */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl border border-red-400/30 bg-black/35 text-white shadow-sm">
                <span className="material-icons text-sm text-red-400">favorite</span>
                <div className="w-16 h-2 rounded-full bg-black/50 border border-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${(gameState.stamina / gameState.maxStamina) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[9px] font-bold tabular-nums text-white/80">
                  {gameState.stamina}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
