import React, { useRef } from 'react';
import { useGameState } from '../services/game-state';
import { world3dService } from '../game/world-3d';
import { audioService } from '../services/audio';

export const DevEditor: React.FC = () => {
  const gameState = useGameState();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setTool = (tool: 'sculpt_raise' | 'sculpt_lower' | 'sculpt_flatten' | 'paint_dirt' | 'paint_grass' | 'paint_cobble' | 'place_prop' | 'delete_prop' | 'edit_gate') => {
    audioService.playSelect();
    gameState.setDevEditorTool(tool);
    gameState.showToast(`Alat Editor: ${getToolName(tool)}`);
  };

  const undo = () => {
    audioService.playSelect();
    (world3dService as any).undoDevAction?.();
  };

  const redo = () => {
    audioService.playSelect();
    (world3dService as any).redoDevAction?.();
  };

  const resetMap = () => {
    audioService.playSelect();
    (world3dService as any).resetDevMap?.();
  };

  const toggleFreeCamera = () => {
    audioService.playSelect();
    const nextVal = !gameState.isDevFreeCamera;
    gameState.setIsDevFreeCamera(nextVal);
    if (nextVal) {
      (world3dService as any).setDevCameraAnglePreset?.('iso');
    }
    gameState.showToast(`Kamera Bebas 3D: ${nextVal ? 'AKTIF (Drag layar untuk rotasi 360°)' : 'STANDAR 3/4 ISOMETRIC'}`);
  };

  const setCamAngle = (angle: 'iso' | 'top' | 'front' | 'side') => {
    audioService.playSelect();
    (world3dService as any).setDevCameraAnglePreset?.(angle);
    gameState.showToast(`Sudut Kamera 3D: ${angle.toUpperCase()}`);
  };

  const rotateCamLeft = () => {
    audioService.playSelect();
    (world3dService as any).rotateDevCamera?.(0.35, 0);
  };

  const rotateCamRight = () => {
    audioService.playSelect();
    (world3dService as any).rotateDevCamera?.(-0.35, 0);
  };

  const zoomCamIn = () => {
    audioService.playSelect();
    (world3dService as any).zoomDevCamera?.(-3.0);
  };

  const zoomCamOut = () => {
    audioService.playSelect();
    (world3dService as any).zoomDevCamera?.(3.0);
  };

  const setProp = (prop: string) => {
    audioService.playSelect();
    gameState.setDevSelectedProp(prop);
    gameState.showToast(`Objek Terpilih: ${getPropName(prop)}`);
  };

  const setPropColor = (color: 'default' | 'golden' | 'autumn_red' | 'moss_green' | 'dark_stone') => {
    audioService.playSelect();
    gameState.setDevPropColor(color);
    gameState.showToast(`Preset Warna Objek: ${color.toUpperCase()}`);
  };

  const onRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    gameState.setDevBrushRadius(val);
  };

  const onStrengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    gameState.setDevBrushStrength(val);
  };

  const exportMap = () => {
    audioService.playSelect();
    (world3dService as any).exportMapData?.();
  };

  const triggerFileInput = () => {
    audioService.playSelect();
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          (world3dService as any).importMapData?.(text);
        }
      };
      reader.readAsText(file);
      input.value = '';
    }
  };

  const toggleGrid = () => {
    audioService.playSelect();
    const nextVal = !gameState.isDevGridVisible;
    gameState.setIsDevGridVisible(nextVal);
    gameState.showToast(`Kisi 3D (Grid Helper): ${nextVal ? 'AKTIF (TAMPIL)' : 'MATI (SEMBUNYI)'}`);
  };

  const exitEditor = () => {
    audioService.playSelect();
    gameState.setIsDevEditorOpen(false);
    (world3dService as any).exitDevEditor?.();
    gameState.showToast('ℹ️ Mode Map Editor dinonaktifkan.');
  };

  const getToolName = (tool: string) => {
    switch (tool) {
      case 'sculpt_raise': return 'Pahat Ketinggian (Naikkan)';
      case 'sculpt_lower': return 'Pahat Ketinggian (Turunkan)';
      case 'sculpt_flatten': return 'Pahat Ketinggian (Datarkan)';
      case 'paint_dirt': return 'Cat Tekstur Tanah Kebun';
      case 'paint_grass': return 'Cat Tekstur Rumput Subur';
      case 'paint_cobble': return 'Cat Tekstur Jalan Kerikil';
      case 'place_prop': return 'Pasang Objek';
      case 'delete_prop': return 'Hapus Objek';
      default: return tool;
    }
  };

  const getPropName = (prop: string) => {
    switch (prop) {
      case 'maple_tree': return 'Pohon Maple';
      case 'pine_tree': return 'Pohon Pinus';
      case 'bush': return 'Semak Bunga';
      case 'wildflower': return 'Bunga Liar';
      case 'rustic_fence': return 'Pagar Rustic';
      case 'bench': return 'Kursi Taman';
      case 'boulder': return 'Batu Boulder';
      case 'hay_bale': return 'Jerami Padi';
      case 'streetlamp': return 'Lampu Jalan';
      case 'shipping_bin': return 'Kotak Penjualan';
      case 'water_well': return 'Sumur Air';
      case 'watermill': return 'Kincir Air Tepung';
      default: return prop;
    }
  };

  if (!gameState.isDevEditorOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-between pointer-events-none p-2 sm:p-3 select-none">
      {/* TOP DOCKED UNIFIED HEADER BAR */}
      <div className="flex flex-col gap-1.5 w-full pointer-events-auto">
        <div className="w-full bg-slate-900/90 backdrop-blur-md border border-white/15 rounded-2xl px-3 py-1.5 shadow-2xl flex flex-wrap items-center justify-between gap-2">
          {/* Left Title & System Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-300">
              <span className="material-icons text-sm">construction</span>
              <span className="text-[10px] font-black tracking-wider uppercase">DEV MAP EDITOR</span>
            </div>

            <button
              type="button"
              onClick={exitEditor}
              className="px-2.5 py-1 rounded-xl bg-rose-600/80 hover:bg-rose-600 border border-rose-500/30 text-white text-[10px] font-black tracking-wide flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
            >
              <span className="material-icons text-xs">exit_to_app</span>
              <span>KELUAR</span>
            </button>

            {/* Grid Toggle */}
            <button
              type="button"
              onClick={toggleGrid}
              className={`px-2 py-1 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                gameState.isDevGridVisible ? 'bg-amber-500/30 border-amber-400/60 text-amber-300' : ''
              }`}
              title="Kisi 3D (Grid Helper)"
            >
              <span className="material-icons text-xs">grid_on</span>
            </button>

            {/* 3D Free Camera Mode Toggle */}
            <button
              type="button"
              onClick={toggleFreeCamera}
              className={`px-2 py-1 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                gameState.isDevFreeCamera ? 'bg-sky-500/40 border-sky-400/70 text-sky-200 ring-2 ring-sky-400/30' : ''
              }`}
              title="Kamera Bebas 3D Orbit 360°"
            >
              <span className="material-icons text-xs">3d_rotation</span>
              <span className="text-[9px] font-black ml-1 hidden sm:inline">{gameState.isDevFreeCamera ? '3D BEBAS' : '3D STANDAR'}</span>
            </button>

            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={undo}
                className="px-2 py-1 rounded-l-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 active:scale-95 cursor-pointer"
                title="Undo (Kembalikan)"
              >
                <span className="material-icons text-xs">undo</span>
              </button>
              <button
                type="button"
                onClick={redo}
                className="px-2 py-1 rounded-r-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 active:scale-95 cursor-pointer"
                title="Redo (Ulangi)"
              >
                <span className="material-icons text-xs">redo</span>
              </button>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={resetMap}
              className="px-2.5 py-1 rounded-xl bg-rose-600/70 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center gap-1 border border-rose-400/20 active:scale-95 transition-transform cursor-pointer"
              title="Reset Elevasi & Objek ke Standar"
            >
              <span className="material-icons text-xs">restart_alt</span>
              <span className="hidden sm:inline">RESET</span>
            </button>

            <button
              type="button"
              onClick={exportMap}
              className="px-2.5 py-1 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 border border-emerald-400/20 active:scale-95 transition-transform cursor-pointer"
              title="Ekspor Peta JSON"
            >
              <span className="material-icons text-xs">download</span>
              <span className="hidden sm:inline">EKSPOR</span>
            </button>

            <button
              type="button"
              onClick={triggerFileInput}
              className="px-2.5 py-1 rounded-xl bg-sky-600/80 hover:bg-sky-600 text-white text-[10px] font-bold flex items-center gap-1 border border-sky-400/20 active:scale-95 transition-transform cursor-pointer"
              title="Impor File Peta JSON"
            >
              <span className="material-icons text-xs">upload</span>
              <span className="hidden sm:inline">IMPOR</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={onFileSelected}
              className="hidden"
            />
          </div>
        </div>

        {/* SECOND ROW: TOOL SELECTOR STRIP */}
        <div className="w-full bg-slate-900/80 backdrop-blur-sm border border-white/10 rounded-2xl px-2 py-1 shadow-lg flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar">
          <button
            type="button"
            onClick={() => setTool('sculpt_raise')}
            className={`px-2.5 py-1 rounded-xl border border-transparent hover:bg-white/5 text-white/80 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
              gameState.devEditorTool === 'sculpt_raise' ? 'bg-amber-500/30 border-amber-400/60 text-amber-300' : ''
            }`}
          >
            <span className="material-icons text-xs">expand_less</span>
            <span>PAHAT NAIK</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('sculpt_lower')}
            className={`px-2.5 py-1 rounded-xl border border-transparent hover:bg-white/5 text-white/80 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
              gameState.devEditorTool === 'sculpt_lower' ? 'bg-amber-500/30 border-amber-400/60 text-amber-300' : ''
            }`}
          >
            <span className="material-icons text-xs">expand_more</span>
            <span>PAHAT TURUN</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('sculpt_flatten')}
            className={`px-2.5 py-1 rounded-xl border border-transparent hover:bg-white/5 text-white/80 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
              gameState.devEditorTool === 'sculpt_flatten' ? 'bg-amber-500/30 border-amber-400/60 text-amber-300' : ''
            }`}
          >
            <span className="material-icons text-xs">horizontal_rule</span>
            <span>DATARKAN</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('paint_dirt')}
            className={`px-2.5 py-1 rounded-xl border border-transparent hover:bg-white/5 text-white/80 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
              gameState.devEditorTool === 'paint_dirt' ? 'bg-amber-500/30 border-amber-400/60 text-amber-300' : ''
            }`}
          >
            <span className="material-icons text-xs">brush</span>
            <span>CAT TANAH</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('paint_grass')}
            className={`px-2.5 py-1 rounded-xl border border-transparent hover:bg-white/5 text-white/80 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
              gameState.devEditorTool === 'paint_grass' ? 'bg-amber-500/30 border-amber-400/60 text-amber-300' : ''
            }`}
          >
            <span className="material-icons text-xs">grass</span>
            <span>CAT RUMPUT</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('place_prop')}
            className={`px-2.5 py-1 rounded-xl border border-transparent hover:bg-white/5 text-white/80 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
              gameState.devEditorTool === 'place_prop' ? 'bg-amber-500/30 border-amber-400/60 text-amber-300' : ''
            }`}
          >
            <span className="material-icons text-xs">nature_people</span>
            <span>PASANG OBJEK</span>
          </button>

          <button
            type="button"
            onClick={() => setTool('delete_prop')}
            className={`px-2.5 py-1 rounded-xl border border-transparent hover:bg-white/5 text-white/80 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
              gameState.devEditorTool === 'delete_prop' ? 'bg-amber-500/30 border-amber-400/60 text-amber-300' : ''
            }`}
          >
            <span className="material-icons text-xs">delete</span>
            <span>HAPUS OBJEK</span>
          </button>
        </div>
      </div>

      {/* 3D FREE CAMERA CONTROLS OVERLAY PANEL (Visible when isDevFreeCamera is TRUE) */}
      {gameState.isDevFreeCamera && (
        <div className="absolute left-3 top-24 z-50 flex flex-col gap-1.5 bg-slate-900/90 border border-sky-400/50 p-2.5 rounded-2xl w-52 shadow-2xl pointer-events-auto backdrop-blur-md animate-in slide-in-from-left duration-200">
          <div className="flex items-center justify-between text-sky-300 border-b border-sky-400/20 pb-1">
            <span className="text-[10px] font-black tracking-wider uppercase flex items-center gap-1">
              <span className="material-icons text-xs">3d_rotation</span>
              <span>KONTROL KAMERA 3D</span>
            </span>
            <span className="text-[8px] bg-sky-500/20 text-sky-200 px-1.5 py-0.5 rounded font-bold">360°</span>
          </div>

          {/* Quick Preset Angles */}
          <span className="text-[8px] font-black text-white/50 uppercase mt-0.5">Sudut Pandang Quick</span>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setCamAngle('iso')}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-sky-500/20 border border-white/10 active:scale-95 text-[9px] font-bold text-white text-center transition-all cursor-pointer"
            >
              ISOMETRIC
            </button>
            <button
              type="button"
              onClick={() => setCamAngle('top')}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-sky-500/20 border border-white/10 active:scale-95 text-[9px] font-bold text-white text-center transition-all cursor-pointer"
            >
              ATAS (90°)
            </button>
            <button
              type="button"
              onClick={() => setCamAngle('front')}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-sky-500/20 border border-white/10 active:scale-95 text-[9px] font-bold text-white text-center transition-all cursor-pointer"
            >
              DEPAN
            </button>
            <button
              type="button"
              onClick={() => setCamAngle('side')}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-sky-500/20 border border-white/10 active:scale-95 text-[9px] font-bold text-white text-center transition-all cursor-pointer"
            >
              SAMPING
            </button>
          </div>

          {/* Manual Rotation & Zoom Buttons */}
          <span className="text-[8px] font-black text-white/50 uppercase mt-1">Rotasi Manual & Zoom</span>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={rotateCamLeft}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 active:scale-95 text-[9px] font-bold text-white flex items-center justify-center gap-0.5 cursor-pointer"
            >
              <span className="material-icons text-xs">rotate_left</span>
              <span>KIRI</span>
            </button>
            <button
              type="button"
              onClick={rotateCamRight}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 active:scale-95 text-[9px] font-bold text-white flex items-center justify-center gap-0.5 cursor-pointer"
            >
              <span>KANAN</span>
              <span className="material-icons text-xs">rotate_right</span>
            </button>
            <button
              type="button"
              onClick={zoomCamIn}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 active:scale-95 text-[9px] font-bold text-white flex items-center justify-center gap-0.5 cursor-pointer"
            >
              <span className="material-icons text-xs">zoom_in</span>
              <span>DEKAT</span>
            </button>
            <button
              type="button"
              onClick={zoomCamOut}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 active:scale-95 text-[9px] font-bold text-white flex items-center justify-center gap-0.5 cursor-pointer"
            >
              <span className="material-icons text-xs">zoom_out</span>
              <span>JAUH</span>
            </button>
          </div>

          <div className="text-[8px] text-sky-200/80 bg-sky-950/60 p-1.5 rounded-lg border border-sky-400/20 leading-tight mt-0.5">
            💡 <strong>Petunjuk:</strong> Klik & Drag layar 3D untuk memutar sudut bebas 360°. Right-click drag untuk menggeser fokus.
          </div>
        </div>
      )}

      {/* RIGHT SIDE PROP PICKER PANEL */}
      {gameState.devEditorTool === 'place_prop' && (
        <div className="absolute right-3 top-24 z-50 flex flex-col gap-1.5 bg-slate-900/90 border border-white/15 p-2.5 rounded-2xl w-48 shadow-2xl pointer-events-auto backdrop-blur-md max-h-[68vh] overflow-y-auto animate-in slide-in-from-right duration-200">
          <span className="text-[9px] font-black tracking-wider text-amber-300 uppercase mb-0.5">Preset Warna & Material</span>
          <div className="grid grid-cols-5 gap-1 mb-1">
            {[
              { id: 'default', color: 'bg-emerald-500', name: 'Alami' },
              { id: 'golden', color: 'bg-amber-400', name: 'Emas' },
              { id: 'autumn_red', color: 'bg-rose-500', name: 'Merah' },
              { id: 'moss_green', color: 'bg-green-700', name: 'Lumut' },
              { id: 'dark_stone', color: 'bg-slate-700', name: 'Gelap' }
            ].map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setPropColor(c.id as any)}
                className={`w-7 h-7 rounded-lg ${c.color} border border-white/30 flex items-center justify-center text-[8px] font-bold text-white transition-all active:scale-95 cursor-pointer ${
                  gameState.devPropColor === c.id ? 'ring-2 ring-amber-300 scale-105' : 'opacity-70'
                }`}
                title={`Warna ${c.name}`}
              >
                {c.name[0]}
              </button>
            ))}
          </div>

          <span className="text-[9px] font-black tracking-wider text-amber-300 uppercase mb-0.5">Daftar Objek (Props)</span>

          {[
            { id: 'maple_tree', icon: 'spa', name: 'Pohon Maple' },
            { id: 'pine_tree', icon: 'terrain', name: 'Pohon Pinus' },
            { id: 'bush', icon: 'filter_vintage', name: 'Semak Bunga' },
            { id: 'wildflower', icon: 'local_florist', name: 'Bunga Liar' },
            { id: 'rustic_fence', icon: 'grid_3x3', name: 'Pagar Rustic' },
            { id: 'bench', icon: 'chair', name: 'Kursi Taman' },
            { id: 'boulder', icon: 'category', name: 'Batu Boulder' },
            { id: 'hay_bale', icon: 'grass', name: 'Jerami Padi' },
            { id: 'streetlamp', icon: 'light', name: 'Lampu Jalan' },
            { id: 'shipping_bin', icon: 'archive', name: 'Kotak Jual' },
            { id: 'water_well', icon: 'water_drop', name: 'Sumur Air' },
            { id: 'watermill', icon: 'factory', name: 'Kincir Air' }
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setProp(item.id)}
              className={`px-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-[10px] text-left transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                gameState.devSelectedProp === item.id ? 'bg-amber-500/30 text-amber-300 border border-amber-400/50' : ''
              }`}
            >
              <span className="material-icons text-xs">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* BOTTOM SLIDERS BAR */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5 flex flex-col md:flex-row gap-3 items-center justify-between shadow-2xl pointer-events-auto mt-auto">
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-white">
          {/* Radius slider */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[10px] font-bold text-white/80">
              <span>Radius Kuas (*Brush Radius*)</span>
              <span className="text-amber-300 font-mono">{gameState.devBrushRadius.toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="8.0"
              step="0.5"
              value={gameState.devBrushRadius}
              onChange={onRadiusChange}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>

          {/* Strength slider */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[10px] font-bold text-white/80">
              <span>Kekuatan Kuas (*Brush Strength*)</span>
              <span className="text-amber-300 font-mono">{Math.round(gameState.devBrushStrength * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={gameState.devBrushStrength}
              onChange={onStrengthChange}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
