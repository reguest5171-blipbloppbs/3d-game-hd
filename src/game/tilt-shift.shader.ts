import * as THREE from 'three';

/**
 * Lightweight Single-Pass Tilt-Shift Diorama Shader
 * - Produces an aesthetic miniature tilt-shift effect with blurred top (mountains/sky)
 *   and bottom edges (foreground), keeping the player and farm plots tack-sharp in center.
 * - Uses a fast early-exit path for the in-focus central band (0 blur overhead in gameplay area).
 * - Samples only 4 neighboring taps at the blurred edges for silky smooth 60 FPS on mobile.
 */
export const TiltShiftShader = {
  name: 'TiltShiftShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    focusY: { value: 0.52 },
    focusRange: { value: 0.42 },
    blurRadius: { value: 0.0035 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float focusY;
    uniform float focusRange;
    uniform float blurRadius;
    varying vec2 vUv;

    void main() {
      float dist = abs(vUv.y - focusY);
      // Smooth transition from sharp focal band to soft miniature blur
      float blurFactor = smoothstep(focusRange * 0.5, 0.5, dist);

      if (blurFactor < 0.01) {
        // Fast path for in-focus central gameplay area: 1 texture lookup, 0 overhead!
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      // Fast 5-tap Poisson blur with subtle lens warmth
      float r = blurRadius * blurFactor;
      vec4 sum = texture2D(tDiffuse, vUv) * 0.32;
      sum += texture2D(tDiffuse, vUv + vec2(0.0, r * 1.5)) * 0.17;
      sum += texture2D(tDiffuse, vUv - vec2(0.0, r * 1.5)) * 0.17;
      sum += texture2D(tDiffuse, vUv + vec2(r * 1.2, r * 0.8)) * 0.17;
      sum += texture2D(tDiffuse, vUv - vec2(r * 1.2, r * 0.8)) * 0.17;

      // Subtle diorama warmth on peripheral blur
      sum.rgb = mix(sum.rgb, sum.rgb * vec3(1.02, 1.01, 0.99), blurFactor * 0.15);

      gl_FragColor = sum;
    }
  `
};
