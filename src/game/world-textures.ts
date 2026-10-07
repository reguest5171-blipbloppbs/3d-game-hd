import * as THREE from 'three';

export interface WorldTextureSet {
  grassTexture: THREE.CanvasTexture | null;
  soilGroundTexture: THREE.CanvasTexture | null;
  noiseTexture: THREE.CanvasTexture | null;
  roadTexture: THREE.CanvasTexture | null;
  roadEastTexture: THREE.CanvasTexture | null;
  townGroundTexture: THREE.CanvasTexture | null;
  woodFloorTexture: THREE.CanvasTexture | null;
  soilTilledTexture: THREE.CanvasTexture | null;
  soilWateredTexture: THREE.CanvasTexture | null;
  waterTexture: THREE.CanvasTexture | null;
}

export class WorldTexturesGenerator {
  public static createTextureSet(): WorldTextureSet {
    if (typeof document === 'undefined') {
      return {
        grassTexture: null,
        soilGroundTexture: null,
        noiseTexture: null,
        roadTexture: null,
        roadEastTexture: null,
        townGroundTexture: null,
        woodFloorTexture: null,
        soilTilledTexture: null,
        soilWateredTexture: null,
        waterTexture: null
      };
    }

    return {
      grassTexture: this.createGrassCanvasTexture(),
      soilGroundTexture: this.createSoilGroundCanvasTexture(),
      noiseTexture: this.createNoiseCanvasTexture(),
      roadTexture: this.createRoadCanvasTexture(false),
      roadEastTexture: this.createRoadCanvasTexture(true),
      townGroundTexture: this.createTownCanvasTexture(),
      woodFloorTexture: this.createWoodFloorCanvasTexture(),
      soilTilledTexture: this.createSoilCanvasTexture(false),
      soilWateredTexture: this.createSoilCanvasTexture(true),
      waterTexture: this.createWaterCanvasTexture()
    };
  }

  // Helper function: Rounded rectangle for canvas rendering
  public static drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // 1. ISOTROPIC LUSH MEADOW GRASS (Velvety, Smooth, Zero Line Strokes or Streaks)
  public static createGrassCanvasTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Uniform lush, vibrant pastel meadow green base (Tree of Tranquility style)
    ctx.fillStyle = '#6ecb32';
    ctx.fillRect(0, 0, 512, 512);

    const offsets = [
      [0, 0], [512, 0], [-512, 0], [0, 512], [0, -512],
      [512, 512], [-512, -512], [512, -512], [-512, 512]
    ];

    // Soft isotropic round turf clusters (seamless radial gradients, zero directional lines)
    for (let i = 0; i < 220; i++) {
      const cx = (i * 137 + 19) % 512;
      const cy = (i * 223 + 47) % 512;
      const rad = 14 + (i % 5) * 8;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const isWarm = i % 3 === 0;
      const isCool = i % 3 === 1;
      grad.addColorStop(0, isWarm ? 'rgba(154, 230, 70, 0.28)' : (isCool ? 'rgba(74, 168, 30, 0.22)' : 'rgba(130, 215, 55, 0.24)'));
      grad.addColorStop(1, 'rgba(110, 203, 50, 0)');
      ctx.fillStyle = grad;

      for (const [ox, oy] of offsets) {
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Dense micro-stippling for velvety turf grain (pure soft circular particles)
    for (let i = 0; i < 2400; i++) {
      const cx = (i * 73 + 31) % 512;
      const cy = (i * 179 + 53) % 512;
      const r = 0.8 + (i % 3) * 0.6;
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(195, 245, 120, 0.35)' : 'rgba(55, 140, 25, 0.18)';

      for (const [ox, oy] of offsets) {
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Multi-petal Chamomile flower clusters & 3-leaf Clover patches
    const petalColors = ['rgba(255, 255, 255, 0.90)', 'rgba(254, 240, 138, 0.85)', 'rgba(251, 207, 232, 0.75)'];
    for (let i = 0; i < 45; i++) {
      const cx = (i * 281 + 71) % 512;
      const cy = (i * 353 + 97) % 512;
      const flowerColor = petalColors[i % petalColors.length];

      for (const [ox, oy] of offsets) {
        // Chamomile center yellow core
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, 1.4, 0, Math.PI * 2);
        ctx.fill();

        // 4 surrounding white petals
        ctx.fillStyle = flowerColor;
        for (let p = 0; p < 4; p++) {
          const angle = (p * Math.PI) / 2;
          const px = cx + ox + Math.cos(angle) * 2.2;
          const py = cy + oy + Math.sin(angle) * 2.2;
          ctx.beginPath();
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 3-leaf Clover patches (deep emerald 3-petal groupings)
    ctx.fillStyle = 'rgba(22, 101, 52, 0.40)';
    for (let i = 0; i < 65; i++) {
      const gx = (i * 193 + 43) % 512;
      const gy = (i * 277 + 83) % 512;

      for (const [ox, oy] of offsets) {
        for (let p = 0; p < 3; p++) {
          const angle = (p * Math.PI * 2) / 3;
          const px = gx + ox + Math.cos(angle) * 1.8;
          const py = gy + oy + Math.sin(angle) * 1.8;
          ctx.beginPath();
          ctx.arc(px, py, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 1D. CRYSTAL AZURE WATER SURFACE TEXTURE WITH MOVING FLOW RIPPLES
  public static createWaterCanvasTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Azure blue base
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(0, 0, 512, 512);

    const offsets = [
      [0, 0], [512, 0], [-512, 0], [0, 512], [0, -512],
      [512, 512], [-512, -512], [512, -512], [-512, 512]
    ];

    // Soft water caustics & gentle flow ripples
    for (let i = 0; i < 160; i++) {
      const cx = (i * 137 + 19) % 512;
      const cy = (i * 223 + 47) % 512;
      const rx = 18 + (i % 5) * 12;
      const ry = 6 + (i % 3) * 4;

      ctx.fillStyle = (i % 2 === 0) ? 'rgba(224, 242, 254, 0.40)' : 'rgba(2, 132, 199, 0.35)';

      for (const [ox, oy] of offsets) {
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, rx, ry, Math.PI / 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 12);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 1B. RICH ORGANIC GROUND SOIL / EARTH TEXTURE (Tanah Alami)
  public static createSoilGroundCanvasTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Warm natural earth baseline
    ctx.fillStyle = '#f5ede0';
    ctx.fillRect(0, 0, 512, 512);

    const offsets = [
      [0, 0], [512, 0], [-512, 0], [0, 512], [0, -512],
      [512, 512], [-512, -512], [512, -512], [-512, 512]
    ];

    // Soft humus loam variations (small crumb clusters)
    for (let i = 0; i < 160; i++) {
      const cx = (i * 149 + 29) % 512;
      const cy = (i * 211 + 61) % 512;
      const rad = 14 + (i % 4) * 9;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const isDark = i % 2 === 0;
      grad.addColorStop(0, isDark ? 'rgba(120, 75, 35, 0.16)' : 'rgba(215, 175, 125, 0.18)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;

      for (const [ox, oy] of offsets) {
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Dense soil crumbs, fine sand grains and humus particles
    for (let i = 0; i < 2800; i++) {
      const cx = (i * 67 + 23) % 512;
      const cy = (i * 191 + 43) % 512;
      const r = 0.7 + (i % 4) * 0.55;
      const mode = i % 3;
      ctx.fillStyle = (mode === 0)
        ? 'rgba(255, 255, 255, 0.45)'
        : ((mode === 1) ? 'rgba(90, 55, 25, 0.22)' : 'rgba(45, 25, 10, 0.14)');

      for (const [ox, oy] of offsets) {
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Micro pebble flecks
    for (let i = 0; i < 350; i++) {
      const px = (i * 173 + 37) % 512;
      const py = (i * 239 + 79) % 512;
      const pr = 1.3 + (i % 3) * 0.8;
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(215, 205, 190, 0.60)' : 'rgba(140, 115, 90, 0.40)';

      for (const [ox, oy] of offsets) {
        ctx.beginPath();
        ctx.arc(px + ox, py + oy, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 1C. SEAMLESS ORGANIC NOISE TEXTURE FOR HARDWARE-ACCELERATED SHADER BLENDING
  public static createNoiseCanvasTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;

    const size = 256;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * Math.PI * 2;
        const v = (y / size) * Math.PI * 2;

        const nx = Math.cos(u);
        const ny = Math.sin(u);
        const nz = Math.cos(v);
        const nw = Math.sin(v);

        let val = Math.sin(nx * 2.5 + nz * 2.0) * 0.45 +
                  Math.cos(ny * 3.0 + nw * 2.5) * 0.35 +
                  Math.sin((nx + ny) * 5.0 + (nz - nw) * 4.5) * 0.20;

        val = Math.max(0, Math.min(1, (val + 1.0) * 0.5));
        const byteVal = Math.floor(val * 255);

        const idx = (y * size + x) * 4;
        data[idx] = byteVal;
        data[idx + 1] = byteVal;
        data[idx + 2] = byteVal;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  }

  // 2. RUSTIC STEPPING STONES & EARTH TRAIL WITH DITHER BLEND & FEATHERED TRANSITION
  public static createRoadCanvasTexture(horizontal: boolean): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Clear transparent background
    ctx.clearRect(0, 0, 512, 512);

    // 1. Warm Rustic Compacted Earth Base with Feathered Alpha Edges (Seamless Grass Blending)
    const baseGrad = horizontal
      ? ctx.createLinearGradient(0, 0, 0, 512)
      : ctx.createLinearGradient(0, 0, 512, 0);

    baseGrad.addColorStop(0.00, 'rgba(197, 172, 134, 0)');
    baseGrad.addColorStop(0.12, 'rgba(197, 172, 134, 0.35)');
    baseGrad.addColorStop(0.24, 'rgba(210, 188, 152, 0.88)');
    baseGrad.addColorStop(0.50, 'rgba(225, 205, 170, 0.98)');
    baseGrad.addColorStop(0.76, 'rgba(210, 188, 152, 0.88)');
    baseGrad.addColorStop(0.88, 'rgba(197, 172, 134, 0.35)');
    baseGrad.addColorStop(1.00, 'rgba(197, 172, 134, 0)');

    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Natural soil crumbs, earth patches & fine sand grains (feathered along path corridor)
    for (let i = 0; i < 600; i++) {
      let px = (i * 73 + 19) % 512;
      let py = (i * 127 + 41) % 512;

      // Keep particles inside the feathered pathway corridor
      if (!horizontal) {
        px = 80 + (px % 352);
      } else {
        py = 80 + (py % 352);
      }

      ctx.fillStyle = (i % 3 === 0)
        ? 'rgba(245, 230, 200, 0.55)'
        : ((i % 3 === 1) ? 'rgba(145, 110, 75, 0.35)' : 'rgba(95, 65, 35, 0.25)');
      ctx.beginPath();
      ctx.arc(px, py, 0.8 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft organic soil variation patches
    for (let i = 0; i < 16; i++) {
      let cx = (i * 97 + 23) % 512;
      let cy = (i * 139 + 37) % 512;
      if (!horizontal) {
        cx = 120 + (cx % 272);
      } else {
        cy = 120 + (cy % 272);
      }

      const r = 20 + (i % 4) * 12;
      const pGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      pGrad.addColorStop(0, i % 2 === 0 ? 'rgba(215, 190, 150, 0.30)' : 'rgba(155, 125, 85, 0.22)');
      pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Loosely Scattered River Stepping Stones (Organic, uncrowded, earth visible)
    const stonePalettes = [
      '#fbf6ed', '#f2e9dc', '#e8dfce', '#ddd3bf', '#faf4e6', '#e5dac1', '#ece3d0'
    ];

    if (!horizontal) {
      // Longitudinal along Y (Z in 3D scene)
      const stones = [
        // Center main stepping stones
        { x: 210, y: 35, w: 75, h: 48, r: 16, col: 0 },
        { x: 275, y: 110, w: 82, h: 52, r: 18, col: 1 },
        { x: 180, y: 195, w: 78, h: 50, r: 16, col: 2 },
        { x: 265, y: 280, w: 86, h: 54, r: 18, col: 3 },
        { x: 195, y: 365, w: 74, h: 48, r: 16, col: 4 },
        { x: 260, y: 445, w: 80, h: 50, r: 17, col: 5 },

        // Smaller side accent pebbles
        { x: 125, y: 75, w: 42, h: 32, r: 12, col: 2 },
        { x: 365, y: 60, w: 40, h: 30, r: 12, col: 4 },
        { x: 130, y: 250, w: 38, h: 28, r: 10, col: 5 },
        { x: 370, y: 220, w: 44, h: 34, r: 12, col: 0 },
        { x: 135, y: 410, w: 40, h: 30, r: 11, col: 3 },
        { x: 360, y: 395, w: 42, h: 32, r: 12, col: 1 }
      ];

      stones.forEach(st => {
        const stoneCol = stonePalettes[st.col % stonePalettes.length];

        // Soft ground shadow
        ctx.fillStyle = 'rgba(110, 80, 45, 0.45)';
        this.drawRoundedRect(ctx, st.x + 2, st.y + 4, st.w, st.h, st.r);
        ctx.fill();

        // Stone base
        ctx.fillStyle = stoneCol;
        this.drawRoundedRect(ctx, st.x, st.y, st.w, st.h, st.r);
        ctx.fill();

        // Soft 3D highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(st.x + st.r, st.y + st.h - 5);
        ctx.lineTo(st.x + st.r, st.y + st.r);
        ctx.lineTo(st.x + st.w - st.r, st.y + st.r);
        ctx.stroke();

        // Soft bevel depth
        ctx.strokeStyle = 'rgba(150, 120, 85, 0.45)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(st.x + st.w - st.r, st.y + st.r);
        ctx.lineTo(st.x + st.w - st.r, st.y + st.h - 5);
        ctx.lineTo(st.x + st.r, st.y + st.h - 5);
        ctx.stroke();
      });

      // Cute clover and grass tufts sprouting around stepping stones
      const grassStrokes = ['#5fb833', '#7ecb47', '#4a9925', '#98e35d'];
      for (let i = 0; i < 120; i++) {
        const gx = (i * 79 + 17) % 512;
        const gy = (i * 137 + 29) % 512;
        ctx.strokeStyle = grassStrokes[i % grassStrokes.length];
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + ((i % 5) - 2), gy - 4 - (i % 3) * 2);
        ctx.stroke();
      }

      // Wild chamomile flowers along path edges
      for (let i = 0; i < 28; i++) {
        const isLeft = i % 2 === 0;
        const fx = isLeft ? 45 + (i * 11) % 45 : 435 + (i * 13) % 45;
        const fy = (i * 53 + 17) % 512;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(fx, fy, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

    } else {
      // Longitudinal along X (East-West Road)
      const stones = [
        { x: 35, y: 210, w: 48, h: 75, r: 16, col: 0 },
        { x: 110, y: 275, w: 52, h: 82, r: 18, col: 1 },
        { x: 195, y: 180, w: 50, h: 78, r: 16, col: 2 },
        { x: 280, y: 265, w: 54, h: 86, r: 18, col: 3 },
        { x: 365, y: 195, w: 48, h: 74, r: 16, col: 4 },
        { x: 445, y: 260, w: 50, h: 80, r: 17, col: 5 },

        { x: 75, y: 125, w: 32, h: 42, r: 12, col: 2 },
        { x: 60, y: 365, w: 30, h: 40, r: 12, col: 4 },
        { x: 250, y: 130, w: 28, h: 38, r: 10, col: 5 },
        { x: 220, y: 370, w: 34, h: 44, r: 12, col: 0 },
        { x: 410, y: 135, w: 30, h: 40, r: 11, col: 3 },
        { x: 395, y: 360, w: 32, h: 42, r: 12, col: 1 }
      ];

      stones.forEach(st => {
        const stoneCol = stonePalettes[st.col % stonePalettes.length];

        ctx.fillStyle = 'rgba(110, 80, 45, 0.45)';
        this.drawRoundedRect(ctx, st.x + 2, st.y + 4, st.w, st.h, st.r);
        ctx.fill();

        ctx.fillStyle = stoneCol;
        this.drawRoundedRect(ctx, st.x, st.y, st.w, st.h, st.r);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(st.x + st.r, st.y + st.h - 5);
        ctx.lineTo(st.x + st.r, st.y + st.r);
        ctx.lineTo(st.x + st.w - st.r, st.y + st.r);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(150, 120, 85, 0.45)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(st.x + st.w - st.r, st.y + st.r);
        ctx.lineTo(st.x + st.w - st.r, st.y + st.h - 5);
        ctx.lineTo(st.x + st.r, st.y + st.h - 5);
        ctx.stroke();
      });

      const grassStrokes = ['#5fb833', '#7ecb47', '#4a9925', '#98e35d'];
      for (let i = 0; i < 120; i++) {
        const gx = (i * 137 + 29) % 512;
        const gy = (i * 79 + 17) % 512;
        ctx.strokeStyle = grassStrokes[i % grassStrokes.length];
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + ((i % 5) - 2), gy - 4 - (i % 3) * 2);
        ctx.stroke();
      }

      for (let i = 0; i < 28; i++) {
        const isTop = i % 2 === 0;
        const fy = isTop ? 45 + (i * 11) % 45 : 435 + (i * 13) % 45;
        const fx = (i * 53 + 17) % 512;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(fx, fy, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Advanced Organic Edge Transition (Dither Blend & Decal Mask)
    // Feathers road edge into grass using procedural multi-octave noise + dither stippling
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;

    // Transition margin (110px soft blend zone)
    const margin = 110;

    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const edgeDist = horizontal
          ? Math.min(y, 511 - y)  // horizontal road: top & bottom edges
          : Math.min(x, 511 - x); // vertical road: left & right edges

        if (edgeDist < margin) {
          // Multi-octave organic curl noise along path border
          const n1 = Math.sin(x * 0.08 + y * 0.07) * 0.5;
          const n2 = Math.cos(x * 0.18 - y * 0.16) * 0.3;
          const n3 = Math.sin(x * 0.35 + y * 0.32) * 0.2;
          const combinedNoise = (n1 + n2 + n3 + 1.0) * 0.5;

          // Dither mask matrix for natural gravel scatter
          const dither = ((x ^ y * 3) & 7) / 7.0 - 0.5;

          // Normalized gradient with noise edge perturbation
          const normDist = edgeDist / margin;
          const noisyDist = normDist + (combinedNoise - 0.5) * 0.45 + dither * 0.25;
          const clamped = Math.max(0, Math.min(1, noisyDist));

          // Smooth Hermite S-Curve (Smoothstep)
          const alpha = clamped * clamped * (3.0 - 2.0 * clamped);

          data[idx + 3] = Math.round(data[idx + 3] * alpha);
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 3. COASTAL TOWN PLAZA FLAGSTONE TEXTURE
  public static createTownCanvasTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#b8c0cc';
    ctx.fillRect(0, 0, 512, 512);

    const stoneCols = ['#e2e8f0', '#cbd5e1', '#d8e1ea', '#94a3b8', '#cbd0d8'];
    const rows = 8;
    const h = 512 / rows;
    for (let r = 0; r < rows; r++) {
      const cols = 6;
      const w = 512 / cols;
      const off = (r % 2 === 1) ? w * 0.5 : 0;
      for (let c = -1; c <= cols; c++) {
        const sx = c * w + off + 3;
        const sy = r * h + 3;
        const sw = w - 6;
        const sh = h - 6;

        ctx.fillStyle = stoneCols[(r * 7 + c + 50) % stoneCols.length];
        this.drawRoundedRect(ctx, sx, sy, sw, sh, 5);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, sw, 1);

        ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy + sh - 1, sw, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 4. WARM OAK COTTAGE WOOD FLOOR
  public static createWoodFloorCanvasTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#925227';
    ctx.fillRect(0, 0, 512, 512);

    const plankH = 512 / 8;
    const plankCols = ['#a15c2d', '#b46b37', '#925227', '#874b21', '#9e5a2c'];
    for (let i = 0; i < 8; i++) {
      const y = i * plankH;
      ctx.fillStyle = plankCols[i % plankCols.length];
      ctx.fillRect(0, y + 2, 512, plankH - 4);

      // Wood grain lines
      ctx.strokeStyle = 'rgba(74, 38, 14, 0.35)';
      ctx.lineWidth = 1.2;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.moveTo(0, y + 8 + j * 15);
        ctx.bezierCurveTo(150, y + 6 + j * 15, 350, y + 10 + j * 15, 512, y + 8 + j * 15);
        ctx.stroke();
      }

      // Plank seams
      ctx.strokeStyle = 'rgba(46, 24, 9, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();

      // Top plank highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y + 3);
      ctx.lineTo(512, y + 3);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // 5. RICH LOAM TILLED & WATERED SOIL
  public static createSoilCanvasTexture(watered: boolean): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const baseColor = watered ? '#3b1c0e' : '#784415';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 256, 256);

    // Furrow stripes (tilled rows)
    const furrowCount = 5;
    const furrowH = 256 / furrowCount;
    for (let f = 0; f < furrowCount; f++) {
      const fy = f * furrowH;
      // Ridge highlight
      ctx.fillStyle = watered ? '#4d2816' : '#94551d';
      ctx.fillRect(0, fy, 256, furrowH * 0.45);

      // Trench shadow
      ctx.fillStyle = watered ? '#281208' : '#572e0d';
      ctx.fillRect(0, fy + furrowH * 0.45, 256, furrowH * 0.55);

      if (watered) {
        // Water gleam in trench
        ctx.fillStyle = 'rgba(96, 165, 250, 0.25)';
        ctx.fillRect(0, fy + furrowH * 0.55, 256, furrowH * 0.35);
      }
    }

    // Soil crumbs & texture specks
    for (let i = 0; i < 250; i++) {
      const sx = (i * 37 + 13) % 256;
      const sy = (i * 79 + 29) % 256;
      ctx.fillStyle = (i % 2 === 0)
        ? (watered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.25)')
        : (watered ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.35)');
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
