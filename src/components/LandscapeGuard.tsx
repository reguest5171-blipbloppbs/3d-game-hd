import React, { useEffect, useState } from 'react';
import { useGameState } from '../services/game-state';
import { assetCacheService } from '../services/asset-cache';
import { world3dService } from '../game/world-3d';

export const LandscapeGuard: React.FC = () => {
  const gameState = useGameState();
  const [isLandscapeAndFullscreen, setIsLandscapeAndFullscreen] = useState(false);
  const [isUrlCopied, setIsUrlCopied] = useState(false);
  const [assetProgress, setAssetProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('Inisialisasi...');
  const [detailText, setDetailText] = useState('Menghubungkan ke Solaria Island...');
  const [verificationStats, setVerificationStats] = useState({ cached: 0, total: 10 });
  const [isAssetLoaded, setIsAssetLoaded] = useState(false);

  useEffect(() => {
    // 1. Monitor and trigger asset preloading in cache service
    const startPreload = async () => {
      try {
        await assetCacheService.preloadAllAssets({
          onProgress: (p) => setAssetProgress(p),
          onStage: (s) => setCurrentStage(s),
          onDetail: (d) => setDetailText(d),
          onItemStats: (cached, total) => setVerificationStats({ cached, total })
        });
        setIsAssetLoaded(true);
      } catch (err) {
        console.error('Failed to preload assets', err);
      }
    };
    startPreload();
  }, []);

  const checkState = () => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isLandscape = width >= height;

    const doc = document as any;
    const isFullscreen = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    const isMobile = width < 1024 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const valid = isMobile ? (isLandscape && (isFullscreen || height < 500)) : isLandscape;

    setIsLandscapeAndFullscreen(valid);
    gameState.setIsFullscreenLandscape(valid);

    if (valid) {
      if (assetCacheService.getIsLoaded() || isAssetLoaded) {
        setTimeout(() => {
          gameState.setIsAppLoading(false);
          world3dService.resumeLoop();
        }, 400);
      }
    } else {
      world3dService.pauseLoop();
    }
  };

  useEffect(() => {
    checkState();

    document.addEventListener('fullscreenchange', checkState);
    document.addEventListener('webkitfullscreenchange', checkState);
    document.addEventListener('mozfullscreenchange', checkState);
    window.addEventListener('resize', checkState);
    window.addEventListener('orientationchange', checkState);

    return () => {
      document.removeEventListener('fullscreenchange', checkState);
      document.removeEventListener('webkitfullscreenchange', checkState);
      document.removeEventListener('mozfullscreenchange', checkState);
      window.removeEventListener('resize', checkState);
      window.removeEventListener('orientationchange', checkState);
    };
  }, [isAssetLoaded]);

  const requestFullscreenAndLandscape = () => {
    if (typeof document === 'undefined') return;

    const docEl = document.documentElement as any;
    const reqFullscreen =
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen;

    if (reqFullscreen && !document.fullscreenElement) {
      try {
        reqFullscreen.call(docEl).catch((err: any) => {
          console.debug('Fullscreen lock notice:', err);
        });
      } catch (err) {
        console.debug('Fullscreen call error:', err);
      }
    }

    const screenOrientation = window.screen.orientation as any;
    if (screenOrientation && typeof screenOrientation.lock === 'function') {
      try {
        screenOrientation.lock('landscape').catch((err: any) => {
          console.debug('Orientation lock notice:', err);
        });
      } catch (err) {
        console.debug('Orientation lock error:', err);
      }
    }

    setTimeout(() => {
      checkState();
    }, 200);
  };

  const copyGameUrl = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setIsUrlCopied(true);
        setTimeout(() => setIsUrlCopied(false), 3000);
      }).catch(() => {
        fallbackCopy(url);
      });
    } else {
      fallbackCopy(url);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setIsUrlCopied(true);
      setTimeout(() => setIsUrlCopied(false), 3000);
    } catch (err) {
      console.debug('Copy fallback failed:', err);
    }
  };

  if (!isLandscapeAndFullscreen) {
    return (
      <div className="fixed inset-0 z-55 flex flex-col items-center justify-between p-4 sm:p-8 bg-slate-950/98 text-white text-center select-none overflow-y-auto backdrop-blur-sm">
        {/* Top Section */}
        <div className="flex flex-col items-center pt-2 sm:pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="material-icons text-base animate-pulse">fullscreen</span>
            <span>Wajib Layar Penuh (Landscape Mode)</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2">
            <span className="text-amber-400">Harvest Moon:</span> Whispering Tree 3D
          </h1>
          <p className="text-xs text-white/70 max-w-md mt-1">
            Pengalaman mobile RPG Tree of Tranquility 3D dengan virtual joystick dan kontrol presisi.
          </p>
        </div>

        {/* Center Section */}
        <div className="flex flex-col items-center my-4 max-w-lg w-full">
          <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping" style={{ animationDuration: '3s' }}></div>
            <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/30 to-emerald-500/30 border border-amber-400/40 flex items-center justify-center shadow-xl shadow-amber-950/50">
              <span className="material-icons text-4xl text-amber-300 animate-spin" style={{ animationDuration: '6s' }}>
                screen_rotation
              </span>
            </div>
          </div>

          <div className="text-sm font-bold text-amber-200 uppercase tracking-wide mb-1">
            Putar Perangkat ke Posisi Landscape
          </div>
          <div className="text-xs text-white/60 mb-5 max-w-sm">
            Game sepenuhnya dihentikan (<strong>0% CPU</strong>) saat di luar fullscreen landscape untuk menghemat baterai & memori.
          </div>

          {/* Progress panel */}
          <div className="w-full bg-slate-900/90 border border-white/10 rounded-2xl p-4 mb-4 text-left shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-icons text-emerald-400 text-sm">inventory_2</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Status Memuat Aset Lokal</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-black text-amber-400">
                <span>{assetProgress}%</span>
              </div>
            </div>

            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-white/10 p-0.5 mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-400 to-teal-300 transition-all duration-300 relative shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                style={{ width: `${assetProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-[11px]">
              <div className="flex items-center justify-between text-white/90">
                <span className="font-medium text-amber-200">{currentStage}</span>
                <span className="text-white/50 text-[10px]">{verificationStats.cached} / {verificationStats.total} Verifikasi</span>
              </div>
              <div className="text-white/50 truncate text-[10px]">
                {detailText}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 text-emerald-300">
                <span className="material-icons text-[12px]">save</span>
                <span>Tersimpan di IndexedDB Lokal</span>
              </div>
              <span className="text-white/40">Tidak hilang saat reload web</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              type="button"
              onClick={requestFullscreenAndLandscape}
              className="w-full flex-1 py-3 px-5 rounded-2xl border border-amber-400/80 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 hover:brightness-110 transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
            >
              <span className="material-icons text-lg">fullscreen</span>
              <span>Masuk Fullscreen Landscape</span>
            </button>

            <button
              type="button"
              onClick={copyGameUrl}
              className="w-full sm:w-auto py-3 px-4 rounded-2xl border border-white/20 bg-slate-800/90 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 hover:bg-slate-700 transition-all cursor-pointer"
            >
              {isUrlCopied ? (
                <>
                  <span className="material-icons text-emerald-400 text-base">check_circle</span>
                  <span className="text-emerald-300 font-black">URL Tersalin!</span>
                </>
              ) : (
                <>
                  <span className="material-icons text-amber-300 text-base">content_copy</span>
                  <span>Salin URL Game</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 pb-2">
          <div className="text-[10px] text-white/40">
            Aktifkan fitur Auto-Rotate / Kunci Rotasi ponsel Anda ke Landscape
          </div>
          <div className="text-[9px] text-white/25">
            Harvest Moon: Whispering Tree 3D · High Performance WebGL Edition
          </div>
        </div>
      </div>
    );
  }

  // Render entry splash screen when landscape is active but asset or game are still loading
  if (isLandscapeAndFullscreen && (!isAssetLoaded || gameState.isAppLoading)) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950 text-white text-center select-none transition-opacity duration-500">
        <div className="relative w-28 h-28 mb-5 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '2.5s' }}></div>
          <div className="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-b from-emerald-500/30 to-amber-500/20 border-2 border-emerald-400/50 flex items-center justify-center shadow-2xl shadow-emerald-950/80">
            <span className="material-icons text-5xl text-emerald-300 animate-bounce" style={{ animationDuration: '2s' }}>
              spa
            </span>
          </div>
        </div>

        <h2 className="text-2xl font-black tracking-wider text-white mb-1">
          <span className="text-amber-400">Harvest Moon:</span> Whispering Tree 3D
        </h2>
        <div className="text-xs font-semibold text-emerald-300/90 uppercase tracking-widest mb-6">
          Solaria Island · Memuat Dunia 3D
        </div>

        <div className="w-64 max-w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10 p-0.5 mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-200"
            style={{ width: `${assetProgress}%` }}
          ></div>
        </div>

        <div className="text-xs text-white/70 font-medium">
          {currentStage}
        </div>
        <div className="text-[10px] text-white/40 mt-1">
          {detailText}
        </div>
      </div>
    );
  }

  return null;
};
