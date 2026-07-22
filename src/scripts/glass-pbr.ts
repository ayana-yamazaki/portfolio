import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { glassDebugModes, readGlassConfig } from './glass-config';

const canvas = document.querySelector<HTMLCanvasElement>('[data-glass-pbr]');
const backdrop = document.querySelector<HTMLImageElement>('[data-hero-backdrop]');
const glassCard = canvas?.closest<HTMLElement>('.material-card--glass');
const textureSrc = canvas?.dataset.textureSrc;

const createShadowTexture = () => {
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 64;
  const context = shadowCanvas.getContext('2d');

  if (context) {
    const gradient = context.createRadialGradient(128, 32, 2, 128, 32, 120);
    gradient.addColorStop(0, 'rgba(33, 31, 29, .3)');
    gradient.addColorStop(.46, 'rgba(57, 54, 51, .12)');
    gradient.addColorStop(1, 'rgba(57, 54, 51, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 64);
  }

  const texture = new THREE.CanvasTexture(shadowCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

if (canvas && backdrop && glassCard && textureSrc) {
  canvas.dataset.rendererState = 'initializing';

  try {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    renderer.setClearColor(0xf3f0ec, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 3;

    const backdropTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    const horizontalBlurTarget = backdropTarget.clone();
    const blurredBackdropTarget = backdropTarget.clone();

    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const horizontalBlurMaterial = new THREE.ShaderMaterial({
      ...HorizontalBlurShader,
      uniforms: THREE.UniformsUtils.clone(HorizontalBlurShader.uniforms),
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const verticalBlurMaterial = new THREE.ShaderMaterial({
      ...VerticalBlurShader,
      uniforms: THREE.UniformsUtils.clone(VerticalBlurShader.uniforms),
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const horizontalBlurScene = new THREE.Scene();
    horizontalBlurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), horizontalBlurMaterial));
    const verticalBlurScene = new THREE.Scene();
    verticalBlurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), verticalBlurMaterial));

    const colorTarget = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    colorTarget.samples = 4;
    const maskTarget = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    maskTarget.samples = 4;

    const compositeScene = new THREE.Scene();
    const compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: colorTarget.texture },
        uMask: { value: maskTarget.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uColor;
        uniform sampler2D uMask;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(uColor, vUv);
          float mask = texture2D(uMask, vUv).r;
          float alpha = color.a * smoothstep(0.04, 0.96, mask);
          gl_FragColor = vec4(color.rgb, alpha);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositeMaterial));
    const maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    let textureReady = false;
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 2;
    textureCanvas.height = 2;
    const textureContext = textureCanvas.getContext('2d');
    if (!textureContext) throw new Error('Unable to create the backdrop texture canvas');
    const texture = new THREE.CanvasTexture(textureCanvas);
    const markTextureReady = () => {
      textureCanvas.width = backdrop.naturalWidth;
      textureCanvas.height = backdrop.naturalHeight;
      textureContext.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
      textureContext.drawImage(backdrop, 0, 0, textureCanvas.width, textureCanvas.height);
      if (canvas.hasAttribute('data-glass-harness')) {
        const centerPixel = textureContext.getImageData(
          Math.floor(textureCanvas.width / 2),
          Math.floor(textureCanvas.height / 2),
          1,
          1,
        ).data;
        canvas.dataset.textureSample = Array.from(centerPixel).join(',');
      }
      texture.needsUpdate = true;
      textureReady = true;
      canvas.dataset.rendererState = 'ready';
      glassCard.classList.add('is-pbr-ready');
      requestAnimationFrame(() => syncScene());
    };
    const markTextureError = () => {
      canvas.dataset.rendererState = 'error';
      canvas.dataset.rendererError = 'texture-load';
      canvas.hidden = true;
    };

    if (backdrop.complete && backdrop.naturalWidth > 0) {
      markTextureReady();
    } else {
      backdrop.addEventListener('load', markTextureReady, { once: true });
      backdrop.addEventListener('error', markTextureError, { once: true });
    }

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const backgroundUniforms = {
      uTexture: { value: texture },
      uUvOffset: { value: new THREE.Vector2() },
      uUvScale: { value: new THREE.Vector2(1, 1) },
    };
    const backgroundMaterial = new THREE.ShaderMaterial({
      uniforms: backgroundUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uTexture;
        uniform vec2 uUvOffset;
        uniform vec2 uUvScale;
        varying vec2 vUv;

        void main() {
          vec2 mappedUv = uUvOffset + vUv * uUvScale;
          float inside = step(0.0, mappedUv.x) * step(mappedUv.x, 1.0)
            * step(0.0, mappedUv.y) * step(mappedUv.y, 1.0);
          vec4 image = texture2D(uTexture, clamp(mappedUv, 0.0, 1.0));
          float luminance = dot(image.rgb, vec3(0.2126, 0.7152, 0.0722));
          image.rgb = mix(vec3(luminance), image.rgb, 1.0);
          vec3 studioBackground = vec3(0.95, 0.94, 0.93);
          vec3 color = mix(studioBackground, image.rgb, image.a * inside);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthWrite: false,
      toneMapped: false,
    });
    const backgroundPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backgroundMaterial);
    backgroundPlane.position.z = -1.8;
    const backdropScene = new THREE.Scene();
    backdropScene.add(backgroundPlane);

    const glassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSharpBackdrop: { value: backdropTarget.texture },
        uBlurredBackdrop: { value: blurredBackdropTarget.texture },
        uCardBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
        uCardSize: { value: new THREE.Vector2(1, 1) },
        uCanvasSize: { value: new THREE.Vector2(1, 1) },
        uCornerRadius: { value: 38 },
        uRimWidth: { value: 30 },
        uRimDisplacement: { value: 50 },
        uScatterStrength: { value: 3.2 },
        uFrostAmount: { value: 0.8 },
        uLightDirection: { value: new THREE.Vector2(-0.68, 0.74) },
        uDebugMode: { value: glassDebugModes.final },
      },
      vertexShader: `
        varying vec2 vScreenUv;
        varying vec3 vViewNormal;

        void main() {
          vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vScreenUv = clipPosition.xy / clipPosition.w * 0.5 + 0.5;
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = clipPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uSharpBackdrop;
        uniform sampler2D uBlurredBackdrop;
        uniform vec4 uCardBounds;
        uniform vec2 uCardSize;
        uniform vec2 uCanvasSize;
        uniform float uCornerRadius;
        uniform float uRimWidth;
        uniform float uRimDisplacement;
        uniform float uScatterStrength;
        uniform float uFrostAmount;
        uniform vec2 uLightDirection;
        uniform float uDebugMode;
        varying vec2 vScreenUv;
        varying vec3 vViewNormal;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float smoothNoise(vec2 p) {
          vec2 cell = floor(p);
          vec2 fraction = fract(p);
          fraction = fraction * fraction * (3.0 - 2.0 * fraction);
          return mix(
            mix(hash(cell), hash(cell + vec2(1.0, 0.0)), fraction.x),
            mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), fraction.x),
            fraction.y
          );
        }

        float roundedBoxDistance(vec2 point, vec2 halfSize, float radius) {
          vec2 q = abs(point) - halfSize + radius;
          return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
        }

        void main() {
          vec2 localUv = (vScreenUv - uCardBounds.xy) / (uCardBounds.zw - uCardBounds.xy);
          vec2 cardPoint = (localUv - 0.5) * uCardSize;
          vec2 halfSize = uCardSize * 0.5;
          float signedDistance = roundedBoxDistance(cardPoint, halfSize, uCornerRadius);
          float insideDistance = max(-signedDistance, 0.0);
          float rim = 1.0 - smoothstep(0.0, uRimWidth, insideDistance);

          float gradientStep = 0.7;
          vec2 rimGradient = vec2(
            roundedBoxDistance(cardPoint + vec2(gradientStep, 0.0), halfSize, uCornerRadius)
              - roundedBoxDistance(cardPoint - vec2(gradientStep, 0.0), halfSize, uCornerRadius),
            roundedBoxDistance(cardPoint + vec2(0.0, gradientStep), halfSize, uCornerRadius)
              - roundedBoxDistance(cardPoint - vec2(0.0, gradientStep), halfSize, uCornerRadius)
          );
          vec2 rimNormal = rimGradient / max(length(rimGradient), 0.0001);

          vec2 noisePoint = vScreenUv * uCanvasSize / 72.0;
          vec2 scatterNoise = vec2(
            smoothNoise(noisePoint),
            smoothNoise(noisePoint + vec2(31.7, 18.4))
          ) - 0.5;
          vec2 scatterUv = clamp(
            vScreenUv + scatterNoise * (uScatterStrength / uCanvasSize),
            vec2(0.002),
            vec2(0.998)
          );

          vec3 sharpBackdrop = texture2D(uSharpBackdrop, vScreenUv).rgb;
          vec3 frostedBackdrop = texture2D(uBlurredBackdrop, scatterUv).rgb;
          float scatterVariation = smoothNoise(noisePoint * 0.46 + vec2(7.3, 11.8));
          float frostAmount = clamp(uFrostAmount + (scatterVariation - 0.5) * 0.1, 0.0, 1.0);
          vec3 surfaceColor = mix(sharpBackdrop, frostedBackdrop, frostAmount);

          float bevel = pow(rim, 1.05);
          float refractionProfile = smoothstep(0.04, 0.94, bevel);
          vec2 rimOffset = rimNormal * (uRimDisplacement / uCanvasSize) * refractionProfile;
          vec2 refractedUv = clamp(vScreenUv - rimOffset, vec2(0.002), vec2(0.998));
          vec2 internalUv = clamp(vScreenUv + rimOffset * 0.32, vec2(0.002), vec2(0.998));
          vec2 chromaticOffset = rimNormal * (1.35 / uCanvasSize) * refractionProfile;
          vec3 refractedSharp = vec3(
            texture2D(uSharpBackdrop, clamp(refractedUv + chromaticOffset, vec2(0.002), vec2(0.998))).r,
            texture2D(uSharpBackdrop, refractedUv).g,
            texture2D(uSharpBackdrop, clamp(refractedUv - chromaticOffset, vec2(0.002), vec2(0.998))).b
          );
          vec3 refractedSoft = texture2D(uBlurredBackdrop, refractedUv).rgb;
          vec3 refractedColor = mix(refractedSharp, refractedSoft, 0.18);
          vec3 internalReflection = texture2D(uSharpBackdrop, internalUv).rgb;
          refractedColor = mix(refractedColor, internalReflection, bevel * 0.12);

          vec3 viewNormal = normalize(vViewNormal);
          float geometricRim = pow(1.0 - abs(viewNormal.z), 1.65);
          float rightThickness = smoothstep(0.18, 0.82, max(viewNormal.x, 0.0));
          float bottomThickness = smoothstep(0.18, 0.82, max(-viewNormal.y, 0.0));
          float visibleThickness = max(rightThickness, bottomThickness);
          vec2 lightDirection = uLightDirection / max(length(uLightDirection), 0.0001);
          float lightFacing = pow(max(dot(rimNormal, lightDirection), 0.0), 1.55);
          float shadowFacing = pow(max(dot(rimNormal, -lightDirection), 0.0), 1.3);
          float innerCaustic = exp(-pow((insideDistance - 13.0) / 5.5, 2.0));
          float edgeReflection = 1.0 - smoothstep(0.0, 4.2, insideDistance);

          vec3 color = mix(surfaceColor, refractedColor, smoothstep(0.05, 0.68, bevel));
          color = mix(color, vec3(1.0), innerCaustic * lightFacing * 0.12);
          color = mix(color, vec3(1.0), edgeReflection * lightFacing * 0.62);
          color *= 1.0 - bevel * shadowFacing * 0.32;
          color = mix(
            color,
            vec3(0.96, 0.97, 0.97),
            geometricRim * lightFacing * 0.18
          );
          color *= 1.0 - rightThickness * 0.15 - bottomThickness * 0.21;
          color = mix(color, vec3(0.2, 0.24, 0.25), visibleThickness * 0.08);
          float alpha = clamp(
            smoothstep(0.04, 0.7, bevel) * mix(0.14, 0.52, lightFacing)
              + geometricRim * (0.08 + lightFacing * 0.36)
              + innerCaustic * lightFacing * 0.12
              + edgeReflection * lightFacing * 0.28
              + rightThickness * 0.32
              + bottomThickness * 0.4,
            0.0,
            0.94
          );

          if (uDebugMode > 0.5 && uDebugMode < 1.5) {
            color = sharpBackdrop;
            alpha = 1.0;
          } else if (uDebugMode > 1.5 && uDebugMode < 2.5) {
            color = frostedBackdrop;
            alpha = 1.0;
          } else if (uDebugMode > 2.5 && uDebugMode < 3.5) {
            color = vec3(rim);
            alpha = 1.0;
          } else if (uDebugMode > 3.5 && uDebugMode < 4.5) {
            color = min(abs(frostedBackdrop - sharpBackdrop) * 5.0, vec3(1.0));
            alpha = 1.0;
          }

          gl_FragColor = vec4(color, alpha);
        }
      `,
      side: THREE.FrontSide,
      depthWrite: true,
      toneMapped: false,
    });

    const glassMesh = new THREE.Mesh(new THREE.BufferGeometry(), glassMaterial);
    glassMesh.layers.set(1);
    scene.add(glassMesh);

    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: createShadowTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial);
    contactShadow.position.z = -0.9;
    scene.add(contactShadow);

    let lastCanvasWidth = 0;
    let lastCanvasHeight = 0;
    let lastFrontWidth = 0;
    let lastFrontHeight = 0;
    let lastThickness = 0;
    let lastCornerRadius = 0;
    let hoverTarget = 0;
    let hoverAmount = 0;
    let isVisible = true;
    let lastCoverage = -1;

    const applyRuntimeConfig = () => {
      const config = readGlassConfig(canvas);
      glassMaterial.uniforms.uRimWidth.value = config.rimWidth;
      glassMaterial.uniforms.uRimDisplacement.value = config.rimDisplacement;
      glassMaterial.uniforms.uScatterStrength.value = config.scatterStrength;
      glassMaterial.uniforms.uFrostAmount.value = config.frostAmount;
      glassMaterial.uniforms.uLightDirection.value.set(config.lightX, config.lightY);
      glassMaterial.uniforms.uDebugMode.value = glassDebugModes[config.debugMode];
      glassCard.style.setProperty('--glass-blur', `${config.blurStep}px`);
      glassCard.style.setProperty('--glass-veil-opacity', String(config.veilOpacity));

      if (lastCanvasWidth && lastCanvasHeight) {
        horizontalBlurMaterial.uniforms.h.value = config.blurStep / lastCanvasWidth;
        verticalBlurMaterial.uniforms.v.value = config.blurStep / lastCanvasHeight;
      }

      return config;
    };

    const syncScene = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const cardRect = glassCard.getBoundingClientRect();
      const backdropRect = backdrop.getBoundingClientRect();
      if (!canvasRect.width || !canvasRect.height || !backdropRect.width || !backdropRect.height) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvasRect.width !== lastCanvasWidth || canvasRect.height !== lastCanvasHeight) {
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(canvasRect.width, canvasRect.height, false);
        colorTarget.setSize(canvasRect.width * pixelRatio, canvasRect.height * pixelRatio);
        maskTarget.setSize(canvasRect.width * pixelRatio, canvasRect.height * pixelRatio);
        const blurWidth = Math.max(1, Math.round(canvasRect.width * pixelRatio));
        const blurHeight = Math.max(1, Math.round(canvasRect.height * pixelRatio));
        backdropTarget.setSize(blurWidth, blurHeight);
        horizontalBlurTarget.setSize(blurWidth, blurHeight);
        blurredBackdropTarget.setSize(blurWidth, blurHeight);
        lastCanvasWidth = canvasRect.width;
        lastCanvasHeight = canvasRect.height;

        const aspect = canvasRect.width / canvasRect.height;
        camera.left = -aspect;
        camera.right = aspect;
        camera.top = 1;
        camera.bottom = -1;
        camera.updateProjectionMatrix();
        backgroundPlane.scale.set(aspect, 1, 1);
      }

      const config = applyRuntimeConfig();

      backgroundUniforms.uUvOffset.value.set(
        (canvasRect.left - backdropRect.left) / backdropRect.width,
        1 - ((canvasRect.bottom - backdropRect.top) / backdropRect.height),
      );
      backgroundUniforms.uUvScale.value.set(
        canvasRect.width / backdropRect.width,
        canvasRect.height / backdropRect.height,
      );

      const overlapWidth = Math.max(0, Math.min(canvasRect.right, backdropRect.right)
        - Math.max(canvasRect.left, backdropRect.left));
      const overlapHeight = Math.max(0, Math.min(canvasRect.bottom, backdropRect.bottom)
        - Math.max(canvasRect.top, backdropRect.top));
      const coverage = (overlapWidth * overlapHeight) / (canvasRect.width * canvasRect.height);
      canvas.dataset.coverage = coverage.toFixed(3);
      if (Math.abs(coverage - lastCoverage) > 0.001) {
        lastCoverage = coverage;
        canvas.dispatchEvent(new CustomEvent('glass:status', {
          bubbles: true,
          detail: {
            textureReady,
            coverage,
            canvasWidth: canvasRect.width,
            canvasHeight: canvasRect.height,
            backdropWidth: backdropRect.width,
            backdropHeight: backdropRect.height,
          },
        }));
      }

      const thicknessPx = Number.parseFloat(getComputedStyle(glassCard).getPropertyValue('--card-thickness')) || 20;
      const radiusPx = Math.min(config.cornerRadius, thicknessPx * 0.48);
      if (cardRect.width !== lastFrontWidth
        || cardRect.height !== lastFrontHeight
        || thicknessPx !== lastThickness
        || radiusPx !== lastCornerRadius) {
        const aspect = canvasRect.width / canvasRect.height;
        const pxToWorldY = 2 / canvasRect.height;
        const pxToWorldX = (aspect * 2) / canvasRect.width;
        const width = cardRect.width * pxToWorldX;
        const height = cardRect.height * pxToWorldY;
        const depth = thicknessPx * pxToWorldY;
        const radius = radiusPx * pxToWorldY;

        glassMesh.geometry.dispose();
        glassMesh.geometry = new RoundedBoxGeometry(width, height, depth, 18, radius);
        glassMaterial.uniforms.uCardBounds.value.set(
          (cardRect.left - canvasRect.left) / canvasRect.width,
          1 - ((cardRect.bottom - canvasRect.top) / canvasRect.height),
          (cardRect.right - canvasRect.left) / canvasRect.width,
          1 - ((cardRect.top - canvasRect.top) / canvasRect.height),
        );
        glassMaterial.uniforms.uCardSize.value.set(cardRect.width, cardRect.height);
        glassMaterial.uniforms.uCanvasSize.value.set(canvasRect.width, canvasRect.height);
        glassMaterial.uniforms.uCornerRadius.value = radiusPx;

        const centerX = (((cardRect.left + cardRect.width / 2) - canvasRect.left) / canvasRect.width * 2 - 1) * aspect;
        const centerY = 1 - (((cardRect.top + cardRect.height / 2) - canvasRect.top) / canvasRect.height * 2);
        glassMesh.position.set(centerX, centerY, 0);

        contactShadow.scale.set(width * 1.04, Math.max(depth * 2.2, 0.08), 1);
        contactShadow.position.set(centerX + depth * 0.55, centerY - height / 2 - depth * 0.42, -0.9);

        lastFrontWidth = cardRect.width;
        lastFrontHeight = cardRect.height;
        lastThickness = thicknessPx;
        lastCornerRadius = radiusPx;
      }
    };

    glassCard.addEventListener('pointerenter', () => { hoverTarget = 1; });
    glassCard.addEventListener('pointerleave', () => { hoverTarget = 0; });
    glassCard.addEventListener('focusin', () => { hoverTarget = 1; });
    glassCard.addEventListener('focusout', () => { hoverTarget = 0; });

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? true;
    });
    observer.observe(glassCard);

    const render = () => {
      requestAnimationFrame(render);
      if (!isVisible || !textureReady) return;

      syncScene();
      const config = applyRuntimeConfig();
      hoverAmount += (hoverTarget - hoverAmount) * 0.08;
      glassMesh.rotation.x = THREE.MathUtils.degToRad(
        THREE.MathUtils.lerp(config.baseTilt, config.hoverTilt, hoverAmount),
      );
      glassMesh.rotation.y = THREE.MathUtils.degToRad(
        THREE.MathUtils.lerp(config.baseYaw, config.hoverYaw, hoverAmount),
      );
      glassMesh.position.z = THREE.MathUtils.lerp(0.055, 0.004, hoverAmount);
      contactShadow.material.opacity = THREE.MathUtils.lerp(0.4, 0.64, hoverAmount);

      renderer.setRenderTarget(backdropTarget);
      renderer.setClearColor(0xf3f0ec, 1);
      renderer.clear(true, true, true);
      renderer.render(backdropScene, camera);
      if (canvas.hasAttribute('data-glass-harness') && !canvas.dataset.renderTargetSample) {
        const targetPixel = new Uint8Array(4);
        renderer.readRenderTargetPixels(
          backdropTarget,
          Math.floor(backdropTarget.width / 2),
          Math.floor(backdropTarget.height / 2),
          1,
          1,
          targetPixel,
        );
        canvas.dataset.renderTargetSample = Array.from(targetPixel).join(',');
      }

      horizontalBlurMaterial.uniforms.tDiffuse.value = backdropTarget.texture;
      renderer.setRenderTarget(horizontalBlurTarget);
      renderer.clear(true, true, true);
      renderer.render(horizontalBlurScene, postCamera);

      verticalBlurMaterial.uniforms.tDiffuse.value = horizontalBlurTarget.texture;
      renderer.setRenderTarget(blurredBackdropTarget);
      renderer.clear(true, true, true);
      renderer.render(verticalBlurScene, postCamera);

      camera.layers.enableAll();
      scene.overrideMaterial = null;
      renderer.setRenderTarget(colorTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      camera.layers.set(1);
      scene.overrideMaterial = maskMaterial;
      renderer.setRenderTarget(maskTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);

      camera.layers.enableAll();
      scene.overrideMaterial = null;
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(compositeScene, compositeCamera);
    };

    render();
  } catch (error) {
    canvas.dataset.rendererState = 'error';
    canvas.dataset.rendererError = error instanceof Error ? error.message : 'webgl-initialization';
    canvas.hidden = true;
  }
}
