import { NeutralToneMapping, OrthographicCamera, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { CAMERA_ANCHORS, CAMERA_PROJECTION, validateCameraAnchors } from '../content/city';
import { createAirplaneVisual } from './airplane';
import type { AirplaneVisual } from './airplane';
import { FrameClock } from './clock';
import { EnvironmentVisual } from './environmentVisual';
import { bindSceneInput } from './input';
import { Locomotion } from './locomotion';
import { LightingVisual } from './lightingVisual';
import type { WorldModel } from './model';
import { buildCityScene } from './scene';
import type { CityScene } from './scene';
import type { Lifecycle, Runtime, WorldCommand } from './types';

interface WorldOptions {
  canvas: HTMLCanvasElement;
  model: WorldModel;
  onChange: () => void;
  onLifecycle: (state: Lifecycle, message: string) => void;
}

export function createWorld({ canvas, model, onChange, onLifecycle }: WorldOptions): Runtime {
  validateCameraAnchors(CAMERA_ANCHORS);
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!context) throw new Error('WebGL2 is unavailable. This browser can’t render the live city.');
  const renderer = new WebGLRenderer({ canvas, context, antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.debug.onShaderError = () => {
    throw new Error('City graphics shaders could not compile. Retry the live city.');
  };
  function buildArt(): CityScene {
    const next = buildCityScene();
    if (next.actors.size !== model.simulation.actors.length ||
      !model.simulation.actors.every(({ id }) => next.actors.has(id))) {
      next.dispose();
      throw new Error('City artwork does not match the active street actors. Retry the live city.');
    }
    return next;
  }
  let art: CityScene;
  try {
    art = buildArt();
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  let lightweight = model.quality === 'lightweight';
  function applyQuality(): void {
    lightweight = model.quality === 'lightweight';
    renderer.shadowMap.enabled = !lightweight;
    renderer.shadowMap.needsUpdate = !lightweight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lightweight ? 1 : 1.5));
  }
  applyQuality();
  const camera = new OrthographicCamera(-63, 63, 63, -63, 0.1, CAMERA_PROJECTION.far);
  const clock = new FrameClock();
  const locomotion = new Locomotion();
  let environment: EnvironmentVisual;
  let lighting: LightingVisual;
  let plane: AirplaneVisual;
  let statusElapsed = 0;
  let shadowWeatherRevision = -1;
  let shadowReducedMotion = model.reducedMotion;
  function attachEffects(): void {
    model.environment.physics.bindSurface(art.weatherSurface.heightAt, art.weatherSurface.snowRetentionAt);
    environment = new EnvironmentVisual(art.scene, art.weatherSurface, art.foliage, art.snowMeshes);
    lighting = new LightingVisual(art.scene, art.vehicleLights, model.simulation.actors, art.weatherSurface);
    plane = createAirplaneVisual();
    art.scene.add(plane.group);
  }
  function detachEffects(): void {
    lighting.dispose();
    environment.dispose();
    plane.dispose();
  }
  attachEffects();
  const listeners = new AbortController();
  let frame: number | null = null;
  let viewDirty = false;
  let disposed = false;
  let lost = false;
  let failed = false;
  let pageHidden = document.hidden;
  let restoreTimeout: ReturnType<typeof setTimeout> | undefined;
  let viewHeight: number = CAMERA_PROJECTION.overviewHeight;
  let lastProjectionZoom = NaN;
  let projectionDirty = true;

  const visible = () => !pageHidden && !document.hidden;
  const available = () => !disposed && !lost && !failed && visible();

  function reportFailure(error: unknown) {
    failed = true;
    halt();
    input.clear();
    onLifecycle('error', error instanceof Error ? error.message : 'The live city could not render. Please retry.');
  }

  function draw() {
    viewDirty = false;
    const { pose } = model.camera;
    for (const actor of model.simulation.actors) {
      const mesh = art.actors.get(actor.id);
      if (!mesh) throw new Error(`Missing original actor geometry: ${actor.id}.`);
      mesh.position.set(actor.position.x, actor.position.y, actor.position.z);
      mesh.rotation.y = actor.heading;
    }
    art.frame({
      signals: model.simulation.traffic.signals,
      elapsedSeconds: model.simulation.elapsed,
      reducedMotion: model.reducedMotion,
      groundLift: model.environment.physics.snowDepth,
      actors: model.simulation.actors,
    });
    const radius = CAMERA_PROJECTION.distance * Math.cos(pose.pitch);
    camera.position.set(pose.x + Math.sin(pose.yaw) * radius, CAMERA_PROJECTION.distance * Math.sin(pose.pitch), pose.z + Math.cos(pose.yaw) * radius);
    camera.lookAt(pose.x, 0, pose.z);
    camera.zoom = pose.zoom;
    if (pose.zoom !== lastProjectionZoom || projectionDirty) {
      camera.updateProjectionMatrix();
      lastProjectionZoom = pose.zoom;
      projectionDirty = false;
    }
    environment.update(model.environment.frame, { reducedMotion: model.reducedMotion, lightweight }, model.environment.physics);
    lighting.update(model.environment.frame, model.environment.physics, model.simulation.elapsed, camera, pose,
      { reducedMotion: model.reducedMotion, lightweight });
    if (!lightweight && (model.environment.physics.revision !== shadowWeatherRevision || model.reducedMotion !== shadowReducedMotion)) {
      renderer.shadowMap.needsUpdate = true;
      shadowWeatherRevision = model.environment.physics.revision;
      shadowReducedMotion = model.reducedMotion;
    }
    const flight = model.airplane.state;
    plane.group.visible = flight.active;
    if (flight.active) {
      plane.group.position.set(flight.position.x, flight.position.y, flight.position.z);
      plane.group.rotation.y = flight.heading;
    }
    renderer.render(art.scene, camera);
  }

  function schedule(explicit = false) {
    if (available() && frame === null && (!model.paused || explicit)) frame = requestAnimationFrame(animate);
  }

  function animate(now: number) {
    frame = null;
    if (!available()) return;
    try {
      const cameraRevision = model.camera.revision;
      let simulated = 0;
      if (!model.paused) {
        clock.advance(now, (dt) => {
          model.step(dt);
          simulated += dt;
        });
      }
      if (simulated > 0) {
        locomotion.update(model.simulation.actors, art.actors, simulated, model.reducedMotion);
        statusElapsed += simulated;
        if (model.camera.revision !== cameraRevision || statusElapsed >= 1) {
          statusElapsed %= 1;
          onChange();
        }
      }
      if (simulated > 0 || viewDirty) draw();
      schedule();
    } catch (error) {
      reportFailure(error);
    }
  }

  function halt() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    clock.reset();
  }

  function command(command: WorldCommand) {
    if (disposed) return;
    const wasPaused = model.paused;
    model.command(command);
    if (command.type === 'set-quality') { applyQuality(); resize(); }
    if (command.type === 'open-panel' || command.type === 'set-reduced-motion') input.clear();
    if ((model.paused && command.type !== 'navigate') || wasPaused !== model.paused) halt();
    onChange();
    if (available()) {
      if (command.type === 'navigate') {
        viewDirty = true;
        schedule(true);
        return;
      }
      try { draw(); } catch (error) { reportFailure(error); }
      schedule();
    }
  }

  const input = bindSceneInput(canvas, {
    command,
    enabled: () => available() && !model.modalOpen,
    scale: () => {
      const scale = viewHeight / Math.max(1, canvas.clientHeight) / model.camera.pose.zoom;
      return { x: scale, y: scale / Math.sin(model.camera.pose.pitch) };
    },
  });

  function resize() {
    if (disposed || lost || failed) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const aspect = width / height;
    viewHeight = Math.max(CAMERA_PROJECTION.overviewHeight, CAMERA_PROJECTION.overviewWidth / aspect);
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    projectionDirty = true;
    renderer.setSize(width, height, false);
    if (available()) {
      try { draw(); } catch (error) { reportFailure(error); }
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  function suspend() {
    halt();
    input.clear();
  }

  function resume() {
    clock.reset();
    model.resync();
    if (available()) {
      try { draw(); } catch (error) { reportFailure(error); }
      schedule();
    }
  }

  document.addEventListener('visibilitychange', () => {
    pageHidden = document.hidden;
    if (pageHidden) suspend();
    else resume();
  }, { signal: listeners.signal });
  window.addEventListener('pagehide', (event) => {
    pageHidden = true;
    suspend();
    if (event.persisted === false) dispose();
  }, { signal: listeners.signal });
  window.addEventListener('pageshow', () => { pageHidden = document.hidden; resume(); }, { signal: listeners.signal });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (disposed || lost) return;
    lost = true;
    suspend();
    onLifecycle('lost', 'Restoring city. Movement is suspended and your view is saved.');
    restoreTimeout = setTimeout(() => {
      if (lost && !disposed) {
        failed = true;
        onLifecycle('error', 'Graphics restoration timed out. Retry the live city.');
      }
    }, 8000);
  }, { signal: listeners.signal });
  canvas.addEventListener('webglcontextrestored', () => {
    if (disposed || !lost || failed) return;
    clearTimeout(restoreTimeout);
    onLifecycle('restoring', 'Rebuilding the original district.');
    try {
      detachEffects();
      art.dispose();
      art = buildArt();
      renderer.shadowMap.needsUpdate = true;
      attachEffects();
      locomotion.restore(model.simulation.actors, art.actors, model.reducedMotion);
      lost = false;
      resize();
      if (failed) return;
      onLifecycle('ready', 'City restored.');
      resume();
    } catch (error) {
      reportFailure(error);
    }
  }, { signal: listeners.signal });

  function dispose() {
    if (disposed) return;
    disposed = true;
    halt();
    clearTimeout(restoreTimeout);
    listeners.abort();
    observer.disconnect();
    input.dispose();
    detachEffects();
    art.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  try {
    resize();
    if (!failed) {
      onLifecycle('ready', 'Live city ready.');
      schedule();
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return { command, dispose };
}
