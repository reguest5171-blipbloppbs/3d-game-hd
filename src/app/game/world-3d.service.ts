import { Injectable, inject } from '@angular/core';
import * as THREE from 'three';
import { ActionContext, AreaId } from '../models/game.models';
import { CROP_CONFIGS, GameStateService } from '../services/game-state.service';
import { WorldTexturesGenerator } from './world-textures';
import { WorldEnvironmentBuilder } from './world-environment';

@Injectable({
  providedIn: 'root'
})
export class World3dService {
  private gameState = inject(GameStateService);

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private container!: HTMLElement;

  // Animation & loop
  private animFrameId: number | null = null;
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

  // Procedural Canvas Textures for Rich Visual Surfaces
  private grassTexture?: THREE.CanvasTexture;
  private roadTexture?: THREE.CanvasTexture;
  private roadEastTexture?: THREE.CanvasTexture;
  private townGroundTexture?: THREE.CanvasTexture;
  private woodFloorTexture?: THREE.CanvasTexture;
  private soilTilledTexture?: THREE.CanvasTexture;
  private soilWateredTexture?: THREE.CanvasTexture;

  public init(canvasContainer: HTMLElement): void {
    this.container = canvasContainer;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbebf5); // Morning sky pastel (06:26 AM)
    this.scene.fog = new THREE.FogExp2(0xdbebf5, 0.015); // Soft morning horizon haze

    // 2. Camera: Classic Tree of Tranquility angle (38° tilt)
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    // Set near plane to 0.8m to eliminate Z-buffer precision loss and surface fighting
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.8, 120);
    this.camera.position.set(0, 8.5, 9.5);
    this.camera.lookAt(0, 1.0, 0);

    // 3. Renderer with High-Precision Depth Buffer & Real-time Soft Shadow Map
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
      precision: 'highp',
      preserveDrawingBuffer: true
    });
    // Clamp pixel ratio to max 1.25 to prevent low-end mobile thermal choking
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    // Directional Sun Light with Warm Morning Sun Color (0xfff0dd) & Low Angle
    this.sunLight = new THREE.DirectionalLight(0xfff0dd, 1.18);
    this.sunLight.position.set(22, 7.5, 14); // Low morning sun angle
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 65;
    this.sunLight.shadow.camera.left = -16;
    this.sunLight.shadow.camera.right = 16;
    this.sunLight.shadow.camera.top = 16;
    this.sunLight.shadow.camera.bottom = -16;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 1.5;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Initial atmospheric lighting pass based on in-game clock (e.g. 06:38 AM)
    this.updateAtmosphericLighting();

    // 5. Add Area group & Player group
    this.scene.add(this.areaGroup);
    this.createPlayerMesh();

    // 6. Build initial area
    this.buildCurrentArea(this.gameState.currentArea());

    // 7. Start render loop
    this.animate();

    // 8. Handle resize
    window.addEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = (): void => {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.setSize(w, h);
  };

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
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

  // CONTINUOUS SMOOTH TERRAIN ELEVATION (Anti-Boxy, Smooth Rolling Hills)
  public getFarmHeight(x: number, z: number): number {
    // 1. Strict Flat Mask for Crop Field (petak tanam tetap rata sempurna)
    // Plots span x: [3.5, 9.5], z: [4.0, 8.5]
    const fieldMinX = 2.4;
    const fieldMaxX = 10.6;
    const fieldMinZ = 2.8;
    const fieldMaxZ = 9.8;
    const fdx = Math.max(0, Math.max(fieldMinX - x, x - fieldMaxX));
    const fdz = Math.max(0, Math.max(fieldMinZ - z, z - fieldMaxZ));
    const distField = Math.hypot(fdx, fdz);

    // Quintic Hermite curve: zero 1st and 2nd derivatives at borders
    // Guarantees zero step, zero crease, and pure organic rounded transition!
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

    // A. North Mountain Ascent (bukit jalan menanjak ke arah Whispering Mother Tree & North Backdrop)
    // Ascends smoothly from z = -2.0 to z = -36.0, reaching up to +10.9m at northern peak
    if (z < -2.0) {
      const nz = Math.abs(z - (-2.0));
      const nt = Math.min(1, nz / 30.0);
      // Smooth continuous mountain rise (smooth cubic ease)
      h += nt * nt * (3.0 - 1.1 * nt) * 5.8;
      if (z < -26.0) {
        const extraN = Math.abs(z - (-26.0)) / 10.0;
        h += extraN * extraN * 5.1; // Seamlessly connects terrain with Mountain Backdrop (Y = 10.9)
      }
    }

    // Outer Boundary Wall Elevations (Sisi Selatan, Timur & Barat)
    if (z > 26.0) {
      const extraS = (z - 26.0) / 10.0;
      h += extraS * extraS * 3.8; // South cliff wall elevation
    }
    if (Math.abs(x) > 26.0) {
      const extraX = (Math.abs(x) - 26.0) / 10.0;
      h += extraX * extraX * 2.8; // West & East forest ridge elevation
    }

    // B. North-East Windmill Hill Terrace (bukit kincir angin dengan lereng membulat halus)
    const wmDist = Math.hypot(x - 22.0, z - (-16.0));
    if (wmDist < 19.0) {
      const wt = 1.0 - wmDist / 19.0;
      // Dome elevation up to 4.8m
      h += wt * wt * wt * (10 - 15 * wt + 6 * wt * wt) * 4.8;
    }

    // C. South Scenic Bluff / Ocean Lookout Hill (bukit panorama selatan menanjak)
    const sDist = Math.hypot(x - 20.0, z - 22.0);
    if (sDist < 17.0) {
      const st = 1.0 - sDist / 17.0;
      h += st * st * (3.0 - 2.0 * st) * 3.6;
    }

    // D. South-West Rolling Ridge (lereng padang rumput barat daya)
    const swDist = Math.hypot(x - (-22.0), z - 20.0);
    if (swDist < 16.0) {
      const swt = 1.0 - swDist / 16.0;
      h += swt * swt * (3.0 - 2.0 * swt) * 3.2;
    }

    // E. West Pasture Rolling Knolls (padang rumput peternakan berkontur alami)
    const pDist = Math.hypot(x - (-19.0), z - (-2.0));
    if (pDist < 17.0) {
      const pt = 1.0 - pDist / 17.0;
      h += pt * pt * (3.0 - 2.0 * pt) * 2.2;
    }

    // F. North-West Forest Foothills (lereng hutan pinus barat laut)
    const nwDist = Math.hypot(x - (-20.0), z - (-20.0));
    if (nwDist < 18.0) {
      const nwt = 1.0 - nwDist / 18.0;
      h += nwt * nwt * (3.0 - 2.0 * nwt) * 4.2;
    }

    // G. Natural Organic Undulation across open grass (permukaan tanah tidak rata & bergelombang alami)
    // Non-repeating multiple harmonic organic waves
    h += Math.sin(x * 0.14 + 0.3) * Math.cos(z * 0.12) * 0.42;
    h += Math.sin(x * 0.28 - z * 0.22 + 1.1) * 0.26;
    h += Math.cos(x * 0.08 + z * 0.16) * 0.32;
    h += Math.sin(x * 0.45 + z * 0.38) * 0.14;

    // Apply strict flat masks so only petak tanam and house entrance remain completely flat
    h = h * smoothField * smoothHouse;

    return Math.max(0, h);
  }

  // AREA 1: SOLARIA FARMSTEAD (EXPANDED & ROLLING SMOOTH HILLS)
  private buildFarmsteadArea(): void {
    // 1. High-Density Smooth Terrain Mesh with Multi-Biome Organic Ground Shading (Meadow, Earth, Stone)
    const terrainSize = 92;
    const terrainSegs = 90;
    const groundGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
    groundGeo.rotateX(-Math.PI / 2); // Make XZ plane with +Y up

    const posAttr = groundGeo.attributes['position'];
    const colors: number[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = this.getFarmHeight(vx, vz);
      posAttr.setY(i, vy);

      // A. Multi-frequency Biome Noise for Meadow Grass Variegation
      const nMeadow = Math.sin(vx * 0.055) * Math.cos(vz * 0.055);
      const nMeadowFine = Math.sin(vx * 0.16 + 1.8) * Math.cos(vz * 0.15 - 1.2) * 0.5;
      const nEarth = Math.sin(vx * 0.13 + 1.2) * Math.cos(vz * 0.12 - 0.7) + Math.sin(vx * 0.06 - vz * 0.08) * 0.5;
      const nStone = Math.sin(vx * 0.22 - 0.5) * Math.cos(vz * 0.24 + 1.1) * 0.5;

      // Micro-Noise Grass Variation (Sun-dappled lime, spring clover, and golden meadow tones)
      const microNoise = Math.sin(vx * 0.85 + vz * 0.65) * 0.05 + Math.cos(vx * 1.5 - vz * 1.3) * 0.035;

      // Base Grass Green tones: Deep lush clover (#3b8c20), warm meadow (#58ad28), sunny golden lime (#7ecf38)
      let r = 0.35 + nMeadow * 0.10 + nMeadowFine * 0.06 + microNoise * 0.5;
      let g = 0.68 + nMeadow * 0.12 + nMeadowFine * 0.08 + microNoise * 0.6;
      let b = 0.18 + nMeadow * 0.05 + nMeadowFine * 0.03 + microNoise * 0.2;

      // B. Organic Exposed Earth / Sandy Loam Patches with Feathered Grass Fleck Dither
      if (nEarth > 0.18) {
        // High-frequency grass dither noise for soft organic transition without sharp straight cuts
        const noiseFleck = Math.sin(vx * 2.8 + vz * 3.2) * 0.16 + Math.cos(vx * 4.2 - vz * 3.8) * 0.10;
        let earthBlend = Math.min(1, (nEarth - 0.18) / 0.45);
        earthBlend = Math.max(0, Math.min(1, earthBlend + noiseFleck));

        const earthR = 0.68;
        const earthG = 0.50;
        const earthB = 0.30;
        r = r * (1 - earthBlend) + earthR * earthBlend;
        g = g * (1 - earthBlend) + earthG * earthBlend;
        b = b * (1 - earthBlend) + earthB * earthBlend;
      }

      // Natural soft earth tint along path borders (subtle feathering under road edges)
      const distCross = Math.hypot(vx, vz - 1.0);
      const distNorthPath = Math.abs(vx);
      const distEastPath = Math.abs(vz);
      if (distCross < 3.2) {
        const crossBlend = (1.0 - distCross / 3.2) * 0.4;
        r = r * (1 - crossBlend) + 0.65 * crossBlend;
        g = g * (1 - crossBlend) + 0.50 * crossBlend;
        b = b * (1 - crossBlend) + 0.32 * crossBlend;
      }
      if (distNorthPath < 2.4 && vz < 0 && vz > -31.0) {
        const pathBlend = (1.0 - distNorthPath / 2.4) * 0.35;
        r = r * (1 - pathBlend) + 0.62 * pathBlend;
        g = g * (1 - pathBlend) + 0.48 * pathBlend;
        b = b * (1 - pathBlend) + 0.32 * pathBlend;
      }
      if (distEastPath < 2.4 && vx > 0 && vx < 31.0) {
        const pathBlend = (1.0 - distEastPath / 2.4) * 0.35;
        r = r * (1 - pathBlend) + 0.62 * pathBlend;
        g = g * (1 - pathBlend) + 0.48 * pathBlend;
        b = b * (1 - pathBlend) + 0.32 * pathBlend;
      }

      // C. High Slopes & Rocky Ridge Tints + Valley/Ceruk Shadowing (Ilusi Kedalaman Alami)
      if (vy > 0.15 && vy < 3.2) {
        // Darken terrain in valley/ceruk areas at slope foot transitions
        const valleyFactor = 0.74 + 0.26 * Math.min(1.0, Math.abs(vy - 1.2) / 1.5);
        r *= valleyFactor;
        g *= valleyFactor;
        b *= valleyFactor;
      }

      if (vy > 1.6) {
        const slopeBlend = Math.min(0.70, (vy - 1.6) / 3.8 + nStone * 0.22);
        if (slopeBlend > 0) {
          const stoneR = 0.52;
          const stoneG = 0.56;
          const stoneB = 0.50;
          r = r * (1 - slopeBlend) + stoneR * slopeBlend;
          g = g * (1 - slopeBlend) + stoneG * slopeBlend;
          b = b * (1 - slopeBlend) + stoneB * slopeBlend;
        }
      }

      // D. Vertex Ambient Occlusion (Gentle contact darkening near base of buildings & edges)
      const distHouse = Math.hypot(vx, vz - (-4.5));
      if (distHouse < 5.0) {
        const aoFactor = 0.80 + 0.20 * (distHouse / 5.0);
        r *= aoFactor;
        g *= aoFactor;
        b *= aoFactor;
      }

      const distBarn = Math.hypot(vx - (-18.0), vz - 2.0);
      if (distBarn < 5.5) {
        const aoFactor = 0.80 + 0.20 * (distBarn / 5.5);
        r *= aoFactor;
        g *= aoFactor;
        b *= aoFactor;
      }

      const distWindmill = Math.hypot(vx - 22.0, vz - (-16.0));
      if (distWindmill < 4.0) {
        const aoFactor = 0.82 + 0.18 * (distWindmill / 4.0);
        r *= aoFactor;
        g *= aoFactor;
        b *= aoFactor;
      }

      colors.push(r, g, b);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals(); // Silky smooth lighting, completely anti-boxy!

    const groundMat = new THREE.MeshLambertMaterial({
      map: this.grassTexture,
      vertexColors: true,
      flatShading: false
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    ground.renderOrder = 0;
    this.areaGroup.add(ground);

    // 2. Smooth Conforming Cobblestone & Dirt Roads with Feathered Alpha Blending (Seamless Grass Transition)
    const roadElevation = 0.065;
    const pathMat = new THREE.MeshLambertMaterial({
      map: this.roadTexture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.005,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0
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
      polygonOffsetUnits: -4.0
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
    const crossMesh = new THREE.Mesh(crossRoadGeo, pathMat);
    crossMesh.receiveShadow = true;
    crossMesh.renderOrder = 2;
    this.areaGroup.add(crossMesh);

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
    const northMesh = new THREE.Mesh(northRoadGeo, pathMat);
    northMesh.receiveShadow = true;
    northMesh.renderOrder = 2;
    this.areaGroup.add(northMesh);

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

    // D. Winding Climbing Path to Windmill Hill (branches cleanly off East Road at x = 3.5)
    const wmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(3.5, 0, 0),
      new THREE.Vector3(8.0, 0, -3.5),
      new THREE.Vector3(13.0, 0, -8.0),
      new THREE.Vector3(17.5, 0, -12.0),
      new THREE.Vector3(21.5, 0, -15.5)
    ]);
    const wmPoints = wmCurve.getPoints(36);
    const wmVertices: number[] = [];
    const wmUvs: number[] = [];
    const wmIndices: number[] = [];
    const roadWidth = 2.8;

    let cumulativeWmDist = 0;
    for (let i = 0; i < wmPoints.length; i++) {
      const p = wmPoints[i];
      let tangent = new THREE.Vector3(1, 0, 0);
      if (i < wmPoints.length - 1) {
        tangent = wmPoints[i + 1].clone().sub(p).normalize();
        if (i > 0) {
          cumulativeWmDist += p.distanceTo(wmPoints[i - 1]);
        }
      } else {
        tangent = p.clone().sub(wmPoints[i - 1]).normalize();
        cumulativeWmDist += p.distanceTo(wmPoints[i - 1]);
      }
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(roadWidth * 0.5);

      const leftX = p.x - normal.x;
      const leftZ = p.z - normal.z;
      const leftY = this.getFarmHeight(leftX, leftZ) + roadElevation;

      const rightX = p.x + normal.x;
      const rightZ = p.z + normal.z;
      const rightY = this.getFarmHeight(rightX, rightZ) + roadElevation;

      wmVertices.push(leftX, leftY, leftZ);
      wmVertices.push(rightX, rightY, rightZ);

      const v = cumulativeWmDist / 2.6;
      wmUvs.push(0, v);
      wmUvs.push(1, v);

      if (i < wmPoints.length - 1) {
        const base = i * 2;
        wmIndices.push(base, base + 1, base + 2);
        wmIndices.push(base + 1, base + 3, base + 2);
      }
    }

    const wmRoadGeo = new THREE.BufferGeometry();
    wmRoadGeo.setAttribute('position', new THREE.Float32BufferAttribute(wmVertices, 3));
    wmRoadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wmUvs, 2));
    wmRoadGeo.setIndex(wmIndices);
    wmRoadGeo.computeVertexNormals();
    const wmMesh = new THREE.Mesh(wmRoadGeo, pathMat);
    wmMesh.receiveShadow = true;
    wmMesh.renderOrder = 2;
    this.areaGroup.add(wmMesh);

    // E. Scenic Climbing Path to South Lookout Bluff (routed cleanly around the crop field perimeter with generous clearance)
    const sCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 3.5),
      new THREE.Vector3(-0.2, 0, 7.5),
      new THREE.Vector3(0.5, 0, 11.8),
      new THREE.Vector3(4.5, 0, 14.8),
      new THREE.Vector3(10.5, 0, 17.5),
      new THREE.Vector3(18.5, 0, 21.0)
    ]);
    const sPoints = sCurve.getPoints(32);
    const sVertices: number[] = [];
    const sUvs: number[] = [];
    const sIndices: number[] = [];

    let cumulativeSDist = 0;
    for (let i = 0; i < sPoints.length; i++) {
      const p = sPoints[i];
      let tangent = new THREE.Vector3(1, 0, 0);
      if (i < sPoints.length - 1) {
        tangent = sPoints[i + 1].clone().sub(p).normalize();
        if (i > 0) {
          cumulativeSDist += p.distanceTo(sPoints[i - 1]);
        }
      } else {
        tangent = p.clone().sub(sPoints[i - 1]).normalize();
        cumulativeSDist += p.distanceTo(sPoints[i - 1]);
      }
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(roadWidth * 0.5);

      const leftX = p.x - normal.x;
      const leftZ = p.z - normal.z;
      const leftY = this.getFarmHeight(leftX, leftZ) + roadElevation;

      const rightX = p.x + normal.x;
      const rightZ = p.z + normal.z;
      const rightY = this.getFarmHeight(rightX, rightZ) + roadElevation;

      sVertices.push(leftX, leftY, leftZ);
      sVertices.push(rightX, rightY, rightZ);

      const v = cumulativeSDist / 2.6;
      sUvs.push(0, v);
      sUvs.push(1, v);

      if (i < sPoints.length - 1) {
        const base = i * 2;
        sIndices.push(base, base + 1, base + 2);
        sIndices.push(base + 1, base + 3, base + 2);
      }
    }

    const sRoadGeo = new THREE.BufferGeometry();
    sRoadGeo.setAttribute('position', new THREE.Float32BufferAttribute(sVertices, 3));
    sRoadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sUvs, 2));
    sRoadGeo.setIndex(sIndices);
    sRoadGeo.computeVertexNormals();
    const sMesh = new THREE.Mesh(sRoadGeo, pathMat);
    sMesh.receiveShadow = true;
    sMesh.renderOrder = 2;
    this.areaGroup.add(sMesh);

    // 3. Farmhouse Exterior (at gentle flat baseline)
    const houseGroup = new THREE.Group();

    // Contact AO Shadow
    const houseShadow = WorldEnvironmentBuilder.createContactShadowAO(4.5);
    houseShadow.position.y = 0.02;
    houseGroup.add(houseShadow);

    const houseBaseMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xffedd5,
      bottomColor: 0xd4a373,
      topColor: 0xfff7ed,
      minY: -1.75,
      maxY: 1.75
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
      maxY: 1.25
    });
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(5.2, 2.5, 4),
      roofMat
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 4.4, 0);
    houseGroup.add(roof);

    const doorMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x78350f,
      bottomColor: 0x451a03,
      topColor: 0x92400e,
      minY: -1.0,
      maxY: 1.0
    });
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.0, 0.1),
      doorMat
    );
    door.position.set(0, 1.0, 2.3);
    houseGroup.add(door);

    const porchMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xa16207,
      bottomColor: 0x713f12,
      topColor: 0xca8a04,
      minY: -0.1,
      maxY: 0.1
    });
    const porch = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.2, 1.5),
      porchMat
    );
    porch.position.set(0, 0.1, 2.9);
    houseGroup.add(porch);

    const chimneyMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x9ca3af,
      bottomColor: 0x475569,
      topColor: 0xcfd8dc,
      minY: -1.0,
      maxY: 1.0
    });
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 2.0, 0.8),
      chimneyMat
    );
    chimney.position.set(2, 4.2, -1);
    houseGroup.add(chimney);

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
    this.createExitSign(new THREE.Vector3(29.0, townExitY, -1.8), 'Town');

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
    this.createExitSign(new THREE.Vector3(-2.2, treeExitY, -29.0), 'Mother Tree');

    // 6. Farm Soil Field (Level & flat at y = 0)
    this.buildSoilGrid(new THREE.Vector3(3.5, 0, 4.0));

    // 7. Expanded Rolling Pasture & Barn on the West (Pasture knoll at x = -18.0)
    this.buildPastureAndAnimals(new THREE.Vector3(-18.0, 0, 2.0));

    // 8. Shipping Bin (placed near farmhouse and crop field)
    this.buildShippingBin(new THREE.Vector3(2.5, 0, 0.8));

    // 9. Water Well (placed conveniently by the path)
    this.buildWaterWell(new THREE.Vector3(-3.2, 0, 0.8));

    // 10. Windmill atop the Scenic North-East Hill (Elevated Hill Terrace)
    this.buildWindmill(new THREE.Vector3(22.0, 0, -16.0));

    // 11. South Lookout Bluff Bench (Bangku Panorama Selatan Menghadap Laut)
    this.createLookoutBench(new THREE.Vector3(20.0, this.getFarmHeight(20.0, 22.0), 22.0));

    // 12. Crossroads Signpost
    this.createCrossroadsSign(new THREE.Vector3(2.0, this.getFarmHeight(2.0, 1.2), 1.2));

    // 13. Rustic Hay Bales in Pasture
    this.createHayBale(new THREE.Vector3(-14.0, this.getFarmHeight(-14.0, -2.5), -2.5));
    this.createHayBale(new THREE.Vector3(-12.5, this.getFarmHeight(-12.5, -3.2), -3.2));

    // 14. Wildflower Clusters on Rolling Slopes (InstancedMesh Batch)
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
      { x: -4.0, z: -25.0, col: 0x818cf8 }
    ];
    const instancedFlowers = WorldEnvironmentBuilder.buildInstancedWildflowers(
      flowerSpots,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedFlowers);

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
    this.createStreetlamp(new THREE.Vector3(-2.0, this.getFarmHeight(-2.0, -10.0), -10.0));
    this.createStreetlamp(new THREE.Vector3(2.0, this.getFarmHeight(2.0, -20.0), -20.0));
    this.createStreetlamp(new THREE.Vector3(-2.0, this.getFarmHeight(-2.0, -28.0), -28.0));

    // 17. Expanded Perimeter Boundary Fences (InstancedMesh Batch)
    const instancedFences = WorldEnvironmentBuilder.buildInstancedFences(
      -34,
      34,
      -34,
      34,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedFences);

    // 18. Random 3D Stylized Grass Tufts across Farmstead Meadow (InstancedMesh Batch)
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
      { x: -17, z: 26 }, { x: 7, z: 10 }, { x: 25, z: 2 }, { x: 23, z: -22 }
    ];
    const instancedGrass = WorldEnvironmentBuilder.buildInstancedGrassTufts(
      grassSeeds,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedGrass);

    // 19. Random 3D Stylized Fluffy Bushes across Rolling Hills (InstancedMesh Batch)
    const bushSeeds = [
      { x: -9, z: -14, b: true }, { x: -14, z: -20, b: false }, { x: -6, z: -24, b: true },
      { x: 5, z: -20, b: false }, { x: 12, z: -23, b: true }, { x: 18, z: -22, b: false },
      { x: 26, z: -14, b: true }, { x: 28, z: -5, b: false }, { x: 24, z: 5, b: true },
      { x: 28, z: 12, b: false }, { x: 24, z: 20, b: true }, { x: 17, z: 25, b: false },
      { x: 11, z: 23, b: true }, { x: 2, z: 25, b: false }, { x: -7, z: 24, b: true },
      { x: -15, z: 22, b: false }, { x: -23, z: 18, b: true }, { x: -27, z: 8, b: false },
      { x: -26, z: -6, b: true }, { x: -22, z: -14, b: false }, { x: -17, z: -4, b: true },
      { x: -11, z: 10, b: false }, { x: 14, z: -4, b: true }, { x: 20, z: -12, b: false },
      { x: 9, z: 15, b: true }, { x: -4, z: 12, b: false }, { x: 19, z: 11, b: true },
      { x: -19, z: 5, b: false }
    ];
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
      { x: 16, z: -9 }, { x: 22, z: -6 }, { x: 11, z: 17 }, { x: -16, z: -10 },
      // North Mountain Slope & Ridge Cliff Rocks
      { x: -18, z: -28 }, { x: -8, z: -30 }, { x: 0, z: -32 }, { x: 8, z: -30 }, { x: 18, z: -28 },
      // South Boundary Cliff Wall Boulders
      { x: -28, z: 32 }, { x: -20, z: 33 }, { x: -10, z: 32 }, { x: 0, z: 33 }, { x: 10, z: 32 }, { x: 20, z: 33 }, { x: 28, z: 32 },
      // Windmill Hill & South Bluff Slope Edge Transition Boulders
      { x: 18, z: -12 }, { x: 24, z: -18 }, { x: 21, z: -22 }, { x: 16, z: -20 },
      { x: 18, z: 18 }, { x: 22, z: 24 }, { x: 14, z: 22 }
    ];
    const instancedRocks = WorldEnvironmentBuilder.buildInstancedRocks(
      rockSeeds,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedRocks);

    // 21. Ambient Occlusion (AO) Ground Contact Shadows for Structures
    const shadowHouse = WorldEnvironmentBuilder.createContactShadowAO(4.6);
    shadowHouse.position.set(0, this.getFarmHeight(0, -4.5) + 0.02, -4.5);
    this.areaGroup.add(shadowHouse);

    const shadowBarn = WorldEnvironmentBuilder.createContactShadowAO(5.2);
    shadowBarn.position.set(-18.0, this.getFarmHeight(-18.0, 2.0) + 0.02, 2.0);
    this.areaGroup.add(shadowBarn);

    const shadowWindmill = WorldEnvironmentBuilder.createContactShadowAO(3.8);
    shadowWindmill.position.set(22.0, this.getFarmHeight(22.0, -16.0) + 0.02, -16.0);
    this.areaGroup.add(shadowWindmill);

    const shadowWell = WorldEnvironmentBuilder.createContactShadowAO(1.6);
    shadowWell.position.set(-3.2, this.getFarmHeight(-3.2, 0.8) + 0.02, 0.8);
    this.areaGroup.add(shadowWell);

    const shadowBin = WorldEnvironmentBuilder.createContactShadowAO(1.5);
    shadowBin.position.set(2.5, this.getFarmHeight(2.5, 0.8) + 0.02, 0.8);
    this.areaGroup.add(shadowBin);

    // 22. Short 3D Micro Grass Tufts (InstancedMesh Batch)
    const microGrassSeeds = [
      { x: -5, z: -8 }, { x: -8, z: -5 }, { x: 5, z: -8 }, { x: 8, z: -10 },
      { x: 14, z: -12 }, { x: 18, z: -8 }, { x: 10, z: -2 }, { x: 12, z: 4 },
      { x: 16, z: 8 }, { x: 20, z: 12 }, { x: 12, z: 14 }, { x: 6, z: 16 },
      { x: -2, z: 14 }, { x: -8, z: 18 }, { x: -14, z: 15 }, { x: -20, z: 12 },
      { x: -12, z: 6 }, { x: -7, z: 8 }, { x: -2, z: 8 }, { x: 1, z: 18 },
      { x: 7, z: 20 }, { x: 15, z: 18 }, { x: 22, z: 20 }, { x: -16, z: -8 },
      { x: -22, z: -6 }, { x: -10, z: -16 }, { x: -4, z: -18 }, { x: 6, z: -18 },
      { x: 12, z: -18 }, { x: 20, z: -18 }
    ];
    const instancedMicroGrass = WorldEnvironmentBuilder.buildInstancedMicroGrass(
      microGrassSeeds,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedMicroGrass);

    // 23. Tiny Natural Ground Pebbles (InstancedMesh Batch)
    const pebbleSeeds = [
      { x: -1, z: -2 }, { x: 1.5, z: -3 }, { x: -2.5, z: 2 }, { x: 2, z: 3.2 },
      { x: 4, z: 1.5 }, { x: 8, z: -1.5 }, { x: 11, z: -6 }, { x: 15, z: -11 },
      { x: 19, z: -14 }, { x: 10, z: 6 }, { x: 13, z: 11 }, { x: 17, z: 16 },
      { x: -6, z: 4 }, { x: -10, z: 2 }, { x: -15, z: 0 }, { x: -12, z: -4 },
      { x: -6, z: -10 }, { x: 3, z: -12 }, { x: 7, z: -15 }, { x: -1, z: 10 },
      { x: 3, z: 13 }, { x: 8, z: 16 }
    ];
    const instancedPebbles = WorldEnvironmentBuilder.buildInstancedPebbles(
      pebbleSeeds,
      (x, z) => this.getFarmHeight(x, z)
    );
    this.areaGroup.add(instancedPebbles);
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
      new THREE.MeshLambertMaterial({
        map: this.grassTexture,
        vertexColors: true
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

    // 1. COMBINED SINGLE LINESEGMENTS FOR ENTIRE HOE GRID OUTLINE (1 Draw Call)
    const lineVerts: number[] = [];
    const half = 1.36 * 0.5;
    const yLine = 0.025;

    plots.forEach(tile => {
      const wx = origin.x + tile.x * 1.5;
      const wz = origin.z + tile.z * 1.5;

      // 4 segment perimeter box per cell
      lineVerts.push(
        wx - half, yLine, wz - half,  wx + half, yLine, wz - half,
        wx + half, yLine, wz - half,  wx + half, yLine, wz + half,
        wx + half, yLine, wz + half,  wx - half, yLine, wz + half,
        wx - half, yLine, wz + half,  wx - half, yLine, wz - half
      );
    });

    const gridLineGeo = new THREE.BufferGeometry();
    gridLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    const gridWireMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b, // warm golden-orange outline
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const gridLinesMesh = new THREE.LineSegments(gridLineGeo, gridWireMat);
    gridLinesMesh.castShadow = false;
    gridLinesMesh.receiveShadow = false;
    this.farmingGridGroup.add(gridLinesMesh);

    // 2. SINGLE INSTANCEDMESH FOR SUBTLE GRID FILL TINT (1 Draw Call)
    const fillPlaneGeo = new THREE.PlaneGeometry(1.36, 1.36);
    fillPlaneGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.06,
      depthWrite: false
    });
    const gridFillInst = new THREE.InstancedMesh(fillPlaneGeo, fillMat, plots.length);
    gridFillInst.castShadow = false;
    gridFillInst.receiveShadow = false;

    plots.forEach((tile, i) => {
      dummy.position.set(origin.x + tile.x * 1.5, 0.02, origin.z + tile.z * 1.5);
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
        this.enableShadows(cropMesh, true, true);
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

  private buildWindmill(pos: THREE.Vector3): void {
    const windmill = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(2.8);
    shadow.position.y = 0.02;
    windmill.add(shadow);

    const towerMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xfef3c7,
      bottomColor: 0xd97706,
      topColor: 0xfffbeb,
      minY: -3.25,
      maxY: 3.25
    });
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2.0, 6.5, 10),
      towerMat
    );
    tower.position.y = 3.25;
    windmill.add(tower);

    const roofMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x991b1b,
      bottomColor: 0x5b1111,
      topColor: 0xdc2626,
      minY: -1.0,
      maxY: 1.0
    });
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 2.0, 10),
      roofMat
    );
    roof.position.y = 7.4;
    windmill.add(roof);

    // Blades
    this.windmillBlades = new THREE.Group();
    const bladeMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xffffff,
      bottomColor: 0xd1d5db,
      topColor: 0xffffff,
      minY: -1.5,
      maxY: 1.5
    });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 3.0, 0.05),
        bladeMat
      );
      blade.position.y = 1.5;
      blade.rotation.z = (i * Math.PI) / 2;
      this.windmillBlades.add(blade);
    }
    this.windmillBlades.position.set(0, 6.2, 1.6);
    windmill.add(this.windmillBlades);

    this.enableShadows(windmill);

    const gy = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    windmill.position.set(pos.x, gy, pos.z);
    this.areaGroup.add(windmill);
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

  // PLAYER CHARACTER (Cute Harvest Moon Tree of Tranquility chibi farmer with Gradient Shading)
  private createPlayerMesh(): void {
    this.playerGroup = new THREE.Group();

    // Body / Overalls with vertical denim gradient
    const bodyGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.85, 8);
    const bodyMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x1d4ed8,
      bottomColor: 0x172554, // Deep indigo base
      topColor: 0x3b82f6,    // Sky denim crest
      minY: -0.42,
      maxY: 0.42
    });
    this.playerBody = new THREE.Mesh(bodyGeo, bodyMat);
    this.playerBody.position.y = 0.75;
    this.playerGroup.add(this.playerBody);

    // Shirt collar / chest
    const shirtMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xffedd5,
      bottomColor: 0xfed7aa,
      topColor: 0xffffff,
      minY: -0.15,
      maxY: 0.15
    });
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.4), shirtMat);
    shirt.position.set(0, 0.95, 0.05);
    this.playerGroup.add(shirt);

    // Head with rosy cheeks gradient
    const headGeo = new THREE.SphereGeometry(0.34, 10, 10);
    const headMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0xfecdd3,
      bottomColor: 0xfba0ac,
      topColor: 0xfff1f2,
      minY: -0.34,
      maxY: 0.34
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.45;
    this.playerGroup.add(head);

    // Stylized Anime Chibi Hair (Warm Amber-Chestnut Brown with Gradient)
    const hairGroup = new THREE.Group();
    const hairMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x92400e,
      bottomColor: 0x451a03,
      topColor: 0xb45309,
      minY: -0.22,
      maxY: 0.28
    });

    // Main Hair Crown / Volume
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 8, 8),
      hairMat
    );
    hairCap.position.set(0, 0.05, -0.04);
    hairGroup.add(hairCap);

    // Front Bangs
    const bang1 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), hairMat);
    bang1.rotation.set(0.35, 0, 0.3);
    bang1.position.set(-0.14, 0.07, 0.27);
    hairGroup.add(bang1);

    const bang2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 4), hairMat);
    bang2.rotation.set(0.32, 0, -0.2);
    bang2.position.set(0.08, 0.09, 0.28);
    hairGroup.add(bang2);

    // Side Tufts
    const tuftL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), hairMat);
    tuftL.rotation.set(0, 0, 0.45);
    tuftL.position.set(-0.3, 0.02, 0.08);
    hairGroup.add(tuftL);

    const tuftR = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), hairMat);
    tuftR.rotation.set(0, 0, -0.45);
    tuftR.position.set(0.3, 0.02, 0.08);
    hairGroup.add(tuftR);

    hairGroup.position.set(0, 1.48, 0);
    this.playerGroup.add(hairGroup);

    // Backpack
    const backpackMat = WorldEnvironmentBuilder.createGradientMaterial({
      color: 0x78350f,
      bottomColor: 0x451a03,
      topColor: 0x92400e,
      minY: -0.22,
      maxY: 0.22
    });
    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.45, 0.25),
      backpackMat
    );
    backpack.position.set(0, 0.82, -0.3);
    this.playerGroup.add(backpack);

    // Legs & Boots
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

    // Arms
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

    let sunColor: THREE.Color;
    let sunIntensity: number;
    let sunPos: THREE.Vector3;
    let ambColor: THREE.Color;
    let ambIntensity: number;
    let skyColor: THREE.Color;
    let fogColor: THREE.Color;
    let fogDensity = 0.016;

    if (isRain) {
      // Overcast / Rainy Mood (Diffuse slate grey lighting & mist)
      sunColor = new THREE.Color(0x94a3b8);
      sunIntensity = 0.45;
      sunPos = new THREE.Vector3(12, 16, 12);
      ambColor = new THREE.Color(0x64748b);
      ambIntensity = 0.55;
      skyColor = new THREE.Color(0x64748b);
      fogColor = new THREE.Color(0x64748b);
      fogDensity = 0.025;
    } else if (timeDec >= 5.0 && timeDec < 8.0) {
      // 🌅 EARLY MORNING / DAWN (05:00 - 08:00 AM, including 06:26 AM / 6.43)
      // Warm golden morning sun (0xfff0dd) with low eastern horizon angle
      const t = (timeDec - 5.0) / 3.0; // 0 to 1
      sunPos = new THREE.Vector3(
        THREE.MathUtils.lerp(26, 16, t),
        THREE.MathUtils.lerp(5.5, 16, t),
        THREE.MathUtils.lerp(17, 13, t)
      );
      // Warm golden morning sun (0xfff0dd) transitioning smoothly into bright midday
      sunColor = new THREE.Color().lerpColors(new THREE.Color(0xfff0dd), new THREE.Color(0xfffdf5), t);
      sunIntensity = THREE.MathUtils.lerp(1.16, 1.25, t);
      // Ambient warm peach / amber morning glow
      ambColor = new THREE.Color().lerpColors(new THREE.Color(0xfed7aa), new THREE.Color(0xfef3c7), t);
      ambIntensity = THREE.MathUtils.lerp(0.66, 0.72, t);
      // Sky & Fog: Soft morning sky pastel (0xdbebf5) blending horizon hills naturally
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0xdbebf5), new THREE.Color(0x93c5fd), t);
      fogColor = new THREE.Color().lerpColors(new THREE.Color(0xdbebf5), new THREE.Color(0xbbe3f5), t);
      fogDensity = THREE.MathUtils.lerp(0.016, 0.015, t);
    } else if (timeDec >= 8.0 && timeDec < 16.0) {
      // ☀️ DAYTIME / MIDDAY (08:00 AM - 04:00 PM) - Crisp bright daylight, brilliant sky
      const t = (timeDec - 8.0) / 8.0;
      sunPos = new THREE.Vector3(
        THREE.MathUtils.lerp(16, -12, t),
        THREE.MathUtils.lerp(22, 27, Math.sin(t * Math.PI)),
        THREE.MathUtils.lerp(14, 12, t)
      );
      sunColor = new THREE.Color(0xfffdf5);
      sunIntensity = 1.25;
      ambColor = new THREE.Color(0xfffbeb);
      ambIntensity = 0.74;
      skyColor = new THREE.Color(0x93c5fd);
      fogColor = new THREE.Color(0xbbe3f5);
      fogDensity = 0.015;
    } else if (timeDec >= 16.0 && timeDec < 18.5) {
      // 🌇 GOLDEN HOUR / LATE AFTERNOON (04:00 PM - 06:30 PM) - Warm Amber Glow, lengthening west shadows
      const t = (timeDec - 16.0) / 2.5;
      sunPos = new THREE.Vector3(
        THREE.MathUtils.lerp(-12, -26, t),
        THREE.MathUtils.lerp(20, 6.0, t),
        THREE.MathUtils.lerp(12, 16, t)
      );
      sunColor = new THREE.Color().lerpColors(new THREE.Color(0xfbbf24), new THREE.Color(0xf97316), t);
      sunIntensity = THREE.MathUtils.lerp(1.2, 1.0, t);
      ambColor = new THREE.Color().lerpColors(new THREE.Color(0xfed7aa), new THREE.Color(0xfbcfe8), t);
      ambIntensity = THREE.MathUtils.lerp(0.7, 0.58, t);
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0xfcd34d), new THREE.Color(0xfb923c), t);
      fogColor = new THREE.Color().lerpColors(new THREE.Color(0xfed7aa), new THREE.Color(0xf97316), t);
      fogDensity = THREE.MathUtils.lerp(0.015, 0.021, t);
    } else if (timeDec >= 18.5 && timeDec < 20.0) {
      // 🌆 DUSK / TWILIGHT (06:30 PM - 08:00 PM) - Crimson / purple twilight
      const t = (timeDec - 18.5) / 1.5;
      sunPos = new THREE.Vector3(-28, THREE.MathUtils.lerp(5.0, 1.0, t), 16);
      sunColor = new THREE.Color().lerpColors(new THREE.Color(0xea580c), new THREE.Color(0x7c3aed), t);
      sunIntensity = THREE.MathUtils.lerp(0.85, 0.35, t);
      ambColor = new THREE.Color().lerpColors(new THREE.Color(0xc084fc), new THREE.Color(0x312e81), t);
      ambIntensity = THREE.MathUtils.lerp(0.55, 0.4, t);
      skyColor = new THREE.Color().lerpColors(new THREE.Color(0xf97316), new THREE.Color(0x1e1b4b), t);
      fogColor = new THREE.Color().lerpColors(new THREE.Color(0xc084fc), new THREE.Color(0x1e1b4b), t);
      fogDensity = 0.022;
    } else {
      // 🌙 NIGHT (08:00 PM - 05:00 AM) - Lunar silver moonlight, deep indigo sky
      sunPos = new THREE.Vector3(-14, 22, -14);
      sunColor = new THREE.Color(0x93c5fd); // Moonlight
      sunIntensity = 0.42;
      ambColor = new THREE.Color(0x1e293b);
      ambIntensity = 0.38;
      skyColor = new THREE.Color(0x0b132b);
      fogColor = new THREE.Color(0x0f172a);
      fogDensity = 0.024;
    }

    // Apply smoothly to Three.js lighting & scene
    // Focus directional light and tight shadow box directly around player position
    this.sunLight.target.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.position.set(
      this.playerPos.x + sunPos.x,
      this.playerPos.y + sunPos.y,
      this.playerPos.z + sunPos.z
    );
    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = sunIntensity;
    this.ambientLight.color.copy(ambColor);
    this.ambientLight.intensity = ambIntensity;

    const area = this.gameState.currentArea();
    if (area !== 'house' && area !== 'shop') {
      this.scene.background = skyColor;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(fogColor);
        this.scene.fog.density = fogDensity;
      }
    }
  }

  // MAIN GAME TICK & ANIMATION LOOP
  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    // Atmospheric lighting tick (Smooth day/night cycle & time of day updates)
    this.updateAtmosphericLighting();

    // Farming Grid outline visibility dynamically tied to equipped Hoe
    if (this.farmingGridGroup) {
      const isFarm = this.gameState.currentArea() === 'farm';
      const isHoe = this.gameState.selectedTool() === 'hoe';
      this.farmingGridGroup.visible = isFarm && isHoe;
    }

    // 1. Windmill rotation
    if (this.windmillBlades) {
      this.windmillBlades.rotation.z += delta * 0.8;
    }

    // 2. Sprite Fin float
    if (this.spriteFin) {
      this.spriteFin.position.y = 2.0 + Math.sin(this.clock.getElapsedTime() * 3) * 0.25;
      this.spriteFin.rotation.y += delta * 1.5;
    }

    // 3. Tree leaves subtle breathing
    if (this.treeLeaves) {
      this.treeLeaves.rotation.y = Math.sin(this.clock.getElapsedTime() * 0.5) * 0.05;
    }

    // 3b. Meadow grass tufts gentle wind swaying
    if (this.grassTuftMeshes.length > 0) {
      const time = this.clock.getElapsedTime();
      const swayTime = time * 2.2;
      for (const tuft of this.grassTuftMeshes) {
        tuft.rotation.z = Math.sin(swayTime + tuft.position.x * 0.4 + tuft.position.z * 0.25) * 0.08;
      }
    }

    // 3c. Fluffy green bushes gentle breeze breathing
    if (this.bushMeshes.length > 0) {
      const time = this.clock.getElapsedTime();
      const swayTime = time * 1.5;
      for (const bush of this.bushMeshes) {
        bush.rotation.y += Math.sin(swayTime + bush.position.x * 0.3) * 0.001;
      }
    }

    // 4. Update Player Movement
    this.updatePlayerMovement(delta);

    // 5. Update Camera (Smooth lerp following player)
    this.updateCamera();

    // 6. Proximity Check for All-in-One Action Button
    this.updateActionProximity();

    // 7. Render
    this.renderer.render(this.scene, this.camera);

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

  private updatePlayerMovement(delta: number): void {
    if (this.gameState.isFading()) return;

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

      // Continuous terrain elevation following (walk smoothly up and down hills)
      if (area === 'farm') {
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

  // Camera tracking (Smooth, 100% steady camera without any pitch/yaw wobble or walking shake)
  private updateCamera(): void {
    const targetX = this.playerPos.x;
    const targetY = this.playerPos.y + 1.0;
    const targetZ = this.playerPos.z;

    const area = this.gameState.currentArea();
    const camOffset = (area === 'house' || area === 'shop')
      ? new THREE.Vector3(0, 7.5, 7.5)
      : new THREE.Vector3(0, 8.5, 9.5);

    // Smoothly track target point without phase delay
    const target = new THREE.Vector3(targetX, targetY, targetZ);
    this.camLookAtTarget.lerp(target, 0.15);

    // Lock camera position strictly to target + offset vector (Guarantees zero rotation wobble)
    this.camera.position.copy(this.camLookAtTarget).add(camOffset);
    this.camera.lookAt(this.camLookAtTarget);
  }

  // Dynamic Contextual Proximity Detection (All-in-One Action Button)
  private updateActionProximity(): void {
    const currentArea = this.gameState.currentArea();
    const currentTool = this.gameState.selectedTool();

    // 1. Check fixed interactive markers (Doors, Signs, Bed, Well, Pier, Bells)
    for (const marker of this.interactiveMarkers) {
      const dist = this.playerPos.distanceTo(marker.pos);
      if (dist <= marker.radius) {
        this.gameState.currentAction.set(marker.context);
        return;
      }
    }

    // 2. Check Animals (Farmstead area)
    if (currentArea === 'farm') {
      for (const a of this.gameState.animals()) {
        const ay = this.getFarmHeight(a.position.x, a.position.z);
        const animalPos = new THREE.Vector3(a.position.x, ay, a.position.z);
        if (this.playerPos.distanceTo(animalPos) <= 2.2) {
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
      const origin = new THREE.Vector3(3.5, 0, 4);
      for (const tile of this.gameState.farmPlots()) {
        const tileWorldPos = new THREE.Vector3(origin.x + tile.x * 1.5, 0, origin.z + tile.z * 1.5);
        if (this.playerPos.distanceTo(tileWorldPos) <= 1.4) {
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
  private createTree(pos: THREE.Vector3): void {
    const tree = new THREE.Group();

    // Contact AO Shadow
    const shadow = WorldEnvironmentBuilder.createContactShadowAO(1.5);
    shadow.position.y = 0.02;
    tree.add(shadow);

    // Trunk rooted into ground
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.45, 2.2, 8),
      new THREE.MeshLambertMaterial({ color: 0x78350f })
    );
    trunk.position.y = 0.8;
    tree.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.4),
      new THREE.MeshLambertMaterial({ color: 0x4ade80 })
    );
    foliage.position.y = 2.4;
    tree.add(foliage);

    this.enableShadows(tree);

    const ty = this.gameState.currentArea() === 'farm' ? this.getFarmHeight(pos.x, pos.z) : pos.y;
    tree.position.set(pos.x, ty, pos.z);
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

  // =========================================================================
  // PROCEDURAL TEXTURE GENERATORS (Modular & High Definition)
  // =========================================================================
  private initTextures(): void {
    const tex = WorldTexturesGenerator.createTextureSet();
    if (tex.grassTexture) this.grassTexture = tex.grassTexture;
    if (tex.roadTexture) this.roadTexture = tex.roadTexture;
    if (tex.roadEastTexture) this.roadEastTexture = tex.roadEastTexture;
    if (tex.townGroundTexture) this.townGroundTexture = tex.townGroundTexture;
    if (tex.woodFloorTexture) this.woodFloorTexture = tex.woodFloorTexture;
    if (tex.soilTilledTexture) this.soilTilledTexture = tex.soilTilledTexture;
    if (tex.soilWateredTexture) this.soilWateredTexture = tex.soilWateredTexture;
  }
}
