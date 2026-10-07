import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  ActionContext,
  Animal,
  AreaId,
  CropDefinition,
  CropType,
  FarmTile,
  Item,
  NPC,
  ToolType
} from '../models/game.models';
import { audioService } from './audio';

export const CROP_CONFIGS: Record<CropType, CropDefinition> = {
  turnip: {
    id: 'turnip',
    name: 'Turnip',
    seedPrice: 20,
    sellPrice: 45,
    growthDays: 2,
    color: '#f8fafc',
    season: 'Spring'
  },
  strawberry: {
    id: 'strawberry',
    name: 'Strawberry',
    seedPrice: 50,
    sellPrice: 110,
    growthDays: 3,
    color: '#f43f5e',
    season: 'Spring'
  },
  corn: {
    id: 'corn',
    name: 'Sweet Corn',
    seedPrice: 80,
    sellPrice: 190,
    growthDays: 4,
    color: '#eab308',
    season: 'Summer'
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Golden Pumpkin',
    seedPrice: 120,
    sellPrice: 320,
    growthDays: 5,
    color: '#f97316',
    season: 'Autumn'
  }
};

const STORAGE_KEY = 'harvest_moon_tot_save_v2';
const SETTINGS_KEY = 'harvest_moon_tot_settings_v1';

export interface DialogueData {
  npc: NPC;
  text: string;
  options?: { label: string; action: () => void }[];
}

export interface SleepSummaryData {
  day: number;
  earned: number;
  itemsSold: number;
}

export interface GameStateContextType {
  // Time & Date
  day: number;
  setDay: React.Dispatch<React.SetStateAction<number>>;
  season: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
  setSeason: React.Dispatch<React.SetStateAction<'Spring' | 'Summer' | 'Autumn' | 'Winter'>>;
  hour: number;
  setHour: React.Dispatch<React.SetStateAction<number>>;
  minute: number;
  setMinute: React.Dispatch<React.SetStateAction<number>>;
  weather: 'Sunny' | 'Rainy';
  setWeather: React.Dispatch<React.SetStateAction<'Sunny' | 'Rainy'>>;

  // Player Stats
  stamina: number;
  setStamina: React.Dispatch<React.SetStateAction<number>>;
  maxStamina: number;
  gold: number;
  setGold: React.Dispatch<React.SetStateAction<number>>;
  currentArea: AreaId;
  setCurrentArea: React.Dispatch<React.SetStateAction<AreaId>>;
  selectedTool: ToolType;
  setSelectedTool: React.Dispatch<React.SetStateAction<ToolType>>;
  isRunning: boolean;
  setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
  totalCropsShipped: number;
  totalFishCaught: number;

  // Player Coords
  playerCoords: { x: number; y: number; z: number };
  setPlayerCoords: React.Dispatch<React.SetStateAction<{ x: number; y: number; z: number }>>;

  // System States
  isFullscreenLandscape: boolean;
  setIsFullscreenLandscape: React.Dispatch<React.SetStateAction<boolean>>;
  isGamePaused: boolean;
  setIsGamePaused: React.Dispatch<React.SetStateAction<boolean>>;
  isAppLoading: boolean;
  setIsAppLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // Modals & Overlay Flags
  isFading: boolean;
  setIsFading: React.Dispatch<React.SetStateAction<boolean>>;
  fadeMessage: string;
  setFadeMessage: React.Dispatch<React.SetStateAction<string>>;
  activeDialogue: DialogueData | null;
  setActiveDialogue: React.Dispatch<React.SetStateAction<DialogueData | null>>;
  isInventoryOpen: boolean;
  setIsInventoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isShopOpen: boolean;
  setIsShopOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSleepSummaryOpen: boolean;
  setIsSleepSummaryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMapOpen: boolean;
  setIsMapOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPerfModalOpen: boolean;
  setIsPerfModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isToolMenuOpen: boolean;
  setIsToolMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPhotoModeOpen: boolean;
  setIsPhotoModeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDevEditorOpen: boolean;
  setIsDevEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDevGridVisible: boolean;
  setIsDevGridVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isDevFreeCamera: boolean;
  setIsDevFreeCamera: React.Dispatch<React.SetStateAction<boolean>>;
  devEditorTool: 'sculpt_raise' | 'sculpt_lower' | 'sculpt_flatten' | 'paint_dirt' | 'paint_grass' | 'paint_cobble' | 'place_prop' | 'delete_prop' | 'edit_gate';
  setDevEditorTool: React.Dispatch<React.SetStateAction<'sculpt_raise' | 'sculpt_lower' | 'sculpt_flatten' | 'paint_dirt' | 'paint_grass' | 'paint_cobble' | 'place_prop' | 'delete_prop' | 'edit_gate'>>;
  devSelectedProp: string;
  setDevSelectedProp: React.Dispatch<React.SetStateAction<string>>;
  devPropColor: 'default' | 'golden' | 'autumn_red' | 'moss_green' | 'dark_stone';
  setDevPropColor: React.Dispatch<React.SetStateAction<'default' | 'golden' | 'autumn_red' | 'moss_green' | 'dark_stone'>>;
  devBrushRadius: number;
  setDevBrushRadius: React.Dispatch<React.SetStateAction<number>>;
  devBrushStrength: number;
  setDevBrushStrength: React.Dispatch<React.SetStateAction<number>>;
  sleepSummary: SleepSummaryData | null;

  // Performance telemetry
  fps: number;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  drawCalls: number;
  setDrawCalls: React.Dispatch<React.SetStateAction<number>>;
  triangles: number;
  setTriangles: React.Dispatch<React.SetStateAction<number>>;
  frameTimeMs: number;
  setFrameTimeMs: React.Dispatch<React.SetStateAction<number>>;
  geometriesCount: number;
  setGeometriesCount: React.Dispatch<React.SetStateAction<number>>;
  texturesCount: number;
  setTexturesCount: React.Dispatch<React.SetStateAction<number>>;
  totalChunks: number;
  setTotalChunks: React.Dispatch<React.SetStateAction<number>>;
  visibleChunks: number;
  setVisibleChunks: React.Dispatch<React.SetStateAction<number>>;
  gpuInfo: string;
  setGpuInfo: React.Dispatch<React.SetStateAction<string>>;

  // Controller Settings
  hudOpacity: number;
  setHudOpacity: React.Dispatch<React.SetStateAction<number>>;
  controlScale: number;
  setControlScale: React.Dispatch<React.SetStateAction<number>>;
  joystickOffsetX: number;
  setJoystickOffsetX: React.Dispatch<React.SetStateAction<number>>;
  joystickOffsetY: number;
  setJoystickOffsetY: React.Dispatch<React.SetStateAction<number>>;
  actionOffsetX: number;
  setActionOffsetX: React.Dispatch<React.SetStateAction<number>>;
  actionOffsetY: number;
  setActionOffsetY: React.Dispatch<React.SetStateAction<number>>;
  shadowsEnabled: boolean;
  setShadowsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  tiltShiftEnabled: boolean;
  setTiltShiftEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  perPixelLighting: 'low' | 'high' | 'ultra';
  setPerPixelLighting: React.Dispatch<React.SetStateAction<'low' | 'high' | 'ultra'>>;
  anisotropicFiltering: 'off' | '4x' | '16x';
  setAnisotropicFiltering: React.Dispatch<React.SetStateAction<'off' | '4x' | '16x'>>;
  renderResolution: '0.75x' | '1.0x' | 'native';
  setRenderResolution: React.Dispatch<React.SetStateAction<'0.75x' | '1.0x' | 'native'>>;

  // Toast
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Gameplay entities
  farmPlots: FarmTile[];
  setFarmPlots: React.Dispatch<React.SetStateAction<FarmTile[]>>;
  animals: Animal[];
  setAnimals: React.Dispatch<React.SetStateAction<Animal[]>>;
  npcs: NPC[];
  setNpcs: React.Dispatch<React.SetStateAction<NPC[]>>;
  inventory: Item[];
  setInventory: React.Dispatch<React.SetStateAction<Item[]>>;
  shippingBin: Item[];

  // Helpers
  cycleToolNext: () => void;
  cycleToolPrev: () => void;
  setTool: (tool: ToolType) => void;
  warpToArea: (area: AreaId, entranceName?: string) => void;
  executeCurrentAction: () => void;
  tillCurrentTile: (tile?: FarmTile) => void;
  plantCurrentTile: (tile?: FarmTile) => void;
  waterCurrentTile: (tile?: FarmTile) => void;
  harvestCurrentTile: (tile?: FarmTile) => void;
  petAnimal: (animal: Animal) => void;
  talkToNpc: (npc: NPC) => void;
  openShippingPrompt: () => void;
  doFishing: () => void;
  refillWater: () => void;
  sleepAndAdvanceDay: (fromPassOut?: boolean) => void;
  addToInventory: (item: Item) => void;
  removeFromInventory: (itemId: string, count?: number) => void;
  saveToStorage: () => void;
  saveSettings: () => void;
  resetSettings: () => void;
  currentAction: ActionContext;
  setCurrentAction: React.Dispatch<React.SetStateAction<ActionContext>>;
  areaName: string;
  timeFormatted: string;
  toolsList: { id: ToolType; name: string; icon: string }[];
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Time & Date
  const [day, setDay] = useState<number>(1);
  const [season, setSeason] = useState<'Spring' | 'Summer' | 'Autumn' | 'Winter'>('Spring');
  const [hour, setHour] = useState<number>(6);
  const [minute, setMinute] = useState<number>(0);
  const [weather, setWeather] = useState<'Sunny' | 'Rainy'>('Sunny');

  // Player Stats
  const [stamina, setStamina] = useState<number>(100);
  const [maxStamina] = useState<number>(100);
  const [gold, setGold] = useState<number>(350);
  const [currentArea, setCurrentArea] = useState<AreaId>('farm');
  const [selectedTool, setSelectedTool] = useState<ToolType>('hoe');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [totalCropsShipped, setTotalCropsShipped] = useState<number>(0);
  const [totalFishCaught, setTotalFishCaught] = useState<number>(0);

  // Player Coordinates
  const [playerCoords, setPlayerCoords] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 2.5 });

  // Fullscreen Landscape Guard & System States
  const [isFullscreenLandscape, setIsFullscreenLandscape] = useState<boolean>(false);
  const [isGamePaused, setIsGamePaused] = useState<boolean>(true);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);

  // Modals & Overlays
  const [isFading, setIsFading] = useState<boolean>(false);
  const [fadeMessage, setFadeMessage] = useState<string>('');
  const [activeDialogue, setActiveDialogue] = useState<DialogueData | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(false);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [isSleepSummaryOpen, setIsSleepSummaryOpen] = useState<boolean>(false);
  const [isMapOpen, setIsMapOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPerfModalOpen, setIsPerfModalOpen] = useState<boolean>(false);
  const [isToolMenuOpen, setIsToolMenuOpen] = useState<boolean>(false);
  const [isPhotoModeOpen, setIsPhotoModeOpen] = useState<boolean>(false);
  const [isDevEditorOpen, setIsDevEditorOpen] = useState<boolean>(false);
  const [isDevGridVisible, setIsDevGridVisible] = useState<boolean>(false);
  const [isDevFreeCamera, setIsDevFreeCamera] = useState<boolean>(false);
  const [devEditorTool, setDevEditorTool] = useState<'sculpt_raise' | 'sculpt_lower' | 'sculpt_flatten' | 'paint_dirt' | 'paint_grass' | 'paint_cobble' | 'place_prop' | 'delete_prop' | 'edit_gate'>('sculpt_raise');
  const [devSelectedProp, setDevSelectedProp] = useState<string>('maple_tree');
  const [devPropColor, setDevPropColor] = useState<'default' | 'golden' | 'autumn_red' | 'moss_green' | 'dark_stone'>('default');
  const [devBrushRadius, setDevBrushRadius] = useState<number>(2.5);
  const [devBrushStrength, setDevBrushStrength] = useState<number>(0.3);
  const [sleepSummary, setSleepSummary] = useState<SleepSummaryData | null>(null);

  // Performance telemetry
  const [fps, setFps] = useState<number>(60);
  const [drawCalls, setDrawCalls] = useState<number>(0);
  const [triangles, setTriangles] = useState<number>(0);
  const [frameTimeMs, setFrameTimeMs] = useState<number>(16.6);
  const [geometriesCount, setGeometriesCount] = useState<number>(0);
  const [texturesCount, setTexturesCount] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [visibleChunks, setVisibleChunks] = useState<number>(0);
  const [gpuInfo, setGpuInfo] = useState<string>('Standard WebGL');

  // Controls & HUD Settings
  const [hudOpacity, setHudOpacity] = useState<number>(0.75);
  const [controlScale, setControlScale] = useState<number>(1.0);
  const [joystickOffsetX, setJoystickOffsetX] = useState<number>(0);
  const [joystickOffsetY, setJoystickOffsetY] = useState<number>(0);
  const [actionOffsetX, setActionOffsetX] = useState<number>(0);
  const [actionOffsetY, setActionOffsetY] = useState<number>(0);
  const [shadowsEnabled, setShadowsEnabled] = useState<boolean>(true);
  const [tiltShiftEnabled, setTiltShiftEnabled] = useState<boolean>(false);
  const [perPixelLighting, setPerPixelLighting] = useState<'low' | 'high' | 'ultra'>('high');
  const [anisotropicFiltering, setAnisotropicFiltering] = useState<'off' | '4x' | '16x'>('16x');
  const [renderResolution, setRenderResolution] = useState<'0.75x' | '1.0x' | 'native'>('1.0x');

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Farm Plots (4x5 Grid = 20 plots)
  const [farmPlots, setFarmPlots] = useState<FarmTile[]>(() => {
    const tiles: FarmTile[] = [];
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 4; z++) {
        tiles.push({
          x,
          z,
          tilled: (x === 1 && z === 1) || (x === 2 && z === 1) || (x === 3 && z === 1),
          watered: false,
          crop: (x === 1 && z === 1) ? { type: 'turnip', stage: 1, daysGrown: 1 } : undefined
        });
      }
    }
    return tiles;
  });

  // Animals
  const [animals, setAnimals] = useState<Animal[]>([
    {
      id: 'cow-1',
      type: 'cow',
      name: 'Bessie',
      pettedToday: false,
      fedToday: false,
      hearts: 1,
      productAvailable: true,
      position: { x: -8, z: 2 }
    },
    {
      id: 'sheep-1',
      type: 'sheep',
      name: 'Woolly',
      pettedToday: false,
      fedToday: false,
      hearts: 1,
      productAvailable: true,
      position: { x: -10, z: -1 }
    },
    {
      id: 'chicken-1',
      type: 'chicken',
      name: 'Pip',
      pettedToday: false,
      fedToday: false,
      hearts: 2,
      productAvailable: true,
      position: { x: -6, z: 4 }
    }
  ]);

  // NPCs
  const [npcs, setNpcs] = useState<NPC[]>([
    {
      id: 'oliver',
      name: 'Mayor Oliver',
      title: 'Solaria Island Mayor',
      area: 'town',
      hearts: 2,
      dialogueIndex: 0,
      color: '#3b82f6',
      dialogues: [
        'Selamat datang di Pulau Solaria! Tanahnya sangat subur untuk bercocok tanam dan beternak.',
        'Kamu bisa menanam sayuran di kebun, memancing di dermaga, atau berbelanja bibit di toko Maya.',
        'Bila ingin melihat peta pulau dan pengaturan kontrol, ketuk info lokasi di layar atas!'
      ]
    },
    {
      id: 'maya',
      name: 'Maya',
      title: 'General Storekeeper',
      area: 'shop',
      hearts: 1,
      dialogueIndex: 0,
      color: '#ec4899',
      dialogues: [
        'Halo! Selamat datang di Toko Maya! Butuh bibit sayuran segar hari ini?',
        'Siram tanamanmu setiap hari dengan air sumur agar tumbuh lebat dan cepat berbuah.',
        'Hasil panen bisa langsung kamu masukkan ke Kotak Penjualan (Shipping Bin) di samping kebun.'
      ]
    },
    {
      id: 'luke',
      name: 'Luke',
      title: 'Island Craftsman',
      area: 'town',
      hearts: 1,
      dialogueIndex: 0,
      color: '#f97316',
      dialogues: [
        'Halo kawan! Angin laut di Dermaga Seagull sangat segar hari ini.',
        'Bawalah alat pancing ke ujung dermaga untuk menangkap ikan laut yang lezat!'
      ]
    },
    {
      id: 'fin',
      name: 'Fin the Sprite',
      title: 'Guardian of the Mother Tree',
      area: 'goddess_tree',
      hearts: 3,
      dialogueIndex: 0,
      color: '#10b981',
      dialogues: [
        'Tee-hee! Kamu bisa melihatku? Aku Fin, peri penjaga alam Pulau Solaria!',
        'Pohon Keramat ini menaungi seluruh pulau dengan kedamaian dan kesejukan alam.',
        'Nikmatilah harimu bercocok tanam di pulau yang indah ini!'
      ]
    }
  ]);

  // Inventory
  const [inventory, setInventory] = useState<Item[]>([
    { id: 'seed_turnip', name: 'Turnip Seeds', count: 6, type: 'seed', sellValue: 10, description: 'Sayuran musim semi cepat panen.', icon: 'grass' },
    { id: 'seed_strawberry', name: 'Strawberry Seeds', count: 3, type: 'seed', sellValue: 25, description: 'Buah manis berwarna merah cerah.', icon: 'spa' }
  ]);

  // Shipping Bin (items waiting to be sold overnight)
  const [shippingBin, setShippingBin] = useState<Item[]>([]);

  // Current Action
  const [currentAction, setCurrentAction] = useState<ActionContext>({
    type: 'interact',
    label: 'AKSI',
    icon: 'touch_app'
  });

  const toolsList: { id: ToolType; name: string; icon: string }[] = [
    { id: 'hoe', name: 'Hoe', icon: 'hardware' },
    { id: 'water_can', name: 'Water Can', icon: 'water_drop' },
    { id: 'seeds', name: 'Seeds', icon: 'yard' },
    { id: 'sickle', name: 'Sickle', icon: 'content_cut' },
    { id: 'fishing_rod', name: 'Fishing Rod', icon: 'phishing' },
    { id: 'hand', name: 'Empty Hand', icon: 'pan_tool' }
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Formatted display values
  const areaName = (() => {
    switch (currentArea) {
      case 'farm': return 'Solaria Farmstead';
      case 'house': return 'Farmer\'s Cottage';
      case 'town': return 'Harmonica Town & Pier';
      case 'shop': return 'General Store';
      case 'goddess_tree': return 'Whispering Mother Tree';
      default: return 'Solaria Island';
    }
  })();

  const timeFormatted = (() => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayH = hour % 12 === 0 ? 12 : hour % 12;
    const displayM = minute < 10 ? `0${minute}` : `${minute}`;
    return `${displayH}:${displayM} ${period}`;
  })();

  // Tool Cycle: Next
  const cycleToolNext = () => {
    const idx = toolsList.findIndex(t => t.id === selectedTool);
    const nextIdx = (idx + 1) % toolsList.length;
    setSelectedTool(toolsList[nextIdx].id);
    showToast(`Alat: ${toolsList[nextIdx].name}`);
  };

  // Tool Cycle: Prev
  const cycleToolPrev = () => {
    const idx = toolsList.findIndex(t => t.id === selectedTool);
    const prevIdx = (idx - 1 + toolsList.length) % toolsList.length;
    setSelectedTool(toolsList[prevIdx].id);
    showToast(`Alat: ${toolsList[prevIdx].name}`);
  };

  const setTool = (tool: ToolType) => {
    setSelectedTool(tool);
    const t = toolsList.find(item => item.id === tool);
    if (t) showToast(`Alat: ${t.name}`);
  };

  // Area Switching
  const warpToArea = (area: AreaId, entranceName = '') => {
    if (isFading) return;
    audioService.playWarp();
    setIsFading(true);
    setFadeMessage(entranceName || `Menuju ${area}...`);

    setTimeout(() => {
      setCurrentArea(area);
      setTimeout(() => {
        setIsFading(false);
        setFadeMessage('');
        saveToStorage();
      }, 400);
    }, 450);
  };

  const tillCurrentTile = (tile?: FarmTile) => {
    if (!tile) return;
    if (stamina < 2) {
      showToast('Terlalu lelah! Istirahat untuk memulihkan stamina.');
      return;
    }
    setFarmPlots(prev => prev.map(p => {
      if (p.x === tile.x && p.z === tile.z) {
        return { ...p, tilled: true };
      }
      return p;
    }));
    setStamina(s => Math.max(0, s - 2));
    audioService.playTill();
    showToast('Tanah berhasil dicangkul!');
  };

  const plantCurrentTile = (tile?: FarmTile) => {
    if (!tile) return;
    const seedItem = inventory.find(i => i.type === 'seed' && i.count > 0);
    if (!seedItem) {
      showToast('Tidak ada bibit di tas! Beli bibit di Toko Maya.');
      return;
    }

    let cropType: CropType = 'turnip';
    if (seedItem.id.includes('strawberry')) cropType = 'strawberry';
    else if (seedItem.id.includes('corn')) cropType = 'corn';
    else if (seedItem.id.includes('pumpkin')) cropType = 'pumpkin';

    setFarmPlots(prev => prev.map(p => {
      if (p.x === tile.x && p.z === tile.z) {
        return {
          ...p,
          crop: {
            type: cropType,
            stage: 0,
            daysGrown: 0
          }
        };
      }
      return p;
    }));

    removeFromInventory(seedItem.id, 1);
    audioService.playPlant();
    showToast(`Menanam/Bibit ${CROP_CONFIGS[cropType].name}!`);
  };

  const waterCurrentTile = (tile?: FarmTile) => {
    if (!tile) return;
    if (stamina < 1) {
      showToast('Terlalu lelah untuk menyiram air.');
      return;
    }
    setFarmPlots(prev => prev.map(p => {
      if (p.x === tile.x && p.z === tile.z) {
        return { ...p, watered: true };
      }
      return p;
    }));
    setStamina(s => Math.max(0, s - 1));
    audioService.playWater();
    showToast('Tanah telah disiram air!');
  };

  const harvestCurrentTile = (tile?: FarmTile) => {
    if (!tile || !tile.crop) return;
    const cropDef = CROP_CONFIGS[tile.crop.type];

    addToInventory({
      id: `crop_${cropDef.id}`,
      name: `Fresh ${cropDef.name}`,
      count: 1,
      type: 'crop',
      sellValue: cropDef.sellPrice,
      description: `Hasil panen segar tanah Solaria. Harga jual ${cropDef.sellPrice} G.`,
      icon: 'eco'
    });

    setFarmPlots(prev => prev.map(p => {
      if (p.x === tile.x && p.z === tile.z) {
        return { ...p, crop: undefined, watered: false };
      }
      return p;
    }));

    audioService.playHarvest();
    showToast(`Panen 1x ${cropDef.name}! ✨`);
  };

  const petAnimal = (animal: Animal) => {
    if (animal.pettedToday) {
      showToast(`${animal.name} sudah disayang hari ini! ❤️`);
      return;
    }

    setAnimals(prev => prev.map(a => {
      if (a.id === animal.id) {
        return {
          ...a,
          pettedToday: true,
          hearts: Math.min(5, a.hearts + 1),
          productAvailable: false
        };
      }
      return a;
    }));

    if (animal.type === 'cow') {
      addToInventory({
        id: 'fresh_milk',
        name: 'Fresh Solaria Milk',
        count: 1,
        type: 'produce',
        sellValue: 60,
        description: 'Susu murni gurih dari Bessie.',
        icon: 'local_drink'
      });
      showToast(`Mengelus Bessie! Mengambil Susu Segar 🥛 (+1 ❤️)`);
    } else if (animal.type === 'sheep') {
      addToInventory({
        id: 'soft_wool',
        name: 'Soft White Wool',
        count: 1,
        type: 'produce',
        sellValue: 90,
        description: 'Bulu domba hangat dari Woolly.',
        icon: 'cloud'
      });
      showToast(`Menyisir Woolly! Mengambil Wol Lembut 🐑 (+1 ❤️)`);
    } else {
      addToInventory({
        id: 'egg',
        name: 'Farm Fresh Egg',
        count: 1,
        type: 'produce',
        sellValue: 35,
        description: 'Telur ayam segar kecokelatan.',
        icon: 'egg'
      });
      showToast(`Menyayangi Pip! Mengambil Telur Segar 🥚 (+1 ❤️)`);
    }

    audioService.playPetAnimal(animal.type);
  };

  const talkToNpc = (npc: NPC) => {
    audioService.playDialogueBlip(npc.id === 'maya' ? 2 : npc.id === 'fin' ? 4 : 0);
    const text = npc.dialogues[npc.dialogueIndex % npc.dialogues.length];

    setNpcs(prev => prev.map(n => n.id === npc.id ? { ...n, dialogueIndex: n.dialogueIndex + 1 } : n));

    const options = npc.id === 'maya' ? [
      {
        label: '🛍️ Buka Toko (Shop)',
        action: () => {
          setActiveDialogue(null);
          setIsShopOpen(true);
        }
      },
      { label: 'Tutup', action: () => setActiveDialogue(null) }
    ] : [
      { label: 'Tutup', action: () => setActiveDialogue(null) }
    ];

    setActiveDialogue({
      npc,
      text,
      options
    });
  };

  const openShippingPrompt = () => {
    const sellables = inventory.filter(i => i.type === 'crop' || i.type === 'produce' || i.type === 'fish');
    if (sellables.length === 0) {
      showToast('Tidak ada hasil panen atau produk ternak di tas untuk dijual.');
      return;
    }

    let countShipped = 0;
    const newBinItems = [...shippingBin];

    sellables.forEach(item => {
      newBinItems.push({ ...item });
      countShipped += item.count;
      removeFromInventory(item.id, item.count);
    });

    setShippingBin(newBinItems);
    setTotalCropsShipped(n => n + countShipped);
    audioService.playCoin();
    showToast(`Memasukkan ${countShipped} barang ke Kotak Penjualan. Uang diterima besok pagi.`);
  };

  const doFishing = () => {
    if (stamina < 3) {
      showToast('Terlalu lelah untuk memancing.');
      return;
    }
    setStamina(s => Math.max(0, s - 3));
    audioService.playWater();

    const fishTypes = [
      { name: 'Solaria Trout', value: 50 },
      { name: 'Seagull Salmon', value: 85 },
      { name: 'Glittering Snapper', value: 140 }
    ];
    const picked = fishTypes[Math.floor(Math.random() * fishTypes.length)];

    addToInventory({
      id: `fish_${picked.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: picked.name,
      count: 1,
      type: 'fish',
      sellValue: picked.value,
      description: 'Hasil pancingan segar di Dermaga Seagull.',
      icon: 'phishing'
    });

    setTotalFishCaught(c => c + 1);
    audioService.playHarvest();
    showToast(`🎣 Mendapatkan seekor ${picked.name} (Nilai: ${picked.value} G)!`);
  };

  const refillWater = () => {
    audioService.playWater();
    showToast('Alat Siram terisi penuh dengan air segar! 💧');
  };

  // Sleep & Advance Day
  const sleepAndAdvanceDay = (fromPassOut = false) => {
    if (isFading) return;
    audioService.playWarp();
    setIsFading(true);
    setFadeMessage('Menyimpan progres & tidur hingga pagi 6:00 AM...');

    setTimeout(() => {
      const nextDay = day + 1;
      setDay(nextDay);
      setHour(6);
      setMinute(0);

      const isRain = Math.random() < 0.2;
      setWeather(isRain ? 'Rainy' : 'Sunny');

      setStamina(fromPassOut ? 60 : 100);

      let earned = 0;
      let itemsSold = 0;
      shippingBin.forEach(item => {
        earned += item.sellValue * item.count;
        itemsSold += item.count;
      });

      if (earned > 0) {
        setGold(g => g + earned);
        audioService.playCoin();
      }
      setShippingBin([]);

      setFarmPlots(plots => {
        return plots.map(p => {
          let updatedCrop = p.crop;
          if (p.crop && (p.watered || isRain)) {
            const def = CROP_CONFIGS[p.crop.type];
            const nextDays = p.crop.daysGrown + 1;
            const stage = Math.min(3, Math.floor((nextDays / def.growthDays) * 3));
            updatedCrop = {
              ...p.crop,
              daysGrown: nextDays,
              stage
            };
          }
          return {
            ...p,
            watered: isRain,
            crop: updatedCrop
          };
        });
      });

      setAnimals(arr => arr.map(a => ({ ...a, pettedToday: false, productAvailable: true })));
      setCurrentArea('house');

      setSleepSummary({
        day: nextDay,
        earned,
        itemsSold
      });
      setIsSleepSummaryOpen(true);

      setTimeout(() => {
        setIsFading(false);
        setFadeMessage('');
        saveToStorageInternal(nextDay, isRain ? 'Rainy' : 'Sunny');
      }, 500);
    }, 600);
  };

  // Inventory helpers
  const addToInventory = (item: Item) => {
    setInventory(inv => {
      const existing = inv.find(i => i.id === item.id);
      if (existing) {
        return inv.map(i => i.id === item.id ? { ...i, count: i.count + item.count } : i);
      }
      return [...inv, item];
    });
  };

  const removeFromInventory = (itemId: string, count = 1) => {
    setInventory(inv => {
      return inv
        .map(i => i.id === itemId ? { ...i, count: i.count - count } : i)
        .filter(i => i.count > 0);
    });
  };

  // Save / Load Storage
  const saveToStorageInternal = (nextDay?: number, nextWeather?: 'Sunny' | 'Rainy') => {
    if (typeof window === 'undefined') return;
    try {
      const data = {
        day: nextDay ?? day,
        season,
        hour,
        minute,
        weather: nextWeather ?? weather,
        stamina,
        gold,
        currentArea,
        farmPlots,
        animals,
        inventory,
        totalCropsShipped,
        totalFishCaught
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  };

  const saveToStorage = () => saveToStorageInternal();

  const loadFromStorage = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.day) setDay(data.day);
      if (data.season) setSeason(data.season);
      if (data.gold !== undefined) setGold(data.gold);
      if (data.farmPlots) setFarmPlots(data.farmPlots);
      if (data.animals) setAnimals(data.animals);
      if (data.inventory) setInventory(data.inventory);
      if (data.totalCropsShipped) setTotalCropsShipped(data.totalCropsShipped);
      if (data.totalFishCaught) setTotalFishCaught(data.totalFishCaught);
    } catch (e) {
      console.warn('Storage load failed:', e);
    }
  };

  const saveSettings = () => {
    if (typeof window === 'undefined') return;
    try {
      const s = {
        hudOpacity,
        controlScale,
        joystickOffsetX,
        joystickOffsetY,
        actionOffsetX,
        actionOffsetY,
        shadowsEnabled,
        tiltShiftEnabled
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) {
      console.warn('Settings save failed:', e);
    }
  };

  const loadSettings = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.hudOpacity !== undefined) setHudOpacity(s.hudOpacity);
      if (s.controlScale !== undefined) setControlScale(s.controlScale);
      if (s.joystickOffsetX !== undefined) setJoystickOffsetX(s.joystickOffsetX);
      if (s.joystickOffsetY !== undefined) setJoystickOffsetY(s.joystickOffsetY);
      if (s.actionOffsetX !== undefined) setActionOffsetX(s.actionOffsetX);
      if (s.actionOffsetY !== undefined) setActionOffsetY(s.actionOffsetY);
      if (s.shadowsEnabled !== undefined) setShadowsEnabled(s.shadowsEnabled);
      if (s.tiltShiftEnabled !== undefined) setTiltShiftEnabled(s.tiltShiftEnabled);
    } catch (e) {
      console.warn('Settings load failed:', e);
    }
  };

  const resetSettings = () => {
    setHudOpacity(0.75);
    setControlScale(1.0);
    setJoystickOffsetX(0);
    setJoystickOffsetY(0);
    setActionOffsetX(0);
    setActionOffsetY(0);
    setShadowsEnabled(true);
    setTiltShiftEnabled(false);
    showToast('Pengaturan kontrol direset ke default!');
  };

  // Time loop
  useEffect(() => {
    loadFromStorage();
    loadSettings();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || isGamePaused) return;

    const timer = setInterval(() => {
      setMinute(m => {
        let nextM = m + 1;
        if (nextM >= 60) {
          nextM = 0;
          setHour(h => {
            let nextH = h + 1;
            if (nextH >= 24) {
              nextH = 0;
            }
            if (nextH === 2) {
              // late night pass out
              showToast('Kelelahan larut malam! Pulih di kasur.');
              sleepAndAdvanceDay(true);
            }
            return nextH;
          });
        }
        return nextM;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isGamePaused, hour, day]);

  // Handle Action Trigger
  const executeCurrentAction = () => {
    const act = currentAction;
    switch (act.type) {
      case 'till':
        tillCurrentTile(act.targetTile);
        break;
      case 'plant':
        plantCurrentTile(act.targetTile);
        break;
      case 'water':
        waterCurrentTile(act.targetTile);
        break;
      case 'harvest':
        harvestCurrentTile(act.targetTile);
        break;
      case 'enter':
        if (act.targetArea) {
          const names: Record<AreaId, string> = {
            farm: 'Solaria Farmstead',
            house: 'Farmer\'s Cottage',
            town: 'Harmonica Town',
            shop: 'General Store',
            goddess_tree: 'Whispering Tree Shrine'
          };
          warpToArea(act.targetArea, names[act.targetArea]);
        }
        break;
      case 'talk':
        if (act.targetNpc) {
          talkToNpc(act.targetNpc);
        }
        break;
      case 'pet':
        if (act.targetAnimal) {
          petAnimal(act.targetAnimal);
        }
        break;
      case 'sleep':
        sleepAndAdvanceDay(false);
        break;
      case 'ship':
        openShippingPrompt();
        break;
      case 'fish':
        doFishing();
        break;
      case 'refill':
        refillWater();
        break;
      default:
        showToast('Tidak ada objek untuk aksi di sini.');
        break;
    }
  };

  return (
    <GameStateContext.Provider
      value={{
        day,
        setDay,
        season,
        setSeason,
        hour,
        setHour,
        minute,
        setMinute,
        weather,
        setWeather,
        stamina,
        setStamina,
        maxStamina,
        gold,
        setGold,
        currentArea,
        setCurrentArea,
        selectedTool,
        setSelectedTool,
        isRunning,
        setIsRunning,
        totalCropsShipped,
        totalFishCaught,
        playerCoords,
        setPlayerCoords,
        isFullscreenLandscape,
        setIsFullscreenLandscape,
        isGamePaused,
        setIsGamePaused,
        isAppLoading,
        setIsAppLoading,
        isFading,
        setIsFading,
        fadeMessage,
        setFadeMessage,
        activeDialogue,
        setActiveDialogue,
        isInventoryOpen,
        setIsInventoryOpen,
        isShopOpen,
        setIsShopOpen,
        isSleepSummaryOpen,
        setIsSleepSummaryOpen,
        isMapOpen,
        setIsMapOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        isPerfModalOpen,
        setIsPerfModalOpen,
        isToolMenuOpen,
        setIsToolMenuOpen,
        isPhotoModeOpen,
        setIsPhotoModeOpen,
        isDevEditorOpen,
        setIsDevEditorOpen,
        isDevGridVisible,
        setIsDevGridVisible,
        isDevFreeCamera,
        setIsDevFreeCamera,
        devEditorTool,
        setDevEditorTool,
        devSelectedProp,
        setDevSelectedProp,
        devPropColor,
        setDevPropColor,
        devBrushRadius,
        setDevBrushRadius,
        devBrushStrength,
        setDevBrushStrength,
        sleepSummary,
        fps,
        setFps,
        drawCalls,
        setDrawCalls,
        triangles,
        setTriangles,
        frameTimeMs,
        setFrameTimeMs,
        geometriesCount,
        setGeometriesCount,
        texturesCount,
        setTexturesCount,
        totalChunks,
        setTotalChunks,
        visibleChunks,
        setVisibleChunks,
        gpuInfo,
        setGpuInfo,
        hudOpacity,
        setHudOpacity,
        controlScale,
        setControlScale,
        joystickOffsetX,
        setJoystickOffsetX,
        joystickOffsetY,
        setJoystickOffsetY,
        actionOffsetX,
        setActionOffsetX,
        actionOffsetY,
        setActionOffsetY,
        shadowsEnabled,
        setShadowsEnabled,
        tiltShiftEnabled,
        setTiltShiftEnabled,
        perPixelLighting,
        setPerPixelLighting,
        anisotropicFiltering,
        setAnisotropicFiltering,
        renderResolution,
        setRenderResolution,
        toastMessage,
        showToast,
        farmPlots,
        setFarmPlots,
        animals,
        setAnimals,
        npcs,
        setNpcs,
        inventory,
        setInventory,
        shippingBin,
        cycleToolNext,
        cycleToolPrev,
        setTool,
        warpToArea,
        executeCurrentAction,
        tillCurrentTile,
        plantCurrentTile,
        waterCurrentTile,
        harvestCurrentTile,
        petAnimal,
        talkToNpc,
        openShippingPrompt,
        doFishing,
        refillWater,
        sleepAndAdvanceDay,
        addToInventory,
        removeFromInventory,
        saveToStorage,
        saveSettings,
        resetSettings,
        currentAction,
        setCurrentAction,
        areaName,
        timeFormatted,
        toolsList
      }}
    >
      {children}
    </GameStateContext.Provider>
  );
};

export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
};
