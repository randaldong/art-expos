// Interactive 3D hero: a masterpiece suspended in a dark volumetric gallery.
// Grab and spin it freely in any direction — full 360°, real inertia, and it
// stays wherever you leave it (no forced snap-back). Falls back silently to the
// DOM frame if WebGL is unavailable.
import * as THREE from "three";

export async function createHeroScene({ canvas, initialImage, onActivate }) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    return null; // no WebGL — caller keeps the CSS frame
  }
  if (!renderer.capabilities.isWebGL2 && !renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // ---- A soft studio environment so the gilded frame catches real reflections ----
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = buildEnvScene();
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;

  // ---- Lighting: warm museum picture-light + cool fill + gold rim ----
  const ambient = new THREE.AmbientLight(0xffe9cf, 0.4);
  scene.add(ambient);

  const keyLight = new THREE.SpotLight(0xffd9a0, 3.4, 46, Math.PI / 5, 0.55, 1.1);
  keyLight.position.set(-4.5, 6.4, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.0002;
  scene.add(keyLight);
  scene.add(keyLight.target);

  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.32);
  fill.position.set(5, -1, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffcf94, 0.7);
  rim.position.set(2, 3, -5);
  scene.add(rim);

  // ---- The painting + gilded frame, grouped so it spins as one solid object ----
  const artwork = new THREE.Group();
  scene.add(artwork);

  const PROPORTION = 1.32; // height / width
  const artWidth = 3.0;
  const artHeight = artWidth * PROPORTION;
  const frameDepth = 0.3;
  const frameLip = 0.44;

  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  // Solid body of the picture (so edges/back read as a real object when flipped).
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x201517,
    roughness: 0.82,
    metalness: 0.05,
  });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(artWidth + 0.04, artHeight + 0.04, frameDepth),
    bodyMat,
  );
  body.castShadow = true;
  body.receiveShadow = true;
  artwork.add(body);

  // Front face: the painting.
  const canvasMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
  });
  const paintingMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(artWidth, artHeight),
    canvasMat,
  );
  paintingMesh.position.z = frameDepth / 2 + 0.012;
  paintingMesh.receiveShadow = true;
  artwork.add(paintingMesh);

  // Back face: a printed label / stretcher hint, visible when you flip it around.
  const backMat = new THREE.MeshStandardMaterial({
    color: 0xd8c8a8,
    roughness: 0.95,
    metalness: 0,
  });
  const backMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(artWidth * 0.92, artHeight * 0.92),
    backMat,
  );
  backMesh.position.z = -frameDepth / 2 - 0.012;
  backMesh.rotation.y = Math.PI;
  artwork.add(backMesh);

  // Cross-brace on the back for a believable stretcher.
  const braceMat = new THREE.MeshStandardMaterial({ color: 0x7c5a34, roughness: 0.7 });
  const braceH = new THREE.Mesh(
    new THREE.BoxGeometry(artWidth * 0.9, 0.16, 0.05),
    braceMat,
  );
  braceH.position.z = -frameDepth / 2 - 0.03;
  artwork.add(braceH);
  const braceV = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, artHeight * 0.9, 0.05),
    braceMat,
  );
  braceV.position.z = -frameDepth / 2 - 0.03;
  artwork.add(braceV);

  // Gilded frame: one extruded, beveled ring rather than four flat bars.
  // The continuous highlight makes it read like a machined museum object.
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xbf9350,
    roughness: 0.26,
    metalness: 1.0,
    envMapIntensity: 1.35,
    emissive: 0x2a1c0c,
    emissiveIntensity: 0.2,
  });
  const outerW = artWidth + frameLip * 2;
  const outerH = artHeight + frameLip * 2;

  const frameShape = new THREE.Shape();
  frameShape.moveTo(-outerW / 2, -outerH / 2);
  frameShape.lineTo(outerW / 2, -outerH / 2);
  frameShape.lineTo(outerW / 2, outerH / 2);
  frameShape.lineTo(-outerW / 2, outerH / 2);
  frameShape.closePath();

  const frameOpening = new THREE.Path();
  frameOpening.moveTo(-artWidth / 2, -artHeight / 2);
  frameOpening.lineTo(-artWidth / 2, artHeight / 2);
  frameOpening.lineTo(artWidth / 2, artHeight / 2);
  frameOpening.lineTo(artWidth / 2, -artHeight / 2);
  frameOpening.closePath();
  frameShape.holes.push(frameOpening);

  const frameGeometry = new THREE.ExtrudeGeometry(frameShape, {
    depth: frameDepth + 0.12,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.075,
    bevelThickness: 0.075,
    curveSegments: 2,
  });
  frameGeometry.translate(0, 0, -(frameDepth + 0.12) / 2);
  const frameRing = new THREE.Mesh(frameGeometry, goldMat);
  frameRing.castShadow = true;
  frameRing.receiveShadow = true;
  artwork.add(frameRing);

  // Inner dark liner for depth between frame and canvas.
  const liner = new THREE.Mesh(
    new THREE.PlaneGeometry(artWidth + 0.16, artHeight + 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0d0708, roughness: 1, metalness: 0 }),
  );
  liner.position.z = frameDepth / 2 + 0.006;
  artwork.add(liner);

  // ---- Soft contact shadow catcher behind ----
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ opacity: 0.42 }),
  );
  shadowPlane.position.z = -2.2;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // ---- Load painting texture (async, swappable) ----
  function applyTexture(url) {
    return new Promise((resolve) => {
      loader.load(
        url,
        (sourceTexture) => {
          const source = sourceTexture.image;
          const mounted = document.createElement("canvas");
          mounted.width = 1200;
          mounted.height = Math.round(mounted.width * PROPORTION);
          const context = mounted.getContext("2d");
          const sourceWidth = source.naturalWidth || source.width;
          const sourceHeight = source.naturalHeight || source.height;
          if (!context || !sourceWidth || !sourceHeight) {
            sourceTexture.dispose();
            resolve(false);
            return;
          }
          context.fillStyle = "#181113";
          context.fillRect(0, 0, mounted.width, mounted.height);

          const padding = 28;
          const availableWidth = mounted.width - padding * 2;
          const availableHeight = mounted.height - padding * 2;
          const scale = Math.min(
            availableWidth / sourceWidth,
            availableHeight / sourceHeight,
          );
          const width = sourceWidth * scale;
          const height = sourceHeight * scale;
          context.drawImage(
            source,
            (mounted.width - width) / 2,
            (mounted.height - height) / 2,
            width,
            height,
          );

          const texture = new THREE.CanvasTexture(mounted);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(
            8,
            renderer.capabilities.getMaxAnisotropy(),
          );
          const prev = canvasMat.map;
          canvasMat.map = texture;
          canvasMat.color.set(0xffffff);
          canvasMat.needsUpdate = true;
          if (prev) prev.dispose();
          sourceTexture.dispose();
          resolve(true);
        },
        undefined,
        () => resolve(false),
      );
    });
  }
  if (initialImage) await applyTexture(initialImage);

  function tweenCanvasOpacity(target, duration) {
    if (reduceMotion || duration <= 1) {
      canvasMat.opacity = target;
      return Promise.resolve();
    }
    const start = canvasMat.opacity;
    const startedAt = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        canvasMat.opacity = THREE.MathUtils.lerp(start, target, eased);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  // ---- Interaction: free-spin in any direction, inertia, no snap-back ----
  const rest = { x: -0.1, y: -0.3 };
  const rot = { x: rest.x, y: rest.y };
  const vel = { x: 0, y: 0 };
  let transition = null;
  let dragging = false;
  let last = { x: 0, y: 0 };
  let moved = 0;
  let downTime = 0;

  function onDown(event) {
    dragging = true;
    transition = null;
    moved = 0;
    downTime = performance.now();
    last = { x: event.clientX, y: event.clientY };
    vel.x = 0;
    vel.y = 0;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add("is-grabbing");
  }
  function onMove(event) {
    if (!dragging) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    moved += Math.abs(dx) + Math.abs(dy);
    // Free rotation: horizontal drag → yaw, vertical drag → pitch. No clamp.
    vel.y = dx * 0.0075;
    vel.x = dy * 0.0075;
    rot.y += vel.y;
    rot.x += vel.x;
    last = { x: event.clientX, y: event.clientY };
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove("is-grabbing");
    const quick = performance.now() - downTime < 260;
    if (quick && moved < 6 && onActivate) onActivate();
  }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  // Keep vertical page scroll possible: only claim the gesture once dragging.
  canvas.style.touchAction = "none";

  // ---- Resize to the hero-art box ----
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = 9 / Math.min(1, (w / h) / 0.7);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  resize();

  // ---- Render loop ----
  let running = true;
  let visible = true;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (visible = e.isIntersecting)),
    { threshold: 0.01 },
  );
  io.observe(canvas);

  const clock = new THREE.Clock();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) return;

    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    if (transition && !dragging) {
      const progress = Math.min(1, (performance.now() - transition.startedAt) / transition.duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      rot.x = THREE.MathUtils.lerp(transition.fromX, transition.toX, eased);
      rot.y = THREE.MathUtils.lerp(transition.fromY, transition.toY, eased);
      if (progress === 1) transition = null;
    } else if (!dragging) {
      // Inertia: keep spinning where the user threw it, decaying smoothly.
      rot.y += vel.y;
      rot.x += vel.x;
      const decay = Math.pow(0.94, dt * 60);
      vel.x *= decay;
      vel.y *= decay;
      if (Math.abs(vel.x) < 1e-5) vel.x = 0;
      if (Math.abs(vel.y) < 1e-5) vel.y = 0;

      // When essentially at rest, add only a whisper of idle life — no snap-home.
      if (!reduceMotion && vel.x === 0 && vel.y === 0) {
        rot.y += Math.sin(t * 0.35) * 0.00035;
        rot.x += Math.cos(t * 0.28) * 0.00022;
      }
    }

    artwork.rotation.y = rot.y;
    artwork.rotation.x = rot.x;
    // Key light drifts so the gilt always keeps a live highlight.
    keyLight.target.position.set(Math.sin(rot.y) * 2, 0, 1);
    renderer.render(scene, camera);
  }
  frame();

  canvas.classList.add("is-ready");

  return {
    async setArtwork(url) {
      await tweenCanvasOpacity(0.08, 180);
      const ok = await applyTexture(url);
      if (ok) {
        vel.x = 0;
        vel.y = 0;
        transition = {
          fromX: rot.x,
          fromY: rot.y,
          toX: nearestEquivalentAngle(rot.x, rest.x),
          toY: nearestEquivalentAngle(rot.y, rest.y),
          startedAt: performance.now(),
          duration: reduceMotion ? 1 : 720,
        };
      }
      await tweenCanvasOpacity(1, 360);
      return ok;
    },
    resetView() {
      vel.x = 0;
      vel.y = 0;
      transition = {
        fromX: rot.x,
        fromY: rot.y,
        toX: nearestEquivalentAngle(rot.x, rest.x),
        toY: nearestEquivalentAngle(rot.y, rest.y),
        startedAt: performance.now(),
        duration: reduceMotion ? 1 : 620,
      };
    },
    dispose() {
      running = false;
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

function nearestEquivalentAngle(current, target) {
  const turns = Math.round((current - target) / (Math.PI * 2));
  return target + turns * Math.PI * 2;
}

// A tiny scene of soft emissive panels; PMREM turns it into a studio env map
// so the gold frame reflects warm/cool gradients instead of looking flat.
function buildEnvScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x120a0c);
  const make = (color, intensity, x, y, z, w, h) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color }),
    );
    m.material.color.multiplyScalar(intensity);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  make(0xffd9a0, 2.4, -6, 4, 4, 10, 10); // warm key
  make(0x9fb4ff, 1.2, 7, -2, 3, 8, 8); // cool fill
  make(0xffcf94, 1.6, 2, 3, -6, 9, 6); // warm rim behind
  make(0x1a1013, 1.0, 0, -6, 0, 20, 12); // dark floor
  return s;
}
