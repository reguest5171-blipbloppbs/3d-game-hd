import * as THREE from 'three';
import { ActionContext, AreaId, Animal, FarmTile, NPC, ToolType } from '../models/game.models';
import { VegetationChunkData, WorldEnvironmentBuilder } from './world-environment';
import { WorldTexturesGenerator } from './world-textures';
import { audioService } from '../services/audio';
import { assetCacheService } from '../services/asset-cache';

export interface World3dGameStateProxy {
  hour: () => number;
  minute: () => number;
  weather: () => 'Sunny' | 'Rainy';
  currentArea: () => AreaId;
  selectedTool: () => ToolType;
  isRunning: () => boolean;
  isPhotoModeOpen: () => boolean;
  isDevEditorOpen: () => boolean;
  isDevGridVisible: () => boolean;
  isDevFreeCamera: () => boolean;
  devSelectedProp: () => string;
  setDevSelectedProp: (v: string) => void;
  devEditorTool: () => 'sculpt_raise' | 'sculpt_lower' | 'sculpt_flatten' | 'paint_dirt' | 'paint_grass' | 'paint_cobble' | 'place_prop' | 'delete_prop' | 'edit_gate';
  devBrushRadius: () => number;
  devBrushStrength: () => number;
  animals: () => Animal[];
  farmPlots: () => FarmTile[];
  npcs: () => NPC[];
  isFading: () => boolean;
  shadowsEnabled: () => boolean;
  tiltShiftEnabled: () => boolean;

  fps: { set: (v: number) => void };
  frameTimeMs: { set: (v: number) => void };
  drawCalls: { set: (v: number) => void };
  triangles: { set: (v: number) => void };
  geometriesCount: { set: (v: number) => void };
  texturesCount: { set: (v: number) => void };
  totalChunks: { set: (v: number) => void };
  visibleChunks: { set: (v: number) => void };
  playerCoords: { set: (coords: { x: number; y: number; z: number }) => void };
  currentAction: { set: (act: ActionContext) => void };
  warpToArea: (area: AreaId, message?: string) => void;
  showToast: (msg: string) => void;
  isAppLoading: { set: (loading: boolean) => void };
  gpuInfo: { set: (v: string) => void };
  isGamePaused: { set: (v: boolean) => void };
}

export const CROP_CONFIGS = {
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
} as const;

export class World3dService {
  private gameState!: World3dGameStateProxy;
  private assetCache = assetCacheService;
  private audio = audioService;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private container!: HTMLElement;
  private terrainMesh?: THREE.Mesh;

  // Animation & loop (Zero CPU when paused)
  private animFrameId: number | null = null;
  private isLoopActive = false;
  private clock = new THREE.Clock();

  // Player 3D objects
  private playerGroup!: THREE.Group;
  private playerBody!: THREE.Mesh;
  private playerLeftLeg!: THREE.Mesh;
  private playerRightLeg!: THREE.Mesh;
  private playerLeftArm!: THREE.Mesh;
  private playerRightArm!: THREE.Mesh;
  private playerToolMesh!: THREE.Mesh;
  private camLookAtTarget = new THREE.Vector3(0, 1.0, 0);

  // Performance Telemetry tracking
  private frameCount = 0;
  private lastFpsUpdateTime = 0;
  private lastFrameTime = 0;

  // World objects
  private areaGroup = new THREE.Group();
  private soilTileMeshes = new Map<string, THREE.Group>();
  private farmingGridGroup = new THREE.Group();
  private animalMeshes = new Map<string, THREE.Group>();
  private npcMeshes = new Map<string, THREE.Group>();
  private interactiveMarkers: { pos: THREE.Vector3; radius: number; context: ActionContext }[] = [];
  private grassTuftMeshes: THREE.Group[] = [];
  private bushMeshes: THREE.Group[] = [];
  private vegetationChunks: VegetationChunkData[] = [];
  private cameraFrustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();
  private lastVisibleChunkCount = -1;
  private actionCheckTick = 0;

  // Zero-allocation pre-cached vector/color objects for 60 FPS animation loop
  private _tempSunColor = new THREE.Color();
  private _tempAmbColor = new THREE.Color();
  private _tempSkyColor = new THREE.Color();
  private _tempFogColor = new THREE.Color();
  private _tempSunPos = new THREE.Vector3();
  private _colA = new THREE.Color();
  private _colB = new THREE.Color();
  private _cachedCamOffsetHouse = new THREE.Vector3(0, 7.8, 10.2);
  private _cachedCamOffsetOutdoor = new THREE.Vector3(0, 10.5, 12.8);
  private _cachedCamTarget = new THREE.Vector3();

  // Tilt-Shift Miniature Shader & Pass (Authentic Diorama Blur)
  private tiltShiftTarget?: THREE.WebGLRenderTarget;
  private tiltShiftCamera?: THREE.OrthographicCamera;
  private tiltShiftScene?: THREE.Scene;
  private tiltShiftMaterial?: THREE.ShaderMaterial;

  // Windmill / Water animation elements
  private windmillBlades?: THREE.Group;
  private waterPlane?: THREE.Mesh;
  private treeLeaves?: THREE.Group;
  private spriteFin?: THREE.Group;

  // Atmospheric Lighting & Shadows
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private playerShadowMesh!: THREE.Mesh;

  // Movement input
  public moveVector = { x: 0, z: 0 }; // from joystick / keys
  private playerPos = new THREE.Vector3(0, 0, 3);
  private playerTargetRotation = 0;
  private walkCycleTime = 0;
  private isSwingingTool = false;
  private swingProgress = 0;

  // Photo Mode Camera Overrides
  public photoFocus = new THREE.Vector3(0, 0, 0);
  public photoDistance = 14.0;
  public photoYaw = 0.0;     // radians
  public photoPitch = 0.65;  // radians

  // Dev Map Editor Properties
  public devFocusPos = new THREE.Vector3(0, 0, 0);
  public devDistance = 20.0;
  public devYaw = 0.0;     // radians
  public devPitch = 0.65;  // radians
  public terrainHeightOffsets = new Map<string, number>();
  private devPlacedProps: { mesh: THREE.Object3D; type: string; x: number; z: number }[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private editorBrushRing?: THREE.Mesh;

  // Procedural Canvas Textures for Rich Visual Surfaces
  private grassTexture?: THREE.CanvasTexture;
  private soilGroundTexture?: THREE.CanvasTexture;
  private noiseTexture?: THREE.CanvasTexture;
  private roadTexture?: THREE.CanvasTexture;
  private roadEastTexture?: THREE.CanvasTexture;
  private townGroundTexture?: THREE.CanvasTexture;
  private woodFloorTexture?: THREE.CanvasTexture;
  private soilTilledTexture?: THREE.CanvasTexture;
  private soilWateredTexture?: THREE.CanvasTexture;

  public init(canvasContainer: HTMLElement, gameStateProxy: World3dGameStateProxy): void {
    this.gameState = gameStateProxy;
    this.container = canvasContainer;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbebf5); // Morning sky pastel (06:26 AM)
    this.scene.fog = new THREE.FogExp2(0xdbebf5, 0.015); // Soft morning horizon haze

    // 2. Camera: Authentic Harvest Moon: Tree of Tranquility 3/4 Isometric Perspective (32° FOV, ~39.4° elevation tilt)
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    // Set near plane to 0.8m to eliminate Z-buffer precision loss and surface fighting, and far plane to 240m to avoid far clipping on zoom out
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.8, 240);
    this.camera.position.set(0, 10.5, 12.8);
    this.camera.lookAt(0, 0.85, 0);

    // 3. Renderer with High-Precision Depth Buffer & Real-time Soft Shadow Map
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
      precision: 'highp',
      preserveDrawingBuffer: true
    });
    // Clamp pixel ratio to max 1.0 on mobile to guarantee smooth 60 FPS fill-rate
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.0));
    this.renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(this.renderer.domElement);

    // Initialize Rich Procedural Textures for Ground & Roads
    this.initTextures();

    // Detect GPU & Platform Capabilities
    try {
      const gl = this.renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (gpu) {
          this.gameState.gpuInfo.set(String(gpu));
        }
      }
    } catch {
      // ignore
    }

    this.lastFpsUpdateTime = performance.now();
    this.lastFrameTime = performance.now();

    // 4. Lighting (Atmospheric Dynamic Sun, Soft Warm Ambient & Horizon Sky Glow)
    this.ambientLight = new THREE.AmbientLight(0xfed7aa, 0.65);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffedd5, 0x334155, 0.6);
    this.hemiLight.position.set(0, 30, 0);
    this.scene.add(this.hemiLight);

    // Directional Sun Light with Precision Focused Shadow Camera (High Resolution & Normal-Biased to eliminate Shadow Acne)
    this.sunLight = new THREE.DirectionalLight(0xfff0dd, 1.18);
    this.sunLight.position.set(22, 7.5, 14); // Low morning sun angle
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 45;
    // Precision shadow camera: tightly bounds the camera's fixed viewing box (20x20m around target)
    this.sunLight.shadow.camera.left = -10.5;
    this.sunLight.shadow.camera.right = 10.5;
    this.sunLight.shadow.camera.top = 10.5;
    this.sunLight.shadow.camera.bottom = -10.5;
    this.sunLight.shadow.camera.updateProjectionMatrix();
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.06; // Offsets shadow along surface normal to eliminate self-shadowing acne
    this.sunLight.shadow.radius = 1.8; // Smooth soft anti-aliased shadow borders
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Initial atmospheric lighting pass based on in-game clock (e.g. 06:38 AM)
    this.updateAtmosphericLighting();

    // Initialize Tilt-Shift Miniature Pass (Authentic Aesthetic Diorama Blur)
    this.initTiltShiftPass(canvasContainer.clientWidth, canvasContainer.clientHeight);

    // 5. Add Area group & Player group
    this.scene.add(this.areaGroup);
    this.createPlayerMesh();

    // 6. Build initial area
    this.buildCurrentArea(this.gameState.currentArea());

    // 7. Start render loop
    this.resumeLoop();

    // 8. Handle resize
    window.addEventListener('resize', this.onWindowResize);
  }

  public pauseLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isLoopActive = false;
    if (this.gameState && this.gameState.isGamePaused) {
      this.gameState.isGamePaused.set(true);
    }
  }

  public resumeLoop(): void {
    if (this.isLoopActive) return;
    this.isLoopActive = true;
    if (this.gameState && this.gameState.isGamePaused) {
      this.gameState.isGamePaused.set(false);
    }
    this.clock.start();
    this.lastFrameTime = performance.now();
    this.lastFpsUpdateTime = performance.now();
    this.frameCount = 0;
    this.animate();
  }

  public isLoopRunning(): boolean {
    return this.isLoopActive;
  }

  private initTiltShiftPass(width: number, height: number): void {
    if (this.tiltShiftTarget) {
      this.tiltShiftTarget.dispose();
    }

    this.tiltShiftTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    this.tiltShiftCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.tiltShiftScene = new THREE.Scene();

    this.tiltShiftMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.tiltShiftTarget.texture },
        uResolution: { value: new THREE.Vector2(width, height) },
        uFocusY: { value: 0.52 },
        uFocusRange: { value: 0.28 },
        uBlurAmount: { value: 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uFocusY;
        uniform float uFocusRange;
        uniform float uBlurAmount;
        varying vec2 vUv;

        void main() {
          float dist = abs(vUv.y - uFocusY);
          float blurFactor = smoothstep(uFocusRange, 0.50, dist) * uBlurAmount;

          // Zero-cost early return in the focal area (character, crops, animals)
          if (blurFactor < 0.01) {
            gl_FragColor = texture2D(tDiffuse, vUv);
            return;
          }

          // 9-tap vertical-weighted bokeh blur for tilt-shift miniature style
          vec2 texel = vec2(0.0, 1.0 / uResolution.y) * blurFactor * 3.2;
          vec4 col = vec4(0.0);
          col += texture2D(tDiffuse, vUv - texel * 4.0) * 0.05;
          col += texture2D(tDiffuse, vUv - texel * 3.0) * 0.09;
          col += texture2D(tDiffuse, vUv - texel * 2.0) * 0.12;
          col += texture2D(tDiffuse, vUv - texel * 1.0) * 0.15;
          col += texture2D(tDiffuse, vUv) * 0.18;
          col += texture2D(tDiffuse, vUv + texel * 1.0) * 0.15;
          col += texture2D(tDiffuse, vUv + texel * 2.0) * 0.12;
          col += texture2D(tDiffuse, vUv + texel * 3.0) * 0.09;
          col += texture2D(tDiffuse, vUv + texel * 4.0) * 0.05;

          // Subtle miniature contrast & saturation boost on peripheral blur
          col.rgb = mix(col.rgb, col.rgb * 1.05, blurFactor * 0.35);
          gl_FragColor = col;
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.tiltShiftMaterial);
    this.tiltShiftScene.add(quad);
  }

  private onWindowResize = (): void => {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.0));
    this.renderer.setSize(w, h);

    if (this.tiltShiftTarget && this.tiltShiftMaterial) {
      this.tiltShiftTarget.setSize(w, h);
      this.tiltShiftMaterial.uniforms['uResolution'].value.set(w, h);
    }
  };

  public destroy(): void {
    this.pauseLoop();
    window.removeEventListener('resize', this.onWindowResize);
    if (this.tiltShiftTarget) {
      this.tiltShiftTarget.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  // BUILD AREA ENVIRONMENT
  public buildCurrentArea(area: AreaId): void {
    // Clear area group
    while (this.areaGroup.children.length > 0) {
      const child = this.areaGroup.children[0];
      this.areaGroup.remove(child);
    }
    while (this.farmingGridGroup.children.length > 0) {
      this.farmingGridGroup.remove(this.farmingGridGroup.children[0]);
    }
    this.soilTileMeshes.clear();
    this.animalMeshes.clear();
    this.npcMeshes.clear();
    this.interactiveMarkers = [];
    this.grassTuftMeshes = [];
    this.bushMeshes = [];
    this.vegetationChunks = [];
    this.gameState.totalChunks.set(0);
    this.gameState.visibleChunks.set(0);

    // Adjust sky/fog based on area
    if (area === 'house' || area === 'shop') {
      this.scene.background = new THREE.Color(0x2d1f14);
      this.scene.fog = new THREE.FogExp2(0x2d1f14, 0.025);
    } else if (area === 'goddess_tree') {
      this.scene.background = new THREE.Color(0xa7d8ff);
      this.scene.fog = new THREE.FogExp2(0xa7d8ff, 0.015);
    } else {
      this.scene.background = new THREE.Color(0xdbebf5);
      this.scene.fog = new THREE.FogExp2(0xdbebf5, 0.015);
    }

    // Reset player position based on entrance
    switch (area) {
      case 'farm':
        this.playerPos.set(0, this.getFarmHeight(0, 2.5), 2.5);
        this.buildFarmsteadArea();
        break;
      case 'house':
        this.playerPos.set(0, 0, 3.5);
        this.buildHouseInterior();
        break;
      case 'town':
        this.playerPos.set(-9, 0, 0);
        this.buildTownArea();
        break;
      case 'shop':
        this.playerPos.set(0, 0, 3.5);
        this.buildShopInterior();
        break;
      case 'goddess_tree':
        this.playerPos.set(0, 0, 6.5);
        this.buildGoddessTreeArea();
        break;
    }
    this.playerGroup.position.copy(this.playerPos);
    this.camLookAtTarget.set(this.playerPos.x, this.playerPos.y + 1.0, this.playerPos.z);
    this.gameState.playerCoords.set({
      x: Math.round(this.playerPos.x * 10) / 10,
      y: Math.round(this.playerPos.y * 10) / 10,
      z: Math.round(this.playerPos.z * 10) / 10
    });
  }

  // CONTINUOUS SMOOTH TERRAIN ELEVATION (Un-carved Base Hill Height)
  public getTerrainBaseHeight(x: number, z: number): number {
    // 1. Strict Flat Mask for Crop Field
    const fieldMinX = 2.4;
    const fieldMaxX = 10.6;
    const fieldMinZ = 2.8;
    const fieldMaxZ = 9.8;
    const fdx = Math.max(0, Math.max(fieldMinX - x, x - fieldMaxX));
    const fdz = Math.max(0, Math.max(fieldMinZ - z, z - fieldMaxZ));
    const distField = Math.hypot(fdx, fdz);
    const blendFieldDist = 4.2;
    const ft = Math.min(1, Math.max(0, distField / blendFieldDist));
    const smoothField = ft * ft * ft * (10 - 15 * ft + 6 * ft * ft);

    // 2. Flat foundation mask for Farmhouse Porch & Doorstep
    const houseMinX = -3.8;
    const houseMaxX = 3.8;
    const houseMinZ = -7.8;
    const houseMaxZ = -1.8;
    const hdx = Math.max(0, Math.max(houseMinX - x, x - houseMaxX));
    const hdz = Math.max(0, Math.max(houseMinZ - z, z - houseMaxZ));
    const distHouse = Math.hypot(hdx, hdz);
    const ht = Math.min(1, Math.max(0, distHouse / 3.4));
    const smoothHouse = ht * ht * ht * (10 - 15 * ht + 6 * ht * ht);

    let h = 0;

    // River channel mask (clears out hill bumps inside river path using new gentle S-curve)
    const riverX = 21.0 + Math.sin(z * 0.08) * 1.8;
    const distRiver = Math.abs(x - riverX);
    let riverPass = 1.0;
    if (distRiver < 3.8) {
      riverPass = Math.min(1.0, distRiver / 3.8);
      riverPass = riverPass * riverPass * (3.0 - 2.0 * riverPass);
    }

    // A. North Mountain Ascent (Allowed to rise naturally with the river flowing up it)
    if (z < -2.0) {
      const nz = Math.abs(z - (-2.0));
      const nt = Math.min(1, nz / 30.0);
      h += nt * nt * (3.0 - 1.1 * nt) * 5.8;
      if (z < -26.0) {
        const extraN = Math.abs(z - (-26.0)) / 10.0;
        h += extraN * extraN * 5.1;
      }
    }

    // Outer Boundary Wall Elevations (River cuts through south boundary wall)
    if (z > 26.0) {
      const extraS = (z - 26.0) / 10.0;
      h += extraS * extraS * 3.8 * riverPass;
    }
    if (Math.abs(x) > 26.0) {
      const extraX = (Math.abs(x) - 26.0) / 10.0;
      h += extraX * extraX * 2.8;
    }

    // B. North-East Windmill Hill Terrace
    const wmDist = Math.hypot(x - 22.0, z - (-16.0));
    if (wmDist < 19.0) {
      const wt = 1.0 - wmDist / 19.0;
      h += wt * wt * wt * (10 - 15 * wt + 6 * wt * wt) * 4.8 * (0.2 + 0.8 * riverPass);
    }

    // C. South Scenic Bluff / Ocean Lookout Hill (River channel passes cleanly through south bluff)
    const sDist = Math.hypot(x - 20.0, z - 22.0);
    if (sDist < 17.0) {
      const st = 1.0 - sDist / 17.0;
      h += st * st * (3.0 - 2.0 * st) * 3.6 * riverPass;
    }

    // D. South-West Rolling Ridge
    const swDist = Math.hypot(x - (-22.0), z - 20.0);
    if (swDist < 16.0) {
      const swt = 1.0 - swDist / 16.0;
      h += swt * swt * (3.0 - 2.0 * swt) * 3.2;
    }

    // E. West Pasture Rolling Knolls
    const pDist = Math.hypot(x - (-19.0), z - (-2.0));
    if (pDist < 17.0) {
      const pt = 1.0 - pDist / 17.0;
      h += pt * pt * (3.0 - 2.0 * pt) * 2.2;
    }

    // F. North-West Forest Foothills
    const nwDist = Math.hypot(x - (-20.0), z - (-20.0));
    if (nwDist < 18.0) {
      const nwt = 1.0 - nwDist / 18.0;
      h += nwt * nwt * (3.0 - 2.0 * nwt) * 4.2;
    }

    // G. Natural Organic Undulation (Cleared inside river path)
    let undulation = Math.sin(x * 0.14 + 0.3) * Math.cos(z * 0.12) * 0.42;
    undulation += Math.sin(x * 0.28 - z * 0.22 + 1.1) * 0.26;
    undulation += Math.cos(x * 0.08 + z * 0.16) * 0.32;
    undulation += Math.sin(x * 0.45 + z * 0.38) * 0.14;
    h += undulation * riverPass;

    h = h * smoothField * smoothHouse;
    return Math.max(0, h);
  }

  // 1. RAW TERRAIN ELEVATION (Base Hills + Riverbed Carving, NO Bridges)
  public getTerrainHeight(x: number, z: number): number {
    let baseH = this.getTerrainBaseHeight(x, z);

    // Apply custom dev height offsets if any
    const gridKey = `${Math.round(x)},${Math.round(z)}`;
    const offset = this.terrainHeightOffsets.get(gridKey) || 0;
    baseH += offset;

    // Gentle S-curve river path formula
    const riverX = 21.0 + Math.sin(z * 0.08) * 1.8;
    const distToRiver = Math.abs(x - riverX);
    const riverBedWidth = 1.4; // 2.8m wide flat riverbed floor
    const bankWidth = 2.8;     // 5.6m total channel span to outer bank

    if (distToRiver < bankWidth && z > -36 && z < 36) {
      const riverCenterBaseY = this.getTerrainBaseHeight(riverX, z) + (this.terrainHeightOffsets.get(`${Math.round(riverX)},${Math.round(z)}`) || 0);
      const bedY = riverCenterBaseY - 0.50;

      if (distToRiver <= riverBedWidth) {
        // Flat riverbed floor consistently 0.50m below river center height
        return bedY;
      } else {
        // Smooth bank slope transitioning from riverbed floor (bedY) up to surrounding land (baseH)
        const t = (distToRiver - riverBedWidth) / (bankWidth - riverBedWidth);
        const smoothT = t * t * (3.0 - 2.0 * t);
        return bedY + (baseH - bedY) * smoothT;
      }
    }

    return baseH;
  }

  // 2. INTERACTIVE PLAYER HEIGHT (Terrain Height + Bridge Deck Overrides)
  public getFarmHeight(x: number, z: number): number {
    const terrainH = this.getTerrainHeight(x, z);

    // 1. East Road Main Wooden Arch Bridge Deck (x ≈ 21.0, z ≈ 0.0)
    const distBridge1X = Math.abs(x - 21.0);
    const distBridge1Z = Math.abs(z - 0.0);
    if (distBridge1X < 3.1 && distBridge1Z < 1.6) {
      // Clean arch deck spanning from x = 17.9 to x = 24.1
      const t = (x - 17.9) / 6.2; // 0 to 1 across the bridge width
      const bankLeftY = this.getTerrainBaseHeight(17.9, z);
      const bankRightY = this.getTerrainBaseHeight(24.1, z);
      const baseY = bankLeftY + t * (bankRightY - bankLeftY);
      
      // Add a nice arch (0.42m peak in the center)
      const archY = baseY + 0.42 * 4.0 * t * (1.0 - t);
      
      // Blend deck height at the Z-edges (Z width of 1.6m) to transition smoothly
      const zBlend = 1.0 - distBridge1Z / 1.6;
      return Math.max(terrainH, archY * zBlend + terrainH * (1.0 - zBlend));
    }

    // 2. High North Mountain Canyon Footbridge Deck (x ≈ 19.5, z ≈ -12.5, Y ≈ 6.2m)
    const distBridge2X = Math.abs(x - 19.5);
    const distBridge2Z = Math.abs(z - (-12.5));
    if (distBridge2X < 4.4 && distBridge2Z < 1.4) {
      const westCliffY = this.getTerrainBaseHeight(15.2, -12.5);
      const eastCliffY = this.getTerrainBaseHeight(23.8, -12.5);
      const highDeckY = Math.max(westCliffY, eastCliffY) + 0.12;
      return highDeckY;
    }

    return terrainH;
  }

  // AREA 1: SOLARIA FARMSTEAD (EXPANDED & ROLLING SMOOTH HILLS)
  private buildFarmsteadArea(): void {
    // 1. High-Density Smooth Terrain Mesh with Multi-Biome Organic Ground Shading
    const terrainSize = 92;
    const terrainSegs = 80; // High resolution for smooth riverbank channels
    const groundGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
    groundGeo.rotateX(-Math.PI / 2); // Make XZ plane with +Y up

    const posAttr = groundGeo.attributes['position'];
    const colors: number[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = this.getTerrainHeight(vx, vz);
      posAttr.setY(i, vy);

      // 100% pure uniform baseline - eliminates per-vertex Gouraud diagonal tessellation stripes
      colors.push(1.0, 1.0, 1.0);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();

    const groundMat = WorldEnvironmentBuilder.createOrganicTerrainMaterial({
      grassTexture: this.grassTexture,
      soilTexture: this.soilGroundTexture,
      noiseTexture: this.noiseTexture,
      tilingScale: 0.12
    });
    this.terrainMesh = new THREE.Mesh(groundGeo, groundMat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.renderOrder = 0;
    this.areaGroup.add(this.terrainMesh);

    // 2. Smooth Conforming Cobblestone & Dirt Roads with Feathered Alpha Blending (Seamless Grass Transition)
    const roadElevation = 0.09;
    const pathMat = new THREE.MeshLambertMaterial({
      map: this.roadTexture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.005,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3.0,
      polygonOffsetUnits: -6.0,
      side: THREE.FrontSide
    });

    const pathEastMat = new THREE.MeshLambertMaterial({
      map: this.roadEastTexture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.005,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      side: THREE.FrontSide
    });

    // A. Central Farmstead Crossroads Pad (Seamless Junction with Zero Overlap)
    const crossRoadGeo = new THREE.PlaneGeometry(3.4, 5.2, 4, 8);
    crossRoadGeo.rotateX(-Math.PI / 2);
    crossRoadGeo.translate(0, 0, 1.0);
    const cPos = crossRoadGeo.attributes['position'];
    for (let i = 0; i < cPos.count; i++) {
      const px = cPos.getX(i);
      const pz = cPos.getZ(i);
      cPos.setY(i, this.getFarmHeight(px, pz) + roadElevation);
    }
    crossRoadGeo.computeVertexNormals();

    // B. North Climbing Mountain Road (Extended past tree line to z = -37.5 with perspective tapering)
    const northRoadGeo = new THREE.PlaneGeometry(3.2, 36.0, 4, 60);
    northRoadGeo.rotateX(-Math.PI / 2);
    northRoadGeo.translate(0, 0, -19.5);
    const nPos = northRoadGeo.attributes['position'];
    for (let i = 0; i < nPos.count; i++) {
      let px = nPos.getX(i);
      const pz = nPos.getZ(i);
      // Perspective taper effect beyond tree line boundary (z < -28.0)
      if (pz < -28.0) {
        const taper = Math.min(1.0, (-28.0 - pz) / 9.5);
        px *= (1.0 - taper * 0.38); // Road width tapers smoothly from 3.2m to 2.0m into mountain trees
        nPos.setX(i, px);
      }
      nPos.setY(i, this.getFarmHeight(px, pz) + roadElevation);
    }
    // Set road length UVs to maintain 1:1 square stone proportion
    const nUvs = northRoadGeo.attributes['uv'];
    for (let i = 0; i < nUvs.count; i++) {
      const u = nUvs.getX(i);
      const v = nUvs.getY(i) * (36.0 / 2.6);
      nUvs.setXY(i, u, v);
    }
    northRoadGeo.computeVertexNormals();

    // C. East Road towards Harmonica Town (Extended past tree line to x = 37.5 with perspective tapering)
    const eastRoadGeo = new THREE.PlaneGeometry(36.1, 3.2, 60, 4);
    eastRoadGeo.rotateX(-Math.PI / 2);
    eastRoadGeo.translate(19.45, 0, 0);
    const ePos = eastRoadGeo.attributes['position'];
    for (let i = 0; i < ePos.count; i++) {
      const px = ePos.getX(i);
      let pz = ePos.getZ(i);
      // Perspective taper effect beyond tree line boundary (x > 28.0)
      if (px > 28.0) {
        const taper = Math.min(1.0, (px - 28.0) / 9.5);
        pz *= (1.0 - taper * 0.38); // Road width tapers smoothly from 3.2m to 2.0m into forest arch
        ePos.setZ(i, pz);
      }
      ePos.setY(i, this.getFarmHeight(px, pz) + roadElevation);
    }
    const eUvs = eastRoadGeo.attributes['uv'];
    for (let i = 0; i < eUvs.count; i++) {
      const u = eUvs.getX(i) * (36.1 / 2.6);
      const v = eUvs.getY(i);
      eUvs.setXY(i, u, v);
    }
    eastRoadGeo.computeVertexNormals();
    const eastMesh = new THREE.Mesh(eastRoadGeo, pathEastMat);
    eastMesh.receiveShadow = true;
    eastMesh.renderOrder = 2;
    this.areaGroup.add(eastMesh);

    // D. Winding Climbing Path to Windmill Hill (West Bank approach to North Footbridge)
    const createRibbonRoadGeo = (points: THREE.Vector3[], width: number, elev: number) => {
      const vertices: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      let cumulativeDist = 0;
      const subSegments = 4; // Subdivide road width into 4 strips to perfectly hug hill contours

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let tangent = new THREE.Vector3(1, 0, 0);
        if (i < points.length - 1) {
          tangent = points[i + 1].clone().sub(p).normalize();
          if (i > 0) cumulativeDist += p.distanceTo(points[i - 1]);
        } else {
          tangent = p.clone().sub(points[i - 1]).normalize();
          cumulativeDist += p.distanceTo(points[i - 1]);
        }
        const unitNormal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const v = cumulativeDist / 2.6;

        for (let j = 0; j <= subSegments; j++) {
          const u = j / subSegments; // 0.0, 0.25, 0.5, 0.75, 1.0
          const offsetFactor = (u - 0.5) * width;
          const vx = p.x + unitNormal.x * offsetFactor;
          const vz = p.z + unitNormal.z * offsetFactor;
          const vy = this.getFarmHeight(vx, vz) + elev;

          vertices.push(vx, vy, vz);
          uvs.push(u, v);
        }

        if (i < points.length - 1) {
          const rowStride = subSegments + 1;
          const baseIdx = i * rowStride;
          const nextIdx = (i + 1) * rowStride;

          for (let j = 0; j < subSegments; j++) {
            const current = baseIdx + j;
            const next = nextIdx + j;
            indices.push(current, current + 1, next);
            indices.push(current + 1, next + 1, next);
          }
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    const roadWidth = 2.8;

    // West Bank Path leading cleanly into West Entrance of High Canyon Bridge (x = 15.2, z = -12.5)
    const wmWestCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(3.5, 0, 0),
      new THREE.Vector3(7.5, 0, -3.5),
      new THREE.Vector3(11.5, 0, -7.5),
      new THREE.Vector3(15.2, 0, -12.5)
    ]);
    const wmRoadGeo = createRibbonRoadGeo(wmWestCurve.getPoints(28), roadWidth, roadElevation);

    // East Bank Path continuing from East Exit of High Canyon Bridge (x = 23.8, z = -12.5) up Windmill Hill
    const wmEastCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(23.8, 0, -12.5),
      new THREE.Vector3(25.5, 0, -15.5),
      new THREE.Vector3(27.0, 0, -18.5)
    ]);
    const wmEastRoadGeo = createRibbonRoadGeo(wmEastCurve.getPoints(20), roadWidth, roadElevation);

    // E. Scenic Climbing Path to South Lookout Bluff
    const sCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 3.5),
      new THREE.Vector3(-0.2, 0, 7.5),
      new THREE.Vector3(0.5, 0, 11.8),
      new THREE.Vector3(4.5, 0, 14.8),
      new THREE.Vector3(10.5, 0, 17.5),
      new THREE.Vector3(18.5, 0, 21.0)
    ]);
    const sRoadGeo = createRibbonRoadGeo(sCurve.getPoints(32), roadWidth, roadElevation);

    // Merge static continuous roads into 1 single mesh (Massive Draw Call Reduction)
    const mergedRoadGeo = WorldEnvironmentBuilder.safeMergeGeometries([crossRoadGeo, northRoadGeo, wmRoadGeo, wmEastRoadGeo, sRoadGeo], false);
    const mergedRoadMesh = new THREE.Mesh(mergedRoadGeo, pathMat);
    mergedRoadMesh.receiveShadow = true;
    mergedRoadMesh.renderOrder = 2;
    this.areaGroup.add(mergedRoadMesh);

    // 3. Farmhouse Exterior (Walls & Roof)
    const houseGroup = new THREE.Group();

    const houseBaseMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xffedd5,
      bottomColor: 0xd4a373,
      topColor: 0xfff7ed,
      minY: -1.75,
      maxY: 1.75,
      side: THREE.FrontSide
    });
    const houseBase = new THREE.Mesh(
      new THREE.BoxGeometry(6, 3.5, 4.5),
      houseBaseMat
    );
    houseBase.position.set(0, 1.75, 0);
    houseGroup.add(houseBase);

    const roofMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xb91c1c,
      bottomColor: 0x7f1d1d,
      topColor: 0xf87171,
      minY: -1.25,
      maxY: 1.25,
      side: THREE.FrontSide
    });
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(5.2, 2.5, 4),
      roofMat
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 4.4, 0);
    houseGroup.add(roof);

    this.enableShadows(houseGroup);

    const houseY = this.getFarmHeight(0, -4.5);
    houseGroup.position.set(0, houseY, -4.5);
    this.areaGroup.add(houseGroup);

    // Doorway warp trigger (into House)
    const doorWarpY = this.getFarmHeight(0, -2.0);
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(0, doorWarpY, -2.0),
      radius: 1.8,
      context: {
        type: 'enter',
        label: 'MASUK RUMAH',
        subLabel: 'Farmer\'s Cottage',
        icon: 'meeting_room',
        targetArea: 'house'
      }
    });

    // 4. East Exit to Town (Expanded to x = 31.0)
    const townExitY = this.getFarmHeight(31.0, 0);
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(31.0, townExitY, 0),
      radius: 2.8,
      context: {
        type: 'enter',
        label: 'KE KOTA / TOWN',
        subLabel: 'Harmonica Town',
        icon: 'holiday_village',
        targetArea: 'town'
      }
    });

    // 5. North Exit to Whispering Mother Tree (Climbing Hill Road at z = -31.0)
    const treeExitY = this.getFarmHeight(0, -31.0);
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(0, treeExitY, -31.0),
      radius: 2.8,
      context: {
        type: 'enter',
        label: 'KE POHON KERAMAT',
        subLabel: 'Whispering Tree',
        icon: 'nature_people',
        targetArea: 'goddess_tree'
      }
    });

    // 6. Farm Soil Field (Level & flat at y = 0)
    this.buildSoilGrid(new THREE.Vector3(3.5, 0, 4.0));

    // 7. Expanded Rolling Pasture & Barn on the West (Pasture knoll at x = -18.0)
    this.buildPastureAndAnimals(new THREE.Vector3(-18.0, 0, 2.0));

    // 8. Waterwheel positioned along the riverbank clear of the bridge, dipping into river flow
    this.buildWaterwheel(new THREE.Vector3(20.0, 0, -20.5));

    // 9. Merged Static Environmental Props (Benches, Signs, Shipping Bin, Water Well, Streetlamps, Fence, Shadows)
    this.buildFarmsteadMergedStaticProps();

    // 14. Wildflower Clusters on Rolling Slopes
    const flowerSpots = [
      { x: 12.0, z: -4.0, col: 0xfacc15 },
      { x: 15.0, z: -7.0, col: 0xf43f5e },
      { x: 18.0, z: -10.0, col: 0x818cf8 },
      { x: 8.0, z: 12.0, col: 0xfacc15 },
      { x: 14.0, z: 17.0, col: 0xf43f5e },
      { x: 16.0, z: 23.0, col: 0x38bdf8 },
      { x: -10.0, z: 8.0, col: 0xfde047 },
      { x: -14.0, z: 12.0, col: 0xf43f5e },
      { x: -24.0, z: 4.0, col: 0xa855f7 },
      { x: -8.0, z: -12.0, col: 0xfacc15 },
      { x: -15.0, z: -18.0, col: 0xec4899 },
      { x: 4.0, z: -18.0, col: 0xfde047 },
      { x: -4.0, z: -25.0, col: 0x818cf8 },
      { x: 22.0, z: -12.0, col: 0xfbbf24 },
      { x: -18.0, z: 22.0, col: 0xf472b6 }
    ];

    // 15. Scenic Trees Across the Expanded Farmstead & Rolling Bluffs (InstancedMesh Batch)
    const treePositions = [
      new THREE.Vector3(-12, 0, -16),
      new THREE.Vector3(-8, 0, -22),
      new THREE.Vector3(8, 0, -22),
      new THREE.Vector3(14, 0, -20),
      new THREE.Vector3(26, 0, -18),
      new THREE.Vector3(27, 0, -8),
      new THREE.Vector3(-25, 0, -8),
      new THREE.Vector3(-28, 0, 4),
      new THREE.Vector3(-26, 0, 14),
      new THREE.Vector3(-24, 0, 22),
      new THREE.Vector3(-14, 0, 24),
      new THREE.Vector3(0, 0, 26),
      new THREE.Vector3(14, 0, 26),
      new THREE.Vector3(25, 0, 24),
      new THREE.Vector3(26, 0, 14),
      new THREE.Vector3(28, 0, 4),
      new THREE.Vector3(-6, 0, -12),
      new THREE.Vector3(9, 0, -8),
      new THREE.Vector3(-11, 0, 16),
      new THREE.Vector3(16, 0, 5)
    ];
    const instancedTrees = WorldEnvironmentBuilder.buildInstancedTrees(
      treePositions,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedTrees);

    // 15b. Dense Alpine Pine Forest Wall along West (X = -32.5) & East (X = +32.5) Outer Boundaries
    const pinePositions: THREE.Vector3[] = [];
    for (let z = -34; z <= 34; z += 3.2) {
      pinePositions.push(new THREE.Vector3(-31.5, 0, z));
      pinePositions.push(new THREE.Vector3(-35.0, 0, z + 1.6));
      pinePositions.push(new THREE.Vector3(31.5, 0, z));
      pinePositions.push(new THREE.Vector3(35.0, 0, z + 1.6));
    }
    const instancedPines = WorldEnvironmentBuilder.buildInstancedPines(
      pinePositions,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedPines);

    // 17. Expanded Perimeter Boundary Fences (InstancedMesh Batch)
    const instancedFences = WorldEnvironmentBuilder.buildInstancedFences(
      -34,
      34,
      -34,
      34,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedFences);

    // 18. Spatial Chunking & Frustum Culling Vegetation (24x24 Meter Grid - 9 Chunks)
    // Partitions grass tufts and wildflowers into 24x24m spatial chunks.
    // Off-screen chunks are culled from rendering, keeping FPS high and mobile thermals cool.
    const grassSeeds = [
      { x: -5, z: 8 }, { x: -8, z: 14 }, { x: -12, z: 6 }, { x: -16, z: 18 },
      { x: -22, z: 10 }, { x: -20, z: -8 }, { x: -15, z: -12 }, { x: -7, z: -18 },
      { x: 6, z: -14 }, { x: 11, z: -16 }, { x: 17, z: -18 }, { x: 25, z: -12 },
      { x: 19, z: -6 }, { x: 14, z: 2 }, { x: 22, z: 8 }, { x: 27, z: 18 },
      { x: 16, z: 12 }, { x: 10, z: 18 }, { x: 6, z: 24 }, { x: -3, z: 20 },
      { x: -10, z: 26 }, { x: -22, z: 24 }, { x: -28, z: -2 }, { x: -25, z: -18 },
      { x: 3, z: -24 }, { x: -12, z: -26 }, { x: 12, z: -26 }, { x: 24, z: -4 },
      { x: 8, z: -6 }, { x: -3, z: 6 }, { x: -7, z: 2 }, { x: 11, z: 8 },
      { x: 18, z: 15 }, { x: -18, z: 12 }, { x: -14, z: -6 }, { x: 2, z: 16 },
      { x: 21, z: 25 }, { x: -6, z: 15 }, { x: -26, z: 18 }, { x: 15, z: 22 },
      { x: -17, z: 26 }, { x: 7, z: 10 }, { x: 25, z: 2 }, { x: 23, z: -22 },
      { x: -28, z: 10 }, { x: -24, z: -12 }, { x: 28, z: 10 }, { x: 12, z: -22 },
      { x: 0, z: 22 }, { x: -14, z: 20 }, { x: 20, z: -2 }, { x: -2, z: -14 }
    ];

    const microGrassSeeds = [
      { x: -5, z: -8 }, { x: -8, z: -5 }, { x: 5, z: -8 }, { x: 8, z: -10 },
      { x: 14, z: -12 }, { x: 18, z: -8 }, { x: 10, z: -2 }, { x: 12, z: 4 },
      { x: 16, z: 8 }, { x: 20, z: 12 }, { x: 12, z: 14 }, { x: 6, z: 16 },
      { x: -2, z: 14 }, { x: -8, z: 18 }, { x: -14, z: 15 }, { x: -20, z: 12 },
      { x: -12, z: 6 }, { x: -7, z: 8 }, { x: -2, z: 8 }, { x: 1, z: 18 },
      { x: 7, z: 20 }, { x: 15, z: 18 }, { x: 22, z: 20 }, { x: -16, z: -8 },
      { x: -22, z: -6 }, { x: -10, z: -16 }, { x: -4, z: -18 }, { x: 6, z: -18 },
      { x: 12, z: -18 }, { x: 20, z: -18 }, { x: -24, z: 2 }, { x: 24, z: -14 },
      { x: 18, z: 24 }, { x: -18, z: -22 }, { x: 4, z: 24 }, { x: -22, z: 22 }
    ];

    const chunkedVeg = WorldEnvironmentBuilder.buildChunkedVegetation(
      grassSeeds,
      microGrassSeeds,
      flowerSpots,
      (x: number, z: number) => this.getFarmHeight(x, z),
      24
    );
    this.vegetationChunks = chunkedVeg.chunks;
    this.gameState.totalChunks.set(chunkedVeg.chunks.length);
    this.areaGroup.add(chunkedVeg.parentGroup);

    // 19. Random 3D Stylized Fluffy Bushes across Rolling Hills (InstancedMesh Batch)
    const bushSeeds = [
      { x: -9, z: -14, b: true }, { x: -14, z: -20, b: false }, { x: -6, z: -24, b: true },
      { x: 5, z: -20, b: false }, { x: 12, z: -23, b: true },
      { x: 26, z: -14, b: true }, { x: 28, z: -5, b: false }, { x: 24, z: 5, b: true },
      { x: 28, z: 12, b: false }, { x: 24, z: 20, b: true }, { x: 17, z: 25, b: false },
      { x: 11, z: 23, b: true }, { x: 2, z: 25, b: false }, { x: -7, z: 24, b: true },
      { x: -15, z: 22, b: false }, { x: -23, z: 18, b: true }, { x: -27, z: 8, b: false },
      { x: -26, z: -6, b: true }, { x: -22, z: -14, b: false }, { x: -17, z: -4, b: true },
      { x: -11, z: 10, b: false }, { x: 9, z: 15, b: true }, { x: -4, z: 12, b: false }, { x: 19, z: 11, b: true },
      { x: -19, z: 5, b: false }
    ].filter(s => {
      // Clear props from both East Road bridge (21,0) and North Hill bridge (19.5, -12.5)
      const d1 = Math.hypot(s.x - 21.0, s.z - 0.0);
      const d2 = Math.hypot(s.x - 19.5, s.z - (-12.5));
      return d1 >= 3.6 && d2 >= 3.2;
    });
    const instancedBushes = WorldEnvironmentBuilder.buildInstancedBushes(
      bushSeeds,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedBushes);

    // 20. Natural Weathered 3D Mossy Rocks & Mountain Cliff Boulders (InstancedMesh Batch)
    const rockSeeds = [
      { x: -16, z: -16 }, { x: -10, z: -25 }, { x: 7, z: -25 }, { x: 15, z: -24 },
      { x: 25, z: -16 }, { x: 27, z: -10 }, { x: 25, z: 10 }, { x: 27, z: 22 },
      { x: 19, z: 26 }, { x: 12, z: 25 }, { x: -9, z: 26 }, { x: -19, z: 25 },
      { x: -27, z: 12 }, { x: -28, z: -10 }, { x: -24, z: -22 }, { x: -14, z: 8 },
      { x: 11, z: 17 }, { x: -16, z: -10 },
      // North Mountain Slope & Ridge Cliff Rocks
      { x: -18, z: -28 }, { x: -8, z: -30 }, { x: 0, z: -32 }, { x: 8, z: -30 }, { x: 18, z: -28 },
      // South Boundary Cliff Wall Boulders
      { x: -28, z: 32 }, { x: -20, z: 33 }, { x: -10, z: 32 }, { x: 0, z: 33 }, { x: 10, z: 32 }, { x: 20, z: 33 }, { x: 28, z: 32 },
      // Windmill Hill & South Bluff Slope Edge Transition Boulders
      { x: 24, z: -18 }, { x: 21, z: -22 }, { x: 16, z: -20 },
      { x: 18, z: 18 }, { x: 22, z: 24 }, { x: 14, z: 22 }
    ].filter(s => {
      // Clear props from both East Road bridge (21,0) and North Hill bridge (19.5, -12.5)
      const d1 = Math.hypot(s.x - 21.0, s.z - 0.0);
      const d2 = Math.hypot(s.x - 19.5, s.z - (-12.5));
      return d1 >= 3.6 && d2 >= 3.2;
    });
    const instancedRocks = WorldEnvironmentBuilder.buildInstancedRocks(
      rockSeeds,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedRocks);

    // 21. Natural Pathway Edge Pebbles & Earth Crumbs (InstancedMesh Batch)
    const pebbleSeeds = [
      { x: -1, z: -2 }, { x: 1.5, z: -3 }, { x: -2.5, z: 2 }, { x: 2, z: 3.2 },
      { x: 4, z: 1.5 }, { x: 8, z: -1.5 }, { x: 11, z: -6 }, { x: 15, z: -11 },
      { x: 19, z: -14 }, { x: 10, z: 6 }, { x: 13, z: 11 }, { x: 17, z: 16 },
      { x: -6, z: 4 }, { x: -10, z: 2 }, { x: -15, z: 0 }, { x: -12, z: -4 },
      { x: -6, z: -10 }, { x: 3, z: -12 }, { x: 7, z: -15 }, { x: -1, z: 10 },
      { x: 3, z: 13 }, { x: 8, z: 16 },
      // Cobblestone Path Edge Pebbles
      { x: 1.8, z: -4.5 }, { x: -1.8, z: -4.5 }, { x: 1.9, z: -12.5 }, { x: -1.9, z: -12.5 },
      { x: 12.5, z: 1.8 }, { x: 12.5, z: -1.8 }, { x: 22.5, z: 1.8 }, { x: 22.5, z: -1.8 }
    ];
    const instancedPebbles = WorldEnvironmentBuilder.buildInstancedPebbles(
      pebbleSeeds,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedPebbles);

    // 22. Red Spotted Forest Mushrooms near Tree Bases & Mountain Boulders
    const mushroomSpots = [
      { x: -15.5, z: -13.2 }, { x: -14.2, z: -15.1 }, { x: 15.8, z: -14.2 },
      { x: -11.8, z: 15.2 }, { x: 16.5, z: 4.2 }, { x: -9.2, z: -24.5 },
      { x: 18.5, z: -21.2 }, { x: -17.5, z: -9.5 }
    ];
    mushroomSpots.forEach(m => {
      const my = this.getFarmHeight(m.x, m.z);
      const shroom = WorldEnvironmentBuilder.createMushroom(new THREE.Vector3(m.x, my, m.z), 1.0);
      this.enableShadows(shroom);
      this.areaGroup.add(shroom);
    });

    // 23. Fallen Twigs & Logs for Natural Forest Floor
    const twigSpots = [
      { x: -12.5, z: -11.0 }, { x: 11.2, z: -9.5 }, { x: -14.5, z: 8.5 },
      { x: 14.2, z: 12.5 }, { x: -7.5, z: -16.5 }, { x: 19.5, z: -10.2 }
    ];
    twigSpots.forEach(t => {
      const ty = this.getFarmHeight(t.x, t.z);
      const twig = WorldEnvironmentBuilder.createFallenTwig(new THREE.Vector3(t.x, ty, t.z), 1.0);
      this.enableShadows(twig);
      this.areaGroup.add(twig);
    });

    // 24. Natural Meandering River, Waterfall, Arch Bridge & Fishing Spot
    this.buildMeanderingRiver();
  }

  /**
   * 24. Natural Meandering Whispering Stream River
   * Flowing in a continuous S-curve from North Mountain Cavern (z = -36.0) down to South Ocean (z = +36.0)
   * Dynamically conforms to hill slope terrain elevation so water never clips or floats!
   */
  private buildMeanderingRiver(): void {
    // 1. Natural Water Surface Mesh (Conforming Width ~3.2m)
    const riverGeo = new THREE.PlaneGeometry(3.6, 72.0, 16, 96);
    riverGeo.rotateX(-Math.PI / 2);

    const pos = riverGeo.attributes['position'];
    const uvs = riverGeo.attributes['uv'];

    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i); // Relatif terhadap center bidang (-1.8 s/d 1.8)
      const pz = pos.getZ(i);

      // S-curve river path formula
      const rx = 21.0 + Math.sin(pz * 0.08) * 1.8;
      const newX = rx + px; 

      pos.setX(i, newX);

      // Dynamically conform water Y height to sit 0.22m inside carved channel level
      // Evaluated at river center rx to ensure water plane is 100% level horizontally
      const riverCenterBaseY = this.getFarmHeight(rx, pz);
      pos.setY(i, riverCenterBaseY - 0.22);

      // Flow direction UVs (North z=-36 to South z=+36)
      uvs.setY(i, (36.0 - pz) / 4.8);
    }
    riverGeo.computeVertexNormals();

    const waterTexture = WorldTexturesGenerator.createWaterCanvasTexture();
    const waterMat = new THREE.MeshStandardMaterial({
      map: waterTexture,
      color: 0x0284c7,
      roughness: 0.10,
      metalness: 0.10,
      transparent: true,
      opacity: 0.88,
      side: THREE.FrontSide // FrontSide avoids backface black void clipping!
    });

    this.waterPlane = new THREE.Mesh(riverGeo, waterMat);
    this.waterPlane.receiveShadow = true;
    this.waterPlane.renderOrder = 2;
    this.areaGroup.add(this.waterPlane);

    // 2. Riverbank Boulders & Smooth River Rocks (Anchored on grassy banks, clear of bridge entrances)
    const riverRockMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x64748b,
      bottomColor: 0x334155,
      topColor: 0x94a3b8,
      minY: 0,
      maxY: 1.0
    });
    const rockZPoints = [-30, -22, -6, 6, 14, 22, 28]; // Excludes areas near bridges!
    rockZPoints.forEach(pz => {
      for (const sideSign of [-1, 1]) {
        const rx = 21.0 + Math.sin(pz * 0.08) * 1.8;
        const rockX = rx + sideSign * (2.2 + Math.random() * 0.5);
        const rockY = this.getFarmHeight(rockX, pz);
        const rockSize = 0.35 + Math.random() * 0.35;
        const riverRock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockSize), riverRockMat);
        riverRock.position.set(rockX, rockY + rockSize * 0.35, pz);
        riverRock.rotation.set(Math.random(), Math.random(), Math.random());
        riverRock.castShadow = true;
        this.areaGroup.add(riverRock);
      }
    });

    // 2b. Floating Logs & Debris (As seen in user reference)
    const logMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x92400e,
      bottomColor: 0x451a03,
      topColor: 0xb45309,
      minY: -0.15,
      maxY: 0.15
    });
    const logPoints = [
      { z: -28, xOff: 0.2, rot: 0.4, s: 1.2 },
      { z: -20, xOff: -0.4, rot: -0.3, s: 1.5 },
      { z: -5, xOff: 0.3, rot: 0.15, s: 1.8 },
      { z: 12, xOff: -0.1, rot: 0.6, s: 1.3 },
      { z: 26, xOff: 0.5, rot: -0.2, s: 2.0 }
    ];
    logPoints.forEach(lp => {
      const rx = 21.0 + Math.sin(lp.z * 0.08) * 1.8 + lp.xOff;
      const bankBaseY = this.getTerrainBaseHeight(rx, lp.z);
      const ly = bankBaseY - 0.16;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, lp.s, 6), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = lp.rot;
      log.position.set(rx, ly, lp.z);
      log.castShadow = true;
      log.receiveShadow = true;
      this.areaGroup.add(log);
    });

    // 2. North Mountain Cavern Waterfall Source (x = 21.0, z = -34.5)
    // Mountain Rock Cavern Grotto
    const rockMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x64748b,
      bottomColor: 0x334155,
      topColor: 0x94a3b8,
      minY: 0,
      maxY: 3.5
    });

    for (const rx of [-1.8, 0, 1.8]) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6), rockMat);
      const ry = this.getFarmHeight(21.0 + rx, -34.5);
      rock.position.set(21.0 + rx, ry + 1.2, -34.8);
      rock.castShadow = true;
      this.areaGroup.add(rock);
    }

    // Waterfall Foam Cascade coming out from mountain rocks
    const sourceY = this.getFarmHeight(21.0, -34.5);
    const fallGeo = new THREE.PlaneGeometry(3.6, 3.8, 6, 8);
    fallGeo.translate(0, 1.9, 0);
    const fallMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide
    });
    const waterfall = new THREE.Mesh(fallGeo, fallMat);
    waterfall.position.set(21.0, sourceY - 0.2, -34.2);
    waterfall.rotation.x = 0.25;
    this.areaGroup.add(waterfall);

    // Waterfall Spray Foam Base
    const sprayGeo = new THREE.CircleGeometry(2.4, 12);
    sprayGeo.rotateX(-Math.PI / 2);
    const sprayMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55
    });
    const spray = new THREE.Mesh(sprayGeo, sprayMat);
    spray.position.set(21.0, sourceY - 0.15, -33.2);
    this.areaGroup.add(spray);

    // 2b. South Sea Cliff Waterfall (River drops off southern cliff into ocean)
    const southRiverX = 21.0 + Math.sin(32.0 * 0.08) * 1.8;
    const southY = this.getTerrainBaseHeight(southRiverX, 32.0);

    const southFallGeo = new THREE.PlaneGeometry(3.8, 4.5, 6, 8);
    southFallGeo.translate(0, -2.25, 0);
    const southFall = new THREE.Mesh(southFallGeo, fallMat);
    southFall.position.set(southRiverX, southY - 0.28, 32.0);
    southFall.rotation.x = -0.2;
    this.areaGroup.add(southFall);

    const southSpray = new THREE.Mesh(sprayGeo, sprayMat);
    southSpray.position.set(southRiverX, -1.8, 33.2);
    this.areaGroup.add(southSpray);

    // 3. Rustic Wooden Bridges Across River (Bridge 1: East Road x=21.0, z=0.0 | Bridge 2: High North Canyon x=19.5, z=-12.5)
    const bridgeSpecs = [
      { x: 21.0, z: 0.0, width: 6.2, length: 2.8, rotY: 0, isHighBridge: false },
      { x: 19.5, z: -12.5, width: 8.6, length: 2.8, rotY: 0.0, isHighBridge: true }
    ];

    const woodMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xca8a04, // Light Amber/Honey Wood (As seen in user reference)
      bottomColor: 0x854d0e,
      topColor: 0xeab308,
      minY: 0,
      maxY: 1.0
    });

    const railWoodMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xca8a04,
      bottomColor: 0x713f12,
      topColor: 0xeab308,
      minY: 0,
      maxY: 1.2
    });

    bridgeSpecs.forEach(b => {
      const bridgeGroup = new THREE.Group();
      const bBaseY = b.isHighBridge
        ? Math.max(this.getTerrainBaseHeight(15.2, -12.5), this.getTerrainBaseHeight(23.8, -12.5))
        : this.getTerrainBaseHeight(b.x, b.z);

      // 1. Contact Shadow Decal
      const bridgeShadow = WorldEnvironmentBuilder.createContactShadowAO(b.width * 0.55);
      bridgeShadow.position.set(0, 0.02, 0);
      bridgeGroup.add(bridgeShadow);

      // 2. Detailed Deck (Individual Vertical Planks)
      const plankCount = 18;
      const plankWidth = b.width / plankCount;
      for (let i = 0; i < plankCount; i++) {
        const px = -b.width * 0.5 + plankWidth * 0.5 + i * plankWidth;
        const pGeo = new THREE.BoxGeometry(plankWidth - 0.04, 0.16, b.length);
        const plank = new THREE.Mesh(pGeo, woodMat);
        plank.position.set(px, 0.12, 0);
        plank.castShadow = true;
        plank.receiveShadow = true;
        bridgeGroup.add(plank);
      }

      // Main structural beams underneath
      const beamGeo = new THREE.BoxGeometry(b.width, 0.18, 0.2);
      for (const sideZ of [-b.length * 0.4, b.length * 0.4]) {
        const beam = new THREE.Mesh(beamGeo, railWoodMat);
        beam.position.set(0, 0, sideZ);
        bridgeGroup.add(beam);
      }

      // 3. Decorative Rails (Triple horizontal bars + posts with caps)
      const railHeight = 0.95;
      const halfLen = b.length * 0.5 - 0.05;
      for (const sideZ of [-halfLen, halfLen]) {
        // 3 Horizontal Rail Bars
        for (const h of [0.4, 0.68, 0.95]) {
          const railBar = new THREE.Mesh(new THREE.BoxGeometry(b.width, 0.06, 0.08), railWoodMat);
          railBar.position.set(0, h, sideZ);
          railBar.castShadow = true;
          bridgeGroup.add(railBar);
        }

        // Vertical Posts with small caps
        const postOffsets = [-b.width * 0.45, -b.width * 0.25, 0, b.width * 0.25, b.width * 0.45];
        postOffsets.forEach(lx => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, railHeight, 6), railWoodMat);
          post.position.set(lx, railHeight * 0.5, sideZ);
          post.castShadow = true;
          bridgeGroup.add(post);

          const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), railWoodMat);
          cap.position.set(lx, railHeight + 0.05, sideZ);
          bridgeGroup.add(cap);
        });
      }

      // 4. Sturdy Bank Foundation Support Pillars (Embedded into riverbanks or canyon floor)
      const pillarHeight = b.isHighBridge ? 3.8 : 0.95;
      const pillarPosY = b.isHighBridge ? -1.9 : -0.35;
      for (const pillarX of [-b.width * 0.42, -b.width * 0.15, b.width * 0.15, b.width * 0.42]) {
        for (const pillarZ of [-halfLen, halfLen]) {
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, pillarHeight, 8), railWoodMat);
          pillar.position.set(pillarX, pillarPosY, pillarZ);
          pillar.castShadow = true;
          pillar.receiveShadow = true;
          bridgeGroup.add(pillar);
        }
      }

      // Position group exactly at intersection
      bridgeGroup.position.set(b.x, bBaseY, b.z);
      if (b.rotY) bridgeGroup.rotation.y = b.rotY;

      bridgeGroup.renderOrder = 4; // Ensure drawn over water
      this.areaGroup.add(bridgeGroup);
    });

    // 4. Water Lily Pads on River
    const lilyGeo = new THREE.CircleGeometry(0.45, 8);
    lilyGeo.rotateX(-Math.PI / 2);
    const lilyMat = new THREE.MeshLambertMaterial({ color: 0x15803d });
    const lilySpots = [
      { x: 19.5, z: -10.0 }, { x: 16.8, z: -5.0 }, { x: 22.2, z: 8.0 }, { x: 23.5, z: 18.0 }
    ];
    lilySpots.forEach(lp => {
      const ly = this.getFarmHeight(lp.x, lp.z);
      const pad = new THREE.Mesh(lilyGeo, lilyMat);
      pad.position.set(lp.x, ly - 0.16, lp.z);
      this.areaGroup.add(pad);
    });

    // 5. Fishing Spot Marker & Ripples near Bridge
    const fishSpotPos = new THREE.Vector3(21.0, 0.0, 3.8);
    const fishY = this.getFarmHeight(fishSpotPos.x, fishSpotPos.z);
    fishSpotPos.y = fishY;

    this.interactiveMarkers.push({
      pos: fishSpotPos,
      radius: 2.2,
      context: {
        type: 'fish',
        label: 'MEMANCING / FISHING',
        subLabel: 'Sungai Whispering Stream',
        icon: 'phishing'
      }
    });

    const ringGeo = new THREE.RingGeometry(0.6, 0.8, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const fishRing = new THREE.Mesh(ringGeo, ringMat);
    fishRing.position.set(21.0, fishY - 0.16, 3.8);
    this.areaGroup.add(fishRing);
  }

  public getRiverSlopeAndVelocity(pz: number): { slope: number; velocity: number } {
    const rx1 = 21.0 + Math.sin(pz * 0.08) * 1.8;
    const ry1 = this.getFarmHeight(rx1, pz);

    const pz2 = pz + 1.0;
    const rx2 = 21.0 + Math.sin(pz2 * 0.08) * 1.8;
    const ry2 = this.getFarmHeight(rx2, pz2);

    const slope = Math.abs(ry1 - ry2);
    const velocity = 0.18 + slope * 1.45;
    return { slope, velocity };
  }

  /**
   * Merged Static Environmental Props Builder
   * Merges all static wooden props, stone/metal props, and contact AO shadow planes
   * into 3 single high-performance draw calls for the entire Farmstead area.
   */
  private buildFarmsteadMergedStaticProps(): void {
    const woodGeos: THREE.BufferGeometry[] = [];
    const stoneGeos: THREE.BufferGeometry[] = [];
    const shadowGeos: THREE.BufferGeometry[] = [];

    const m4 = new THREE.Matrix4();
    const tempMat = new THREE.Matrix4();

    const addShadow = (x: number, z: number, size: number, scaleX = 1, scaleZ = 1) => {
      const y = this.getFarmHeight(x, z) + 0.02;
      const g = new THREE.PlaneGeometry(size * scaleX, size * scaleZ);
      g.rotateX(-Math.PI / 2);
      g.translate(x, y, z);
      shadowGeos.push(g);
    };

    // 1. South Lookout Bluff Bench (x = 20, z = 22)
    const bx = 20.0;
    const bz = 22.0;
    const by = this.getFarmHeight(bx, bz);
    addShadow(bx, bz, 1.8, 1.4, 0.7);

    m4.makeTranslation(bx, by, bz);
    m4.multiply(tempMat.makeRotationY(-Math.PI / 4));

    const bSeat = new THREE.BoxGeometry(1.8, 0.12, 0.6);
    bSeat.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.45, 0));
    bSeat.applyMatrix4(m4);
    woodGeos.push(bSeat);

    const bBack = new THREE.BoxGeometry(1.8, 0.5, 0.1);
    bBack.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.75, -0.25));
    bBack.applyMatrix4(m4);
    woodGeos.push(bBack);

    for (const lx of [-0.75, 0.75]) {
      const leg = new THREE.BoxGeometry(0.1, 0.6, 0.5);
      leg.applyMatrix4(new THREE.Matrix4().makeTranslation(lx, 0.15, 0));
      leg.applyMatrix4(m4);
      woodGeos.push(leg);
    }

    // 2. Crossroads Signpost (x = 2, z = 1.2)
    const sx = 2.0;
    const sz = 1.2;
    const sy = this.getFarmHeight(sx, sz);
    addShadow(sx, sz, 1.0);

    const signPost = new THREE.CylinderGeometry(0.09, 0.09, 2.4, 6);
    signPost.translate(sx, sy + 0.9, sz);
    woodGeos.push(signPost);

    const boardN = new THREE.BoxGeometry(0.9, 0.25, 0.08);
    boardN.rotateY(Math.PI / 2);
    boardN.translate(sx, sy + 1.6, sz + 0.35);
    woodGeos.push(boardN);

    const boardE = new THREE.BoxGeometry(0.9, 0.25, 0.08);
    boardE.translate(sx + 0.35, sy + 1.3, sz);
    woodGeos.push(boardE);

    // 3. Exit Signs (Town & Mother Tree)
    const exits = [
      { x: 29.0, z: -1.8, name: 'Town' },
      { x: -2.2, z: -29.0, name: 'Mother Tree' }
    ];
    for (const ex of exits) {
      const ey = this.getFarmHeight(ex.x, ex.z);
      addShadow(ex.x, ex.z, 0.8);

      const p = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6);
      p.translate(ex.x, ey + 0.6, ex.z);
      woodGeos.push(p);

      const b = new THREE.BoxGeometry(0.8, 0.45, 0.1);
      b.translate(ex.x, ey + 1.2, ex.z);
      woodGeos.push(b);
    }

    // 4. Hay Bales in Pasture
    const bales = [
      { x: -14.0, z: -2.5 },
      { x: -12.5, z: -3.2 }
    ];
    for (const bale of bales) {
      const hy = this.getFarmHeight(bale.x, bale.z);
      addShadow(bale.x, bale.z, 1.4);

      const bg = new THREE.CylinderGeometry(0.7, 0.7, 1.2, 8);
      bg.rotateZ(Math.PI / 2);
      bg.translate(bale.x, hy + 0.7, bale.z);
      woodGeos.push(bg);
    }

    // 5. Wooden Pasture Fence Enclosure (x = -18, z = 2, w = 9, d = 8)
    const pcx = -18.0;
    const pcz = 2.0;
    const pw = 9.0;
    const pd = 8.0;
    const halfW = pw / 2;
    const halfD = pd / 2;

    for (const fx of [pcx - halfW, pcx + halfW]) {
      for (const fz of [pcz - halfD, pcz + halfD]) {
        const fy = this.getFarmHeight(fx, fz);
        const post = new THREE.CylinderGeometry(0.12, 0.12, 1.5, 6);
        post.translate(fx, fy + 0.45, fz);
        woodGeos.push(post);
      }
    }
    const rails = [
      { x: pcx, z: pcz - halfD, isZ: true },
      { x: pcx - halfW, z: pcz, isZ: false },
      { x: pcx + halfW, z: pcz, isZ: false }
    ];
    for (const r of rails) {
      const ry = this.getFarmHeight(r.x, r.z);
      const rail = new THREE.BoxGeometry(r.isZ ? pw : 0.12, 0.15, r.isZ ? 0.12 : pd);
      rail.translate(r.x, ry + 0.45, r.z);
      woodGeos.push(rail);
    }

    // 6. Shipping Bin (x = 2.5, z = 0.8)
    const binX = 2.5;
    const binZ = 0.8;
    const binY = this.getFarmHeight(binX, binZ);
    addShadow(binX, binZ, 2.2);

    const binCrate = new THREE.BoxGeometry(1.6, 1.0, 1.2);
    binCrate.translate(binX, binY + 0.5, binZ);
    woodGeos.push(binCrate);

    const binLid = new THREE.BoxGeometry(1.7, 0.15, 1.3);
    binLid.translate(binX, binY + 1.05, binZ);
    woodGeos.push(binLid);

    this.interactiveMarkers.push({
      pos: new THREE.Vector3(binX, binY, binZ),
      radius: 1.8,
      context: {
        type: 'ship',
        label: 'KOTAK PENJUALAN',
        subLabel: 'Shipping Bin (Jual Hasil)',
        icon: 'archive'
      }
    });

    // 7. Water Well (x = -3.2, z = 0.8)
    const wellX = -3.2;
    const wellZ = 0.8;
    const wellY = this.getFarmHeight(wellX, wellZ);
    addShadow(wellX, wellZ, 2.8);

    const wellBase = new THREE.CylinderGeometry(1.0, 1.1, 0.9, 8);
    wellBase.translate(wellX, wellY + 0.45, wellZ);
    stoneGeos.push(wellBase);

    const wellRoof = new THREE.ConeGeometry(1.4, 0.9, 4);
    wellRoof.rotateY(Math.PI / 4);
    wellRoof.translate(wellX, wellY + 2.1, wellZ);
    woodGeos.push(wellRoof);

    for (const px of [-0.85, 0.85]) {
      const wp = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 4);
      wp.translate(wellX + px, wellY + 0.9, wellZ);
      woodGeos.push(wp);
    }

    this.interactiveMarkers.push({
      pos: new THREE.Vector3(wellX, wellY, wellZ),
      radius: 1.8,
      context: {
        type: 'refill',
        label: 'SUMUR AIR / REFILL',
        subLabel: 'Water Well',
        icon: 'water_drop'
      }
    });

    // 8. Farmhouse Porch, Door, Chimney
    const houseY = this.getFarmHeight(0, -4.5);
    addShadow(0, -4.5, 9.0);

    const porch = new THREE.BoxGeometry(2.4, 0.2, 1.5);
    porch.translate(0, houseY + 0.1, -4.5 + 2.9);
    woodGeos.push(porch);

    const door = new THREE.BoxGeometry(1.2, 2.0, 0.1);
    door.translate(0, houseY + 1.0, -4.5 + 2.3);
    woodGeos.push(door);

    const chimney = new THREE.BoxGeometry(0.8, 2.0, 0.8);
    chimney.translate(2.0, houseY + 4.2, -4.5 - 1.0);
    stoneGeos.push(chimney);

    // 9. Streetlamps along North Climbing Road
    const lampPositions = [
      { x: -2.0, z: -10.0 },
      { x: 2.0, z: -20.0 },
      { x: -2.0, z: -28.0 }
    ];
    for (const lp of lampPositions) {
      const ly = this.getFarmHeight(lp.x, lp.z);
      addShadow(lp.x, lp.z, 0.9);

      const pole = new THREE.CylinderGeometry(0.08, 0.12, 3.2, 6);
      pole.translate(lp.x, ly + 1.3, lp.z);
      stoneGeos.push(pole);

      const box = new THREE.DodecahedronGeometry(0.28);
      box.translate(lp.x, ly + 2.9, lp.z);
      stoneGeos.push(box);
    }

    // 10. Barn & Windmill AO Shadows
    addShadow(-18.0, 2.0, 8.0);
    addShadow(22.0, -16.0, 7.5);

    // Create Merged Meshes
    if (woodGeos.length > 0) {
      const mergedWoodGeo = WorldEnvironmentBuilder.safeMergeGeometries(woodGeos, false);
      const woodMat = new THREE.MeshLambertMaterial({
        color: 0x92400e,
        side: THREE.FrontSide
      });
      const woodMesh = new THREE.Mesh(mergedWoodGeo, woodMat);
      woodMesh.castShadow = true;
      woodMesh.receiveShadow = true;
      woodMesh.renderOrder = 3;
      this.areaGroup.add(woodMesh);
    }

    if (stoneGeos.length > 0) {
      const mergedStoneGeo = WorldEnvironmentBuilder.safeMergeGeometries(stoneGeos, false);
      const stoneMat = new THREE.MeshLambertMaterial({
        color: 0x64748b,
        side: THREE.FrontSide
      });
      const stoneMesh = new THREE.Mesh(mergedStoneGeo, stoneMat);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      stoneMesh.renderOrder = 3;
      this.areaGroup.add(stoneMesh);
    }

    if (shadowGeos.length > 0) {
      const mergedShadowGeo = WorldEnvironmentBuilder.safeMergeGeometries(shadowGeos, false);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: WorldEnvironmentBuilder.getShadowTexture(),
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.FrontSide
      });
      const shadowMesh = new THREE.Mesh(mergedShadowGeo, shadowMat);
      shadowMesh.renderOrder = 1;
      this.areaGroup.add(shadowMesh);
    }
  }

  // AREA 2: FARMER'S COTTAGE INTERIOR
  private buildHouseInterior(): void {
    // Wooden Floor with Authentic Warm Oak Texture
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 10),
      new THREE.MeshLambertMaterial({
        map: this.woodFloorTexture,
        color: 0xffffff
      })
    );
    floor.rotation.x = -Math.PI / 2;
    this.areaGroup.add(floor);

    // Warm Wooden Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xfef3c7 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(12, 4.5, 0.3), wallMat);
    backWall.position.set(0, 2.25, -5);
    this.areaGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.5, 10), wallMat);
    leftWall.position.set(-6, 2.25, 0);
    this.areaGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.5, 10), wallMat);
    rightWall.position.set(6, 2.25, 0);
    this.areaGroup.add(rightWall);

    // Cozy Rug
    const rugMat = new THREE.MeshLambertMaterial({
      color: 0xd97706,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0
    });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.04, 0.5);
    rug.renderOrder = 2;
    this.areaGroup.add(rug);

    // Bed (Corner)
    const bedGroup = new THREE.Group();
    const bedFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.6, 3.2),
      new THREE.MeshLambertMaterial({ color: 0x78350f })
    );
    bedFrame.position.set(0, 0.3, 0);
    bedGroup.add(bedFrame);

    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.4, 2.9),
      new THREE.MeshLambertMaterial({ color: 0x38bdf8 })
    );
    mattress.position.set(0, 0.6, 0.1);
    bedGroup.add(mattress);

    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.25, 0.7),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    pillow.position.set(0, 0.85, -0.9);
    bedGroup.add(pillow);

    bedGroup.position.set(-4.2, 0, -3);
    this.areaGroup.add(bedGroup);

    // Bed Action Trigger (Sleep & Advance Day)
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(-4.2, 0, -2.0),
      radius: 1.8,
      context: {
        type: 'sleep',
        label: 'TIDUR / SLEEP',
        subLabel: 'Save & Next Day',
        icon: 'bed'
      }
    });

    // Fireplace & Chimney
    const fireGroup = new THREE.Group();
    const fireBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.8, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x78716c })
    );
    fireBase.position.set(0, 1.4, 0);
    fireGroup.add(fireBase);

    // Glowing hearth
    const hearth = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.0, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    hearth.position.set(0, 0.8, 0.4);
    fireGroup.add(hearth);

    fireGroup.position.set(3.5, 0, -4.3);
    this.areaGroup.add(fireGroup);

    // Dining Table & Chairs
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x92400e })
    );
    table.position.set(0, 0.55, -1.8);
    this.areaGroup.add(table);

    // Door Exit back to Farmstead
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
    const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.2), doorMat);
    exitDoor.position.set(0, 1.3, 4.9);
    this.areaGroup.add(exitDoor);

    const doorMatGreen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.2),
      new THREE.MeshLambertMaterial({
        color: 0x15803d,
        polygonOffset: true,
        polygonOffsetFactor: -1.0,
        polygonOffsetUnits: -2.0
      })
    );
    doorMatGreen.rotation.x = -Math.PI / 2;
    doorMatGreen.position.set(0, 0.04, 3.8);
    doorMatGreen.renderOrder = 2;
    this.areaGroup.add(doorMatGreen);

    this.interactiveMarkers.push({
      pos: new THREE.Vector3(0, 0, 3.8),
      radius: 1.6,
      context: {
        type: 'enter',
        label: 'KELUAR / EXIT',
        subLabel: 'Solaria Farmstead',
        icon: 'door_front',
        targetArea: 'farm'
      }
    });
  }

  // AREA 3: HARMONICA TOWN & SEAGULL PIER
  private buildTownArea(): void {
    // 1. Cobblestone Plaza Ground with Coastal Flagstone Texture
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 34),
      new THREE.MeshLambertMaterial({
        map: this.townGroundTexture,
        color: 0xffffff
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.areaGroup.add(ground);

    // 2. Ocean Water Strip (South)
    const waterGeo = new THREE.PlaneGeometry(42, 14);
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85
    });
    this.waterPlane = new THREE.Mesh(waterGeo, waterMat);
    this.waterPlane.rotation.x = -Math.PI / 2;
    this.waterPlane.position.set(0, -0.05, 12);
    this.waterPlane.receiveShadow = true;
    this.areaGroup.add(this.waterPlane);

    // 3. Central Town Fountain with Gradient Shading
    const fountainGroup = new THREE.Group();

    // Contact AO Shadow
    const fountainShadow = WorldEnvironmentBuilder.createContactShadowAO(2.8);
    fountainShadow.position.y = 0.02;
    fountainGroup.add(fountainShadow);

    const basinMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x9ca3af,
      bottomColor: 0x475569,
      topColor: 0xcfd8dc,
      minY: -0.3,
      maxY: 0.3
    });
    const fountainBasin = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.7, 0.6, 12),
      basinMat
    );
    fountainBasin.position.y = 0.3;
    fountainGroup.add(fountainBasin);

    const fountainWater = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.1, 0.5, 12),
      new THREE.MeshLambertMaterial({ color: 0x0284c7 })
    );
    fountainWater.position.y = 0.35;
    fountainGroup.add(fountainWater);

    const spireMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x6b7280,
      bottomColor: 0x374151,
      topColor: 0x9ca3af,
      minY: -0.9,
      maxY: 0.9
    });
    const fountainSpire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.5, 1.8, 8),
      spireMat
    );
    fountainSpire.position.y = 1.2;
    fountainGroup.add(fountainSpire);

    this.enableShadows(fountainGroup);

    fountainGroup.position.set(0, 0, -1);
    this.areaGroup.add(fountainGroup);

    // 4. General Store Exterior (Shop)
    const shopGroup = new THREE.Group();

    // Contact AO Shadow
    const shopShadow = WorldEnvironmentBuilder.createContactShadowAO(4.8);
    shopShadow.position.y = 0.02;
    shopGroup.add(shopShadow);

    const shopBaseMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xfef08a,
      bottomColor: 0xd97706,
      topColor: 0xfef9c3,
      minY: -2.0,
      maxY: 2.0
    });
    const shopBase = new THREE.Mesh(
      new THREE.BoxGeometry(7, 4.0, 5),
      shopBaseMat
    );
    shopBase.position.set(0, 2.0, 0);
    shopGroup.add(shopBase);

    const shopRoofMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x0284c7,
      bottomColor: 0x0369a1,
      topColor: 0x38bdf8,
      minY: -1.4,
      maxY: 1.4
    });
    const shopRoof = new THREE.Mesh(
      new THREE.ConeGeometry(6, 2.8, 4),
      shopRoofMat
    );
    shopRoof.rotation.y = Math.PI / 4;
    shopRoof.position.set(0, 5.0, 0);
    shopGroup.add(shopRoof);

    // Shop sign
    const signMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x78350f,
      bottomColor: 0x451a03,
      topColor: 0x92400e,
      minY: -0.35,
      maxY: 0.35
    });
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.7, 0.2),
      signMat
    );
    sign.position.set(0, 3.2, 2.6);
    shopGroup.add(sign);

    this.enableShadows(shopGroup);

    shopGroup.position.set(-7, 0, -8);
    this.areaGroup.add(shopGroup);

    // Door into General Store
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(-7, 0, -5.2),
      radius: 1.8,
      context: {
        type: 'enter',
        label: 'MASUK TOKO / SHOP',
        subLabel: 'General Store (Maya)',
        icon: 'storefront',
        targetArea: 'shop'
      }
    });

    // 5. Town Hall & Flute Clinic Exterior
    const hallGroup = new THREE.Group();

    // Contact AO Shadow
    const hallShadow = WorldEnvironmentBuilder.createContactShadowAO(5.4);
    hallShadow.position.y = 0.02;
    hallGroup.add(hallShadow);

    const hallBaseMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xf1f5f9,
      bottomColor: 0xcfd8dc,
      topColor: 0xffffff,
      minY: -2.25,
      maxY: 2.25
    });
    const hallBase = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4.5, 5),
      hallBaseMat
    );
    hallBase.position.set(0, 2.25, 0);
    hallGroup.add(hallBase);

    const hallRoofMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x991b1b,
      bottomColor: 0x5b1111,
      topColor: 0xdc2626,
      minY: -0.6,
      maxY: 0.6
    });
    const hallRoof = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 1.2, 5.4),
      hallRoofMat
    );
    hallRoof.position.set(0, 4.8, 0);
    hallGroup.add(hallRoof);

    this.enableShadows(hallGroup);

    hallGroup.position.set(7, 0, -8);
    this.areaGroup.add(hallGroup);

    // 6. Seagull Wooden Fishing Pier
    const pierGeo = new THREE.BoxGeometry(3.5, 0.4, 9);
    const pierMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x854d0e,
      bottomColor: 0x582405,
      topColor: 0xa16207,
      minY: -0.2,
      maxY: 0.2
    });
    const pier = new THREE.Mesh(pierGeo, pierMat);
    pier.position.set(3, 0.2, 8.5);
    pier.castShadow = true;
    pier.receiveShadow = true;
    this.areaGroup.add(pier);

    // Fishing spot marker at end of pier
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(3, 0, 11.5),
      radius: 2.0,
      context: {
        type: 'fish',
        label: 'MANCING / FISH',
        subLabel: 'Seagull Pier Dock',
        icon: 'phishing'
      }
    });

    // 7. Town NPCs
    this.createNpc(new THREE.Vector3(-1.8, 0, 1.5), 'oliver'); // Mayor Oliver near fountain
    this.createNpc(new THREE.Vector3(4.5, 0, 6.0), 'luke');   // Luke near pier

    // 8. West Exit to Farmstead
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(-17, 0, 0),
      radius: 2.5,
      context: {
        type: 'enter',
        label: 'KEMBALI KE KEBUN',
        subLabel: 'Solaria Farmstead',
        icon: 'agriculture',
        targetArea: 'farm'
      }
    });
    this.createExitSign(new THREE.Vector3(-15, 0, -1.8), 'Farmstead');

    // Town streetlamps, benches & planter boxes
    this.createLookoutBench(new THREE.Vector3(-3.2, 0, -1.8));
    this.createLookoutBench(new THREE.Vector3(3.2, 0, -1.8));
    this.createStreetlamp(new THREE.Vector3(-4, 0, 3));
    this.createStreetlamp(new THREE.Vector3(4, 0, 3));
    this.createStreetlamp(new THREE.Vector3(-4, 0, -4));
    this.createStreetlamp(new THREE.Vector3(4, 0, -4));
  }

  // AREA 4: GENERAL STORE INTERIOR
  private buildShopInterior(): void {
    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 10),
      new THREE.MeshLambertMaterial({ color: 0xfef08a })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.areaGroup.add(floor);

    // Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xfde68a });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(12, 4.5, 0.3), wallMat);
    backWall.position.set(0, 2.25, -5);
    this.areaGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.5, 10), wallMat);
    leftWall.position.set(-6, 2.25, 0);
    this.areaGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.5, 10), wallMat);
    rightWall.position.set(6, 2.25, 0);
    this.areaGroup.add(rightWall);

    // Shop Counter
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 1.2, 1.4),
      new THREE.MeshLambertMaterial({ color: 0xa16207 })
    );
    counter.position.set(0, 0.6, -1.8);
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.areaGroup.add(counter);

    // Maya NPC standing behind counter
    this.createNpc(new THREE.Vector3(0, 0, -3.0), 'maya');

    // Seed display shelves
    const shelf1 = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 3.0, 1.0),
      new THREE.MeshLambertMaterial({ color: 0x78350f })
    );
    shelf1.position.set(-3.8, 1.5, -4.2);
    shelf1.castShadow = true;
    shelf1.receiveShadow = true;
    this.areaGroup.add(shelf1);

    const shelf2 = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 3.0, 1.0),
      new THREE.MeshLambertMaterial({ color: 0x78350f })
    );
    shelf2.position.set(3.8, 1.5, -4.2);
    shelf2.castShadow = true;
    shelf2.receiveShadow = true;
    this.areaGroup.add(shelf2);

    // Exit Door
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(0, 0, 3.8),
      radius: 1.6,
      context: {
        type: 'enter',
        label: 'KELUAR / EXIT',
        subLabel: 'Harmonica Town',
        icon: 'door_front',
        targetArea: 'town'
      }
    });
  }

  // AREA 5: WHISPERING MOTHER TREE SHRINE
  private buildGoddessTreeArea(): void {
    // 1. Cliff Island Ground with Multi-Tonal Grass Shading
    const groundGeo = new THREE.CylinderGeometry(16, 17, 3, 28);
    const posAttr = groundGeo.attributes['position'];
    const colors: number[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);

      if (vy > 1.0) {
        // Island top lush sanctuary lawn
        const noise = Math.sin(vx * 0.2 + vz * 0.25) * 0.08 + Math.cos(vx * 0.5 - vz * 0.4) * 0.05;
        colors.push(0.38 + noise * 0.6, 0.76 + noise * 0.8, 0.24 + noise * 0.3);
      } else {
        // Island cliff rocky slope
        const stoneNoise = Math.sin(vx * 0.35 + vz * 0.35) * 0.08;
        colors.push(0.48 + stoneNoise, 0.52 + stoneNoise, 0.46 + stoneNoise);
      }
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();

    const ground = new THREE.Mesh(
      groundGeo,
      WorldEnvironmentBuilder.createOrganicTerrainMaterial({
        grassTexture: this.grassTexture,
        soilTexture: this.soilGroundTexture,
        noiseTexture: this.noiseTexture,
        tilingScale: 0.18,
        grassBaseColor: 0x429e22,
        grassWarmColor: 0x6ad42e,
        grassCoolColor: 0x226e18
      })
    );
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    this.areaGroup.add(ground);

    // Surrounding Ocean
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshLambertMaterial({ color: 0x0284c7, transparent: true, opacity: 0.75 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -2.8;
    ocean.receiveShadow = true;
    this.areaGroup.add(ocean);

    // 2. Colossal Whispering Mother Tree (Signature Tree of Tranquility icon!)
    const treeGroup = new THREE.Group();

    // Ground Contact Shadow Disc
    const treeShadow = WorldEnvironmentBuilder.createContactShadowAO(4.5);
    treeShadow.position.y = 0.02;
    treeGroup.add(treeShadow);

    // Giant Trunk with Sacred Ancient Timber Gradient
    const trunkMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x713f12,
      bottomColor: 0x3d1f05,
      topColor: 0x92400e,
      minY: -3.75,
      maxY: 3.75
    });
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.8, 7.5, 12),
      trunkMat
    );
    trunk.position.y = 3.75;
    treeGroup.add(trunk);

    // Massive Rainbow Blossom Canopy with Top-to-Bottom Pastel Shading
    this.treeLeaves = new THREE.Group();
    const colorsPuff = [
      { col: 0xf472b6, b: 0x9d174d, t: 0xfbcfe8 }, // Rose Blossom
      { col: 0x60a5fa, b: 0x1e40af, t: 0xbfdbfe }, // Sky Bell
      { col: 0x4ade80, b: 0x166534, t: 0xbbf7d0 }, // Meadow Bell
      { col: 0xfbbf24, b: 0xb45309, t: 0xfef08a }, // Golden Bell
      { col: 0xa78bfa, b: 0x5b21b6, t: 0xddd6fe }  // Twilight Bell
    ];
    for (let i = 0; i < 7; i++) {
      const pDef = colorsPuff[i % colorsPuff.length];
      const puffMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: pDef.col,
        bottomColor: pDef.b,
        topColor: pDef.t,
        minY: -2.4,
        maxY: 2.4
      });
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2.4 + (i % 2) * 0.4),
        puffMat
      );
      const angle = (i / 7) * Math.PI * 2;
      puff.position.set(Math.cos(angle) * 2.2, 7.2 + (i % 3) * 0.6, Math.sin(angle) * 2.2);
      this.treeLeaves.add(puff);
    }
    const centerPuffMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xfef08a,
      bottomColor: 0xf59e0b,
      topColor: 0xffffff,
      minY: -3.2,
      maxY: 3.2
    });
    const centerPuff = new THREE.Mesh(
      new THREE.DodecahedronGeometry(3.2),
      centerPuffMat
    );
    centerPuff.position.set(0, 8.5, 0);
    this.treeLeaves.add(centerPuff);
    treeGroup.add(this.treeLeaves);

    this.enableShadows(treeGroup);

    treeGroup.position.set(0, 0, -5);
    this.areaGroup.add(treeGroup);

    // 3. Sacred Island Crystal Altars arranged in a semi-circle
    const crystalColors = [0xfbbf24, 0x38bdf8, 0x4ade80, 0xf87171, 0xc084fc];
    const bellAngles = [-1.2, -0.6, 0, 0.6, 1.2];
    crystalColors.forEach((hex, idx) => {
      const angle = bellAngles[idx];
      const bx = Math.sin(angle) * 5.0;
      const bz = -5.0 + Math.cos(angle) * 5.0;

      // Stone Pedestal
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.65, 1.2, 8),
        new THREE.MeshLambertMaterial({ color: 0x9ca3af })
      );
      pedestal.position.set(bx, 0.6, bz);
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      this.areaGroup.add(pedestal);

      // Glowing Crystal Shard
      const crystalMat = new THREE.MeshLambertMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 0.4
      });
      const crystalMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), crystalMat);
      crystalMesh.position.set(bx, 1.45, bz);
      crystalMesh.castShadow = true;
      this.areaGroup.add(crystalMesh);
    });

    // 4. Fin the Sprite (fluttering near tree)
    this.spriteFin = new THREE.Group();
    const spriteBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0x4ade80 })
    );
    this.spriteFin.add(spriteBody);
    const spriteHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.05, 8, 16),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    spriteHalo.rotation.x = Math.PI / 2;
    spriteHalo.position.y = 0.45;
    this.spriteFin.add(spriteHalo);
    this.spriteFin.position.set(2.2, 2.0, -3.2);

    this.enableShadows(this.spriteFin);

    this.areaGroup.add(this.spriteFin);

    this.createNpc(new THREE.Vector3(2.2, 0, -3.2), 'fin');

    // 5. Exit back to Farmstead
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(0, 0, 9),
      radius: 2.2,
      context: {
        type: 'enter',
        label: 'KEMBALI KE KEBUN',
        subLabel: 'Solaria Farmstead',
        icon: 'agriculture',
        targetArea: 'farm'
      }
    });
    this.createExitSign(new THREE.Vector3(-1.8, 0, 7.5), 'Farmstead');
  }

  // 3D SOIL GRID & CROPS (Tree of Tranquility farming!)
  private buildSoilGrid(origin: THREE.Vector3): void {
    const plots = this.gameState.farmPlots();
    const dummy = new THREE.Object3D();

    // Clear previous farming grid
    while (this.farmingGridGroup.children.length > 0) {
      this.farmingGridGroup.remove(this.farmingGridGroup.children[0]);
    }

    // Single Instanced subtle farm plot indicator (soft warm tint, zero wireframe line clutter)
    const fillPlaneGeo = new THREE.PlaneGeometry(1.36, 1.36);
    fillPlaneGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0
    });
    const gridFillInst = new THREE.InstancedMesh(fillPlaneGeo, fillMat, plots.length);
    gridFillInst.castShadow = false;
    gridFillInst.receiveShadow = false;

    plots.forEach((tile, i) => {
      dummy.position.set(origin.x + tile.x * 1.5, 0.025, origin.z + tile.z * 1.5);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      gridFillInst.setMatrixAt(i, dummy.matrix);
    });
    gridFillInst.instanceMatrix.needsUpdate = true;
    this.farmingGridGroup.add(gridFillInst);

    // Visibility dynamically toggled according to equipped tool
    this.farmingGridGroup.visible = (this.gameState.selectedTool() === 'hoe');
    this.areaGroup.add(this.farmingGridGroup);

    // 3. INSTANCED SOIL PATCHES (Dry vs Watered) - Massive Draw Call Savings
    const dryPlots = plots.filter(p => p.tilled && !p.watered);
    const wateredPlots = plots.filter(p => p.tilled && p.watered);

    const patchGeo = new THREE.BoxGeometry(1.35, 0.06, 1.35);

    // Dry tilled soil batch (1 Draw Call)
    if (dryPlots.length > 0) {
      const dryMat = new THREE.MeshLambertMaterial({
        map: this.soilTilledTexture,
        color: 0xffffff,
        polygonOffset: true,
        polygonOffsetFactor: -1.0,
        polygonOffsetUnits: -2.0
      });
      const dryInst = new THREE.InstancedMesh(patchGeo, dryMat, dryPlots.length);
      dryInst.castShadow = false; // Flat against ground -> castShadow disabled for max performance
      dryInst.receiveShadow = true;
      dryInst.renderOrder = 2;

      dryPlots.forEach((tile, i) => {
        dummy.position.set(origin.x + tile.x * 1.5, 0.03, origin.z + tile.z * 1.5);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        dryInst.setMatrixAt(i, dummy.matrix);
      });
      dryInst.instanceMatrix.needsUpdate = true;
      this.areaGroup.add(dryInst);
      this.soilTileMeshes.set('batch_dry', dryInst as unknown as THREE.Group);
    }

    // Watered tilled soil batch (1 Draw Call)
    if (wateredPlots.length > 0) {
      const wateredMat = new THREE.MeshLambertMaterial({
        map: this.soilWateredTexture,
        color: 0xffffff,
        polygonOffset: true,
        polygonOffsetFactor: -1.0,
        polygonOffsetUnits: -2.0
      });
      const wateredInst = new THREE.InstancedMesh(patchGeo, wateredMat, wateredPlots.length);
      wateredInst.castShadow = false; // Flat against ground -> castShadow disabled
      wateredInst.receiveShadow = true;
      wateredInst.renderOrder = 2;

      wateredPlots.forEach((tile, i) => {
        dummy.position.set(origin.x + tile.x * 1.5, 0.03, origin.z + tile.z * 1.5);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        wateredInst.setMatrixAt(i, dummy.matrix);
      });
      wateredInst.instanceMatrix.needsUpdate = true;
      this.areaGroup.add(wateredInst);
      this.soilTileMeshes.set('batch_watered', wateredInst as unknown as THREE.Group);
    }

    // 4. INSTANCED SOIL FURROWS (3 ridges per tilled plot)
    const furrowGeo = new THREE.BoxGeometry(1.2, 0.04, 0.15);

    if (dryPlots.length > 0) {
      const dryFurrowMat = new THREE.MeshLambertMaterial({ color: 0x6e3c09 });
      const dryFurrowsInst = new THREE.InstancedMesh(furrowGeo, dryFurrowMat, dryPlots.length * 3);
      dryFurrowsInst.castShadow = false;
      dryFurrowsInst.receiveShadow = true;
      dryFurrowsInst.renderOrder = 3;

      let fIdx = 0;
      dryPlots.forEach(tile => {
        const wx = origin.x + tile.x * 1.5;
        const wz = origin.z + tile.z * 1.5;
        for (let i = -0.4; i <= 0.4; i += 0.4) {
          dummy.position.set(wx, 0.07, wz + i);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          dryFurrowsInst.setMatrixAt(fIdx++, dummy.matrix);
        }
      });
      dryFurrowsInst.instanceMatrix.needsUpdate = true;
      this.areaGroup.add(dryFurrowsInst);
      this.soilTileMeshes.set('batch_furrows_dry', dryFurrowsInst as unknown as THREE.Group);
    }

    if (wateredPlots.length > 0) {
      const wateredFurrowMat = new THREE.MeshLambertMaterial({ color: 0x2e180c });
      const wateredFurrowsInst = new THREE.InstancedMesh(furrowGeo, wateredFurrowMat, wateredPlots.length * 3);
      wateredFurrowsInst.castShadow = false;
      wateredFurrowsInst.receiveShadow = true;
      wateredFurrowsInst.renderOrder = 3;

      let fIdx = 0;
      wateredPlots.forEach(tile => {
        const wx = origin.x + tile.x * 1.5;
        const wz = origin.z + tile.z * 1.5;
        for (let i = -0.4; i <= 0.4; i += 0.4) {
          dummy.position.set(wx, 0.07, wz + i);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          wateredFurrowsInst.setMatrixAt(fIdx++, dummy.matrix);
        }
      });
      wateredFurrowsInst.instanceMatrix.needsUpdate = true;
      this.areaGroup.add(wateredFurrowsInst);
      this.soilTileMeshes.set('batch_furrows_watered', wateredFurrowsInst as unknown as THREE.Group);
    }

    // 5. INDIVIDUAL CROP MODELS (Placed on tilled tiles with crops)
    plots.forEach(tile => {
      if (tile.tilled && tile.crop) {
        const cropMesh = this.createCropModel(tile.crop.type, tile.crop.stage);
        cropMesh.position.set(origin.x + tile.x * 1.5, 0.08, origin.z + tile.z * 1.5);
        cropMesh.renderOrder = 3;
        this.enableShadows(cropMesh, false, true); // Crops receive shadow without extra shadow pass draw calls
        this.areaGroup.add(cropMesh);
        this.soilTileMeshes.set(`crop_${tile.x}_${tile.z}`, cropMesh);
      }
    });
  }

  // Dynamic Crop 3D Models with Gradient Shading
  private createCropModel(type: string, stage: number): THREE.Group {
    const group = new THREE.Group();
    if (stage === 0) {
      // Tiny Seedling
      const seedMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0x84cc16,
        bottomColor: 0x4d7c0f,
        topColor: 0xbef264,
        minY: -0.12,
        maxY: 0.12
      });
      const seed = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.12),
        seedMat
      );
      seed.position.y = 0.1;
      group.add(seed);
    } else if (stage === 1) {
      // Small Sprout (Two leaves)
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6),
        new THREE.MeshLambertMaterial({ color: 0x4ade80 })
      );
      stem.position.y = 0.15;
      group.add(stem);

      const leafMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0x22c55e,
        bottomColor: 0x15803d,
        topColor: 0x86efac,
        minY: -0.15,
        maxY: 0.15
      });
      const leaf1 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4), leafMat);
      leaf1.rotation.z = 0.6;
      leaf1.position.set(0.12, 0.25, 0);
      group.add(leaf1);

      const leaf2 = leaf1.clone();
      leaf2.rotation.z = -0.6;
      leaf2.position.set(-0.12, 0.25, 0);
      group.add(leaf2);
    } else if (stage === 2) {
      // Bushy flowering stage
      const bushMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0x16a34a,
        bottomColor: 0x14532d,
        topColor: 0x4ade80,
        minY: -0.35,
        maxY: 0.35
      });
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        bushMat
      );
      bush.position.y = 0.35;
      group.add(bush);

      const flowerMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0xfef08a,
        bottomColor: 0xf59e0b,
        topColor: 0xffffff,
        minY: -0.15,
        maxY: 0.15
      });
      const flower = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.15),
        flowerMat
      );
      flower.position.set(0, 0.6, 0);
      group.add(flower);
    } else {
      // Ripe harvestable crop!
      const leafMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0x15803d,
        bottomColor: 0x052e16,
        topColor: 0x4ade80,
        minY: -0.3,
        maxY: 0.3
      });
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 0.6, 6),
        leafMat
      );
      leaves.position.y = 0.35;
      group.add(leaves);

      let fruitMat: THREE.Material;
      if (type === 'turnip') {
        fruitMat = WorldEnvironmentBuilder.createGradientMaterial({
          color: 0xf8fafc,
          bottomColor: 0xc084fc, // purple-tinted turnip base
          topColor: 0xffffff,
          minY: -0.28,
          maxY: 0.28
        });
      } else if (type === 'strawberry') {
        fruitMat = WorldEnvironmentBuilder.createGradientMaterial({
          color: 0xf43f5e,
          bottomColor: 0x9f1239,
          topColor: 0xfecdd3,
          minY: -0.28,
          maxY: 0.28
        });
      } else if (type === 'corn') {
        fruitMat = WorldEnvironmentBuilder.createGradientMaterial({
          color: 0xfacc15,
          bottomColor: 0xb45309,
          topColor: 0xfef08a,
          minY: -0.28,
          maxY: 0.28
        });
      } else {
        fruitMat = WorldEnvironmentBuilder.createGradientMaterial({
          color: 0xf97316,
          bottomColor: 0x9a3412,
          topColor: 0xfed7aa,
          minY: -0.28,
          maxY: 0.28
        });
      }

      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), fruitMat);
      fruit.position.set(0, 0.55, 0);
      group.add(fruit);

      // Star sparkle indicating ripe
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      star.position.set(0, 0.95, 0);
      group.add(star);
    }
    return group;
  }

  // 3D ANIMALS & PASTURE
  private buildPastureAndAnimals(origin: THREE.Vector3): void {
    // Wooden fence enclosure
    this.createWoodenFenceEnclosure(origin.x, origin.z, 9, 8);

    // Barn shed in background with Gradient Shading
    const barnGroup = new THREE.Group();
    const barnMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x991b1b,
      bottomColor: 0x5b1111,
      topColor: 0xdc2626,
      minY: -1.6,
      maxY: 1.6
    });
    const barn = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 3.2, 3.8),
      barnMat
    );
    barn.position.y = 1.6;
    barnGroup.add(barn);

    // Barn roof
    const barnRoofMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xffedd5,
      bottomColor: 0xd4a373,
      topColor: 0xfffbeb,
      minY: -1.1,
      maxY: 1.1
    });
    const barnRoof = new THREE.Mesh(
      new THREE.ConeGeometry(4.2, 2.2, 4),
      barnRoofMat
    );
    barnRoof.rotation.y = Math.PI / 4;
    barnRoof.position.y = 4.1;
    barnGroup.add(barnRoof);

    const barnShadow = WorldEnvironmentBuilder.createContactShadowAO(3.8);
    barnShadow.position.y = 0.02;
    barnGroup.add(barnShadow);

    this.enableShadows(barnGroup);

    const barnY = this.getFarmHeight(origin.x, origin.z - 4.5);
    barnGroup.position.set(origin.x, barnY, origin.z - 4.5);
    this.areaGroup.add(barnGroup);

    // Animals (positioned at terrain surface)
    const animals = this.gameState.animals();
    animals.forEach(a => {
      const mesh = this.createAnimalModel(a.type);
      const ay = this.getFarmHeight(a.position.x, a.position.z);
      mesh.position.set(a.position.x, ay, a.position.z);
      this.areaGroup.add(mesh);
      this.animalMeshes.set(a.id, mesh);
    });
  }

  private createAnimalModel(type: 'cow' | 'sheep' | 'chicken'): THREE.Group {
    const group = new THREE.Group();
    if (type === 'cow') {
      // Ground Contact Shadow Disc
      const shadow = WorldEnvironmentBuilder.createContactShadowAO(1.2);
      shadow.position.y = 0.02;
      group.add(shadow);

      // Holstein Cow (Tree of Tranquility style)
      // Body with subtle shading gradient
      const bodyMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0xffffff,
        bottomColor: 0xe2e8f0,
        topColor: 0xffffff,
        minY: -0.55,
        maxY: 0.55
      });
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.1, 2.2),
        bodyMat
      );
      body.position.y = 1.1;
      group.add(body);

      // Black spots
      const spotMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0x1f2937,
        bottomColor: 0x111827,
        topColor: 0x374151,
        minY: -0.3,
        maxY: 0.3
      });
      const spot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.8), spotMat);
      spot.position.set(0.45, 1.25, 0.2);
      group.add(spot);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.0), bodyMat);
      head.position.set(0, 1.6, 1.2);
      group.add(head);

      // Pink Snout
      const snoutMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0xfbcfe8,
        bottomColor: 0xf472b6,
        topColor: 0xfdf2f8,
        minY: -0.2,
        maxY: 0.2
      });
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), snoutMat);
      snout.position.set(0, 1.4, 1.7);
      group.add(snout);

      // Horns
      const hornMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0xfef08a,
        bottomColor: 0xca8a04,
        topColor: 0xfef9c3,
        minY: -0.15,
        maxY: 0.15
      });
      const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 4), hornMat);
      horn1.position.set(0.35, 2.15, 1.1);
      group.add(horn1);
      const horn2 = horn1.clone();
      horn2.position.set(-0.35, 2.15, 1.1);
      group.add(horn2);

      // Legs
      const legMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0x1f2937,
        bottomColor: 0x030712,
        topColor: 0x374151,
        minY: -0.35,
        maxY: 0.35
      });
      for (const lx of [-0.6, 0.6]) {
        for (const lz of [-0.7, 0.7]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), legMat);
          leg.position.set(lx, 0.35, lz);
          group.add(leg);
        }
      }
    } else if (type === 'sheep') {
      // Ground Contact Shadow Disc
      const shadow = WorldEnvironmentBuilder.createContactShadowAO(0.95);
      shadow.position.y = 0.02;
      group.add(shadow);

      // Fluffy round Sheep with wool gradient
      const woolMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0xf3f4f6,
        bottomColor: 0xd1d5db,
        topColor: 0xffffff,
        minY: -0.9,
        maxY: 0.9
      });
      const wool = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.9),
        woolMat
      );
      wool.position.y = 0.9;
      group.add(wool);

      // Head
      const headMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0x1e293b,
        bottomColor: 0x0f172a,
        topColor: 0x334155,
        minY: -0.4,
        maxY: 0.4
      });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), headMat);
      head.position.set(0, 1.1, 0.85);
      group.add(head);

      // Legs
      for (const lx of [-0.35, 0.35]) {
        for (const lz of [-0.4, 0.4]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), headMat);
          leg.position.set(lx, 0.25, lz);
          group.add(leg);
        }
      }
    } else {
      // Ground Contact Shadow Disc
      const shadow = WorldEnvironmentBuilder.createContactShadowAO(0.45);
      shadow.position.y = 0.02;
      group.add(shadow);

      // Cute Chicken with warm plumage gradient
      const bodyMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0xd97706,
        bottomColor: 0x92400e,
        topColor: 0xfbbf24,
        minY: -0.35,
        maxY: 0.35
      });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bodyMat);
      body.position.y = 0.35;
      group.add(body);

      // Red comb
      const combMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0xef4444,
        bottomColor: 0xb91c1c,
        topColor: 0xf87171,
        minY: -0.1,
        maxY: 0.1
      });
      const comb = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), combMat);
      comb.position.set(0, 0.72, 0.05);
      group.add(comb);

      // Beak
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 4), new THREE.MeshLambertMaterial({ color: 0xfacc15 }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.45, 0.38);
      group.add(beak);
    }
    this.enableShadows(group);
    group.renderOrder = 4;
    return group;
  }

  // 3D INTERACTIVE OBJECTS (Shipping Bin, Well, Windmill)
  private buildShippingBin(pos: THREE.Vector3): void {
    const binGroup = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(1.1);
    shadow.position.y = 0.02;
    binGroup.add(shadow);

    // Wooden crate with gradient
    const crateMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x78350f,
      bottomColor: 0x451a03,
      topColor: 0x92400e,
      minY: -0.5,
      maxY: 0.5
    });
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.0, 1.2),
      crateMat
    );
    crate.position.y = 0.5;
    binGroup.add(crate);

    // Lid
    const lidMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xd97706,
      bottomColor: 0x92400e,
      topColor: 0xfde68a,
      minY: -0.1,
      maxY: 0.1
    });
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.15, 1.3),
      lidMat
    );
    lid.position.y = 1.05;
    binGroup.add(lid);

    this.enableShadows(binGroup, false, true);

    const gy = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    binGroup.position.set(pos.x, gy, pos.z);
    this.areaGroup.add(binGroup);

    this.interactiveMarkers.push({
      pos: new THREE.Vector3(pos.x, gy, pos.z),
      radius: 1.8,
      context: {
        type: 'ship',
        label: 'KOTAK PENJUALAN',
        subLabel: 'Shipping Bin (Jual Hasil)',
        icon: 'archive'
      }
    });
  }

  private buildWaterWell(pos: THREE.Vector3): void {
    const wellGroup = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(1.5);
    shadow.position.y = 0.02;
    wellGroup.add(shadow);

    // Stone base with gradient
    const baseMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x9ca3af,
      bottomColor: 0x475569,
      topColor: 0xcfd8dc,
      minY: -0.45,
      maxY: 0.45
    });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.1, 0.9, 10),
      baseMat
    );
    base.position.y = 0.45;
    wellGroup.add(base);

    // Water surface inside
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: 0x0284c7 })
    );
    water.position.y = 0.7;
    wellGroup.add(water);

    // Wooden canopy posts & roof
    const roofMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xb45309,
      bottomColor: 0x78350f,
      topColor: 0xd97706,
      minY: -0.45,
      maxY: 0.45
    });
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 0.9, 4),
      roofMat
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 2.1;
    wellGroup.add(roof);

    this.enableShadows(wellGroup, false, true);

    const gy = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    wellGroup.position.set(pos.x, gy, pos.z);
    this.areaGroup.add(wellGroup);

    this.interactiveMarkers.push({
      pos: new THREE.Vector3(pos.x, gy, pos.z),
      radius: 1.8,
      context: {
        type: 'refill',
        label: 'SUMUR AIR / REFILL',
        subLabel: 'Water Well',
        icon: 'water_drop'
      }
    });
  }

  private buildWaterwheel(pos: THREE.Vector3): void {
    const waterwheel = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(5.2);
    shadow.position.y = 0.02;
    waterwheel.add(shadow);

    const woodMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x854d0e,
      bottomColor: 0x451a03,
      topColor: 0xca8a04,
      minY: -3.2,
      maxY: 3.2
    });

    const darkWoodMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x713f12,
      bottomColor: 0x3b1a03,
      topColor: 0x854d0e,
      minY: -2.0,
      maxY: 2.0
    });

    const ironMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x475569,
      bottomColor: 0x1e293b,
      topColor: 0x64748b,
      minY: -1.2,
      maxY: 1.2
    });

    const stoneMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x64748b,
      bottomColor: 0x334155,
      topColor: 0x94a3b8,
      minY: 0,
      maxY: 3.2
    });

    // 1. Flour Mill Processing Grotto / Manufacturing Room Foundation on Bank
    const bankX = 2.2; // Positioned cleanly on East Bank
    const millBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 4.2), stoneMat);
    millBase.position.set(bankX, 1.6, 0);
    waterwheel.add(millBase);

    // Decorative Flour Mill Wooden Roof Structure
    const millRoofMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x991b1b,
      bottomColor: 0x5b1111,
      topColor: 0xdc2626,
      minY: 0,
      maxY: 1.8
    });
    const millRoof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.8, 4), millRoofMat);
    millRoof.rotation.y = Math.PI / 4;
    millRoof.position.set(bankX, 4.1, 0);
    waterwheel.add(millRoof);

    // Grain Hopper on side for Wheat-to-Flour Milling
    const hopper = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.9, 4), woodMat);
    hopper.rotation.x = Math.PI;
    hopper.position.set(bankX - 0.9, 2.6, 1.2);
    waterwheel.add(hopper);

    // Heavy Axle Bearing Pillow Block
    const bearingBlock = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), ironMat);
    bearingBlock.position.set(bankX - 1.0, 2.3, 0);
    waterwheel.add(bearingBlock);

    // River A-Frame Heavy Support Posts (West side submerged in riverbed)
    const postGeo = new THREE.CylinderGeometry(0.18, 0.22, 3.8, 8);
    
    const postInWater1 = new THREE.Mesh(postGeo, darkWoodMat);
    postInWater1.position.set(-1.4, 1.4, -1.2);
    postInWater1.rotation.z = 0.18;
    postInWater1.rotation.x = -0.15;
    waterwheel.add(postInWater1);

    const postInWater2 = new THREE.Mesh(postGeo, darkWoodMat);
    postInWater2.position.set(-1.4, 1.4, 1.2);
    postInWater2.rotation.z = 0.18;
    postInWater2.rotation.x = 0.15;
    waterwheel.add(postInWater2);

    // 2. Main Drive Shaft ("As Rontor" connecting Waterwheel to Mill Room)
    const driveShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 4.2, 10), ironMat);
    driveShaft.rotation.z = Math.PI / 2; // Lies along X-axis
    driveShaft.position.set(0.4, 2.3, 0);
    waterwheel.add(driveShaft);

    // Heavy Cast Iron Gear Coupling on Shaft
    const gearCoupling = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.35, 12), ironMat);
    gearCoupling.rotation.z = Math.PI / 2;
    gearCoupling.position.set(bankX - 0.4, 2.3, 0);
    waterwheel.add(gearCoupling);

    // 3. Rotating Waterwheel Group
    this.windmillBlades = new THREE.Group();

    // Grand Wheel Radius = 3.2m (Total 6.4m Diameter)
    const wheelRadius = 3.2;
    
    // Axle center iron hub
    const axleHub = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 2.2, 12), ironMat);
    axleHub.rotation.z = Math.PI / 2;
    this.windmillBlades.add(axleHub);

    // Double Parallel Outer Timber Rims with Reinforced Studs
    const outerRimGeo = new THREE.TorusGeometry(wheelRadius, 0.15, 8, 32);
    outerRimGeo.rotateY(Math.PI / 2);
    
    const rim1 = new THREE.Mesh(outerRimGeo, woodMat);
    rim1.position.set(-0.7, 0, 0);
    this.windmillBlades.add(rim1);

    const rim2 = new THREE.Mesh(outerRimGeo, woodMat);
    rim2.position.set(0.7, 0, 0);
    this.windmillBlades.add(rim2);

    // Inner Reinforcing Timber Ring
    const innerRimGeo = new THREE.TorusGeometry(wheelRadius * 0.58, 0.1, 8, 28);
    innerRimGeo.rotateY(Math.PI / 2);
    const innerRim1 = new THREE.Mesh(innerRimGeo, darkWoodMat);
    innerRim1.position.set(-0.7, 0, 0);
    this.windmillBlades.add(innerRim1);
    const innerRim2 = new THREE.Mesh(innerRimGeo, darkWoodMat);
    innerRim2.position.set(0.7, 0, 0);
    this.windmillBlades.add(innerRim2);

    // Spokes & Curved Bucket Paddles (16 Spokes for smooth animation)
    const spokeCount = 16;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i * Math.PI * 2) / spokeCount;
      const spokeGroup = new THREE.Group();
      spokeGroup.rotation.x = angle;

      // Timber Spoke Beam
      const spokeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, wheelRadius * 0.98, 0.12), woodMat);
      spokeMesh.position.set(0, wheelRadius * 0.49, 0);
      spokeGroup.add(spokeMesh);

      // Water Scoop Bucket Paddle at the end of spoke
      const paddleMesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 0.1), woodMat);
      paddleMesh.position.set(0, wheelRadius, 0);
      paddleMesh.rotation.x = 0.32; // Curved scoop catching river flow
      spokeGroup.add(paddleMesh);

      this.windmillBlades.add(spokeGroup);
    }

    // Set wheel center at axle height
    this.windmillBlades.position.set(-0.6, 2.3, 0);
    waterwheel.add(this.windmillBlades);

    // 4. Submerged Water Foam & Splash Spray Rings at River Level
    const foamGeo = new THREE.RingGeometry(1.2, 2.6, 24);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.position.set(-0.6, 0.08, 0);
    waterwheel.add(foam);

    this.enableShadows(waterwheel);

    // Lower height by -1.25m so bottom paddles dip deeply into flowing water!
    const gy = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) - 1.25 : pos.y;
    waterwheel.position.set(pos.x, gy, pos.z);
    
    this.areaGroup.add(waterwheel);

    // Interactive Marker for Wheat-to-Flour Processing
    this.interactiveMarkers.push({
      pos: new THREE.Vector3(pos.x + 2.0, gy + 0.5, pos.z),
      radius: 2.5,
      context: {
        type: 'ship',
        label: 'KINCIR TEPUNG GANDUM',
        subLabel: 'Flour Mill (Konversi Gandum)',
        icon: 'factory'
      }
    });
  }

  // NPCS (Oliver, Maya, Luke, Fin)
  private createNpc(pos: THREE.Vector3, npcId: string): void {
    const npc = this.gameState.npcs().find(n => n.id === npcId);
    if (!npc) return;

    const group = new THREE.Group();

    // Ground Contact Shadow Disc
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(0.55);
    shadow.position.y = 0.02;
    group.add(shadow);

    // Body with vertical gradient
    const bodyColor = new THREE.Color(npc.color);
    const bodyMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: bodyColor,
      bottomColor: bodyColor.clone().multiplyScalar(0.65),
      topColor: bodyColor.clone().lerp(new THREE.Color(0xffffff), 0.3),
      minY: -0.55,
      maxY: 0.55
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.45, 1.1, 8),
      bodyMat
    );
    body.position.y = 0.55;
    group.add(body);

    // Head
    const headMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xfecdd3,
      bottomColor: 0xfba0ac,
      topColor: 0xfff1f2,
      minY: -0.32,
      maxY: 0.32
    });
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 8),
      headMat
    );
    head.position.y = 1.35;
    group.add(head);

    // Hat / Hair accessory
    const hatMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x1e293b,
      bottomColor: 0x0f172a,
      topColor: 0x475569,
      minY: -0.2,
      maxY: 0.2
    });
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 0.4, 6),
      hatMat
    );
    hat.position.y = 1.7;
    group.add(hat);

    this.enableShadows(group);

    group.position.copy(pos);
    group.renderOrder = 5;
    this.areaGroup.add(group);
    this.npcMeshes.set(npcId, group);

    this.interactiveMarkers.push({
      pos,
      radius: 1.8,
      context: {
        type: 'talk',
        label: `BICARA / TALK`,
        subLabel: npc.name,
        icon: 'chat',
        targetNpc: npc
      }
    });
  }

  // PLAYER CHARACTER (Detailed Harvest Moon Tree of Tranquility Chibi Farmer - No Hat)
  private createPlayerMesh(): void {
    this.playerGroup = new THREE.Group();

    // 1. Denim Overalls Body with vertical gradient
    const bodyGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.85, 8);
    const bodyMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x1d4ed8,
      bottomColor: 0x172554, // Deep indigo denim base
      topColor: 0x3b82f6,    // Sky denim crest
      minY: -0.42,
      maxY: 0.42
    });
    this.playerBody = new THREE.Mesh(bodyGeo, bodyMat);
    this.playerBody.position.y = 0.75;
    this.playerGroup.add(this.playerBody);

    // Overalls Shoulder Straps
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x1e40af });
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.44), strapMat);
    strapL.position.set(-0.16, 0.96, 0.02);
    this.playerGroup.add(strapL);

    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.44), strapMat);
    strapR.position.set(0.16, 0.96, 0.02);
    this.playerGroup.add(strapR);

    // Overalls Brass Buttons
    const buttonGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.03, 6);
    buttonGeo.rotateX(Math.PI / 2);
    const buttonMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b }); // Gold brass
    const buttonL = new THREE.Mesh(buttonGeo, buttonMat);
    buttonL.position.set(-0.16, 0.88, 0.23);
    this.playerGroup.add(buttonL);

    const buttonR = new THREE.Mesh(buttonGeo, buttonMat);
    buttonR.position.set(0.16, 0.88, 0.23);
    this.playerGroup.add(buttonR);

    // Front Pouch Pocket
    const pocketMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.04), pocketMat);
    pocket.position.set(0, 0.72, 0.24);
    this.playerGroup.add(pocket);

    // 2. White/Cream Shirt Underneath
    const shirtMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xffedd5,
      bottomColor: 0xfed7aa,
      topColor: 0xffffff,
      minY: -0.15,
      maxY: 0.15
    });
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.38), shirtMat);
    shirt.position.set(0, 0.96, 0.02);
    this.playerGroup.add(shirt);

    // 3. Red Bandana / Scarf around Neck
    const scarfMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xd92626,
      bottomColor: 0x991b1b,
      topColor: 0xef4444,
      minY: -0.06,
      maxY: 0.06
    });
    const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), scarfMat);
    scarfRing.rotation.x = Math.PI / 2;
    scarfRing.position.set(0, 1.15, 0);
    this.playerGroup.add(scarfRing);

    const scarfKnot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), scarfMat);
    scarfKnot.rotation.set(0.4, 0, -0.2);
    scarfKnot.position.set(-0.08, 1.08, 0.22);
    this.playerGroup.add(scarfKnot);

    // 4. Head with Rosy Cheeks & Anime Face Details
    const headGeo = new THREE.SphereGeometry(0.34, 12, 12);
    const headMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xffe4e6,
      bottomColor: 0xfecdd3,
      topColor: 0xfff1f2,
      minY: -0.34,
      maxY: 0.34
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.45;
    this.playerGroup.add(head);

    // Anime Eyes (Deep navy with white shine highlights)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const eyeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 8);
    eyeGeo.rotateX(Math.PI / 2);

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.11, 1.46, 0.31);
    this.playerGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.11, 1.46, 0.31);
    this.playerGroup.add(eyeR);

    const shineGeo = new THREE.SphereGeometry(0.018, 6, 6);
    const shineL = new THREE.Mesh(shineGeo, shineMat);
    shineL.position.set(-0.095, 1.48, 0.33);
    this.playerGroup.add(shineL);

    const shineR = new THREE.Mesh(shineGeo, shineMat);
    shineR.position.set(0.125, 1.48, 0.33);
    this.playerGroup.add(shineR);

    // Soft Rosy Cheeks
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.65 });
    const cheekGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8);
    cheekGeo.rotateX(Math.PI / 2);

    const cheekL = new THREE.Mesh(cheekGeo, cheekMat);
    cheekL.position.set(-0.18, 1.40, 0.28);
    this.playerGroup.add(cheekL);

    const cheekR = new THREE.Mesh(cheekGeo, cheekMat);
    cheekR.position.set(0.18, 1.40, 0.28);
    this.playerGroup.add(cheekR);

    // 5. Stylized Anime Chibi Hair (Warm Amber-Chestnut Brown with Layered Locks - NO HAT)
    const hairGroup = new THREE.Group();
    const hairMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x92400e,
      bottomColor: 0x451a03,
      topColor: 0xb45309,
      minY: -0.22,
      maxY: 0.28
    });

    // Hair Cap / Crown
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 10, 10),
      hairMat
    );
    hairCap.position.set(0, 0.06, -0.02);
    hairGroup.add(hairCap);

    // Front Bangs (Center & Sides)
    const bang1 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 4), hairMat);
    bang1.rotation.set(0.35, 0, 0.25);
    bang1.position.set(-0.12, 0.08, 0.28);
    hairGroup.add(bang1);

    const bang2 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.30, 4), hairMat);
    bang2.rotation.set(0.32, 0, -0.18);
    bang2.position.set(0.09, 0.10, 0.29);
    hairGroup.add(bang2);

    const bang3 = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.22, 4), hairMat);
    bang3.rotation.set(0.30, 0, -0.4);
    bang3.position.set(0.22, 0.06, 0.25);
    hairGroup.add(bang3);

    // Side Locks & Back Fluff
    const tuftL = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.25, 4), hairMat);
    tuftL.rotation.set(0, 0, 0.45);
    tuftL.position.set(-0.31, 0.02, 0.06);
    hairGroup.add(tuftL);

    const tuftR = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.25, 4), hairMat);
    tuftR.rotation.set(0, 0, -0.45);
    tuftR.position.set(0.31, 0.02, 0.06);
    hairGroup.add(tuftR);

    const backFluff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), hairMat);
    backFluff.position.set(0, -0.08, -0.28);
    hairGroup.add(backFluff);

    hairGroup.position.set(0, 1.48, 0);
    this.playerGroup.add(hairGroup);

    // 6. Leather Backpack with Flap & Buckle
    const backpackMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x78350f,
      bottomColor: 0x451a03,
      topColor: 0x92400e,
      minY: -0.22,
      maxY: 0.22
    });
    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.45, 0.24),
      backpackMat
    );
    backpack.position.set(0, 0.82, -0.28);
    this.playerGroup.add(backpack);

    const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.16, 0.26), backpackMat);
    packFlap.position.set(0, 0.98, -0.28);
    this.playerGroup.add(packFlap);

    const packBuckle = new THREE.Mesh(buttonGeo, buttonMat);
    packBuckle.position.set(0, 0.80, -0.41);
    this.playerGroup.add(packBuckle);

    // 7. Legs & Boots
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.45, 6);
    const legMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x1e3a8a,
      bottomColor: 0x172554,
      topColor: 0x2563eb,
      minY: -0.22,
      maxY: 0.22
    });

    this.playerLeftLeg = new THREE.Mesh(legGeo, legMat);
    this.playerLeftLeg.position.set(-0.16, 0.32, 0);
    this.playerGroup.add(this.playerLeftLeg);

    this.playerRightLeg = new THREE.Mesh(legGeo, legMat);
    this.playerRightLeg.position.set(0.16, 0.32, 0);
    this.playerGroup.add(this.playerRightLeg);

    const bootGeo = new THREE.BoxGeometry(0.18, 0.14, 0.28);
    const bootMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x582405,
      bottomColor: 0x381503,
      topColor: 0x78350f,
      minY: -0.07,
      maxY: 0.07
    });
    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(0, -0.16, 0.05);
    this.playerLeftLeg.add(leftBoot);

    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0, -0.16, 0.05);
    this.playerRightLeg.add(rightBoot);

    // 8. Arms & Sleeves
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.45, 6);
    const armMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xef4444,
      bottomColor: 0x991b1b,
      topColor: 0xf87171,
      minY: -0.22,
      maxY: 0.22
    });

    this.playerLeftArm = new THREE.Mesh(armGeo, armMat);
    this.playerLeftArm.position.set(-0.4, 0.85, 0);
    this.playerGroup.add(this.playerLeftArm);

    this.playerRightArm = new THREE.Mesh(armGeo, armMat);
    this.playerRightArm.position.set(0.4, 0.85, 0);
    this.playerGroup.add(this.playerRightArm);

    // Active Tool in Hand
    const toolGeo = new THREE.BoxGeometry(0.08, 0.6, 0.08);
    const toolMat = new THREE.MeshLambertMaterial({ color: 0x9ca3af });
    this.playerToolMesh = new THREE.Mesh(toolGeo, toolMat);
    this.playerToolMesh.position.set(0.4, 0.6, 0.3);
    this.playerToolMesh.rotation.x = Math.PI / 4;
    this.playerGroup.add(this.playerToolMesh);

    // Ground Contact Shadow Disc (Baked AO) for grounded footing
    this.playerShadowMesh = WorldEnvironmentBuilder.createContactShadowAO(0.55);
    this.playerShadowMesh.position.set(0, 0.02, 0);
    this.playerGroup.add(this.playerShadowMesh);

    // Enable cast and receive shadows on player meshes
    this.enableShadows(this.playerGroup, true, true);

    this.playerGroup.renderOrder = 5;
    this.playerGroup.position.copy(this.playerPos);
    this.scene.add(this.playerGroup);
  }

  // RECURSIVE SHADOW HELPER
  private enableShadows(root: THREE.Object3D, cast = true, receive = true): void {
    root.traverse(child => {
      if (child instanceof THREE.Mesh) {
        // Do not cast shadow from transparent decals / contact shadows
        if (child.material && (child.material as THREE.Material).transparent) {
          child.castShadow = false;
          child.receiveShadow = false;
        } else {
          child.castShadow = cast;
          child.receiveShadow = receive;
        }
      }
    });
  }

  // DYNAMIC ATMOSPHERIC LIGHTING & TIME-OF-DAY CYCLE (Supports 06:38 AM Sunrise & Beyond)
  private updateAtmosphericLighting(): void {
    if (!this.sunLight || !this.ambientLight) return;

    const hour = this.gameState.hour();
    const minute = this.gameState.minute();
    const timeDec = hour + minute / 60; // e.g. 6.63 for 06:38 AM
    const isRain = this.gameState.weather() === 'Rainy';

    let sunIntensity = 1.0;
    let ambIntensity = 0.65;
    let fogDensity = 0.016;

    if (isRain) {
      // Overcast / Rainy Mood (Diffuse slate grey lighting & mist)
      this._tempSunColor.setHex(0xb0c4de);
      sunIntensity = 0.85;
      this._tempSunPos.set(12, 16, 12);
      this._tempAmbColor.setHex(0x94a3b8);
      ambIntensity = 0.75;
      this._tempSkyColor.setHex(0x64748b);
      this._tempFogColor.setHex(0x94a3b8);
      fogDensity = 0.015;
    } else if (timeDec >= 5.0 && timeDec < 8.5) {
      // 🌅 EARLY MORNING / DAWN (05:00 - 08:30 AM, e.g. 06:00 AM / 06:38 AM)
      const t = (timeDec - 5.0) / 3.5; // 0 to 1
      this._tempSunPos.set(
        THREE.MathUtils.lerp(24, 16, t),
        THREE.MathUtils.lerp(12.0, 22.0, t),
        THREE.MathUtils.lerp(16, 14, t)
      );
      this._colA.setHex(0xfffaed);
      this._colB.setHex(0xffffff);
      this._tempSunColor.lerpColors(this._colA, this._colB, t);
      sunIntensity = THREE.MathUtils.lerp(1.35, 1.55, t);

      this._colA.setHex(0xfff1db);
      this._colB.setHex(0xfffbeb);
      this._tempAmbColor.lerpColors(this._colA, this._colB, t);
      ambIntensity = THREE.MathUtils.lerp(0.82, 0.92, t);

      this._colA.setHex(0xbae6fd);
      this._colB.setHex(0x7dd3fc);
      this._tempSkyColor.lerpColors(this._colA, this._colB, t);

      this._colA.setHex(0xe0f2fe);
      this._colB.setHex(0xbae6fd);
      this._tempFogColor.lerpColors(this._colA, this._colB, t);
      fogDensity = THREE.MathUtils.lerp(0.009, 0.007, t);
    } else if (timeDec >= 8.5 && timeDec < 16.5) {
      // ☀️ DAYTIME / MIDDAY (08:30 AM - 04:30 PM) - Crisp bright daylight, brilliant blue sky
      const t = (timeDec - 8.5) / 8.0;
      this._tempSunPos.set(
        THREE.MathUtils.lerp(16, -12, t),
        THREE.MathUtils.lerp(24, 28, Math.sin(t * Math.PI)),
        THREE.MathUtils.lerp(14, 12, t)
      );
      this._tempSunColor.setHex(0xffffff);
      sunIntensity = 1.6;
      this._tempAmbColor.setHex(0xfffdf5);
      ambIntensity = 0.95;
      this._tempSkyColor.setHex(0x38bdf8);
      this._tempFogColor.setHex(0xbae6fd);
      fogDensity = 0.006;
    } else if (timeDec >= 16.5 && timeDec < 18.5) {
      // 🌇 GOLDEN HOUR / LATE AFTERNOON (04:30 PM - 06:30 PM)
      const t = (timeDec - 16.5) / 2.0;
      this._tempSunPos.set(
        THREE.MathUtils.lerp(-12, -26, t),
        THREE.MathUtils.lerp(22, 10.0, t),
        THREE.MathUtils.lerp(12, 16, t)
      );
      this._colA.setHex(0xfef08a);
      this._colB.setHex(0xfb923c);
      this._tempSunColor.lerpColors(this._colA, this._colB, t);
      sunIntensity = THREE.MathUtils.lerp(1.5, 1.25, t);

      this._colA.setHex(0xfef3c7);
      this._colB.setHex(0xfed7aa);
      this._tempAmbColor.lerpColors(this._colA, this._colB, t);
      ambIntensity = THREE.MathUtils.lerp(0.9, 0.78, t);

      this._colA.setHex(0x38bdf8);
      this._colB.setHex(0xfb923c);
      this._tempSkyColor.lerpColors(this._colA, this._colB, t);

      this._colA.setHex(0xbae6fd);
      this._colB.setHex(0xfbcfe8);
      this._tempFogColor.lerpColors(this._colA, this._colB, t);
      fogDensity = THREE.MathUtils.lerp(0.007, 0.012, t);
    } else if (timeDec >= 18.5 && timeDec < 20.0) {
      // 🌆 DUSK / TWILIGHT (06:30 PM - 08:00 PM)
      const t = (timeDec - 18.5) / 1.5;
      this._tempSunPos.set(-28, THREE.MathUtils.lerp(10.0, 3.0, t), 16);
      this._colA.setHex(0xf97316);
      this._colB.setHex(0xa855f7);
      this._tempSunColor.lerpColors(this._colA, this._colB, t);
      sunIntensity = THREE.MathUtils.lerp(1.1, 0.55, t);

      this._colA.setHex(0xfed7aa);
      this._colB.setHex(0x6366f1);
      this._tempAmbColor.lerpColors(this._colA, this._colB, t);
      ambIntensity = THREE.MathUtils.lerp(0.75, 0.52, t);

      this._colA.setHex(0xf97316);
      this._colB.setHex(0x1e1b4b);
      this._tempSkyColor.lerpColors(this._colA, this._colB, t);

      this._colA.setHex(0xfbcfe8);
      this._colB.setHex(0x312e81);
      this._tempFogColor.lerpColors(this._colA, this._colB, t);
      fogDensity = 0.015;
    } else {
      // 🌙 NIGHT (08:00 PM - 05:00 AM) - Crisp silver moonlight, deep starry night
      this._tempSunPos.set(-14, 22, -14);
      this._tempSunColor.setHex(0xbfdbfe);
      sunIntensity = 0.62;
      this._tempAmbColor.setHex(0x475569);
      ambIntensity = 0.52;
      this._tempSkyColor.setHex(0x0f172a);
      this._tempFogColor.setHex(0x1e293b);
      fogDensity = 0.016;
    }

    // Apply smoothly to Three.js lighting & scene
    this.sunLight.target.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.position.set(
      this.playerPos.x + this._tempSunPos.x,
      this.playerPos.y + this._tempSunPos.y,
      this.playerPos.z + this._tempSunPos.z
    );
    this.sunLight.color.copy(this._tempSunColor);
    this.sunLight.intensity = sunIntensity;
    this.ambientLight.color.copy(this._tempAmbColor);
    this.ambientLight.intensity = ambIntensity;

    if (this.hemiLight) {
      this.hemiLight.color.copy(this._tempSkyColor);
      this.hemiLight.groundColor.setHex(0x78350f);
      this.hemiLight.intensity = THREE.MathUtils.lerp(0.45, 0.8, ambIntensity);
    }

    const area = this.gameState.currentArea();
    if (area !== 'house' && area !== 'shop') {
      this.scene.background = this._tempSkyColor;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this._tempFogColor);
        this.scene.fog.density = fogDensity;
      }
    }
  }

  // MAIN GAME TICK & ANIMATION LOOP (Zero CPU when paused)
  private animate = (): void => {
    if (!this.isLoopActive) return;

    // Zero-CPU optimization when tab is backgrounded
    if (typeof document !== 'undefined' && document.hidden) {
      setTimeout(() => {
        if (this.isLoopActive) {
          requestAnimationFrame(this.animate);
        }
      }, 200);
      return;
    }

    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    // Staggered execution / frame-rate budgeting
    const isEvenFrame = this.frameCount % 2 === 0;

    // Dev Editor Mode Performance Override: Disable shadow maps while sculpting for max 60 FPS smoothness
    const isDevMode = this.gameState.isDevEditorOpen();
    const shadowsOn = this.gameState.shadowsEnabled() && !isDevMode;
    if (this.renderer && this.renderer.shadowMap.enabled !== shadowsOn) {
      this.renderer.shadowMap.enabled = shadowsOn;
      if (this.sunLight) this.sunLight.castShadow = shadowsOn;
    }

    // Atmospheric lighting is extremely slow-changing. Update once every 12 frames (5Hz) to save massive CPU math.
    if (this.frameCount % 12 === 0) {
      this.updateAtmosphericLighting();
    }

    // Farming Grid outline visibility dynamically tied to equipped Hoe
    if (this.farmingGridGroup && this.frameCount % 4 === 0) {
      const isFarm = this.gameState.currentArea() === 'farm';
      const isHoe = this.gameState.selectedTool() === 'hoe';
      this.farmingGridGroup.visible = isFarm && isHoe && !isDevMode;
    }

    // Dynamic slope-based water flow velocity physics
    const { velocity: localWaterVelocity } = this.getRiverSlopeAndVelocity(this.playerPos.z);

    // 1. Waterwheel rotation (rotates dynamically faster when river slope is steeper)
    if (this.windmillBlades) {
      const wheelSlopeVel = this.getRiverSlopeAndVelocity(-20.5).velocity;
      this.windmillBlades.rotation.x += delta * (0.8 + wheelSlopeVel * 2.4);
    }

    // 2. Sprite Fin float
    if (this.spriteFin) {
      this.spriteFin.position.y = 2.0 + Math.sin(this.clock.getElapsedTime() * 3) * 0.25;
      this.spriteFin.rotation.y += delta * 1.5;
    }

    // 3. Tree leaves subtle breathing (throttled/simplified)
    if (this.treeLeaves && isEvenFrame) {
      this.treeLeaves.rotation.y = Math.sin(this.clock.getElapsedTime() * 0.5) * 0.05;
    }

    // 3b. Meadow grass tufts gentle wind swaying (staggered to update only 50% per frame)
    if (this.grassTuftMeshes.length > 0) {
      const time = this.clock.getElapsedTime();
      const swayTime = time * 2.2;
      const startIdx = isEvenFrame ? 0 : Math.floor(this.grassTuftMeshes.length / 2);
      const endIdx = isEvenFrame ? Math.floor(this.grassTuftMeshes.length / 2) : this.grassTuftMeshes.length;
      for (let i = startIdx; i < endIdx; i++) {
        const tuft = this.grassTuftMeshes[i];
        tuft.rotation.z = Math.sin(swayTime + tuft.position.x * 0.4 + tuft.position.z * 0.25) * 0.08;
      }
    }

    // 3d. River water flow animation (Flows FROM North Mountain Source DOWN TO South Ocean Cliff)
    if (this.waterPlane && this.waterPlane.material) {
      const mat = this.waterPlane.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        mat.map.offset.y += delta * localWaterVelocity;
      }
    }

    // 4. Update Player Movement
    this.updatePlayerMovement(delta);

    // 5. Update Camera (Smooth lerp following player)
    this.updateCamera();

    // 5b. Frustum Culling for Chunks: Camera moves smoothly, updating once every 4 frames (15Hz) is completely seamless
    if (this.frameCount % 4 === 0) {
      this.updateVegetationFrustumCulling();
    }

    // 6. Proximity Check for All-in-One Action Button
    this.updateActionProximity();

    // 7. Render (Direct or via Miniature Tilt-Shift Pass)
    if (this.gameState.tiltShiftEnabled() && this.tiltShiftTarget && this.tiltShiftScene && this.tiltShiftCamera) {
      this.renderer.setRenderTarget(this.tiltShiftTarget);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.tiltShiftScene, this.tiltShiftCamera);
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }

    // 8. Performance Telemetry Tracking
    this.frameCount++;
    const now = performance.now();
    const frameDelta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    if (now - this.lastFpsUpdateTime >= 500) {
      const elapsedSec = (now - this.lastFpsUpdateTime) / 1000;
      const calculatedFps = Math.max(1, Math.round(this.frameCount / elapsedSec));
      this.gameState.fps.set(calculatedFps);
      this.gameState.frameTimeMs.set(parseFloat(frameDelta.toFixed(1)));
      this.gameState.drawCalls.set(this.renderer.info.render.calls);
      this.gameState.triangles.set(this.renderer.info.render.triangles);
      this.gameState.geometriesCount.set(this.renderer.info.memory.geometries);
      this.gameState.texturesCount.set(this.renderer.info.memory.textures);

      this.frameCount = 0;
      this.lastFpsUpdateTime = now;
    }
  };

  private updateVegetationFrustumCulling(): void {
    if (this.vegetationChunks.length === 0) return;

    this.projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.cameraFrustum.setFromProjectionMatrix(this.projScreenMatrix);

    let visibleCount = 0;
    for (const chunk of this.vegetationChunks) {
      const isVisible = this.cameraFrustum.intersectsBox(chunk.bounds);
      chunk.group.visible = isVisible;
      if (isVisible) visibleCount++;
    }
    if (this.lastVisibleChunkCount !== visibleCount) {
      this.lastVisibleChunkCount = visibleCount;
      this.gameState.visibleChunks.set(visibleCount);
    }
  }

  private updatePlayerMovement(delta: number): void {
    if (this.gameState.isFading()) return;
    if (this.gameState.isDevEditorOpen()) return; // Lock player movement in dev editor mode

    const vx = this.moveVector.x;
    const vz = this.moveVector.z;
    const speed = this.gameState.isRunning() ? 5.2 : 3.4;

    const isMoving = Math.abs(vx) > 0.05 || Math.abs(vz) > 0.05;

    if (isMoving) {
      // Calculate target angle
      this.playerTargetRotation = Math.atan2(vx, vz);

      // Smooth rotate player
      this.playerGroup.rotation.y = this.playerTargetRotation;

      // Update position
      this.playerPos.x += vx * speed * delta;
      this.playerPos.z += vz * speed * delta;

      // Clamp to area boundaries with road exit corridor clearance
      const area = this.gameState.currentArea();
      let boundX = area === 'house' || area === 'shop' ? 5.0 : (area === 'farm' ? 32.5 : 16.0);
      let boundZ = area === 'house' || area === 'shop' ? 5.0 : (area === 'farm' ? 32.5 : 16.0);

      if (area === 'farm') {
        // Allow player to walk into North Road exit corridor
        if (Math.abs(this.playerPos.x) <= 2.2 && this.playerPos.z < 0) {
          boundZ = 35.0;
        }
        // Allow player to walk into East Road exit corridor
        if (Math.abs(this.playerPos.z) <= 2.2 && this.playerPos.x > 0) {
          boundX = 35.0;
        }
      }

      this.playerPos.x = Math.max(-boundX, Math.min(boundX, this.playerPos.x));
      this.playerPos.z = Math.max(-boundZ, Math.min(boundZ, this.playerPos.z));

      // Trigger Zone Check (Area transition Trigger Box in tree/gate gap with smooth fade)
      if (area === 'farm') {
        // 1. North Mountain Exit Trigger Box (Z <= -31.2, |X| <= 2.2) -> Whispering Mother Tree
        if (this.playerPos.z <= -31.2 && Math.abs(this.playerPos.x) <= 2.2) {
          this.gameState.warpToArea('goddess_tree', 'Menuju Whispering Mother Tree...');
          return;
        }
        // 2. East Town Exit Trigger Box (X >= 31.2, |Z| <= 2.2) -> Harmonica Town & Pier
        if (this.playerPos.x >= 31.2 && Math.abs(this.playerPos.z) <= 2.2) {
          this.gameState.warpToArea('town', 'Menuju Harmonica Town & Pier...');
          return;
        }
      } else if (area === 'goddess_tree') {
        // Return to Farmstead Exit (Z >= 13.5)
        if (this.playerPos.z >= 13.5) {
          this.gameState.warpToArea('farm', 'Kembali ke Solaria Farmstead...');
          return;
        }
      } else if (area === 'town') {
        // Return to Farmstead Exit (X <= -14.5)
        if (this.playerPos.x <= -14.5) {
          this.gameState.warpToArea('farm', 'Kembali ke Solaria Farmstead...');
          return;
        }
      }

      // Continuous terrain elevation following & riverbank collision limit
      if (area === 'farm') {
        // Prevent player from stepping directly into deep river water (except on wooden bridge decks)
        // Using same formula as getTerrainHeight: rx = 21.0 + sin(z * 0.08) * 1.8
        const riverX = 21.0 + Math.sin(this.playerPos.z * 0.08) * 1.8;
        const distToRiver = Math.abs(this.playerPos.x - riverX);

        const isOnBridge1 = Math.abs(this.playerPos.x - 21.0) < 3.1 && Math.abs(this.playerPos.z - 0.0) < 1.4;
        const isOnBridge2 = Math.abs(this.playerPos.x - 19.5) < 4.4 && Math.abs(this.playerPos.z - (-12.5)) < 1.4;

        if (distToRiver < 1.95 && !isOnBridge1 && !isOnBridge2) {
          const pushSign = this.playerPos.x >= riverX ? 1 : -1;
          this.playerPos.x = riverX + pushSign * 1.95;
        }

        this.playerPos.y = this.getFarmHeight(this.playerPos.x, this.playerPos.z);
      } else {
        this.playerPos.y = 0;
      }

      this.playerGroup.position.copy(this.playerPos);
      this.gameState.playerCoords.set({
        x: Math.round(this.playerPos.x * 10) / 10,
        y: Math.round(this.playerPos.y * 10) / 10,
        z: Math.round(this.playerPos.z * 10) / 10
      });

      // Walking animation
      this.walkCycleTime += delta * (this.gameState.isRunning() ? 14 : 9);
      const legSwing = Math.sin(this.walkCycleTime) * 0.5;
      this.playerLeftLeg.rotation.x = legSwing;
      this.playerRightLeg.rotation.x = -legSwing;
      this.playerLeftArm.rotation.x = -legSwing;
      this.playerRightArm.rotation.x = legSwing;

      // Clean, stable walking animation (torso stays steady without head bob shake)
      this.playerBody.position.y = 0.75;
    } else {
      // Idle reset
      this.playerLeftLeg.rotation.x = 0;
      this.playerRightLeg.rotation.x = 0;
      this.playerLeftArm.rotation.x = 0;
      this.playerRightArm.rotation.x = 0;
      this.playerBody.position.y = 0.75;
    }
  }

  public rotateDevCamera(deltaYaw: number, deltaPitch: number): void {
    this.devYaw += deltaYaw;
    this.devPitch = THREE.MathUtils.clamp(this.devPitch + deltaPitch, 0.08, 1.48);
  }

  public zoomDevCamera(deltaDist: number): void {
    this.devDistance = THREE.MathUtils.clamp(this.devDistance + deltaDist, 6.0, 48.0);
  }

  public panDevCamera(deltaX: number, deltaZ: number): void {
    this.devFocusPos.x = THREE.MathUtils.clamp(this.devFocusPos.x + deltaX, -30.0, 30.0);
    this.devFocusPos.z = THREE.MathUtils.clamp(this.devFocusPos.z + deltaZ, -30.0, 30.0);
  }

  public setDevCameraAnglePreset(angle: 'iso' | 'top' | 'front' | 'side'): void {
    this.devFocusPos.copy(this.playerPos);
    if (angle === 'iso') {
      this.devYaw = 0.0;
      this.devPitch = 0.65;
      this.devDistance = 20.0;
    } else if (angle === 'top') {
      this.devYaw = 0.0;
      this.devPitch = 1.45;
      this.devDistance = 24.0;
    } else if (angle === 'front') {
      this.devYaw = 0.0;
      this.devPitch = 0.22;
      this.devDistance = 16.0;
    } else if (angle === 'side') {
      this.devYaw = Math.PI / 2;
      this.devPitch = 0.5;
      this.devDistance = 20.0;
    }
  }

  // Camera tracking (Authentic Harvest Moon: Tree of Tranquility hill elevation mechanic)
  // When player climbs a hill/mountain (Y elevation rises), the camera's base height remains grounded/damped
  // and tilts its pitch up to frame the character climbing upwards against the sky/hill
  private updateCamera(): void {
    if (this.gameState.isPhotoModeOpen()) {
      // Free Camera Orbit in Photo Mode
      const focusX = this.photoFocus.x;
      const focusY = this.photoFocus.y;
      const focusZ = this.photoFocus.z;

      const cosPitch = Math.cos(this.photoPitch);
      this.camera.position.x = focusX + this.photoDistance * Math.sin(this.photoYaw) * cosPitch;
      this.camera.position.y = focusY + this.photoDistance * Math.sin(this.photoPitch);
      this.camera.position.z = focusZ + this.photoDistance * Math.cos(this.photoYaw) * cosPitch;

      this.camera.lookAt(focusX, focusY, focusZ);
      return;
    }

    if (this.gameState.isDevEditorOpen() && this.gameState.isDevFreeCamera()) {
      // 3D Free Orbit Camera in Dev Map Editor Mode
      const focusX = this.devFocusPos.x;
      const focusY = this.devFocusPos.y;
      const focusZ = this.devFocusPos.z;

      const cosPitch = Math.cos(this.devPitch);
      this.camera.position.x = focusX + this.devDistance * Math.sin(this.devYaw) * cosPitch;
      this.camera.position.y = focusY + this.devDistance * Math.sin(this.devPitch);
      this.camera.position.z = focusZ + this.devDistance * Math.cos(this.devYaw) * cosPitch;

      this.camera.lookAt(focusX, focusY, focusZ);
      return;
    }

    const targetX = this.playerPos.x;
    const targetY = this.playerPos.y + 0.85;
    const targetZ = this.playerPos.z;

    const area = this.gameState.currentArea();
    const isInterior = (area === 'house' || area === 'shop');
    const camOffset = isInterior
      ? this._cachedCamOffsetHouse
      : this._cachedCamOffsetOutdoor;

    // Smoothly track target point without phase delay
    this._cachedCamTarget.set(targetX, targetY, targetZ);
    this.camLookAtTarget.lerp(this._cachedCamTarget, 0.12);

    if (isInterior) {
      // Direct dollhouse cutaway interior tracking
      this.camera.position.x = this.camLookAtTarget.x + camOffset.x;
      this.camera.position.y = this.camLookAtTarget.y + camOffset.y;
      this.camera.position.z = this.camLookAtTarget.z + camOffset.z;
    } else {
      // Tree of Tranquility outdoor hill mechanic:
      // Camera X and Z follow player, while camera Y elevation is heavily dampened (28% climb)
      // As a result, when player climbs a hill (Y > 0), the camera stays lower and tilts UP at the player!
      const hillClimbFraction = 0.28;
      this.camera.position.x = this.camLookAtTarget.x + camOffset.x;
      this.camera.position.y = camOffset.y + Math.max(0, this.camLookAtTarget.y * hillClimbFraction);
      this.camera.position.z = this.camLookAtTarget.z + camOffset.z;
    }

    this.camera.lookAt(this.camLookAtTarget);
  }

  // Dynamic Contextual Proximity Detection (All-in-One Action Button)
  private updateActionProximity(): void {
    // Throttle check to run once every 4 frames (15 Hz) to save CPU cycles
    this.actionCheckTick = (this.actionCheckTick + 1) % 4;
    if (this.actionCheckTick !== 0) return;

    const currentArea = this.gameState.currentArea();
    const currentTool = this.gameState.selectedTool();
    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    // 1. Check fixed interactive markers (Doors, Signs, Bed, Well, Pier, Bells)
    for (const marker of this.interactiveMarkers) {
      const dx = px - marker.pos.x;
      const dz = pz - marker.pos.z;
      if (dx * dx + dz * dz <= marker.radius * marker.radius) {
        this.gameState.currentAction.set(marker.context);
        return;
      }
    }

    // 2. Check Animals (Farmstead area)
    if (currentArea === 'farm') {
      for (const a of this.gameState.animals()) {
        const dx = px - a.position.x;
        const dz = pz - a.position.z;
        if (dx * dx + dz * dz <= 2.2 * 2.2) {
          this.gameState.currentAction.set({
            type: 'pet',
            label: a.pettedToday ? `ELUS / PET ${a.name}` : `RAWAT / CARE ${a.name}`,
            subLabel: a.pettedToday ? 'Sudah disayang hari ini' : 'Beri kasih sayang & ambil hasil',
            icon: 'favorite',
            targetAnimal: a
          });
          return;
        }
      }

      // 3. Check Farm Plots (Soil tiles)
      const originX = 3.5;
      const originZ = 4.0;
      for (const tile of this.gameState.farmPlots()) {
        const tileX = originX + tile.x * 1.5;
        const tileZ = originZ + tile.z * 1.5;
        const dx = px - tileX;
        const dz = pz - tileZ;
        if (dx * dx + dz * dz <= 1.4 * 1.4) {
          // Context depends on tile state & selected tool
          if (tile.crop && tile.crop.stage === 3) {
            // RIPE CROP -> HARVEST
            const cropDef = CROP_CONFIGS[tile.crop.type];
            this.gameState.currentAction.set({
              type: 'harvest',
              label: `PANEN ${cropDef.name.toUpperCase()}`,
              subLabel: `Siap dipanen! (+${cropDef.sellPrice} G)`,
              icon: 'eco',
              targetTile: tile
            });
            return;
          } else if (tile.tilled && !tile.crop && currentTool === 'seeds') {
            // Tilled earth & Seeds equipped -> PLANT
            this.gameState.currentAction.set({
              type: 'plant',
              label: 'TANAM BIBIT',
              subLabel: 'Tanam biji ke tanah gembur',
              icon: 'yard',
              targetTile: tile
            });
            return;
          } else if (tile.tilled && !tile.watered && currentTool === 'water_can') {
            // Tilled unwatered -> WATER
            this.gameState.currentAction.set({
              type: 'water',
              label: 'SIRAM AIR',
              subLabel: 'Basahi tanah agar tanaman tumbuh',
              icon: 'water_drop',
              targetTile: tile
            });
            return;
          } else if (!tile.tilled && currentTool === 'hoe') {
            // Untilled & Hoe equipped -> TILL
            this.gameState.currentAction.set({
              type: 'till',
              label: 'CANGKUL TANAH',
              subLabel: 'Gemburkan petak kebun',
              icon: 'hardware',
              targetTile: tile
            });
            return;
          } else if (tile.crop && currentTool === 'water_can' && !tile.watered) {
            // Growing crop needs water
            this.gameState.currentAction.set({
              type: 'water',
              label: 'SIRAM TANAMAN',
              subLabel: 'Beri air setiap hari',
              icon: 'water_drop',
              targetTile: tile
            });
            return;
          }
        }
      }
    }

    // Default Action state
    this.gameState.currentAction.set({
      type: 'interact',
      label: 'AKSI',
      subLabel: 'Tekan untuk aksi',
      icon: 'touch_app'
    });
  }

  // Helpers: Decorative trees, fences, signs
  private createTree(pos: THREE.Vector3, isFruitTree = false, fruitType: 'apple' | 'orange' = 'apple'): void {
    const ty = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    const tree = WorldEnvironmentBuilder.createTree(new THREE.Vector3(pos.x, ty, pos.z), 1.0, isFruitTree, fruitType);
    this.enableShadows(tree);
    tree.renderOrder = 3;
    this.areaGroup.add(tree);
  }

  private createExitSign(pos: THREE.Vector3, text: string): void {
    const sign = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(0.4);
    shadow.position.y = 0.02;
    sign.add(shadow);

    // Post rooted 30cm underground
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6),
      new THREE.MeshLambertMaterial({ color: 0x78350f })
    );
    post.position.y = 0.6;

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.45, 0.1),
      new THREE.MeshLambertMaterial({ color: 0xd97706 })
    );
    board.name = `Sign_${text}`;
    board.position.set(0, 1.2, 0);

    sign.name = text;
    sign.add(post);
    sign.add(board);

    this.enableShadows(sign, false, true);

    const sy = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    sign.position.set(pos.x, sy, pos.z);
    sign.renderOrder = 3;
    this.areaGroup.add(sign);
  }

  private createStreetlamp(pos: THREE.Vector3): void {
    const lamp = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(0.45);
    shadow.position.y = 0.02;
    lamp.add(shadow);

    // Pole rooted 30cm underground
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 3.2, 8),
      new THREE.MeshLambertMaterial({ color: 0x374151 })
    );
    pole.position.y = 1.3;
    lamp.add(pole);

    const lightBox = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.28),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    lightBox.position.y = 2.9;
    lamp.add(lightBox);

    this.enableShadows(lamp, false, true);

    const ly = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    lamp.position.set(pos.x, ly, pos.z);
    lamp.renderOrder = 3;
    this.areaGroup.add(lamp);
  }

  private createLookoutBench(pos: THREE.Vector3): void {
    const bench = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(0.9);
    shadow.scale.set(1.4, 1.0, 0.7);
    shadow.position.y = 0.02;
    bench.add(shadow);

    const seatMat = new THREE.MeshLambertMaterial({ color: 0xa16207 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.6), seatMat);
    seat.position.y = 0.45;
    bench.add(seat);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.1), seatMat);
    backrest.position.set(0, 0.75, -0.25);
    bench.add(backrest);

    for (const lx of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.5), new THREE.MeshLambertMaterial({ color: 0x451a03 }));
      leg.position.set(lx, 0.15, 0);
      bench.add(leg);
    }

    this.enableShadows(bench, false, true);

    const by = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    bench.position.set(pos.x, by, pos.z);
    bench.rotation.y = -Math.PI / 4;
    bench.renderOrder = 3;
    this.areaGroup.add(bench);
  }

  private createCrossroadsSign(pos: THREE.Vector3): void {
    const signGroup = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(0.5);
    shadow.position.y = 0.02;
    signGroup.add(shadow);

    const postMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    // Post rooted 30cm underground
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 6), postMat);
    post.position.y = 0.9;
    signGroup.add(post);

    const boardMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    // North pointer (Mother Tree)
    const boardN = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.08), boardMat);
    boardN.position.set(0, 1.6, 0.35);
    boardN.rotation.y = Math.PI / 2;
    signGroup.add(boardN);

    // East pointer (Town)
    const boardE = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.08), boardMat);
    boardE.position.set(0.35, 1.3, 0);
    signGroup.add(boardE);

    this.enableShadows(signGroup, false, true);

    const sy = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    signGroup.position.set(pos.x, sy, pos.z);
    signGroup.renderOrder = 3;
    this.areaGroup.add(signGroup);
  }

  private createHayBale(pos: THREE.Vector3): void {
    const baleGroup = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(0.7);
    shadow.position.y = 0.02;
    baleGroup.add(shadow);

    const hayMat = new THREE.MeshLambertMaterial({ color: 0xfde047 });
    const bale = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 1.2, 10),
      hayMat
    );
    bale.rotation.z = Math.PI / 2;
    bale.position.y = 0.7;
    baleGroup.add(bale);

    this.enableShadows(baleGroup, false, true);

    const hy = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    baleGroup.position.set(pos.x, hy, pos.z);
    baleGroup.renderOrder = 3;
    this.areaGroup.add(baleGroup);
  }

  private createWildflowerCluster(x: number, z: number, colorHex: number): void {
    const y = this.getFarmHeight(x, z);
    const flowerGroup = new THREE.Group();
    const petalMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const centerMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    for (let i = 0; i < 4; i++) {
      const ox = Math.sin(i * 1.5) * 0.35;
      const oz = Math.cos(i * 1.8) * 0.35;
      const fy = this.getFarmHeight(x + ox, z + oz) - y;

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.28, 4),
        new THREE.MeshLambertMaterial({ color: 0x15803d })
      );
      stem.position.set(ox, fy + 0.12, oz);
      flowerGroup.add(stem);

      const blossom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08), petalMat);
      blossom.position.set(ox, fy + 0.26, oz);
      flowerGroup.add(blossom);

      const core = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), centerMat);
      core.position.set(ox, fy + 0.27, oz);
      flowerGroup.add(core);
    }

    flowerGroup.position.set(x, y, z);
    flowerGroup.renderOrder = 3;
    this.areaGroup.add(flowerGroup);
  }

  private createFence(minX: number, maxX: number, minZ: number, maxZ: number): void {
    // Light fence posts around perimeter, rooted into ground
    const postMat = new THREE.MeshLambertMaterial({ color: 0xa16207 });

    // North & South perimeter lines
    for (let x = minX; x <= maxX; x += 3.5) {
      if (Math.abs(x) > 2.0) {
        const y1 = this.getFarmHeight(x, minZ);
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), postMat);
        p1.position.set(x, y1 + 0.45, minZ);
        p1.renderOrder = 3;
        this.areaGroup.add(p1);
      }

      const y2 = this.getFarmHeight(x, maxZ);
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), postMat);
      p2.position.set(x, y2 + 0.45, maxZ);
      p2.renderOrder = 3;
      this.areaGroup.add(p2);
    }

    // East & West perimeter lines
    for (let z = minZ; z <= maxZ; z += 3.5) {
      if (Math.abs(z) > 2.0) {
        const y1 = this.getFarmHeight(maxX, z);
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), postMat);
        p1.position.set(maxX, y1 + 0.45, z);
        p1.renderOrder = 3;
        this.areaGroup.add(p1);
      }

      const y2 = this.getFarmHeight(minX, z);
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), postMat);
      p2.position.set(minX, y2 + 0.45, z);
      p2.renderOrder = 3;
      this.areaGroup.add(p2);
    }
  }

  private createWoodenFenceEnclosure(cx: number, cz: number, w: number, d: number): void {
    const postMat = new THREE.MeshLambertMaterial({ color: 0x92400e });
    const railMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });

    const halfW = w / 2;
    const halfD = d / 2;

    // Corner posts (rooted 30cm underground)
    for (const px of [cx - halfW, cx + halfW]) {
      for (const pz of [cz - halfD, cz + halfD]) {
        const py = this.getFarmHeight(px, pz);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 6), postMat);
        post.position.set(px, py + 0.45, pz);
        post.renderOrder = 3;
        this.areaGroup.add(post);
      }
    }

    const rails = [
      new THREE.Vector3(cx, 0, cz - halfD), // back
      new THREE.Vector3(cx - halfW, 0, cz), // left
      new THREE.Vector3(cx + halfW, 0, cz)  // right
    ];

    rails.forEach((r, idx) => {
      const isZ = idx === 0;
      const ry = this.getFarmHeight(r.x, r.z);
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(isZ ? w : 0.12, 0.15, isZ ? 0.12 : d),
        railMat
      );
      rail.position.set(r.x, ry + 0.45, r.z);
      rail.renderOrder = 3;
      this.areaGroup.add(rail);
    });
  }

  public rebuildFarmPlots(): void {
    // Rebuild only the farm soil plots when player waters, tills, or harvests
    if (this.gameState.currentArea() === 'farm') {
      this.soilTileMeshes.forEach(mesh => this.areaGroup.remove(mesh));
      this.soilTileMeshes.clear();
      this.areaGroup.remove(this.farmingGridGroup);
      this.buildSoilGrid(new THREE.Vector3(3.5, 0, 4));
    }
  }

  public enterPhotoMode(): void {
    this.photoFocus.copy(this.playerPos);
    // Offset focus slightly upwards so camera is centered on player's upper body
    this.photoFocus.y += 0.85;
    this.photoDistance = 14.0;
    this.photoYaw = 0.0;
    this.photoPitch = 0.65;
  }

  public captureScreenshot(): string | null {
    if (!this.renderer || !this.scene || !this.camera) return null;
    try {
      this.renderer.render(this.scene, this.camera);
      return this.renderer.domElement.toDataURL('image/png');
    } catch (e) {
      console.error('Screenshot capture failed', e);
      return null;
    }
  }

  private buildEditorBrushRing(): void {
    const ringGeo = new THREE.RingGeometry(0.95, 1.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    this.editorBrushRing = mesh;
    this.scene.add(mesh);
  }

  public updateEditorRaycast(mouseX: number, mouseY: number, isMouseDown: boolean): void {
    if (!this.renderer || !this.scene || !this.camera || !this.terrainMesh) return;

    this.mouse.set(mouseX, mouseY);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.terrainMesh);
    if (intersects.length > 0) {
      const hit = intersects[0].point;

      if (!this.editorBrushRing) {
        this.buildEditorBrushRing();
      }
      if (this.editorBrushRing) {
        this.editorBrushRing.visible = true;
        this.editorBrushRing.position.set(hit.x, hit.y + 0.05, hit.z);
        const r = this.gameState.devBrushRadius();
        this.editorBrushRing.scale.set(r, 1, r);
      }

      if (isMouseDown) {
        const tool = this.gameState.devEditorTool();
        if (tool === 'sculpt_raise' || tool === 'sculpt_lower' || tool === 'sculpt_flatten') {
          this.sculptTerrain(hit.x, hit.z, tool === 'sculpt_raise', tool === 'sculpt_flatten');
        } else if (tool === 'place_prop') {
          this.placeDevProp(hit.x, hit.z);
        } else if (tool === 'delete_prop') {
          this.deleteDevProp(hit.x, hit.z);
        }
      }
    } else {
      if (this.editorBrushRing) {
        this.editorBrushRing.visible = false;
      }
    }
  }

  private devUndoStack: { heightMap: [string, number][]; placedProps: { type: string; x: number; z: number }[] }[] = [];
  private devRedoStack: { heightMap: [string, number][]; placedProps: { type: string; x: number; z: number }[] }[] = [];

  public saveUndoSnapshot(): void {
    const snapshot = {
      heightMap: Array.from(this.terrainHeightOffsets.entries()),
      placedProps: this.devPlacedProps.map(p => ({ type: p.type, x: p.x, z: p.z }))
    };
    this.devUndoStack.push(snapshot);
    if (this.devUndoStack.length > 25) this.devUndoStack.shift();
    this.devRedoStack = [];
  }

  public undoDevAction(): void {
    if (this.devUndoStack.length === 0) {
      this.gameState.showToast('Tidak ada histori Undo.');
      return;
    }
    const currentSnapshot = {
      heightMap: Array.from(this.terrainHeightOffsets.entries()),
      placedProps: this.devPlacedProps.map(p => ({ type: p.type, x: p.x, z: p.z }))
    };
    this.devRedoStack.push(currentSnapshot);

    const prev = this.devUndoStack.pop()!;
    this.terrainHeightOffsets = new Map(prev.heightMap);
    this.applyHeightmapToTerrain();
    this.rebuildPlacedProps(prev.placedProps);
    this.gameState.showToast('↩️ Undo berhasil diterapkan!');
  }

  public redoDevAction(): void {
    if (this.devRedoStack.length === 0) {
      this.gameState.showToast('Tidak ada histori Redo.');
      return;
    }
    const currentSnapshot = {
      heightMap: Array.from(this.terrainHeightOffsets.entries()),
      placedProps: this.devPlacedProps.map(p => ({ type: p.type, x: p.x, z: p.z }))
    };
    this.devUndoStack.push(currentSnapshot);

    const next = this.devRedoStack.pop()!;
    this.terrainHeightOffsets = new Map(next.heightMap);
    this.applyHeightmapToTerrain();
    this.rebuildPlacedProps(next.placedProps);
    this.gameState.showToast('↪️ Redo berhasil diterapkan!');
  }

  public resetDevMap(): void {
    this.saveUndoSnapshot();
    this.terrainHeightOffsets.clear();
    this.applyHeightmapToTerrain();
    this.devPlacedProps.forEach(p => this.scene.remove(p.mesh));
    this.devPlacedProps = [];
    this.gameState.showToast('🧹 Peta berhasil direset ke standar!');
  }

  private applyHeightmapToTerrain(): void {
    if (this.terrainMesh && this.terrainMesh.geometry) {
      const geo = this.terrainMesh.geometry as THREE.BufferGeometry;
      const posAttr = geo.attributes['position'];
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        posAttr.setY(i, this.getFarmHeight(vx, vz));
      }
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
    }
    this.updateTerrainConformingGrid();
    this.updateWaterMeshGeometry();
    this.updatePlacedPropsHeight();
  }

  private updateWaterMeshGeometry(): void {
    if (this.waterPlane && this.waterPlane.geometry) {
      const geo = this.waterPlane.geometry as THREE.BufferGeometry;
      const posAttr = geo.attributes['position'];
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        const riverCenterBaseY = this.getFarmHeight(vx, vz);
        posAttr.setY(i, riverCenterBaseY - 0.22);
      }
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
    }
  }

  private updatePlacedPropsHeight(): void {
    this.devPlacedProps.forEach(p => {
      const newY = this.getFarmHeight(p.x, p.z);
      p.mesh.position.y = newY;
    });
  }

  private rebuildPlacedProps(propsData: { type: string; x: number; z: number }[]): void {
    this.devPlacedProps.forEach(p => this.scene.remove(p.mesh));
    this.devPlacedProps = [];
    propsData.forEach(p => {
      this.gameState.setDevSelectedProp(p.type);
      this.placeDevProp(p.x, p.z);
    });
  }

  public sculptTerrain(centerX: number, centerZ: number, isRaise: boolean, isFlatten = false): void {
    const radius = this.gameState.devBrushRadius();
    const targetHeight = isFlatten ? this.getFarmHeight(centerX, centerZ) : 0;
    const strength = this.gameState.devBrushStrength() * (isRaise ? 1 : -1) * 0.4;

    for (let dx = -Math.ceil(radius); dx <= radius; dx++) {
      for (let dz = -Math.ceil(radius); dz <= radius; dz++) {
        const gx = Math.round(centerX + dx);
        const gz = Math.round(centerZ + dz);
        const dist = Math.hypot(gx - centerX, gz - centerZ);
        if (dist <= radius) {
          const factor = (1.0 - dist / radius);
          const smoothFactor = factor * factor * (3.0 - 2.0 * factor);
          const gridKey = `${gx},${gz}`;
          const current = this.terrainHeightOffsets.get(gridKey) || 0;
          if (isFlatten) {
            const baseH = this.getTerrainBaseHeight(gx, gz);
            const neededOffset = targetHeight - baseH;
            const lerped = THREE.MathUtils.lerp(current, neededOffset, this.gameState.devBrushStrength() * smoothFactor);
            this.terrainHeightOffsets.set(gridKey, lerped);
          } else {
            this.terrainHeightOffsets.set(gridKey, current + strength * smoothFactor);
          }
        }
      }
    }

    this.applyHeightmapToTerrain();
  }

  public placeDevProp(x: number, z: number): void {
    const near = this.devPlacedProps.some(p => Math.hypot(p.x - x, p.z - z) < 1.0);
    if (near) return;

    const propType = this.gameState.devSelectedProp();
    const y = this.getFarmHeight(x, z);
    let propMesh: THREE.Object3D | null = null;

    if (propType === 'maple_tree') {
      propMesh = WorldEnvironmentBuilder.createTree(new THREE.Vector3(x, y, z), 1.0, false);
    } else if (propType === 'pine_tree') {
      propMesh = WorldEnvironmentBuilder.createTree(new THREE.Vector3(x, y, z), 1.15, true);
    } else if (propType === 'bush') {
      const bGroup = new THREE.Group();
      const bushMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0x22c55e,
        bottomColor: 0x14532d,
        topColor: 0x4ade80,
        minY: -0.5,
        maxY: 0.5
      });
      const bushMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7), bushMat);
      bushMesh.position.set(0, 0.5, 0);
      bGroup.add(bushMesh);
      bGroup.position.set(x, y, z);
      propMesh = bGroup;
    } else if (propType === 'wildflower') {
      const fGroup = new THREE.Group();
      const flower = WorldEnvironmentBuilder.createMushroom(new THREE.Vector3(0, 0, 0), 1.2);
      fGroup.add(flower);
      fGroup.position.set(x, y, z);
      propMesh = fGroup;
    } else if (propType === 'rustic_fence') {
      const fenceGroup = new THREE.Group();
      const woodMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0xca8a04,
        bottomColor: 0x713f12,
        topColor: 0xeab308,
        minY: 0,
        maxY: 1.2
      });
      const postGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
      const post1 = new THREE.Mesh(postGeo, woodMat); post1.position.set(-0.6, 0.55, 0); fenceGroup.add(post1);
      const post2 = new THREE.Mesh(postGeo, woodMat); post2.position.set(0.6, 0.55, 0); fenceGroup.add(post2);
      const railGeo = new THREE.BoxGeometry(1.3, 0.08, 0.08);
      const rail1 = new THREE.Mesh(railGeo, woodMat); rail1.position.set(0, 0.8, 0); fenceGroup.add(rail1);
      const rail2 = new THREE.Mesh(railGeo, woodMat); rail2.position.set(0, 0.4, 0); fenceGroup.add(rail2);
      fenceGroup.position.set(x, y, z);
      propMesh = fenceGroup;
    } else if (propType === 'bench') {
      propMesh = WorldEnvironmentBuilder.buildMergedBench(new THREE.Vector3(x, y, z), 0);
    } else if (propType === 'boulder') {
      propMesh = WorldEnvironmentBuilder.createRock(new THREE.Vector3(x, y, z), 1.3);
    } else if (propType === 'hay_bale') {
      const hGroup = new THREE.Group();
      const hayMat = WorldEnvironmentBuilder.createGradientMaterial({
        color: 0xfacc15,
        bottomColor: 0xca8a04,
        topColor: 0xfef08a,
        minY: -0.5,
        maxY: 0.5
      });
      const hayMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 8), hayMat);
      hayMesh.rotation.z = Math.PI / 2;
      hayMesh.position.set(0, 0.6, 0);
      hGroup.add(hayMesh);
      hGroup.position.set(x, y, z);
      propMesh = hGroup;
    } else if (propType === 'streetlamp') {
      propMesh = WorldEnvironmentBuilder.buildMergedStreetlamps([new THREE.Vector3(x, y, z)]);
    } else if (propType === 'shipping_bin') {
      this.buildShippingBin(new THREE.Vector3(x, y, z));
      return;
    } else if (propType === 'water_well') {
      this.buildWaterWell(new THREE.Vector3(x, y, z));
      return;
    } else if (propType === 'watermill') {
      this.buildWaterwheel(new THREE.Vector3(x, y, z));
      return;
    }

    if (propMesh) {
      this.enableShadows(propMesh);
      this.scene.add(propMesh);
      this.devPlacedProps.push({ mesh: propMesh, type: propType, x, z });
      this.audio.playPlant();
    }
  }

  public deleteDevProp(x: number, z: number): void {
    const idx = this.devPlacedProps.findIndex(p => Math.hypot(p.x - x, p.z - z) < 1.5);
    if (idx !== -1) {
      const p = this.devPlacedProps[idx];
      this.scene.remove(p.mesh);
      this.devPlacedProps.splice(idx, 1);
      this.audio.playSelect();
    }
  }

  public exitDevEditor(): void {
    if (this.editorBrushRing) {
      this.editorBrushRing.visible = false;
    }
    this.toggleDevGrid(false);
  }

  private devTerrainGridMesh?: THREE.LineSegments;

  public toggleDevGrid(visible: boolean): void {
    if (!this.scene) return;

    if (visible) {
      if (!this.devTerrainGridMesh) {
        const gridGeo = new THREE.PlaneGeometry(72, 72, 72, 72);
        gridGeo.rotateX(-Math.PI / 2);
        const wireframeGeo = new THREE.WireframeGeometry(gridGeo);
        const wireframeMat = new THREE.LineBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.55
        });
        this.devTerrainGridMesh = new THREE.LineSegments(wireframeGeo, wireframeMat);
        this.scene.add(this.devTerrainGridMesh);
      }
      this.updateTerrainConformingGrid();
      this.devTerrainGridMesh.visible = true;
    } else {
      if (this.devTerrainGridMesh) {
        this.devTerrainGridMesh.visible = false;
      }
    }
  }

  private updateTerrainConformingGrid(): void {
    if (!this.devTerrainGridMesh) return;
    const lineGeo = this.devTerrainGridMesh.geometry as THREE.BufferGeometry;
    const posAttr = lineGeo.attributes['position'];
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = this.getFarmHeight(vx, vz) + 0.05;
      posAttr.setY(i, vy);
    }
    posAttr.needsUpdate = true;
  }

  public async exportMapData(): Promise<void> {
    const payload = {
      mapName: 'Solaria Custom Map',
      terrainHeightOffsets: Array.from(this.terrainHeightOffsets.entries()),
      placedProps: this.devPlacedProps.map(p => ({ type: p.type, x: p.x, z: p.z }))
    };

    try {
      // 1. Try Backend Express API Download Endpoint
      const response = await fetch('/api/map/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const blob = await response.blob();
        const link = document.createElement('a');
        const contentDisp = response.headers.get('Content-Disposition');
        let filename = `Solaria_Map_${Date.now()}.json`;
        if (contentDisp && contentDisp.includes('filename=')) {
          filename = contentDisp.split('filename=')[1].replace(/"/g, '');
        }
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.gameState.showToast('📥 Peta berhasil diekspor via Backend API!');
        return;
      }
    } catch (e) {
      console.warn('Backend API download fallback to client blob:', e);
    }

    // 2. Client-side fallback
    try {
      const exportData = {
        ...payload,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.download = `Solaria_Map_${Date.now()}.json`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.gameState.showToast('📥 Peta berhasil diekspor sebagai JSON!');
    } catch {
      this.gameState.showToast('Gagal mengekspor data peta.');
    }
  }

  public importMapData(jsonString: string): void {
    try {
      const data = JSON.parse(jsonString);
      if (data.terrainHeightOffsets) {
        this.terrainHeightOffsets = new Map(data.terrainHeightOffsets);
      }
      this.devPlacedProps.forEach(p => this.scene.remove(p.mesh));
      this.devPlacedProps = [];

      if (data.placedProps) {
        data.placedProps.forEach((p: { type: string; x: number; z: number }) => {
          this.gameState.setDevSelectedProp(p.type);
          this.placeDevProp(p.x, p.z);
        });
      }

      if (this.terrainMesh && this.terrainMesh.geometry) {
        const geo = this.terrainMesh.geometry as THREE.BufferGeometry;
        const posAttr = geo.attributes['position'];
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vz = posAttr.getZ(i);
          posAttr.setY(i, this.getFarmHeight(vx, vz));
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();
      }

      this.gameState.showToast('📥 Peta kustom berhasil dimuat!');
    } catch {
      this.gameState.showToast('Gagal mengimpor file JSON peta.');
    }
  }

  // =========================================================================
  // PROCEDURAL TEXTURE GENERATORS (Modular & High Definition)
  // =========================================================================
  private initTextures(): void {
    const tex = this.assetCache.getLoadedTextureSet();
    if (tex.grassTexture) this.grassTexture = tex.grassTexture;
    if (tex.soilGroundTexture) this.soilGroundTexture = tex.soilGroundTexture;
    if (tex.noiseTexture) this.noiseTexture = tex.noiseTexture;
    if (tex.roadTexture) this.roadTexture = tex.roadTexture;
    if (tex.roadEastTexture) this.roadEastTexture = tex.roadEastTexture;
    if (tex.townGroundTexture) this.townGroundTexture = tex.townGroundTexture;
    if (tex.woodFloorTexture) this.woodFloorTexture = tex.woodFloorTexture;
    if (tex.soilTilledTexture) this.soilTilledTexture = tex.soilTilledTexture;
    if (tex.soilWateredTexture) this.soilWateredTexture = tex.soilWateredTexture;
  }
}

export const world3dService = new World3dService();

