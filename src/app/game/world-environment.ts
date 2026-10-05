import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface GradientMaterialParams {
  color?: THREE.ColorRepresentation;
  bottomColor?: THREE.ColorRepresentation;
  topColor?: THREE.ColorRepresentation;
  minY?: number;
  maxY?: number;
  map?: THREE.Texture | null;
  transparent?: boolean;
  opacity?: number;
  flatShading?: boolean;
  vertexColors?: boolean;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  side?: THREE.Side;
}

export class WorldEnvironmentBuilder {
  // Shared canvas texture for contact shadows (cached for memory efficiency)
  private static cachedShadowTexture: THREE.CanvasTexture | null = null;

  public static getShadowTexture(): THREE.CanvasTexture {
    if (!this.cachedShadowTexture && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;

      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(10, 15, 30, 0.58)');
      grad.addColorStop(0.35, 'rgba(12, 18, 35, 0.40)');
      grad.addColorStop(0.7, 'rgba(15, 23, 42, 0.16)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);

      this.cachedShadowTexture = new THREE.CanvasTexture(canvas);
    }
    return this.cachedShadowTexture!;
  }

  /**
   * Top-to-Bottom Gradient Shader Material
   * Injects a smooth vertical gradient into Three.js MeshLambertMaterial,
   * providing rich artistic lighting, depth and dimension to low-poly models
   * while seamlessly preserving shadow maps, ambient, directional, and fog lighting.
   */
  public static createGradientMaterial(params: GradientMaterialParams): THREE.MeshLambertMaterial {
    const baseColor = params.color ? new THREE.Color(params.color) : new THREE.Color(0xffffff);
    const bColor = params.bottomColor
      ? new THREE.Color(params.bottomColor)
      : baseColor.clone().multiplyScalar(0.62);
    const tColor = params.topColor
      ? new THREE.Color(params.topColor)
      : baseColor.clone().lerp(new THREE.Color(0xffffff), 0.28);

    const minY = params.minY ?? -1.0;
    const maxY = params.maxY ?? 1.0;

    const mat = new THREE.MeshLambertMaterial({
      color: params.color ?? 0xffffff,
      map: params.map ?? null,
      transparent: params.transparent ?? false,
      opacity: params.opacity ?? 1.0,
      flatShading: params.flatShading ?? false,
      vertexColors: params.vertexColors ?? false,
      emissive: params.emissive ?? 0x000000,
      emissiveIntensity: params.emissiveIntensity ?? 0.0,
      side: params.side ?? THREE.FrontSide
    });

    mat.userData['gradBottom'] = { value: bColor };
    mat.userData['gradTop'] = { value: tColor };
    mat.userData['gradMinY'] = { value: minY };
    mat.userData['gradMaxY'] = { value: maxY };

    mat.onBeforeCompile = (shader) => {
      shader.uniforms['gradBottom'] = mat.userData['gradBottom'];
      shader.uniforms['gradTop'] = mat.userData['gradTop'];
      shader.uniforms['gradMinY'] = mat.userData['gradMinY'];
      shader.uniforms['gradMaxY'] = mat.userData['gradMaxY'];

      shader.vertexShader = `
        varying float vLocalGradY;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vLocalGradY = position.y;
        `
      );

      shader.fragmentShader = `
        uniform vec3 gradBottom;
        uniform vec3 gradTop;
        uniform float gradMinY;
        uniform float gradMaxY;
        varying float vLocalGradY;
        ${shader.fragmentShader}
      `.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float gradFactor = clamp((vLocalGradY - gradMinY) / max(0.0001, gradMaxY - gradMinY), 0.0, 1.0);
        gradFactor = gradFactor * gradFactor * (3.0 - 2.0 * gradFactor);
        vec3 gradColorRgb = mix(gradBottom, gradTop, gradFactor);
        diffuseColor.rgb *= gradColorRgb;
        `
      );
    };

    return mat;
  }

  // =========================================================================
  // INSTANCED MESH BATCH BUILDERS (Massive Draw Call Reduction: 280+ -> <50)
  // =========================================================================

  /**
   * 1. Instanced Trees Batch
   * Groups trunk, 3 canopy puffs, and contact shadows into shared InstancedMeshes
   */
  public static buildInstancedTrees(
    positions: THREE.Vector3[],
    getHeight: (x: number, z: number) => number
  ): THREE.Group {
    const group = new THREE.Group();
    const count = positions.length;
    if (count === 0) return group;

    const dummy = new THREE.Object3D();

    // 1. Trunk Instanced Mesh
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 1.8, 8);
    const trunkMat = this.createGradientMaterial({
      color: 0x78350f,
      bottomColor: 0x451a03,
      topColor: 0x92400e,
      minY: -0.9,
      maxY: 0.9
    });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;

    // 2. Canopy Lobes Instanced Meshes
    const c1Geo = new THREE.DodecahedronGeometry(1.4);
    const c1Mat = this.createGradientMaterial({
      color: 0x22c55e,
      bottomColor: 0x14532d,
      topColor: 0x86efac,
      minY: -1.4,
      maxY: 1.4
    });
    const c1Inst = new THREE.InstancedMesh(c1Geo, c1Mat, count);
    c1Inst.castShadow = true;
    c1Inst.receiveShadow = true;

    const c2Geo = new THREE.DodecahedronGeometry(1.0);
    const c2Mat = this.createGradientMaterial({
      color: 0x16a34a,
      bottomColor: 0x052e16,
      topColor: 0x4ade80,
      minY: -1.0,
      maxY: 1.0
    });
    const c2Inst = new THREE.InstancedMesh(c2Geo, c2Mat, count);
    c2Inst.castShadow = true;
    c2Inst.receiveShadow = true;

    const c3Geo = new THREE.DodecahedronGeometry(0.9);
    const c3Mat = this.createGradientMaterial({
      color: 0x4ade80,
      bottomColor: 0x15803d,
      topColor: 0xbbf7d0,
      minY: -0.9,
      maxY: 0.9
    });
    const c3Inst = new THREE.InstancedMesh(c3Geo, c3Mat, count);
    c3Inst.castShadow = true;
    c3Inst.receiveShadow = true;

    // 3. Contact Shadows Instanced Mesh
    const shadowGeo = new THREE.PlaneGeometry(3.0, 3.0);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.getShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0
    });
    const shadowInst = new THREE.InstancedMesh(shadowGeo, shadowMat, count);
    shadowInst.renderOrder = 1;

    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const gy = getHeight(p.x, p.z);
      const scale = 0.9 + (i % 3) * 0.15;

      // Shadow disc
      dummy.position.set(p.x, gy + 0.02, p.z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      shadowInst.setMatrixAt(i, dummy.matrix);

      // Trunk
      dummy.position.set(p.x, gy + 0.9 * scale, p.z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, (i * 1.57) % Math.PI, 0);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);

      // Canopy 1 (Center)
      dummy.position.set(p.x, gy + 2.4 * scale, p.z);
      dummy.updateMatrix();
      c1Inst.setMatrixAt(i, dummy.matrix);

      // Canopy 2 (Right lobe)
      dummy.position.set(p.x + 0.6 * scale, gy + 2.6 * scale, p.z + 0.4 * scale);
      dummy.updateMatrix();
      c2Inst.setMatrixAt(i, dummy.matrix);

      // Canopy 3 (Left lobe)
      dummy.position.set(p.x - 0.5 * scale, gy + 2.8 * scale, p.z - 0.4 * scale);
      dummy.updateMatrix();
      c3Inst.setMatrixAt(i, dummy.matrix);
    }

    trunkInst.instanceMatrix.needsUpdate = true;
    c1Inst.instanceMatrix.needsUpdate = true;
    c2Inst.instanceMatrix.needsUpdate = true;
    c3Inst.instanceMatrix.needsUpdate = true;
    shadowInst.instanceMatrix.needsUpdate = true;

    group.add(shadowInst);
    group.add(trunkInst);
    group.add(c1Inst);
    group.add(c2Inst);
    group.add(c3Inst);

    return group;
  }

  /**
   * 2. Instanced Rocks & Mountain Boulders Batch
   */
  public static buildInstancedRocks(
    rockSeeds: { x: number; z: number }[],
    getHeight: (x: number, z: number) => number
  ): THREE.Group {
    const group = new THREE.Group();
    const count = rockSeeds.length;
    if (count === 0) return group;

    const dummy = new THREE.Object3D();

    const rockMat = this.createGradientMaterial({
      color: 0x94a3b8,
      bottomColor: 0x475569,
      topColor: 0xcfd8dc,
      minY: -0.5,
      maxY: 0.75
    });

    const mossMat = this.createGradientMaterial({
      color: 0x65a30d,
      bottomColor: 0x365314,
      topColor: 0xa3e635,
      minY: -0.38,
      maxY: 0.38
    });

    const mainGeo = new THREE.DodecahedronGeometry(0.75);
    const miniGeo = new THREE.DodecahedronGeometry(0.42);
    const mossGeo = new THREE.OctahedronGeometry(0.38);

    const mainInst = new THREE.InstancedMesh(mainGeo, rockMat, count);
    mainInst.castShadow = false; // Shadow pass optimized: zero extra shadow map draw calls
    mainInst.receiveShadow = true;
    mainInst.frustumCulled = true;

    const miniInst = new THREE.InstancedMesh(miniGeo, rockMat, count);
    miniInst.castShadow = false;
    miniInst.receiveShadow = true;
    miniInst.frustumCulled = true;

    const mossInst = new THREE.InstancedMesh(mossGeo, mossMat, count);
    mossInst.castShadow = false;
    mossInst.receiveShadow = true;
    mossInst.frustumCulled = true;

    const shadowGeo = new THREE.PlaneGeometry(1.9, 1.9);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.getShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0
    });
    const shadowInst = new THREE.InstancedMesh(shadowGeo, shadowMat, count);
    shadowInst.renderOrder = 1;
    shadowInst.frustumCulled = true;

    for (let i = 0; i < count; i++) {
      const s = rockSeeds[i];
      const ry = getHeight(s.x, s.z);
      const scale = 0.75 + (i % 3) * 0.3;
      const hasMoss = i % 2 === 0;

      // Shadow
      dummy.position.set(s.x, ry + 0.02, s.z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      shadowInst.setMatrixAt(i, dummy.matrix);

      // Main boulder
      dummy.position.set(s.x, ry + 0.35 * scale, s.z);
      dummy.rotation.set(0.3, 0.8 + (i * 1.3), 0.4);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mainInst.setMatrixAt(i, dummy.matrix);

      // Accent mini pebble
      dummy.position.set(s.x + 0.6 * scale, ry + 0.18 * scale, s.z + 0.35 * scale);
      dummy.rotation.set(0.2, 0.4 + (i * 0.9), 0.6);
      dummy.updateMatrix();
      miniInst.setMatrixAt(i, dummy.matrix);

      // Moss patch
      if (hasMoss) {
        dummy.position.set(s.x - 0.15 * scale, ry + 0.68 * scale, s.z + 0.1 * scale);
        dummy.rotation.set(0.4, 0.2 + (i * 0.7), 0.1);
        dummy.scale.set(scale, scale, scale);
      } else {
        dummy.position.set(0, -999, 0);
        dummy.scale.set(0, 0, 0);
      }
      dummy.updateMatrix();
      mossInst.setMatrixAt(i, dummy.matrix);
    }

    mainInst.instanceMatrix.needsUpdate = true;
    miniInst.instanceMatrix.needsUpdate = true;
    mossInst.instanceMatrix.needsUpdate = true;
    shadowInst.instanceMatrix.needsUpdate = true;

    group.add(shadowInst);
    group.add(mainInst);
    group.add(miniInst);
    group.add(mossInst);

    return group;
  }

  /**
   * 3. Instanced Bushes & Berry Shrubs Batch
   */
  public static buildInstancedBushes(
    bushSeeds: { x: number; z: number; b: boolean }[],
    getHeight: (x: number, z: number) => number
  ): THREE.Group {
    const group = new THREE.Group();
    const count = bushSeeds.length;
    if (count === 0) return group;

    const dummy = new THREE.Object3D();

    const lobe1Mat = this.createGradientMaterial({
      color: 0x4ade80,
      bottomColor: 0x15803d,
      topColor: 0x86efac,
      minY: -0.65,
      maxY: 0.65
    });
    const lobe2Mat = this.createGradientMaterial({
      color: 0x22c55e,
      bottomColor: 0x14532d,
      topColor: 0x4ade80,
      minY: -0.52,
      maxY: 0.52
    });
    const lobe3Mat = this.createGradientMaterial({
      color: 0x16a34a,
      bottomColor: 0x052e16,
      topColor: 0x22c55e,
      minY: -0.48,
      maxY: 0.48
    });

    const l1Geo = new THREE.DodecahedronGeometry(0.65);
    const l2Geo = new THREE.DodecahedronGeometry(0.52);
    const l3Geo = new THREE.DodecahedronGeometry(0.48);

    const l1Inst = new THREE.InstancedMesh(l1Geo, lobe1Mat, count);
    l1Inst.castShadow = false; // Zero shadow-map pass overhead for small foliage
    l1Inst.receiveShadow = true;
    l1Inst.frustumCulled = true;

    const l2Inst = new THREE.InstancedMesh(l2Geo, lobe2Mat, count);
    l2Inst.castShadow = false;
    l2Inst.receiveShadow = true;
    l2Inst.frustumCulled = true;

    const l3Inst = new THREE.InstancedMesh(l3Geo, lobe3Mat, count);
    l3Inst.castShadow = false;
    l3Inst.receiveShadow = true;
    l3Inst.frustumCulled = true;

    const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.getShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0
    });
    const shadowInst = new THREE.InstancedMesh(shadowGeo, shadowMat, count);
    shadowInst.renderOrder = 1;
    shadowInst.frustumCulled = true;

    for (let i = 0; i < count; i++) {
      const s = bushSeeds[i];
      const by = getHeight(s.x, s.z);
      const scale = 0.8 + (i % 3) * 0.25;

      // Shadow
      dummy.position.set(s.x, by + 0.02, s.z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      shadowInst.setMatrixAt(i, dummy.matrix);

      // Lobe 1
      dummy.position.set(s.x, by + 0.48 * scale, s.z);
      dummy.rotation.set(0, (i * 1.85) % (Math.PI * 2), 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      l1Inst.setMatrixAt(i, dummy.matrix);

      // Lobe 2
      dummy.position.set(s.x + 0.35 * scale, by + 0.42 * scale, s.z + 0.25 * scale);
      dummy.updateMatrix();
      l2Inst.setMatrixAt(i, dummy.matrix);

      // Lobe 3
      dummy.position.set(s.x - 0.32 * scale, by + 0.38 * scale, s.z - 0.2 * scale);
      dummy.updateMatrix();
      l3Inst.setMatrixAt(i, dummy.matrix);
    }

    l1Inst.instanceMatrix.needsUpdate = true;
    l2Inst.instanceMatrix.needsUpdate = true;
    l3Inst.instanceMatrix.needsUpdate = true;
    shadowInst.instanceMatrix.needsUpdate = true;

    group.add(shadowInst);
    group.add(l1Inst);
    group.add(l2Inst);
    group.add(l3Inst);

    return group;
  }

  /**
   * 4. Instanced Meadow Grass Tufts Batch
   */
  public static buildInstancedGrassTufts(
    grassSeeds: { x: number; z: number }[],
    getHeight: (x: number, z: number) => number
  ): THREE.InstancedMesh {
    const totalBlades = grassSeeds.length * 5;
    const dummy = new THREE.Object3D();

    const bladeGeo = new THREE.PlaneGeometry(0.12, 0.42);
    bladeGeo.translate(0, 0.21, 0);

    const grassMat = this.createGradientMaterial({
      color: 0x65a30d,
      bottomColor: 0x166534,
      topColor: 0xa3e635,
      minY: 0,
      maxY: 0.42,
      side: THREE.DoubleSide
    });

    const instMesh = new THREE.InstancedMesh(bladeGeo, grassMat, totalBlades);
    instMesh.castShadow = false; // Zero shadow-map pass overhead for grass
    instMesh.receiveShadow = true;
    instMesh.frustumCulled = true;

    let idx = 0;
    for (let s = 0; s < grassSeeds.length; s++) {
      const seed = grassSeeds[s];
      const gy = getHeight(seed.x, seed.z);
      const scale = 0.85 + (s % 4) * 0.15;
      const baseRot = (s * 1.37) % (Math.PI * 2);

      for (let b = 0; b < 5; b++) {
        dummy.position.set(seed.x, gy, seed.z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(
          ((b % 3) - 1) * 0.16,
          baseRot + (b * Math.PI) / 2.5 + b * 0.2,
          (b % 2 === 0 ? 1 : -1) * 0.12
        );
        dummy.updateMatrix();
        instMesh.setMatrixAt(idx++, dummy.matrix);
      }
    }

    instMesh.instanceMatrix.needsUpdate = true;
    return instMesh;
  }

  /**
   * 5. Instanced Micro Grass Tufts Batch
   */
  public static buildInstancedMicroGrass(
    microSeeds: { x: number; z: number }[],
    getHeight: (x: number, z: number) => number
  ): THREE.InstancedMesh {
    const totalBlades = microSeeds.length * 3;
    const dummy = new THREE.Object3D();

    const bladeGeo = new THREE.PlaneGeometry(0.08, 0.24);
    bladeGeo.translate(0, 0.12, 0);

    const mat = this.createGradientMaterial({
      color: 0x65a30d,
      bottomColor: 0x14532d,
      topColor: 0xbef264,
      minY: 0,
      maxY: 0.24,
      side: THREE.DoubleSide
    });

    const instMesh = new THREE.InstancedMesh(bladeGeo, mat, totalBlades);
    instMesh.castShadow = false; // Zero shadow pass overhead for micro grass
    instMesh.receiveShadow = true;
    instMesh.frustumCulled = true;

    let idx = 0;
    for (let s = 0; s < microSeeds.length; s++) {
      const seed = microSeeds[s];
      const gy = getHeight(seed.x, seed.z);
      const scale = 0.8 + (s % 3) * 0.25;
      const baseRot = (s * 1.6) % (Math.PI * 2);

      for (let b = 0; b < 3; b++) {
        dummy.position.set(seed.x, gy, seed.z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(
          ((b % 2) - 0.5) * 0.22,
          baseRot + (b * Math.PI) / 1.5,
          0
        );
        dummy.updateMatrix();
        instMesh.setMatrixAt(idx++, dummy.matrix);
      }
    }

    instMesh.instanceMatrix.needsUpdate = true;
    return instMesh;
  }

  /**
   * 6. Instanced Wildflowers Batch
   */
  public static buildInstancedWildflowers(
    flowerSpots: { x: number; z: number; col: number }[],
    getHeight: (x: number, z: number) => number
  ): THREE.Group {
    const group = new THREE.Group();
    const total = flowerSpots.length * 4;
    if (total === 0) return group;

    const dummy = new THREE.Object3D();

    const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.28, 4);
    stemGeo.translate(0, 0.14, 0);
    const stemMat = this.createGradientMaterial({
      color: 0x16a34a,
      bottomColor: 0x14532d,
      topColor: 0x4ade80,
      minY: 0,
      maxY: 0.28
    });
    const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, total);
    stemInst.castShadow = false; // Zero shadow-map pass for flowers
    stemInst.receiveShadow = true;
    stemInst.frustumCulled = true;

    const blossomGeo = new THREE.DodecahedronGeometry(0.08);
    const blossomMat = new THREE.MeshBasicMaterial();
    const blossomInst = new THREE.InstancedMesh(blossomGeo, blossomMat, total);
    blossomInst.castShadow = false;
    blossomInst.receiveShadow = true;
    blossomInst.frustumCulled = true;

    const coreGeo = new THREE.SphereGeometry(0.035, 4, 4);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const coreInst = new THREE.InstancedMesh(coreGeo, coreMat, total);
    coreInst.castShadow = false;
    coreInst.receiveShadow = true;
    coreInst.frustumCulled = true;

    let idx = 0;
    const col = new THREE.Color();

    for (const spot of flowerSpots) {
      col.set(spot.col);
      for (let i = 0; i < 4; i++) {
        const ox = Math.sin(i * 1.5) * 0.35;
        const oz = Math.cos(i * 1.8) * 0.35;
        const fx = spot.x + ox;
        const fz = spot.z + oz;
        const fy = getHeight(fx, fz);

        dummy.position.set(fx, fy, fz);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, (i * 1.1) % Math.PI, 0);
        dummy.updateMatrix();
        stemInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(fx, fy + 0.26, fz);
        dummy.updateMatrix();
        blossomInst.setMatrixAt(idx, dummy.matrix);
        blossomInst.setColorAt(idx, col);

        dummy.position.set(fx, fy + 0.27, fz);
        dummy.updateMatrix();
        coreInst.setMatrixAt(idx, dummy.matrix);

        idx++;
      }
    }

    stemInst.instanceMatrix.needsUpdate = true;
    blossomInst.instanceMatrix.needsUpdate = true;
    if (blossomInst.instanceColor) blossomInst.instanceColor.needsUpdate = true;
    coreInst.instanceMatrix.needsUpdate = true;

    group.add(stemInst);
    group.add(blossomInst);
    group.add(coreInst);

    return group;
  }

  /**
   * 7. Instanced Ground Pebbles Batch
   */
  public static buildInstancedPebbles(
    pebbleSeeds: { x: number; z: number }[],
    getHeight: (x: number, z: number) => number
  ): THREE.InstancedMesh {
    const count = pebbleSeeds.length;
    const dummy = new THREE.Object3D();

    const geo = new THREE.DodecahedronGeometry(0.16);
    const mat = this.createGradientMaterial({
      color: 0x9ca3af,
      bottomColor: 0x475569,
      topColor: 0xe2e8f0,
      minY: -0.08,
      maxY: 0.08
    });

    const instMesh = new THREE.InstancedMesh(geo, mat, count);
    instMesh.castShadow = false; // Zero shadow pass overhead for tiny pebbles
    instMesh.receiveShadow = true;
    instMesh.frustumCulled = true;

    const colors = [0xb0b8a6, 0x9ca3af, 0xc4b59d, 0x8e9882];
    const col = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const s = pebbleSeeds[i];
      const py = getHeight(s.x, s.z);
      const scale = 0.7 + (i % 4) * 0.2;

      dummy.position.set(s.x, py + 0.08 * scale, s.z);
      dummy.scale.set(scale * 1.2, scale * 0.5, scale * 1.0);
      dummy.rotation.set((i * 0.4) % 0.4, (i * 1.7) % Math.PI, (i * 0.3) % 0.4);
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);

      col.set(colors[i % colors.length]);
      instMesh.setColorAt(i, col);
    }

    instMesh.instanceMatrix.needsUpdate = true;
    if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;

    return instMesh;
  }

  /**
   * 8. Instanced Perimeter Fence Batch with Connected Horizontal Wooden Crossbars
   * Merges vertical posts with 2 horizontal wooden crossbars into a single InstancedMesh,
   * creating a seamless rustic picket fence line in 1 single draw call.
   */
  public static buildInstancedFences(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    getHeight: (x: number, z: number) => number
  ): THREE.InstancedMesh {
    const segments: { x: number; z: number; rotY: number }[] = [];
    const step = 3.5;

    // North side (minZ)
    for (let x = minX; x <= maxX - step; x += step) {
      if (Math.abs(x + step * 0.5) > 2.0) {
        segments.push({ x, z: minZ, rotY: 0 });
      }
    }
    // East side (maxX)
    for (let z = minZ; z <= maxZ - step; z += step) {
      if (Math.abs(z + step * 0.5) > 2.0) {
        segments.push({ x: maxX, z, rotY: -Math.PI / 2 });
      }
    }
    // South side (maxZ)
    for (let x = maxX; x >= minX + step; x -= step) {
      if (Math.abs(x - step * 0.5) > 2.0) {
        segments.push({ x, z: maxZ, rotY: Math.PI });
      }
    }
    // West side (minX)
    for (let z = maxZ; z >= minZ + step; z -= step) {
      if (Math.abs(z - step * 0.5) > 2.0) {
        segments.push({ x: minX, z, rotY: Math.PI / 2 });
      }
    }

    const count = segments.length;
    const dummy = new THREE.Object3D();

    // Build connected fence unit geometry (vertical post + 2 horizontal crossbars)
    const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.3, 6);
    postGeo.translate(0, 0.65, 0);

    const railTopGeo = new THREE.BoxGeometry(step + 0.1, 0.08, 0.08);
    railTopGeo.translate(step * 0.5, 0.98, 0);

    const railBotGeo = new THREE.BoxGeometry(step + 0.1, 0.08, 0.08);
    railBotGeo.translate(step * 0.5, 0.52, 0);

    const fenceUnitGeo = mergeGeometries([postGeo, railTopGeo, railBotGeo], false) || postGeo;

    const fenceMat = this.createGradientMaterial({
      color: 0xa16207,
      bottomColor: 0x713f12,
      topColor: 0xd97706,
      minY: 0,
      maxY: 1.3
    });

    const instMesh = new THREE.InstancedMesh(fenceUnitGeo, fenceMat, count);
    instMesh.castShadow = false; // Zero shadow pass overhead for perimeter fences
    instMesh.receiveShadow = true;
    instMesh.frustumCulled = true;

    for (let i = 0; i < count; i++) {
      const s = segments[i];
      const py = getHeight(s.x, s.z);
      dummy.position.set(s.x, py, s.z);
      dummy.rotation.set(0, s.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }

    instMesh.instanceMatrix.needsUpdate = true;
    return instMesh;
  }

  /**
   * 9. Instanced Dense Evergreen Pine Forest Wall (For Outer Ring Boundaries)
   */
  public static buildInstancedPines(
    positions: THREE.Vector3[],
    getHeight: (x: number, z: number) => number
  ): THREE.Group {
    const group = new THREE.Group();
    const count = positions.length;
    if (count === 0) return group;

    const dummy = new THREE.Object3D();

    // Trunk Geometry
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 2.2, 8);
    trunkGeo.translate(0, 1.1, 0);
    const trunkMat = this.createGradientMaterial({
      color: 0x582f0e,
      bottomColor: 0x331800,
      topColor: 0x7f4f24,
      minY: 0,
      maxY: 2.2
    });

    // Pine Needles Geometry (3 Tiered Cones merged)
    const tier1 = new THREE.ConeGeometry(1.6, 2.2, 7);
    tier1.translate(0, 2.2, 0);
    const tier2 = new THREE.ConeGeometry(1.25, 1.8, 7);
    tier2.translate(0, 3.2, 0);
    const tier3 = new THREE.ConeGeometry(0.85, 1.4, 7);
    tier3.translate(0, 4.2, 0);

    const pineCanopyGeo = mergeGeometries([tier1, tier2, tier3], false) || tier1;
    const pineMat = this.createGradientMaterial({
      color: 0x166534,
      bottomColor: 0x052e16,
      topColor: 0x22c55e,
      minY: 1.1,
      maxY: 4.9
    });

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunkInst.castShadow = false;
    trunkInst.receiveShadow = true;
    trunkInst.frustumCulled = true;

    const canopyInst = new THREE.InstancedMesh(pineCanopyGeo, pineMat, count);
    canopyInst.castShadow = false;
    canopyInst.receiveShadow = true;
    canopyInst.frustumCulled = true;

    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      const py = getHeight(pos.x, pos.z);
      const scale = 0.85 + ((i * 1.3) % 0.45);

      dummy.position.set(pos.x, py, pos.z);
      dummy.scale.set(scale, scale * (0.95 + (i % 3) * 0.1), scale);
      dummy.rotation.set(0, (i * 1.1) % Math.PI, 0);
      dummy.updateMatrix();

      trunkInst.setMatrixAt(i, dummy.matrix);
      canopyInst.setMatrixAt(i, dummy.matrix);
    }

    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;

    group.add(trunkInst);
    group.add(canopyInst);

    return group;
  }

  /**
   * 9. Static Geometry Batching via BufferGeometryUtils.mergeGeometries
   * Merges multiple static child meshes sharing the same material into 1 single mesh,
   * cutting draw calls significantly for town square, fences, lamp posts, signs, benches, etc.
   */
  public static mergeStaticMeshes(
    items: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[],
    material: THREE.Material
  ): THREE.Mesh | null {
    if (items.length === 0) return null;
    const clonedGeos: THREE.BufferGeometry[] = [];
    for (const item of items) {
      const g = item.geometry.clone();
      g.applyMatrix4(item.matrix);
      clonedGeos.push(g);
    }
    const merged = mergeGeometries(clonedGeos, false);
    if (!merged) return null;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    return mesh;
  }

  // =========================================================================
  // SINGLETON PREFAB BUILDERS (For unique interactive objects / signs)
  // =========================================================================

  public static createTree(pos: THREE.Vector3, scale = 1.0): THREE.Group {
    const tree = new THREE.Group();
    const shadow = this.createContactShadowAO(1.5 * scale);
    shadow.position.y = 0.02;
    tree.add(shadow);

    const trunkMat = this.createGradientMaterial({
      color: 0x78350f,
      bottomColor: 0x451a03,
      topColor: 0x92400e,
      minY: -0.9 * scale,
      maxY: 0.9 * scale
    });
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 * scale, 0.42 * scale, 1.8 * scale, 8),
      trunkMat
    );
    trunk.position.y = 0.9 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const leafMatMid = this.createGradientMaterial({
      color: 0x22c55e,
      bottomColor: 0x14532d,
      topColor: 0x86efac,
      minY: -1.4 * scale,
      maxY: 1.4 * scale
    });
    const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 * scale), leafMatMid);
    c1.position.set(0, 2.4 * scale, 0);
    c1.castShadow = true;
    c1.receiveShadow = true;
    tree.add(c1);

    tree.position.copy(pos);
    return tree;
  }

  public static createRock(pos: THREE.Vector3, scale = 1.0, hasMoss = true): THREE.Group {
    const group = new THREE.Group();
    const shadow = this.createContactShadowAO(0.95 * scale);
    shadow.position.y = 0.02;
    group.add(shadow);

    const rockMat = this.createGradientMaterial({
      color: 0x94a3b8,
      bottomColor: 0x475569,
      topColor: 0xcfd8dc,
      minY: -0.5 * scale,
      maxY: 0.75 * scale
    });

    const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 * scale), rockMat);
    mainRock.position.set(0, 0.35 * scale, 0);
    mainRock.rotation.set(0.3, 0.8, 0.4);
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    group.add(mainRock);

    if (hasMoss) {
      const mossMat = this.createGradientMaterial({
        color: 0x65a30d,
        bottomColor: 0x365314,
        topColor: 0xa3e635,
        minY: -0.38 * scale,
        maxY: 0.38 * scale
      });
      const mossCap = new THREE.Mesh(new THREE.OctahedronGeometry(0.38 * scale), mossMat);
      mossCap.position.set(-0.15 * scale, 0.68 * scale, 0.1 * scale);
      mossCap.castShadow = true;
      mossCap.receiveShadow = true;
      group.add(mossCap);
    }

    group.position.copy(pos);
    return group;
  }

  public static createBush(pos: THREE.Vector3, scale = 1.0, withBerries = false): THREE.Group {
    const bush = new THREE.Group();
    const shadow = this.createContactShadowAO(0.75 * scale);
    shadow.position.y = 0.02;
    bush.add(shadow);

    const leafMatA = this.createGradientMaterial({
      color: 0x4ade80,
      bottomColor: 0x15803d,
      topColor: 0x86efac,
      minY: -0.65 * scale,
      maxY: 0.65 * scale
    });
    const lobe1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65 * scale), leafMatA);
    lobe1.position.set(0, 0.48 * scale, 0);
    lobe1.castShadow = true;
    lobe1.receiveShadow = true;
    bush.add(lobe1);

    if (withBerries) {
      const berryMat = this.createGradientMaterial({
        color: 0xf43f5e,
        bottomColor: 0xbe123c,
        topColor: 0xfecdd3,
        minY: -0.09 * scale,
        maxY: 0.09 * scale
      });
      const berryGeo = new THREE.SphereGeometry(0.09 * scale, 6, 6);
      const berry = new THREE.Mesh(berryGeo, berryMat);
      berry.position.set(0.2, 0.7 * scale, 0.4 * scale);
      berry.castShadow = true;
      bush.add(berry);
    }

    bush.position.copy(pos);
    return bush;
  }

  public static createGrassTuft(pos: THREE.Vector3, scale = 1.0): THREE.Group {
    const tuft = new THREE.Group();
    const bladeGeo = new THREE.PlaneGeometry(0.12 * scale, 0.42 * scale);
    bladeGeo.translate(0, 0.21 * scale, 0);

    const mat = this.createGradientMaterial({
      color: 0x65a30d,
      bottomColor: 0x166534,
      topColor: 0xa3e635,
      minY: 0,
      maxY: 0.42 * scale,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(bladeGeo, mat);
      blade.rotation.y = (i * Math.PI) / 2.5 + (i * 0.2);
      blade.rotation.x = ((i % 3) - 1) * 0.16;
      blade.rotation.z = ((i % 2 === 0) ? 1 : -1) * 0.12;
      blade.castShadow = true;
      tuft.add(blade);
    }
    tuft.position.copy(pos);
    return tuft;
  }

  public static createContactShadowAO(radius: number): THREE.Mesh {
    const texture = this.getShadowTexture();
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -2.0
    });

    const shadow = new THREE.Mesh(geo, mat);
    shadow.renderOrder = 1;
    return shadow;
  }
}
