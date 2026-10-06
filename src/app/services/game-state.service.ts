import { Injectable, signal, computed, inject } from '@angular/core';
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
import { AudioService } from './audio.service';

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

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  private audio = inject(AudioService);

  // Time & Date
  public day = signal<number>(1);
  public season = signal<'Spring' | 'Summer' | 'Autumn' | 'Winter'>('Spring');
  public hour = signal<number>(6);
  public minute = signal<number>(0);
  public weather = signal<'Sunny' | 'Rainy'>('Sunny');

  // Player Stats
  public stamina = signal<number>(100);
  public maxStamina = signal<number>(100);
  public gold = signal<number>(350);
  public currentArea = signal<AreaId>('farm');
  public selectedTool = signal<ToolType>('hoe');
  public isRunning = signal<boolean>(false);
  public totalCropsShipped = signal<number>(0);
  public totalFishCaught = signal<number>(0);

  // Player 3D Coordinates & Altitude (X, Y / Elevation, Z)
  public playerCoords = signal<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 2.5 });

  // Fullscreen Landscape Guard & Zero CPU State (Requirement)
  public isFullscreenLandscape = signal<boolean>(false);
  public isGamePaused = signal<boolean>(true);
  public isAppLoading = signal<boolean>(true);
  public assetLoadingProgress = signal<number>(0);
  public assetLoadingStage = signal<string>('Memulai...');
  public assetLoadingDetail = signal<string>('Menyiapkan...');
  public isAssetsCachedLocally = signal<boolean>(false);

  // Transitions & Modals
  public isFading = signal<boolean>(false);
  public fadeMessage = signal<string>('');
  public activeDialogue = signal<{ npc: NPC; text: string; options?: { label: string; action: () => void }[] } | null>(null);
  public isInventoryOpen = signal<boolean>(false);
  public isShopOpen = signal<boolean>(false);
  public isSleepSummaryOpen = signal<boolean>(false);
  public isMapOpen = signal<boolean>(false);
  public isSettingsOpen = signal<boolean>(false);
  public isPerfModalOpen = signal<boolean>(false);
  public isToolMenuOpen = signal<boolean>(false);
  public isPhotoModeOpen = signal<boolean>(false);
  public isDevEditorOpen = signal<boolean>(false);
  public isDevGridVisible = signal<boolean>(false);
  public devEditorTool = signal<'sculpt_raise' | 'sculpt_lower' | 'place_prop' | 'delete_prop'>('sculpt_raise');
  public devSelectedProp = signal<string>('maple_tree');
  public devBrushRadius = signal<number>(2.5);
  public devBrushStrength = signal<number>(0.3);
  public sleepSummary = signal<{ day: number; earned: number; itemsSold: number } | null>(null);

  // Performance Telemetry Signals
  public fps = signal<number>(60);
  public drawCalls = signal<number>(0);
  public triangles = signal<number>(0);
  public frameTimeMs = signal<number>(16.6);
  public geometriesCount = signal<number>(0);
  public texturesCount = signal<number>(0);
  public totalChunks = signal<number>(0);
  public visibleChunks = signal<number>(0);
  public gpuInfo = signal<string>('Standard WebGL');

  // Customizable Settings for Controls & HUD (Requirement)
  public hudOpacity = signal<number>(0.75); // 0.2 .. 1.0
  public controlScale = signal<number>(1.0); // 0.75 .. 1.35
  public joystickOffsetX = signal<number>(0); // -40 .. 40 px
  public joystickOffsetY = signal<number>(0); // -40 .. 40 px
  public actionOffsetX = signal<number>(0); // -40 .. 40 px
  public actionOffsetY = signal<number>(0); // -40 .. 40 px
  public shadowsEnabled = signal<boolean>(true);
  public tiltShiftEnabled = signal<boolean>(false);

  // Notifications
  public toastMessage = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Farm Plots (4x4 Grid = 16 plots)
  public farmPlots = signal<FarmTile[]>(this.initFarmPlots());

  // Animals
  public animals = signal<Animal[]>([
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
  public npcs = signal<NPC[]>([
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
  public inventory = signal<Item[]>([
    { id: 'seed_turnip', name: 'Turnip Seeds', count: 6, type: 'seed', sellValue: 10, description: 'Sayuran musim semi cepat panen.', icon: 'grass' },
    { id: 'seed_strawberry', name: 'Strawberry Seeds', count: 3, type: 'seed', sellValue: 25, description: 'Buah manis berwarna merah cerah.', icon: 'spa' }
  ]);

  // Shipping Bin (items waiting to be sold overnight)
  public shippingBin = signal<Item[]>([]);

  // Dynamic Contextual Action for All-in-One Button
  public currentAction = signal<ActionContext>({
    type: 'interact',
    label: 'AKSI',
    icon: 'touch_app'
  });

  // Tools available
  public toolsList: { id: ToolType; name: string; icon: string }[] = [
    { id: 'hoe', name: 'Hoe', icon: 'hardware' },
    { id: 'water_can', name: 'Water Can', icon: 'water_drop' },
    { id: 'seeds', name: 'Seeds', icon: 'yard' },
    { id: 'sickle', name: 'Sickle', icon: 'content_cut' },
    { id: 'fishing_rod', name: 'Fishing Rod', icon: 'phishing' },
    { id: 'hand', name: 'Empty Hand', icon: 'pan_tool' }
  ];

  // Formatted display values
  public timeFormatted = computed(() => {
    const h = this.hour();
    const m = this.minute();
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m < 10 ? `0${m}` : `${m}`;
    return `${displayH}:${displayM} ${period}`;
  });

  public areaName = computed(() => {
    switch (this.currentArea()) {
      case 'farm': return 'Solaria Farmstead';
      case 'house': return 'Farmer\'s Cottage';
      case 'town': return 'Harmonica Town & Pier';
      case 'shop': return 'General Store';
      case 'goddess_tree': return 'Whispering Mother Tree';
      default: return 'Solaria Island';
    }
  });

  constructor() {
    this.loadFromStorage();
    this.loadSettings();
    this.startTimeLoop();
  }

  private initFarmPlots(): FarmTile[] {
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
  }

  private startTimeLoop(): void {
    if (typeof window === 'undefined') return;
    setInterval(() => {
      let m = this.minute() + 1;
      let h = this.hour();
      if (m >= 60) {
        m = 0;
        h += 1;
      }
      if (h >= 24) {
        h = 0;
      }
      if (h === 2 && m === 0) {
        this.showToast('Kelelahan larut malam! Pulih di kasur.');
        this.sleepAndAdvanceDay(true);
        return;
      }
      this.minute.set(m);
      this.hour.set(h);
    }, 1000);
  }

  public showToast(msg: string): void {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set(null);
    }, 3200);
  }

  // Tool Cycle: Next (Tap)
  public cycleToolNext(): void {
    const current = this.selectedTool();
    const idx = this.toolsList.findIndex(t => t.id === current);
    const nextIdx = (idx + 1) % this.toolsList.length;
    this.selectedTool.set(this.toolsList[nextIdx].id);
    this.showToast(`Alat: ${this.toolsList[nextIdx].name}`);
  }

  // Tool Cycle: Prev (Swipe / Geser)
  public cycleToolPrev(): void {
    const current = this.selectedTool();
    const idx = this.toolsList.findIndex(t => t.id === current);
    const prevIdx = (idx - 1 + this.toolsList.length) % this.toolsList.length;
    this.selectedTool.set(this.toolsList[prevIdx].id);
    this.showToast(`Alat: ${this.toolsList[prevIdx].name}`);
  }

  public setTool(tool: ToolType): void {
    this.selectedTool.set(tool);
    const t = this.toolsList.find(item => item.id === tool);
    if (t) this.showToast(`Alat: ${t.name}`);
  }

  // Area Switching with smooth fade to black
  public warpToArea(area: AreaId, entranceName = ''): void {
    if (this.isFading()) return;
    this.audio.playWarp();
    this.isFading.set(true);
    this.fadeMessage.set(entranceName || `Menuju ${area}...`);

    setTimeout(() => {
      this.currentArea.set(area);
      setTimeout(() => {
        this.isFading.set(false);
        this.fadeMessage.set('');
        this.saveToStorage();
      }, 400);
    }, 450);
  }

  // All-in-One Action Trigger
  public executeCurrentAction(): void {
    const act = this.currentAction();
    switch (act.type) {
      case 'till':
        this.tillCurrentTile(act.targetTile);
        break;
      case 'plant':
        this.plantCurrentTile(act.targetTile);
        break;
      case 'water':
        this.waterCurrentTile(act.targetTile);
        break;
      case 'harvest':
        this.harvestCurrentTile(act.targetTile);
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
          this.warpToArea(act.targetArea, names[act.targetArea]);
        }
        break;
      case 'talk':
        if (act.targetNpc) {
          this.talkToNpc(act.targetNpc);
        }
        break;
      case 'pet':
        if (act.targetAnimal) {
          this.petAnimal(act.targetAnimal);
        }
        break;
      case 'sleep':
        this.sleepAndAdvanceDay(false);
        break;
      case 'ship':
        this.openShippingPrompt();
        break;
      case 'fish':
        this.doFishing();
        break;
      case 'refill':
        this.refillWater();
        break;
      default:
        this.showToast('Tidak ada objek untuk aksi di sini.');
        break;
    }
  }

  public tillCurrentTile(tile?: FarmTile): void {
    if (!tile) return;
    if (this.stamina() < 2) {
      this.showToast('Terlalu lelah! Istirahat untuk memulihkan stamina.');
      return;
    }
    this.farmPlots.update(plots => {
      return plots.map(p => {
        if (p.x === tile.x && p.z === tile.z) {
          return { ...p, tilled: true };
        }
        return p;
      });
    });
    this.stamina.update(s => Math.max(0, s - 2));
    this.audio.playTill();
    this.showToast('Tanah berhasil dicangkul!');
  }

  public plantCurrentTile(tile?: FarmTile): void {
    if (!tile) return;
    const seedItem = this.inventory().find(i => i.type === 'seed' && i.count > 0);
    if (!seedItem) {
      this.showToast('Tidak ada bibit di tas! Beli bibit di Toko Maya.');
      return;
    }

    let cropType: CropType = 'turnip';
    if (seedItem.id.includes('strawberry')) cropType = 'strawberry';
    else if (seedItem.id.includes('corn')) cropType = 'corn';
    else if (seedItem.id.includes('pumpkin')) cropType = 'pumpkin';

    this.farmPlots.update(plots => {
      return plots.map(p => {
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
      });
    });

    this.removeFromInventory(seedItem.id, 1);
    this.audio.playPlant();
    this.showToast(`Menanam Bibit ${CROP_CONFIGS[cropType].name}!`);
  }

  public waterCurrentTile(tile?: FarmTile): void {
    if (!tile) return;
    if (this.stamina() < 1) {
      this.showToast('Terlalu lelah untuk menyiram air.');
      return;
    }
    this.farmPlots.update(plots => {
      return plots.map(p => {
        if (p.x === tile.x && p.z === tile.z) {
          return { ...p, watered: true };
        }
        return p;
      });
    });
    this.stamina.update(s => Math.max(0, s - 1));
    this.audio.playWater();
    this.showToast('Tanah telah disiram air!');
  }

  public harvestCurrentTile(tile?: FarmTile): void {
    if (!tile || !tile.crop) return;
    const cropDef = CROP_CONFIGS[tile.crop.type];

    this.addToInventory({
      id: `crop_${cropDef.id}`,
      name: `Fresh ${cropDef.name}`,
      count: 1,
      type: 'crop',
      sellValue: cropDef.sellPrice,
      description: `Hasil panen segar tanah Solaria. Harga jual ${cropDef.sellPrice} G.`,
      icon: 'eco'
    });

    this.farmPlots.update(plots => {
      return plots.map(p => {
        if (p.x === tile.x && p.z === tile.z) {
          return { ...p, crop: undefined, watered: false };
        }
        return p;
      });
    });

    this.audio.playHarvest();
    this.showToast(`Panen 1x ${cropDef.name}! ✨`);
  }

  public petAnimal(animal: Animal): void {
    if (animal.pettedToday) {
      this.showToast(`${animal.name} sudah disayang hari ini! ❤️`);
      return;
    }

    this.animals.update(arr => {
      return arr.map(a => {
        if (a.id === animal.id) {
          return {
            ...a,
            pettedToday: true,
            hearts: Math.min(5, a.hearts + 1),
            productAvailable: false
          };
        }
        return a;
      });
    });

    if (animal.type === 'cow') {
      this.addToInventory({
        id: 'fresh_milk',
        name: 'Fresh Solaria Milk',
        count: 1,
        type: 'produce',
        sellValue: 60,
        description: 'Susu murni gurih dari Bessie.',
        icon: 'local_drink'
      });
      this.showToast(`Mengelus Bessie! Mengambil Susu Segar 🥛 (+1 ❤️)`);
    } else if (animal.type === 'sheep') {
      this.addToInventory({
        id: 'soft_wool',
        name: 'Soft White Wool',
        count: 1,
        type: 'produce',
        sellValue: 90,
        description: 'Bulu domba hangat dari Woolly.',
        icon: 'cloud'
      });
      this.showToast(`Menyisir Woolly! Mengambil Wol Lembut 🐑 (+1 ❤️)`);
    } else {
      this.addToInventory({
        id: 'egg',
        name: 'Farm Fresh Egg',
        count: 1,
        type: 'produce',
        sellValue: 35,
        description: 'Telur ayam segar kecokelatan.',
        icon: 'egg'
      });
      this.showToast(`Menyayangi Pip! Mengambil Telur Segar 🥚 (+1 ❤️)`);
    }

    this.audio.playPetAnimal(animal.type);
  }

  public talkToNpc(npc: NPC): void {
    this.audio.playDialogueBlip(npc.id === 'maya' ? 2 : npc.id === 'fin' ? 4 : 0);
    const text = npc.dialogues[npc.dialogueIndex % npc.dialogues.length];
    
    this.npcs.update(list => list.map(n => n.id === npc.id ? { ...n, dialogueIndex: n.dialogueIndex + 1 } : n));

    const options = npc.id === 'maya' ? [
      { label: '🛍️ Buka Toko (Shop)', action: () => { this.activeDialogue.set(null); this.isShopOpen.set(true); } },
      { label: 'Tutup', action: () => this.activeDialogue.set(null) }
    ] : [
      { label: 'Tutup', action: () => this.activeDialogue.set(null) }
    ];

    this.activeDialogue.set({
      npc,
      text,
      options
    });
  }

  public openShippingPrompt(): void {
    const sellables = this.inventory().filter(i => i.type === 'crop' || i.type === 'produce' || i.type === 'fish');
    if (sellables.length === 0) {
      this.showToast('Tidak ada hasil panen atau produk ternak di tas untuk dijual.');
      return;
    }

    let countShipped = 0;
    this.shippingBin.update(bin => {
      const newBin = [...bin];
      sellables.forEach(item => {
        newBin.push({ ...item });
        countShipped += item.count;
        this.removeFromInventory(item.id, item.count);
      });
      return newBin;
    });

    this.totalCropsShipped.update(n => n + countShipped);
    this.audio.playCoin();
    this.showToast(`Memasukkan ${countShipped} barang ke Kotak Penjualan. Uang diterima besok pagi.`);
  }

  public doFishing(): void {
    if (this.stamina() < 3) {
      this.showToast('Terlalu lelah untuk memancing.');
      return;
    }
    this.stamina.update(s => Math.max(0, s - 3));
    this.audio.playWater();

    const fishTypes = [
      { name: 'Solaria Trout', value: 50 },
      { name: 'Seagull Salmon', value: 85 },
      { name: 'Glittering Snapper', value: 140 }
    ];
    const picked = fishTypes[Math.floor(Math.random() * fishTypes.length)];

    this.addToInventory({
      id: `fish_${picked.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: picked.name,
      count: 1,
      type: 'fish',
      sellValue: picked.value,
      description: 'Hasil pancingan segar di Dermaga Seagull.',
      icon: 'phishing'
    });

    this.totalFishCaught.update(c => c + 1);
    this.audio.playHarvest();
    this.showToast(`🎣 Mendapatkan seekor ${picked.name} (Nilai: ${picked.value} G)!`);
  }

  public refillWater(): void {
    this.audio.playWater();
    this.showToast('Alat Siram terisi penuh dengan air segar! 💧');
  }

  // Sleep & Advance Day
  public sleepAndAdvanceDay(fromPassOut = false): void {
    if (this.isFading()) return;
    this.audio.playWarp();
    this.isFading.set(true);
    this.fadeMessage.set('Menyimpan progres & tidur hingga pagi 6:00 AM...');

    setTimeout(() => {
      const nextDay = this.day() + 1;
      this.day.set(nextDay);
      this.hour.set(6);
      this.minute.set(0);

      const isRain = Math.random() < 0.2;
      this.weather.set(isRain ? 'Rainy' : 'Sunny');

      this.stamina.set(fromPassOut ? 60 : 100);

      let earned = 0;
      let itemsSold = 0;
      this.shippingBin().forEach(item => {
        earned += item.sellValue * item.count;
        itemsSold += item.count;
      });
      if (earned > 0) {
        this.gold.update(g => g + earned);
        this.audio.playCoin();
      }
      this.shippingBin.set([]);

      this.farmPlots.update(plots => {
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

      this.animals.update(arr => arr.map(a => ({ ...a, pettedToday: false, productAvailable: true })));
      this.currentArea.set('house');

      this.sleepSummary.set({
        day: nextDay,
        earned,
        itemsSold
      });
      this.isSleepSummaryOpen.set(true);

      setTimeout(() => {
        this.isFading.set(false);
        this.fadeMessage.set('');
        this.saveToStorage();
      }, 500);
    }, 600);
  }

  // Inventory helpers
  public addToInventory(item: Item): void {
    this.inventory.update(inv => {
      const existing = inv.find(i => i.id === item.id);
      if (existing) {
        return inv.map(i => i.id === item.id ? { ...i, count: i.count + item.count } : i);
      }
      return [...inv, item];
    });
  }

  public removeFromInventory(itemId: string, count = 1): void {
    this.inventory.update(inv => {
      return inv
        .map(i => i.id === itemId ? { ...i, count: i.count - count } : i)
        .filter(i => i.count > 0);
    });
  }

  // Save / Load (localStorage)
  public saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const data = {
        day: this.day(),
        season: this.season(),
        hour: this.hour(),
        minute: this.minute(),
        weather: this.weather(),
        stamina: this.stamina(),
        gold: this.gold(),
        currentArea: this.currentArea(),
        farmPlots: this.farmPlots(),
        animals: this.animals(),
        inventory: this.inventory(),
        totalCropsShipped: this.totalCropsShipped(),
        totalFishCaught: this.totalFishCaught()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  public loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.day) this.day.set(data.day);
      if (data.season) this.season.set(data.season);
      if (data.gold !== undefined) this.gold.set(data.gold);
      if (data.farmPlots) this.farmPlots.set(data.farmPlots);
      if (data.animals) this.animals.set(data.animals);
      if (data.inventory) this.inventory.set(data.inventory);
      if (data.totalCropsShipped) this.totalCropsShipped.set(data.totalCropsShipped);
      if (data.totalFishCaught) this.totalFishCaught.set(data.totalFishCaught);
    } catch (e) {
      console.warn('Storage load failed:', e);
    }
  }

  public saveSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const s = {
        hudOpacity: this.hudOpacity(),
        controlScale: this.controlScale(),
        joystickOffsetX: this.joystickOffsetX(),
        joystickOffsetY: this.joystickOffsetY(),
        actionOffsetX: this.actionOffsetX(),
        actionOffsetY: this.actionOffsetY()
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) {
      console.warn('Settings save failed:', e);
    }
  }

  public loadSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.hudOpacity !== undefined) this.hudOpacity.set(s.hudOpacity);
      if (s.controlScale !== undefined) this.controlScale.set(s.controlScale);
      if (s.joystickOffsetX !== undefined) this.joystickOffsetX.set(s.joystickOffsetX);
      if (s.joystickOffsetY !== undefined) this.joystickOffsetY.set(s.joystickOffsetY);
      if (s.actionOffsetX !== undefined) this.actionOffsetX.set(s.actionOffsetX);
      if (s.actionOffsetY !== undefined) this.actionOffsetY.set(s.actionOffsetY);
    } catch (e) {
      console.warn('Settings load failed:', e);
    }
  }

  public resetSettings(): void {
    this.hudOpacity.set(0.75);
    this.controlScale.set(1.0);
    this.joystickOffsetX.set(0);
    this.joystickOffsetY.set(0);
    this.actionOffsetX.set(0);
    this.actionOffsetY.set(0);
    this.saveSettings();
    this.showToast('Pengaturan kontrol direset ke default!');
  }
}
