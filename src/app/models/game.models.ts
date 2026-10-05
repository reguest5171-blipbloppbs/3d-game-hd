export type ToolType = 'hand' | 'hoe' | 'water_can' | 'seeds' | 'sickle' | 'fishing_rod';

export type AreaId = 'farm' | 'house' | 'town' | 'shop' | 'goddess_tree';

export type CropType = 'turnip' | 'strawberry' | 'corn' | 'pumpkin';

export interface CropDefinition {
  id: CropType;
  name: string;
  seedPrice: number;
  sellPrice: number;
  growthDays: number;
  color: string;
  season: 'Spring' | 'Summer' | 'Autumn' | 'All';
}

export interface FarmTile {
  x: number; // grid coordinate 0..4
  z: number; // grid coordinate 0..3
  tilled: boolean;
  watered: boolean;
  crop?: {
    type: CropType;
    stage: number; // 0: seed, 1: sprout, 2: blooming, 3: ripe
    daysGrown: number;
  };
}

export interface Item {
  id: string;
  name: string;
  count: number;
  type: 'crop' | 'seed' | 'produce' | 'fish' | 'tool' | 'special';
  sellValue: number;
  description: string;
  icon: string;
}

export interface Animal {
  id: string;
  type: 'cow' | 'sheep' | 'chicken';
  name: string;
  pettedToday: boolean;
  fedToday: boolean;
  hearts: number; // 0..5
  productAvailable: boolean;
  position: { x: number; z: number };
}

export interface NPC {
  id: string;
  name: string;
  title: string;
  area: AreaId;
  hearts: number;
  dialogueIndex: number;
  dialogues: string[];
  color: string;
}

export interface ActionContext {
  type: 'till' | 'plant' | 'water' | 'harvest' | 'talk' | 'enter' | 'sleep' | 'ship' | 'pet' | 'fish' | 'refill' | 'interact';
  label: string;
  subLabel?: string;
  icon: string;
  targetArea?: AreaId;
  targetNpc?: NPC;
  targetTile?: FarmTile;
  targetAnimal?: Animal;
}
