"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { SHRINES, type ShrineId } from "./shrines";
import { MARTIAL_DURATION } from "./three/martial";
import { getTempleSchedule } from "./templeSchedule";
import type { NpcResidentId } from "./npcResidents";
import { findNpcEncounter } from "./npcEncounters";
type TempleFloor = 1 | 2 | 3;

type Participant = {
  id: string;
  name: string;
  seat: number | null;
  action: string;
  meditating: boolean;
  x?: number;
  z?: number;
  heading?: number;
  bowSpeed?: 1 | 4;
  floor?: TempleFloor;
};

type Position = { x: number; z: number; heading: number; floor: 1 };
type Landmark = { name: string; x: number; z: number };
type ContextAction = "incense" | "incenseGuanyin" | "incenseWenshu" | "incenseCaishen" | "longLamp" | "skyLantern" | "drum" | "towerBell" | "flower" | "ritual" | "bell" | "fish" | "pondFeed" | "mural" | "lamp" | "sutra" | "breathe" | "release" | "martial" | "pagoda";
type WorldContext = { nearCushion: boolean; nearAltar: boolean; nearFlowers: boolean; nearRitual: boolean };
type WorldProps = {
  action: string;
  actionPulse: number;
  cameraMode?: "first" | "third" | "map";
  incensePulse?: number;
  incenseShrine?: ShrineId;
  lampPulse?: number;
  lampLit?: boolean;
  skyLanternPulse?: number;
  flowerPulse?: number;
  ritualPulse?: number;
  auto: boolean;
  bowSpeed?: 1 | 4;
  meditating: boolean;
  seat: number | null;
  selfId?: string;
  participants: Participant[];
  onSeatSelect: (index: number) => void;
  onLeaveSeat: () => void;
  onLongPress: () => void;
  onPositionChange: (position: Position) => void;
  onPlaceChange?: (name: string) => void;
  onContextAction?: (kind: ContextAction) => void;
  onContextChange?: (context: WorldContext) => void;
  onSeatedChange?: (seated: boolean) => void;
  onFloorChange?: (floor: TempleFloor) => void;
  onIncenseStage?: (stage: "begin" | "insert" | "complete") => void;
  onLampStage?: (stage: "begin" | "complete") => void;
  onMartialStage?: (stage: "begin" | "complete" | "cancel") => void;
  onFishStage?: (kind: "fish" | "release", stage: "begin" | "offer" | "complete") => void;
  onSkyLanternStage?: (stage: "begin" | "release" | "complete") => void;
  talkingNpcId?: NpcResidentId | null;
  onNpcEncounter?: (id: NpcResidentId | null) => void;
};

type MonkInstance = {
  group: THREE.Group;
  update: (action: string, time: number, walking: boolean, phase?: number) => void;
  dispose: () => void;
};

const remoteColors = [0x96a78d, 0xb39274, 0x8ba7a0, 0xbd9c83, 0xaca17d];
// Keep a monk-radius clearance inside every wall, including the open mountain gate.
const TEMPLE_BOUNDS = { minX: -51.5, maxX: 51.5, minZ: -39.5, maxZ: 39.5 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const FISH_ACTIONS = {
  fish: { x: 5.8, z: 2, heading: Math.PI / 2, duration: 4.2, offerAt: 1.8 },
  pondFeed: { x: -22.5, z: 8, heading: -Math.PI / 2, duration: 4.2, offerAt: 1.8 },
  release: { x: -23.1, z: 8, heading: -Math.PI / 2, duration: 5.5, offerAt: 3.1 },
};

export default function TempleWorld(props: WorldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const hotspotsRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const joystick = useRef({ x: 0, y: 0 });
  const joystickPointer = useRef<number | null>(null);
  const travel = useRef<(landmark: Landmark) => void>(() => {});
  const zoomView = useRef<(amount: number) => void>(() => {});
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [places, setPlaces] = useState<Landmark[]>([]);
  const [placeMenu, setPlaceMenu] = useState(false);

  useEffect(() => {
    let alive = true;
    let disposeWorld = () => {};
    setReady(false);
    setError(false);
    latest.current.onSeatedChange?.(false);
    latest.current.onContextChange?.({ nearCushion: false, nearAltar: false, nearFlowers: false, nearRitual: false });

    void (async () => {
      try {
        const [T, { createMonk }, { createTempleEnvironment }, { createIncenseOffering }] = await Promise.all([
          import("three"),
          import("./three/monk"),
          import("./three/environment"),
          import("./three/incense"),
        ]);
        const host = hostRef.current;
        const labels = labelsRef.current;
        const hotspots = hotspotsRef.current;
        if (!alive || !host || !labels || !hotspots) return;

        const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute("aria-label", "三维寺庙。地图视角可向上下左右拖动，轻点地面行走，走近场景中的地点可互动。电脑可用方向键或WASD移动。");
        host.insertBefore(renderer.domElement, host.firstChild);

        const scene = new T.Scene();
        scene.background = new T.Color(0xd9e9eb);
        scene.fog = new T.Fog(0xd9e9eb, 120, 360);
        const camera = new T.PerspectiveCamera(42, 1, 0.1, 430);
        let mobile = host.clientWidth < 640;
        let yaw = 0.18;
        let cameraRadius = mobile ? 7.8 : 10;
        let cameraHeight = mobile ? 7.4 : 9.4;
        let cameraMode = latest.current.cameraMode ?? "third";
        let firstPersonPitch = -0.06;
        let firstPersonHeight = 1.1;
        const cameraTarget = new T.Vector3(0, 0.65, 2.9);
        const mapFocus = new T.Vector3(0, 0.65, 2.9);
        const cameraGoal = new T.Vector3();
        camera.position.set(Math.sin(yaw) * cameraRadius, cameraHeight, 9 + Math.cos(yaw) * cameraRadius);
        camera.lookAt(cameraTarget);

        const skyLight = new T.HemisphereLight(0xfff8e6, 0x879a77, 2.35);
        const sunlight = new T.DirectionalLight(0xffeed7, 2.7);
        sunlight.position.set(-8, 17, 8);
        sunlight.target.position.set(0, 0, -2);
        sunlight.castShadow = true;
        sunlight.shadow.mapSize.set(mobile ? 1024 : 1536, mobile ? 1024 : 1536);
        sunlight.shadow.camera.left = -54;
        sunlight.shadow.camera.right = 54;
        sunlight.shadow.camera.top = 42;
        sunlight.shadow.camera.bottom = -42;
        sunlight.shadow.camera.near = 0.5;
        sunlight.shadow.camera.far = 80;
        sunlight.shadow.bias = -0.00025;
        sunlight.shadow.normalBias = 0.025;
        scene.add(skyLight, sunlight, sunlight.target);

        let environment: ReturnType<typeof createTempleEnvironment> | undefined;
        let local: MonkInstance | undefined;
        const offerings = new Map<ShrineId, ReturnType<typeof createIncenseOffering>>();
        let frame = 0;
        let holdTimer: ReturnType<typeof setTimeout> | undefined;
        let observer: ResizeObserver | undefined;
        const remote = new Map<string, { monk: MonkInstance; label: HTMLDivElement; target: THREE.Vector3; heading: number; action: string; actionStart: number; bowSpeed: number }>();
        const cleanupListeners: (() => void)[] = [];
        const hotspotButtons: HTMLButtonElement[] = [];
        const ownedGeometries: THREE.BufferGeometry[] = [];
        const ownedMaterials: THREE.Material[] = [];
        const selfLabel = document.createElement("div");
        selfLabel.style.cssText = "position:absolute;top:0;left:0;padding:5px 10px;border-radius:12px;background:rgba(252,251,238,.94);border:1px solid rgba(111,136,96,.26);color:#42573d;font:700 14px system-ui;white-space:nowrap;max-width:min(45vw,240px);overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 7px #52694c12;will-change:transform";
        selfLabel.textContent = "● 你的小和尚";
        labels.appendChild(selfLabel);

        disposeWorld = () => {
          cancelAnimationFrame(frame);
          if (holdTimer) clearTimeout(holdTimer);
          observer?.disconnect();
          cleanupListeners.forEach(remove => remove());
          remote.forEach(({ monk, label }) => { monk.dispose(); label.remove(); });
          local?.dispose();
          offerings.forEach(offering => offering.dispose());
          environment?.dispose();
          ownedGeometries.forEach(geometry => geometry.dispose());
          ownedMaterials.forEach(material => material.dispose());
          sunlight.shadow.dispose();
          scene.clear();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
          selfLabel.remove();
          hotspotButtons.forEach(button => button.remove());
          joystick.current = { x: 0, y: 0 };
          travel.current = () => {};
        };

        environment = createTempleEnvironment(scene);
        local = createMonk(0xcc9365);
        scene.add(local.group);
        local.group.position.set(0, 0, 9);
        local.group.rotation.y = 0;
        const actor = local;
        const world = environment;
        const hotspotStyle = "position:absolute;top:0;left:0;display:none;height:44px;max-height:44px;padding:0 12px;border:1px solid #84976d77;border-radius:22px;background:rgba(255,253,238,.95);color:#405438;font:700 14px system-ui;white-space:nowrap;max-width:min(45vw,240px);overflow:hidden;text-overflow:ellipsis;box-shadow:0 3px 10px #354c2525;pointer-events:auto;touch-action:manipulation;will-change:transform";
        const interactivePoints = world.interactions.map(point => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "world-hotspot";
          button.textContent = point.label;
          button.setAttribute("aria-label", point.label.replace(/^[^ ]+ /, ""));
          button.style.cssText = hotspotStyle;
          let nextActivation = 0;
          const activate = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            const state = latest.current;
            if (state.auto || state.meditating || Math.hypot(actor.group.position.x - point.x, actor.group.position.z - point.z) > 5) return;
            if (point.kind === "martial" && (approachingMartial || sceneAction?.kind === "martial")) return;
            if ((point.kind === "fish" || point.kind === "pondFeed" || point.kind === "release") && (approachingFish || sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" || sceneAction?.kind === "release")) return;
            if (performance.now() < nextActivation) return;
            nextActivation = performance.now() + (point.kind === "fish" ? 4000 : point.kind === "towerBell" ? 3500 : 1200);
            cancelMartial();
            cancelFish();
            cancelSkyLantern();
            if (point.kind === "martial") {
              approachingIncense = false;
              incensePrayerUntil = 0;
              approachingLamp = false;
              lampPrayerUntil = 0;
              walkTo(28, 12);
              approachingMartial = true;
            }
            if (point.kind === "fish" || point.kind === "pondFeed" || point.kind === "release") {
              approachingIncense = false;
              incensePrayerUntil = 0;
              approachingLamp = false;
              lampPrayerUntil = 0;
              const shore = FISH_ACTIONS[point.kind];
              walkTo(shore.x, shore.z);
              approachingFish = point.kind;
            }
            if (point.kind === "bell" || point.kind === "lamp" || point.kind === "pagoda" || point.kind === "drum" || point.kind === "towerBell") world.interact(point.kind);
            if (point.kind === "pagoda") sceneAction = { kind: "salute", start: (performance.now() - started) / 1000, duration: 4 };
            if (point.kind === "drum" || point.kind === "towerBell") {
              actor.group.rotation.y = Math.atan2(point.x - actor.group.position.x, point.z - 3.5 - actor.group.position.z);
              sceneAction = { kind: "strike", start: (performance.now() - started) / 1000, duration: 1.2 };
            }
            state.onContextAction?.(point.kind);
          };
          button.addEventListener("click", activate);
          cleanupListeners.push(() => button.removeEventListener("click", activate));
          hotspots.appendChild(button);
          hotspotButtons.push(button);
          return { ...point, button };
        });
        let nearestCushionIndex = -1;
        const cushionButton = document.createElement("button");
        cushionButton.type = "button";
        cushionButton.className = "world-hotspot world-seat-hotspot";
        cushionButton.textContent = "○ 入座";
        cushionButton.setAttribute("aria-label", "在附近的空蒲团上坐下");
        cushionButton.style.cssText = hotspotStyle;
        const sitOnNearbyCushion = (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          const state = latest.current;
          if (nearestCushionIndex < 0 || state.seat !== null || state.auto || state.meditating) return;
          state.onSeatSelect(nearestCushionIndex);
        };
        cushionButton.addEventListener("click", sitOnNearbyCushion);
        cleanupListeners.push(() => cushionButton.removeEventListener("click", sitOnNearbyCushion));
        hotspots.appendChild(cushionButton);
        hotspotButtons.push(cushionButton);
        for (const [id, shrine] of Object.entries(SHRINES)) {
          offerings.set(id as ShrineId, createIncenseOffering(scene, { x: shrine.x, z: shrine.furnaceZ }));
          world.colliders.push({ minX: shrine.x - 0.45, maxX: shrine.x + 0.45, minZ: shrine.furnaceZ - 0.35, maxZ: shrine.furnaceZ + 0.35 });
        }
        const roofSurfaces: THREE.Mesh[] = [];
        const hallRoofs = new Set<THREE.Mesh>();
        scene.updateMatrixWorld(true);
        scene.traverse(object => {
          if (!(object instanceof T.Mesh) || Array.isArray(object.material) || object.material.side !== T.DoubleSide) return;
          const bounds = new T.Box3().setFromObject(object);
          if (bounds.min.y > 2.7 && bounds.max.x - bounds.min.x > 3 && bounds.max.z - bounds.min.z > 0.8) {
            object.material.transparent = true;
            roofSurfaces.push(object);
            // Each roof has separate front/back slopes; match their overlap with the hall.
            if (bounds.min.z < -2 && bounds.max.z > -22 && bounds.max.x - bounds.min.x > 24 && Math.abs(bounds.min.x + bounds.max.x) < 1) hallRoofs.add(object);
          }
        });
        setPlaces([...world.landmarks, { name: "回到庭院", x: 0, z: 7 }]);

        const ringGeometry = new T.RingGeometry(0.51, 0.58, 32);
        const ringMaterial = new T.MeshBasicMaterial({ color: 0x89a66c, transparent: true, opacity: 0.7, depthWrite: false });
        ownedGeometries.push(ringGeometry);
        ownedMaterials.push(ringMaterial);
        const selfRing = new T.Mesh(ringGeometry, ringMaterial);
        selfRing.rotation.x = -Math.PI / 2;
        scene.add(selfRing);

        // Larger invisible hit surfaces make the actual three-dimensional cushions easy to tap.
        const cushionGeometry = new T.CircleGeometry(0.7, 20);
        const cushionMaterial = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
        ownedGeometries.push(cushionGeometry);
        ownedMaterials.push(cushionMaterial);
        const cushionTargets = world.cushions.map((position, index) => {
          const target = new T.Mesh(cushionGeometry, cushionMaterial);
          target.position.set(position.x, 0.19, position.z);
          target.rotation.x = -Math.PI / 2;
          target.userData.seat = index;
          scene.add(target);
          return target;
        });

        const destinationGeometry = new T.RingGeometry(0.19, 0.23, 24);
        const destinationMaterial = new T.MeshBasicMaterial({ color: 0x8caa73, transparent: true, opacity: 0.8, depthWrite: false });
        ownedGeometries.push(destinationGeometry);
        ownedMaterials.push(destinationMaterial);
        const destination = new T.Mesh(destinationGeometry, destinationMaterial);
        destination.rotation.x = -Math.PI / 2;
        destination.visible = false;
        scene.add(destination);

        const raycaster = new T.Raycaster();
        const occlusionRay = new T.Raycaster();
        const occlusionDirection = new T.Vector3();
        const obscuredRoofs = new Set<THREE.Object3D>();
        const pointer = new T.Vector2();
        const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
        const groundPoint = new T.Vector3();
        const panFrom = new T.Vector3();
        const panTo = new T.Vector3();
        const projected = new T.Vector3();
        const keys = new Set<string>();
        let route: { x: number; z: number }[] = [];
        let lastSeat: number | null | undefined;
        let releasedSeat = false;
        let userMoved = false;
        let hydratedIdentity: string | undefined;
        let actionPulse = latest.current.actionPulse;
        let localAction = latest.current.action;
        let actionStart = 0;
        let incensePulse = latest.current.incensePulse ?? 0;
        let incenseTarget: ShrineId = "rulai";
        let lampPulse = latest.current.lampPulse ?? 0;
        let restoredLampLit: boolean | undefined;
        let flowerPulse = latest.current.flowerPulse ?? 0;
        let ritualPulse = latest.current.ritualPulse ?? 0;
        let approachingIncense = false;
        let incensePrayerUntil = 0;
        let incensePrayerStart = 0;
        let incenseInserted = false;
        let approachingLamp = false;
        let lampPrayerUntil = 0;
        let lampPrayerStart = 0;
        let approachingMartial = false;
        let approachingFish: "fish" | "pondFeed" | "release" | null = null;
        let skyLanternPulse = latest.current.skyLanternPulse ?? 0;
        let approachingSkyLantern = false;
        let zoomScale = 1;
        let mapFollowing = false;
        let sceneAction: { kind: "martial" | "salute" | "strike" | "fish" | "pondFeed" | "release" | "skyLantern"; start: number; duration: number; offered?: boolean } | null = null;
        let lastScheduleCheck = -Infinity;
        let lessonActive = false;
        const touchPoints = new Map<number, { x: number; y: number }>();
        let pinchDistance = 0;
        function changeZoom(amount: number) { zoomScale = clamp(zoomScale * amount, 0.45, 3.2); }
        zoomView.current = changeZoom;
        let currentPlace = "静心庭院";
        let actualSeated: boolean | undefined;
        let lastContext: WorldContext | undefined;
        let encounteredNpc: NpcResidentId | null = null;
        let talkingNpc: NpcResidentId | null = null;
        let lastSent = -1;
        let lastPosition: Position = { x: 100, z: 100, heading: 0, floor: 1 };
        let lastRemoteSync = -1;
        let lastOcclusionCheck = -1;
        let lastTime = performance.now();
        const started = lastTime;
        const cameraLook = new T.Vector3();
        const pointerState = { id: -1, x: 0, y: 0, lastX: 0, lastY: 0, dragged: false, self: false, held: false, orbit: false };

        function blocked(x: number, z: number) {
          if (x < TEMPLE_BOUNDS.minX || x > TEMPLE_BOUNDS.maxX || z < TEMPLE_BOUNDS.minZ || z > TEMPLE_BOUNDS.maxZ) return true;
          const radius = 0.26;
          return world.colliders.some(box => x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius);
        }

        function clearLine(ax: number, az: number, bx: number, bz: number) {
          const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.22));
          for (let step = 1; step <= steps; step++) {
            const progress = step / steps;
            if (blocked(ax + (bx - ax) * progress, az + (bz - az) * progress)) return false;
          }
          return true;
        }

        function pathTo(requestedX: number, requestedZ: number) {
          let target = {
            x: clamp(requestedX, TEMPLE_BOUNDS.minX, TEMPLE_BOUNDS.maxX),
            z: clamp(requestedZ, TEMPLE_BOUNDS.minZ, TEMPLE_BOUNDS.maxZ),
          };
          const origin = actor.group.position;
          if (blocked(target.x, target.z)) {
            let found = false;
            for (let radius = 0.35; radius <= 2.1 && !found; radius += 0.35) {
              for (let step = 0; step < 16; step++) {
                const angle = step * Math.PI / 8;
                const candidate = { x: target.x + Math.cos(angle) * radius, z: target.z + Math.sin(angle) * radius };
                if (!blocked(candidate.x, candidate.z)) { target = candidate; found = true; break; }
              }
            }
            if (!found) return [];
          }
          if (clearLine(origin.x, origin.z, target.x, target.z)) return [target];

          // A small navigation grid routes taps around the hall, pond, and trees.
          const size = 175;
          const spacing = 0.6;
          const half = 52.2;
          const position = (index: number) => ({ x: (index % size) * spacing - half, z: Math.floor(index / size) * spacing - half });
          const indexOf = (x: number, z: number) => clamp(Math.round((z + half) / spacing), 0, size - 1) * size + clamp(Math.round((x + half) / spacing), 0, size - 1);
          const walkable = new Uint8Array(size * size);
          for (let index = 0; index < walkable.length; index++) { const point = position(index); walkable[index] = blocked(point.x, point.z) ? 0 : 1; }
          const nearest = (x: number, z: number) => {
            const initial = indexOf(x, z);
            if (walkable[initial]) return initial;
            let winner = -1;
            let distance = Infinity;
            for (let index = 0; index < walkable.length; index++) {
              if (!walkable[index]) continue;
              const point = position(index);
              const current = Math.hypot(point.x - x, point.z - z);
              if (current < distance) { distance = current; winner = index; }
            }
            return winner;
          };
          const start = nearest(origin.x, origin.z);
          const goal = nearest(target.x, target.z);
          if (start < 0 || goal < 0) return [];
          const costs = new Float32Array(size * size).fill(Infinity);
          const scores = new Float32Array(size * size).fill(Infinity);
          const previous = new Int32Array(size * size).fill(-1);
          const closed = new Uint8Array(size * size);
          const queued = new Uint8Array(size * size);
          const open = [start];
          costs[start] = 0;
          scores[start] = Math.hypot(position(start).x - target.x, position(start).z - target.z);
          queued[start] = 1;
          while (open.length) {
            let best = 0;
            for (let index = 1; index < open.length; index++) if (scores[open[index]] < scores[open[best]]) best = index;
            const current = open.splice(best, 1)[0];
            queued[current] = 0;
            if (current === goal) {
              const path = [target];
              for (let node = goal; node !== start && node >= 0; node = previous[node]) path.push(position(node));
              path.reverse();
              const smooth: { x: number; z: number }[] = [];
              let anchor = { x: origin.x, z: origin.z };
              let cursor = 0;
              while (cursor < path.length) {
                let furthest = cursor;
                while (furthest + 1 < path.length && clearLine(anchor.x, anchor.z, path[furthest + 1].x, path[furthest + 1].z)) furthest++;
                smooth.push(path[furthest]);
                anchor = path[furthest];
                cursor = furthest + 1;
              }
              return smooth;
            }
            closed[current] = 1;
            const column = current % size;
            const row = Math.floor(current / size);
            for (let dz = -1; dz <= 1; dz++) {
              for (let dx = -1; dx <= 1; dx++) {
                if ((!dx && !dz) || column + dx < 0 || column + dx >= size || row + dz < 0 || row + dz >= size) continue;
                const neighbor = current + dx + dz * size;
                if (closed[neighbor] || !walkable[neighbor]) continue;
                if (dx && dz && (!walkable[current + dx] || !walkable[current + dz * size])) continue;
                const cost = costs[current] + (dx && dz ? Math.SQRT2 : 1) * spacing;
                if (cost >= costs[neighbor]) continue;
                previous[neighbor] = current;
                costs[neighbor] = cost;
                const point = position(neighbor);
                scores[neighbor] = cost + Math.hypot(point.x - target.x, point.z - target.z);
                if (!queued[neighbor]) { open.push(neighbor); queued[neighbor] = 1; }
              }
            }
          }
          return [];
        }

        function leaveSeat() {
          if (latest.current.seat !== null && !releasedSeat) {
            releasedSeat = true;
            latest.current.onLeaveSeat();
          }
        }

        function walkTo(x: number, z: number) {
          if (latest.current.auto || latest.current.meditating) return;
          cancelMartial();
          cancelFish();
          cancelSkyLantern();
          leaveSeat();
          userMoved = true;
          mapFollowing = true;
          route = pathTo(x, z);
          if (route.length) {
            const end = route[route.length - 1];
            destination.position.set(end.x, world.floorHeightAt(end.x, end.z) + 0.03, end.z);
            destination.visible = true;
          }
        }
        travel.current = landmark => {
          approachingIncense = false;
          incensePrayerUntil = 0;
          approachingLamp = false;
          lampPrayerUntil = 0;
          walkTo(landmark.x, landmark.z);
        };

        function cancelMartial() {
          approachingMartial = false;
          if (sceneAction?.kind !== "martial") return;
          sceneAction = null;
          world.stopMartial();
          latest.current.onMartialStage?.("cancel");
        }

        function cancelFish() {
          approachingFish = null;
          if (sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" || sceneAction?.kind === "release") sceneAction = null;
        }
        function cancelSkyLantern() {
          approachingSkyLantern = false;
          if (sceneAction?.kind === "skyLantern") sceneAction = null;
        }

        function updatePointer(event: PointerEvent) {
          const bounds = renderer.domElement.getBoundingClientRect();
          pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
          raycaster.setFromCamera(pointer, camera);
          return bounds;
        }

        function pointerDown(event: PointerEvent) {
          if (event.pointerType === "touch") {
            touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (touchPoints.size === 2) {
              const [a, b] = [...touchPoints.values()];
              pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
              pointerState.dragged = true;
              if (holdTimer) clearTimeout(holdTimer);
              renderer.domElement.setPointerCapture(event.pointerId);
              return;
            }
          }
          if (pointerState.id !== -1 || event.button > 0) return;
          const bounds = updatePointer(event);
          pointerState.id = event.pointerId;
          pointerState.x = event.clientX;
          pointerState.y = event.clientY;
          pointerState.lastX = event.clientX;
          pointerState.lastY = event.clientY;
          pointerState.dragged = false;
          pointerState.held = false;
          pointerState.self = latest.current.cameraMode !== "first" && raycaster.intersectObject(actor.group, true).length > 0;
          pointerState.orbit = latest.current.cameraMode === "map" || event.pointerType === "mouse" || event.clientX - bounds.left > bounds.width * 0.32;
          renderer.domElement.setPointerCapture(event.pointerId);
          if (pointerState.self && !latest.current.auto && !latest.current.meditating) {
            holdTimer = setTimeout(() => {
              if (pointerState.dragged || pointerState.id === -1) return;
              pointerState.held = true;
              latest.current.onLongPress();
              navigator.vibrate?.(30);
            }, 650);
          }
        }

        function pointerMove(event: PointerEvent) {
          if (touchPoints.has(event.pointerId)) touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (touchPoints.size >= 2) {
            const [a, b] = [...touchPoints.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinchDistance > 1 && distance > 1) changeZoom(pinchDistance / distance);
            pinchDistance = distance;
            return;
          }
          if (event.pointerId !== pointerState.id) return;
          if (Math.hypot(event.clientX - pointerState.x, event.clientY - pointerState.y) > 7) {
            pointerState.dragged = true;
            if (holdTimer) clearTimeout(holdTimer);
          }
          if (pointerState.dragged && pointerState.orbit) {
            if (latest.current.cameraMode === "map") {
              mapFollowing = false;
              const bounds = renderer.domElement.getBoundingClientRect();
              pointer.set((pointerState.lastX - bounds.left) / bounds.width * 2 - 1, -(pointerState.lastY - bounds.top) / bounds.height * 2 + 1);
              raycaster.setFromCamera(pointer, camera);
              const fromGround = raycaster.ray.intersectPlane(groundPlane, panFrom);
              updatePointer(event);
              const toGround = raycaster.ray.intersectPlane(groundPlane, panTo);
              if (fromGround && toGround) {
                mapFocus.x = clamp(mapFocus.x + panFrom.x - panTo.x, TEMPLE_BOUNDS.minX, TEMPLE_BOUNDS.maxX);
                mapFocus.z = clamp(mapFocus.z + panFrom.z - panTo.z, TEMPLE_BOUNDS.minZ, TEMPLE_BOUNDS.maxZ);
              }
            } else {
              yaw -= (event.clientX - pointerState.lastX) * 0.006;
              if (latest.current.cameraMode === "first") firstPersonPitch = clamp(firstPersonPitch - (event.clientY - pointerState.lastY) * 0.004, -0.85, 0.85);
            }
          }
          pointerState.lastX = event.clientX;
          pointerState.lastY = event.clientY;
        }

        function pointerUp(event: PointerEvent) {
          touchPoints.delete(event.pointerId);
          if (pinchDistance > 0) {
            if (touchPoints.size < 2) { pinchDistance = 0; pointerState.id = -1; }
            return;
          }
          if (event.pointerId !== pointerState.id) return;
          if (holdTimer) clearTimeout(holdTimer);
          if (!pointerState.dragged && !pointerState.held && !pointerState.self && !latest.current.auto && !latest.current.meditating) {
            updatePointer(event);
            const cushion = raycaster.intersectObjects(cushionTargets, false)[0];
            if (cushion) latest.current.onSeatSelect(cushion.object.userData.seat as number);
            else if (raycaster.ray.intersectPlane(groundPlane, groundPoint)) {
              approachingIncense = false;
              incensePrayerUntil = 0;
              approachingLamp = false;
              lampPrayerUntil = 0;
              walkTo(groundPoint.x, groundPoint.z);
            }
          }
          pointerState.id = -1;
        }

        function pointerCancel() {
          if (holdTimer) clearTimeout(holdTimer);
          pointerState.id = -1;
          touchPoints.clear();
          pinchDistance = 0;
        }

        function wheel(event: WheelEvent) {
          event.preventDefault();
          const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? renderer.domElement.clientHeight : 1;
          changeZoom(Math.exp(clamp(event.deltaY * unit, -240, 240) * 0.0018));
        }

        function keyDown(event: KeyboardEvent) {
          const target = event.target as HTMLElement;
          if (target.closest("input,textarea,select,[contenteditable='true']") || document.querySelector("[role='dialog']")) return;
          if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
            event.preventDefault();
            keys.add(event.code);
          }
        }

        function keyUp(event: KeyboardEvent) { keys.delete(event.code); }
        function releaseControls() { keys.clear(); joystick.current = { x: 0, y: 0 }; setKnob({ x: 0, y: 0 }); pointerCancel(); }
        function contextMenu(event: Event) { event.preventDefault(); }
        function contextLost(event: Event) {
          event.preventDefault();
          if (alive) {
            hotspotButtons.forEach(button => { button.style.display = "none"; });
            latest.current.onSeatedChange?.(false);
            setError(true);
            setReady(false);
          }
        }
        function contextRestored() { if (alive) setRetry(value => value + 1); }
        function listen(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions) {
          target.addEventListener(type, handler, options);
          cleanupListeners.push(() => target.removeEventListener(type, handler));
        }
        listen(renderer.domElement, "pointerdown", pointerDown as EventListener);
        listen(renderer.domElement, "pointermove", pointerMove as EventListener);
        listen(renderer.domElement, "pointerup", pointerUp as EventListener);
        listen(renderer.domElement, "pointercancel", pointerCancel);
        listen(renderer.domElement, "wheel", wheel as EventListener, { passive: false });
        listen(renderer.domElement, "contextmenu", contextMenu);
        listen(renderer.domElement, "webglcontextlost", contextLost);
        listen(renderer.domElement, "webglcontextrestored", contextRestored);
        listen(document, "keydown", keyDown as EventListener);
        listen(document, "keyup", keyUp as EventListener);
        listen(window, "blur", releaseControls);
        listen(document, "visibilitychange", releaseControls);

        observer = new ResizeObserver(() => {
          const width = host.clientWidth;
          const height = host.clientHeight;
          if (!width || !height) return;
          mobile = width < 640;
          cameraRadius = mobile ? 7.8 : 10;
          cameraHeight = mobile ? 7.4 : 9.4;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        });
        observer.observe(host);

        function positionLabel(label: HTMLDivElement, group: THREE.Group, height: number) {
          projected.copy(group.position);
          projected.y += height;
          projected.project(camera);
          const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
          label.style.display = visible ? "block" : "none";
          if (visible) label.style.transform = `translate(${(projected.x + 1) * host!.clientWidth / 2}px,${(1 - projected.y) * host!.clientHeight / 2}px) translate(-50%,-100%)`;
        }

        function positionHotspot(button: HTMLButtonElement, x: number, y: number, z: number, available: boolean) {
          if (!available) {
            button.style.display = "none";
            return;
          }
          const width = renderer.domElement.clientWidth;
          const height = renderer.domElement.clientHeight;
          projected.set(x, y, z).project(camera);
          const screenX = (projected.x * 0.5 + 0.5) * width;
          const screenY = (-projected.y * 0.5 + 0.5) * height;
          const visible = projected.z > -1 && projected.z < 1 && screenX > 8 && screenX < width - 8 && screenY > 24 && screenY < height - 24;
          button.style.display = visible ? "block" : "none";
          if (visible) {
            const halfWidth = button.offsetWidth / 2;
            const besidePlayer = Math.hypot(x - actor.group.position.x, z - actor.group.position.z) < 1.6;
            const offset = besidePlayer ? (screenX < width / 2 ? 1 : -1) * (halfWidth + 42) : 0;
            const boundedX = clamp(screenX + offset, halfWidth + 8, width - halfWidth - 8);
            button.style.transform = `translate(${boundedX - halfWidth}px,${screenY - 22}px)`;
          }
        }

        function syncRemote(time: number) {
          const state = latest.current;
          const ownName = state.participants.find(person => person.id === state.selfId)?.name;
          if (ownName && selfLabel.textContent !== `● ${ownName}`) { selfLabel.textContent = `● ${ownName}`; selfLabel.title = ownName; }
          // Keep the nearest real visitors visible on crowded mobile devices.
          const visitors = state.participants.filter(person => person.id !== state.selfId).sort((a, b) => {
            if (a.seat !== null && b.seat === null) return -1;
            if (a.seat === null && b.seat !== null) return 1;
            const ap = a.seat === null ? { x: a.x ?? 0, z: a.z ?? 9 } : world.cushions[a.seat];
            const bp = b.seat === null ? { x: b.x ?? 0, z: b.z ?? 9 } : world.cushions[b.seat];
            return Math.hypot(ap.x - actor.group.position.x, ap.z - actor.group.position.z) - Math.hypot(bp.x - actor.group.position.x, bp.z - actor.group.position.z);
          }).slice(0, mobile ? 12 : 20);
          const present = new Set(visitors.map(person => person.id));
          remote.forEach((person, id) => {
            if (!present.has(id)) { person.monk.group.removeFromParent(); person.monk.dispose(); person.label.remove(); remote.delete(id); }
          });
          visitors.forEach(person => {
            const seatPosition = (person.floor ?? 1) !== 1 || person.seat === null ? null : world.cushions[person.seat];
            const legacyFloor = (person.floor ?? 1) > 1;
            const x = clamp(legacyFloor ? 0 : seatPosition?.x ?? person.x ?? 0, TEMPLE_BOUNDS.minX, TEMPLE_BOUNDS.maxX);
            const z = clamp(legacyFloor ? 9 : seatPosition?.z ?? person.z ?? 9, TEMPLE_BOUNDS.minZ, TEMPLE_BOUNDS.maxZ);
            const height = world.floorHeightAt(x, z) + (seatPosition ? 0.12 : 0);
            let existing = remote.get(person.id);
            if (!existing) {
              const colorIndex = Array.from(person.id).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % remoteColors.length;
              const monk = createMonk(remoteColors[colorIndex]);
              monk.group.position.set(x, height, z);
              scene.add(monk.group);
              const label = document.createElement("div");
              label.style.cssText = "position:absolute;top:0;left:0;padding:4px 8px;border-radius:9px;background:rgba(252,251,238,.9);color:#42573d;font:700 14px system-ui;white-space:nowrap;max-width:min(45vw,240px);overflow:hidden;text-overflow:ellipsis;will-change:transform";
              labels!.appendChild(label);
              existing = { monk, label, target: new T.Vector3(), heading: person.heading ?? 0, action: "idle", actionStart: time, bowSpeed: person.bowSpeed ?? 1 };
              remote.set(person.id, existing);
            }
            existing.target.set(x, height, z);
            existing.heading = seatPosition ? Math.PI : person.heading ?? 0;
            const nextAction = person.meditating ? "meditate" : person.action === "idle" && seatPosition ? "sit" : person.action;
            if (nextAction !== existing.action || existing.bowSpeed !== (person.bowSpeed ?? 1)) existing.actionStart = time;
            existing.action = nextAction;
            existing.bowSpeed = person.bowSpeed ?? 1;
            existing.label.textContent = `${person.meditating ? "◦ " : ""}${person.name}`;
            existing.label.title = person.name;
          });
        }

        function animate(now: number) {
          if (!alive) return;
          frame = requestAnimationFrame(animate);
          const dt = Math.min((now - lastTime) / 1000, 0.05);
          lastTime = now;
          const time = (now - started) / 1000;
          const state = latest.current;
          if (now - lastScheduleCheck >= 1000) {
            lastScheduleCheck = now;
            lessonActive = Boolean(getTempleSchedule(Date.now()).lesson);
          }
          const position = actor.group.position;
          const conversationResident = lessonActive ? undefined : world.residents.find(resident => resident.id === state.talkingNpcId);
          const conversationId = conversationResident?.id ?? null;
          if (conversationId !== talkingNpc) {
            talkingNpc = conversationId;
            if (talkingNpc) {
              route = [];
              destination.visible = false;
              keys.clear();
              joystick.current = { x: 0, y: 0 };
              setKnob({ x: 0, y: 0 });
            }
          }
          world.setNpcConversation(conversationId, position);
          let firstPerson = state.cameraMode === "first";
          let mapMode = state.cameraMode === "map";

          if ((state.incensePulse ?? 0) !== incensePulse) {
            incensePulse = state.incensePulse ?? 0;
            if (!state.auto && !state.meditating) {
              incensePrayerUntil = 0;
              approachingLamp = false;
              lampPrayerUntil = 0;
              incenseTarget = state.incenseShrine ?? "rulai";
              walkTo(SHRINES[incenseTarget].x, SHRINES[incenseTarget].z);
              approachingIncense = true;
            }
          }
          if ((state.lampPulse ?? 0) !== lampPulse) {
            lampPulse = state.lampPulse ?? 0;
            if (!state.auto && !state.meditating) {
              approachingIncense = false;
              incensePrayerUntil = 0;
              lampPrayerUntil = 0;
              walkTo(40, 32.5);
              approachingLamp = true;
            }
          }
          if ((state.skyLanternPulse ?? 0) !== skyLanternPulse) {
            skyLanternPulse = state.skyLanternPulse ?? 0;
            if (!state.auto && !state.meditating) {
              approachingIncense = false; incensePrayerUntil = 0;
              approachingLamp = false; lampPrayerUntil = 0;
              walkTo(0, 28);
              approachingSkyLantern = true;
            }
          }
          if (Boolean(state.lampLit) !== restoredLampLit) {
            restoredLampLit = Boolean(state.lampLit);
            world.restoreLongLamp(restoredLampLit);
          }
          if ((state.flowerPulse ?? 0) !== flowerPulse) {
            flowerPulse = state.flowerPulse ?? 0;
            world.offerFlowers();
          }
          if ((state.ritualPulse ?? 0) !== ritualPulse) {
            ritualPulse = state.ritualPulse ?? 0;
            world.startRitual();
          }

          if (state.selfId && hydratedIdentity !== state.selfId) {
            hydratedIdentity = state.selfId;
            const self = state.participants.find(person => person.id === state.selfId);
            if (!userMoved && self && Number.isFinite(self.x) && Number.isFinite(self.z)) {
              const valid = (self.floor ?? 1) === 1 && !blocked(self.x!, self.z!);
              const x = valid ? self.x! : 0;
              const z = valid ? self.z! : 9;
              position.set(x, world.floorHeightAt(x, z), z);
              groundPlane.constant = -position.y;
              mapFocus.set(position.x, position.y + 0.65, position.z);
              state.onFloorChange?.(1);
              actor.group.rotation.y = self.heading ?? 0;
            }
          }

          if (state.seat !== lastSeat) {
            lastSeat = state.seat;
            releasedSeat = false;
            if (state.seat !== null && world.cushions[state.seat]) {
              cancelMartial();
              cancelFish();
              cancelSkyLantern();
              sceneAction = null;
              approachingIncense = false;
              incensePrayerUntil = 0;
              approachingLamp = false;
              lampPrayerUntil = 0;
              const cushion = world.cushions[state.seat];
              route = pathTo(cushion.x, cushion.z);
              destination.visible = false;
            }
          }
          if ((state.auto || state.meditating) && state.seat !== null && world.cushions[state.seat]) {
            cancelMartial();
            cancelFish();
            cancelSkyLantern();
            const cushion = world.cushions[state.seat];
            position.set(cushion.x, 0.12, cushion.z);
            route = [];
          }

          const dialogOpen = Boolean(document.querySelector("[role='dialog']"));
          if (dialogOpen) keys.clear();
          let inputX = dialogOpen ? 0 : joystick.current.x;
          let inputY = dialogOpen ? 0 : joystick.current.y;
          if (keys.has("KeyA") || keys.has("ArrowLeft")) inputX -= 1;
          if (keys.has("KeyD") || keys.has("ArrowRight")) inputX += 1;
          if (keys.has("KeyW") || keys.has("ArrowUp")) inputY -= 1;
          if (keys.has("KeyS") || keys.has("ArrowDown")) inputY += 1;
          let dx = 0;
          let dz = 0;
          if (!state.auto && !state.meditating && !dialogOpen) {
            const strength = Math.min(1, Math.hypot(inputX, inputY));
            if (strength > 0.1) {
              cancelMartial();
              cancelFish();
              cancelSkyLantern();
              approachingIncense = false;
              incensePrayerUntil = 0;
              approachingLamp = false;
              lampPrayerUntil = 0;
              const length = Math.hypot(inputX, inputY);
              inputX = inputX / length * strength;
              inputY = inputY / length * strength;
              const movementYaw = mapMode ? 0 : yaw;
              dx = inputX * Math.cos(movementYaw) + inputY * Math.sin(movementYaw);
              dz = -inputX * Math.sin(movementYaw) + inputY * Math.cos(movementYaw);
              route = [];
              destination.visible = false;
              userMoved = true;
              mapFollowing = true;
              leaveSeat();
            } else if (route.length) {
              const target = route[0];
              const distance = Math.hypot(target.x - position.x, target.z - position.z);
              if (distance < 0.001) route.shift();
              else {
                // Reach each corner before turning, and stop a frame exactly at its waypoint.
                const stepScale = Math.min(1, distance / (2.9 * dt));
                dx = (target.x - position.x) / distance * stepScale;
                dz = (target.z - position.z) / distance * stepScale;
              }
              if (!route.length) destination.visible = false;
            }
          }

          const previousX = position.x;
          const previousZ = position.z;
          const movement = 2.9 * dt;
          if (dx || dz) {
            const nextX = position.x + dx * movement;
            const nextZ = position.z + dz * movement;
            if (!blocked(nextX, nextZ)) { position.x = nextX; position.z = nextZ; }
            else {
              if (!blocked(nextX, position.z)) position.x = nextX;
              if (!blocked(position.x, nextZ)) position.z = nextZ;
            }
            if (Math.hypot(position.x - previousX, position.z - previousZ) < 0.001 && route.length) { route = []; destination.visible = false; }
          }
          const walking = Math.hypot(position.x - previousX, position.z - previousZ) > 0.001;
          const cushion = state.seat === null ? null : world.cushions[state.seat];
          const seated = Boolean(cushion && !walking && Math.hypot(position.x - cushion.x, position.z - cushion.z) < 0.18);
          if (seated !== actualSeated) {
            actualSeated = seated;
            state.onSeatedChange?.(seated);
          }
          nearestCushionIndex = -1;
          let nearestCushionDistance = 4;
          if (state.seat === null) world.cushions.forEach((point, index) => {
            if (state.participants.some(person => person.id !== state.selfId && person.seat === index)) return;
            const distance = Math.hypot(position.x - point.x, position.z - point.z);
            if (distance < nearestCushionDistance) {
              nearestCushionDistance = distance;
              nearestCushionIndex = index;
            }
          });
          const context: WorldContext = {
            nearCushion: world.cushions.some(point => Math.hypot(position.x - point.x, position.z - point.z) <= 2),
            nearAltar: Math.hypot(position.x, position.z + 13.8) <= 5,
            nearFlowers: Math.hypot(position.x - 16, position.z - 5) <= 5,
            nearRitual: Math.hypot(position.x - 42, position.z + 12) <= 5,
          };
          if (!lastContext || context.nearCushion !== lastContext.nearCushion || context.nearAltar !== lastContext.nearAltar || context.nearFlowers !== lastContext.nearFlowers || context.nearRitual !== lastContext.nearRitual) {
            lastContext = context;
            state.onContextChange?.(context);
          }
          const prayerSpot = SHRINES[incenseTarget];
          if (approachingSkyLantern && route.length === 0 && Math.hypot(position.x, position.z - 28) < 0.25 && !dialogOpen && !state.auto && !state.meditating) {
            approachingSkyLantern = false;
            actor.group.rotation.y = 0;
            sceneAction = { kind: "skyLantern", start: time, duration: 5, offered: false };
            state.onSkyLanternStage?.("begin");
          }
          if (sceneAction?.kind === "skyLantern" && !sceneAction.offered && time - sceneAction.start >= 2.75) {
            sceneAction.offered = true;
            world.releaseSkyLantern();
            state.onSkyLanternStage?.("release");
          }
          if (approachingFish && route.length === 0 && !dialogOpen && !state.auto && !state.meditating) {
            const shore = FISH_ACTIONS[approachingFish];
            if (Math.hypot(position.x - shore.x, position.z - shore.z) < 0.25) {
              const kind = approachingFish;
              approachingFish = null;
              actor.group.rotation.y = shore.heading;
              sceneAction = { kind, start: time, duration: shore.duration, offered: false };
              state.onFishStage?.(kind === "release" ? "release" : "fish", "begin");
            }
          }
          if (sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" || sceneAction?.kind === "release") {
            const kind = sceneAction.kind;
            if (!sceneAction.offered && time - sceneAction.start >= FISH_ACTIONS[kind].offerAt) {
              sceneAction.offered = true;
              world.interact(kind);
              state.onFishStage?.(kind === "release" ? "release" : "fish", "offer");
            }
          }
          if (approachingMartial && route.length === 0 && Math.hypot(position.x - 28, position.z - 12) < 0.25 && !dialogOpen && !state.auto && !state.meditating) {
            approachingMartial = false;
            actor.group.rotation.y = 0;
            sceneAction = { kind: "martial", start: time, duration: MARTIAL_DURATION };
            world.interact("martial");
            state.onMartialStage?.("begin");
          }
          if (approachingLamp && route.length === 0 && Math.hypot(position.x - 40, position.z - 32.5) < 0.6 && !dialogOpen) {
            approachingLamp = false;
            lampPrayerStart = time;
            lampPrayerUntil = time + 24;
            world.lightLongLamp();
            state.onLampStage?.("begin");
          }
          if (lampPrayerUntil > 0 && time >= lampPrayerUntil) {
            lampPrayerUntil = 0;
            state.onLampStage?.("complete");
          }
          const lampPrayer = time < lampPrayerUntil;
          if (approachingIncense && route.length === 0 && Math.hypot(position.x - prayerSpot.x, position.z - prayerSpot.z) < 0.6) {
            approachingIncense = false;
            incensePrayerStart = time;
            incensePrayerUntil = time + 8.4;
            incenseInserted = false;
            state.onIncenseStage?.("begin");
          }
          if (incensePrayerUntil > 0 && time >= incensePrayerUntil) {
            incensePrayerUntil = 0;
            state.onIncenseStage?.("complete");
          }
          const incensePrayer = time < incensePrayerUntil;
          if (incensePrayer && !incenseInserted && time - incensePrayerStart >= 8.4 * 0.68) {
            offerings.get(incenseTarget)?.offer();
            incenseInserted = true;
            state.onIncenseStage?.("insert");
          }
          position.y = world.floorHeightAt(position.x, position.z) + (seated ? 0.12 : 0);
          groundPlane.constant = -position.y;
          if (walking) actor.group.rotation.y += angleDelta(actor.group.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 13);
          else if (seated || incensePrayer || lampPrayer) actor.group.rotation.y += angleDelta(actor.group.rotation.y, Math.PI) * Math.min(1, dt * 5);
          else if (firstPerson && !sceneAction) actor.group.rotation.y = yaw + Math.PI;

          if (state.actionPulse !== actionPulse || state.action !== localAction) {
            if (state.action !== "idle") {
              cancelMartial();
              cancelFish();
              cancelSkyLantern();
              sceneAction = null;
              approachingIncense = false;
              incensePrayerUntil = 0;
              approachingLamp = false;
              lampPrayerUntil = 0;
            }
            actionPulse = state.actionPulse;
            localAction = state.action;
            actionStart = time;
          }
          const incenseAge = time - incensePrayerStart;
          if (sceneAction && time - sceneAction.start >= sceneAction.duration) {
            if (sceneAction.kind === "martial") state.onMartialStage?.("complete");
            if (sceneAction.kind === "fish" || sceneAction.kind === "pondFeed" || sceneAction.kind === "release") state.onFishStage?.(sceneAction.kind === "release" ? "release" : "fish", "complete");
            if (sceneAction.kind === "skyLantern") state.onSkyLanternStage?.("complete");
            sceneAction = null;
          }
          const martialView = sceneAction?.kind === "martial";
          const fishView = sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" || sceneAction?.kind === "release";
          const skyLanternView = sceneAction?.kind === "skyLantern";
          const practiceView = seated && ["prayer", "beads", "bow", "meditate"].includes(state.action);
          const conversationView = Boolean(conversationResident);
          const martialProgress = sceneAction?.kind === "martial" ? clamp((time - sceneAction.start) / MARTIAL_DURATION, 0, 1) : 0;
          if (martialView || fishView || practiceView || skyLanternView || conversationView) { firstPerson = false; mapMode = false; }
          if (conversationResident) actor.group.rotation.y += angleDelta(actor.group.rotation.y, Math.atan2(conversationResident.x - position.x, conversationResident.z - position.z)) * Math.min(1, dt * 7);
          const schedulePose = lessonActive && state.action === "idle" ? seated ? "chantSit" : "chant" : state.action;
          const pose = walking ? "idle" : incensePrayer ? "incense" : lampPrayer ? "light" : sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" ? "feed" : sceneAction?.kind === "release" ? "releaseFish" : sceneAction ? sceneAction.kind : schedulePose === "idle" && seated ? "sit" : schedulePose;
          const bowPhase = Math.min((time - actionStart) * (state.bowSpeed ?? 1), 1);
          const incensePhase = incensePrayer ? incenseAge / 8.4 : sceneAction ? (time - sceneAction.start) / sceneAction.duration : 0;
          actor.update(pose, time, walking, pose === "incense" ? incensePhase : pose === "light" ? (time - lampPrayerStart) / 24 : ["strike", "martial", "feed", "releaseFish", "skyLantern"].includes(pose) ? incensePhase : pose === "bow" ? bowPhase : undefined);
          selfRing.position.set(position.x, position.y + 0.025, position.z);
          selfRing.scale.setScalar(1 + Math.sin(time * 2) * 0.035);
          selfRing.visible = !seated && !firstPerson;
          actor.group.visible = !firstPerson;

          if (time - lastRemoteSync > 0.3) { syncRemote(time); lastRemoteSync = time; }
          remote.forEach(person => {
            const distance = person.monk.group.position.distanceTo(person.target);
            person.monk.group.position.lerp(person.target, 1 - Math.exp(-dt * 7));
            person.monk.group.rotation.y += angleDelta(person.monk.group.rotation.y, person.heading) * Math.min(1, dt * 8);
            const remotePose = lessonActive && distance <= 0.12 && (person.action === "idle" || person.action === "sit") ? person.action === "sit" ? "chantSit" : "chant" : person.action;
            person.monk.update(remotePose, time, distance > 0.12 && person.action !== "sit" && person.action !== "meditate", person.action === "bow" ? Math.min(((time - person.actionStart) * person.bowSpeed) % 1.25, 1) : undefined);
          });
          world.animate(time);
          offerings.forEach(offering => offering.animate(time));

          const activeRoom = world.rooms.find(room => position.x > room.minX && position.x < room.maxX && position.z > room.minZ && position.z < room.maxZ);
          const indoors = Boolean(activeRoom);
          const floorHeight = world.floorHeightAt(position.x, position.z);
          if (mapMode) mapFocus.y = floorHeight + 0.65;
          const nextCameraMode = martialView || fishView || practiceView || skyLanternView || conversationView ? "third" : state.cameraMode ?? "third";
          const cameraChanged = nextCameraMode !== cameraMode;
          const fieldOfView = firstPerson ? clamp(64 * Math.sqrt(zoomScale), 42, 85) : mapMode || martialView ? 48 : 42;
          if (cameraChanged || camera.fov !== fieldOfView) {
            cameraMode = nextCameraMode;
            camera.fov = fieldOfView;
            camera.near = firstPerson ? 0.06 : 0.1;
            camera.updateProjectionMatrix();
          }
          if (mapMode) {
            if (cameraChanged) mapFocus.set(position.x, floorHeight + 0.65, position.z);
            if (mapFollowing && walking) {
              mapFocus.x += (position.x - mapFocus.x) * Math.min(1, dt * 4);
              mapFocus.z += (position.z - 1.2 - mapFocus.z) * Math.min(1, dt * 4);
            }
            const overview = clamp((zoomScale - 1.55) / 1.65, 0, 1);
            const overviewWidth = 1 + overview * (clamp(0.9 / camera.aspect, 1, 2.4) - 1);
            const mapHeight = (mobile ? 19 : 24) * zoomScale * (1 + overview * 0.75) * overviewWidth;
            cameraTarget.copy(mapFocus);
            camera.position.set(mapFocus.x, mapFocus.y + mapHeight, mapFocus.z + mapHeight * 0.7);
          } else if (firstPerson) {
            const eyeHeight = pose === "idle" ? 1.1 : 0.85;
            firstPersonHeight += (eyeHeight - firstPersonHeight) * Math.min(1, dt * 8);
            camera.position.set(position.x, position.y + firstPersonHeight, position.z);
            cameraLook.set(
              position.x - Math.sin(yaw) * Math.cos(firstPersonPitch),
              camera.position.y + Math.sin(firstPersonPitch),
              position.z - Math.cos(yaw) * Math.cos(firstPersonPitch),
            );
            cameraTarget.copy(cameraLook);
          } else {
            if (conversationResident) cameraLook.set((position.x + conversationResident.x) / 2, floorHeight + 0.8, (position.z + conversationResident.z) / 2);
            else if (martialView) cameraLook.set(28, 1.1, 12);
            else if (skyLanternView) cameraLook.set(0, 1.4, 28);
            else if (practiceView) cameraLook.set(position.x, floorHeight + 0.65, position.z);
            else if (fishView) cameraLook.set(position.x + (sceneAction?.kind === "fish" ? 0.5 : -0.5), floorHeight + 0.6, position.z);
            else if (lampPrayer) cameraLook.set(40, 3.8, 28);
            else cameraLook.set(position.x, floorHeight + (indoors ? 0.95 : 0.8), position.z - (indoors ? 0.2 : 0.8));
            if (cameraChanged) cameraTarget.copy(cameraLook);
            else cameraTarget.lerp(cameraLook, 1 - Math.exp(-dt * 4));
            if (conversationResident) {
              const distance = Math.max(4.2, 1.3 / (Math.tan(Math.PI * 42 / 360) * camera.aspect)) * clamp(zoomScale, 0.85, 1.25);
              const directionX = conversationResident.x - position.x;
              const directionZ = conversationResident.z - position.z;
              const length = Math.max(0.1, Math.hypot(directionX, directionZ));
              cameraGoal.set(cameraLook.x - directionZ / length * distance, floorHeight + 2.4, cameraLook.z + directionX / length * distance);
            } else if (martialView) {
              const martialZoom = clamp(zoomScale, 0.85, 1.25);
              const distance = Math.max(9.5, 4.2 / (Math.tan(Math.PI * 48 / 360) * camera.aspect)) * martialZoom;
              const orbit = Math.sin(martialProgress * Math.PI * 2) * 0.24;
              cameraGoal.set(28 + Math.sin(orbit) * distance, 3.8 + Math.sin(martialProgress * Math.PI) * 0.65, 12 + Math.cos(orbit) * distance);
            } else if (skyLanternView) {
              const distance = Math.max(7, 1.6 / (Math.tan(Math.PI * 42 / 360) * camera.aspect)) * clamp(zoomScale, 0.85, 1.25);
              cameraGoal.set(distance * 0.15, 4, 28 + distance);
            } else if (practiceView) {
              const practiceZoom = clamp(zoomScale, 0.85, 1.4);
              const distance = Math.max(3.3, 0.72 / (Math.tan(Math.PI * 42 / 360) * camera.aspect)) * practiceZoom;
              cameraGoal.set(position.x + distance * 0.08, floorHeight + 1.65 * practiceZoom, position.z - distance);
            } else if (fishView) {
              const direction = sceneAction?.kind === "fish" ? 1 : -1;
              const distance = Math.max(4.8, 1.6 / (Math.tan(Math.PI * 42 / 360) * camera.aspect)) * clamp(zoomScale, 0.85, 1.25);
              cameraGoal.set(position.x + direction * distance * 0.7, floorHeight + 2.8, position.z + distance * 0.7);
            } else if (lampPrayer) {
              const lampZoom = clamp(zoomScale, 0.95, 1.35);
              const lampDistance = 32 * Math.max(1, 0.5 / camera.aspect) * lampZoom;
              cameraGoal.set(40, 8 * lampZoom, 28 + lampDistance);
            } else if (activeRoom) {
              const indoorZoom = clamp(zoomScale, 0.65, 1.35);
              for (const turn of [0, Math.PI / 3, -Math.PI / 3, Math.PI * 2 / 3, -Math.PI * 2 / 3, Math.PI]) {
                cameraGoal.set(clamp(position.x + Math.sin(yaw + turn) * 5.2 * indoorZoom, activeRoom.minX + 0.4, activeRoom.maxX - 0.4), floorHeight + 2.6 * indoorZoom, clamp(position.z + Math.cos(yaw + turn) * 5.2 * indoorZoom, activeRoom.minZ + 0.4, activeRoom.maxZ - 0.4));
                if (!blocked(cameraGoal.x, cameraGoal.z) && Math.hypot(cameraGoal.x - position.x, cameraGoal.z - position.z) > 1.8) break;
              }
            } else cameraGoal.set(position.x + Math.sin(yaw) * cameraRadius * zoomScale, floorHeight + cameraHeight * zoomScale, position.z + Math.cos(yaw) * cameraRadius * zoomScale);
            if (cameraChanged) camera.position.copy(cameraGoal);
            else camera.position.lerp(cameraGoal, 1 - Math.exp(-dt * 5));
            if (activeRoom) camera.position.set(
              clamp(camera.position.x, activeRoom.minX + 0.4, activeRoom.maxX - 0.4),
              clamp(camera.position.y, floorHeight + 1.5, floorHeight + 3.6),
              clamp(camera.position.z, activeRoom.minZ + 0.4, activeRoom.maxZ - 0.4),
            );
          }
          camera.lookAt(cameraTarget);
          const fogShift = Math.max(0, camera.position.distanceTo(cameraTarget) - 80);
          if (scene.fog instanceof T.Fog) {
            scene.fog.near = 120 + fogShift;
            scene.fog.far = Math.min(camera.far - 8, 360 + fogShift);
          }
          if (firstPerson) obscuredRoofs.clear();
          else if (time - lastOcclusionCheck > 0.08) {
            occlusionDirection.copy(position);
            occlusionDirection.y += 0.85;
            occlusionDirection.sub(camera.position);
            occlusionRay.far = occlusionDirection.length() - 0.2;
            occlusionRay.ray.set(camera.position, occlusionDirection.normalize());
            obscuredRoofs.clear();
            occlusionRay.intersectObjects(roofSurfaces, false).forEach(hit => obscuredRoofs.add(hit.object));
            if (activeRoom && mapMode) {
              const roomRoofs = activeRoom.name === "大雄宝殿" ? hallRoofs : activeRoom.roofs;
              roomRoofs.forEach(roof => obscuredRoofs.add(roof));
            }
            lastOcclusionCheck = time;
          }
          roofSurfaces.forEach(roof => {
            const material = roof.material as THREE.Material;
            const opacity = obscuredRoofs.has(roof) ? 0.12 : 1;
            material.opacity += (opacity - material.opacity) * Math.min(1, dt * 9);
            material.depthWrite = material.opacity > 0.98;
          });
          world.rooms.forEach(room => {
            const roomRoofs = room.name === "大雄宝殿" ? [...hallRoofs] : room.roofs;
            const hidden = (activeRoom === room && mapMode) || roomRoofs.some(roof => (roof.material as THREE.Material).opacity < 0.98);
            room.roofDetails?.forEach(details => { details.visible = !hidden; });
          });
          renderer.render(scene, camera);
          const canEncounter = !lessonActive && !state.auto && !state.meditating && !seated && !sceneAction && !approachingIncense && !approachingLamp && !approachingFish && !approachingMartial && !approachingSkyLantern && !incensePrayer && !lampPrayer && (!dialogOpen || conversationView);
          const nextEncounter = conversationId ?? (canEncounter ? findNpcEncounter(world.residents, encounteredNpc, position, resident => {
            if (!clearLine(position.x, position.z, resident.x, resident.z)) return false;
            projected.set(resident.x, world.floorHeightAt(resident.x, resident.z) + 0.9, resident.z).project(camera);
            return projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95;
          }) : null);
          if (nextEncounter !== encounteredNpc) {
            encounteredNpc = nextEncounter;
            state.onNpcEncounter?.(nextEncounter);
          }
          interactivePoints.forEach(point => {
            const nearby = Math.hypot(position.x - point.x, position.z - point.z) <= 5;
            positionHotspot(point.button, point.x, point.y, point.z, nearby && Boolean(state.onContextAction) && !state.auto && !state.meditating && !dialogOpen && !martialView && !fishView && !practiceView && !skyLanternView);
          });
          const availableCushion = world.cushions[nearestCushionIndex];
          positionHotspot(cushionButton, availableCushion?.x ?? 0, 0.55, availableCushion?.z ?? 0, nearestCushionIndex >= 0 && !state.auto && !state.meditating && !dialogOpen && !martialView && !fishView && !practiceView && !skyLanternView);
          if (firstPerson || martialView || fishView || practiceView || skyLanternView) selfLabel.style.display = "none";
          else positionLabel(selfLabel, actor.group, walking ? 1.72 : seated ? 1.4 : 1.72);
          remote.forEach(person => positionLabel(person.label, person.monk.group, person.action === "sit" || person.action === "meditate" ? 1.4 : 1.65));

          if (state.selfId && time - lastSent > 0.2 && (Math.hypot(position.x - lastPosition.x, position.z - lastPosition.z) > 0.035 || Math.abs(angleDelta(lastPosition.heading, actor.group.rotation.y)) > 0.05)) {
            lastSent = time;
            lastPosition = { x: Math.round(position.x * 100) / 100, z: Math.round(position.z * 100) / 100, heading: Math.atan2(Math.sin(actor.group.rotation.y), Math.cos(actor.group.rotation.y)), floor: 1 };
            state.onPositionChange(lastPosition);
          }
          let place = activeRoom?.name ?? "静心庭院";
          let nearest = 4.5;
          world.landmarks.forEach(landmark => {
            const distance = Math.hypot(position.x - landmark.x, position.z - landmark.z);
            if (distance < nearest) { nearest = distance; place = landmark.name; }
          });
          if (place !== currentPlace) { currentPlace = place; state.onPlaceChange?.(place); }
        }

        if (!alive) { disposeWorld(); return; }
        frame = requestAnimationFrame(animate);
        setReady(true);
      } catch {
        disposeWorld();
        if (alive) { setError(true); setReady(false); }
      }
    })();

    return () => { alive = false; disposeWorld(); };
  }, [retry]);

  function updateJoystick(event: React.PointerEvent<HTMLButtonElement>) {
    if (joystickPointer.current !== event.pointerId || latest.current.auto || latest.current.meditating) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    const length = Math.hypot(x, y);
    const radius = Math.min(bounds.width / 2 - 19, 30);
    const scale = length > radius ? radius / length : 1;
    const next = { x: x * scale, y: y * scale };
    joystick.current = { x: next.x / radius, y: next.y / radius };
    setKnob(next);
  }

  function endJoystick(event: React.PointerEvent<HTMLButtonElement>) {
    if (joystickPointer.current !== event.pointerId) return;
    joystickPointer.current = null;
    joystick.current = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
  }

  const controlsDisabled = !ready || props.auto || props.meditating;

  return <div ref={hostRef} className="temple-world" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#d9e9eb", touchAction: "none" }}>
    <div ref={labelsRef} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
    <div ref={hotspotsRef} role="group" aria-label="附近可互动的地点" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
    {!ready && !error && <div role="status" style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center", color: "#526347", fontSize: 16, fontWeight: 700, gap: 12 }}><span style={{ fontSize: 28 }}>✳</span><span>正在推开三维寺庙的门…</span></div>}
    {error && <div role="alert" style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", padding: 28, textAlign: "center", color: "#526347", fontSize: 16, fontWeight: 700, background: "#e4eadc", gap: 14 }}><span style={{ fontSize: 32 }}>✳</span><strong>三维庭院暂时没有打开</strong><span style={{ fontSize: 14, lineHeight: 1.8 }}>请使用手机 Safari 或 Chrome 重新打开，再试一次。</span><button onClick={() => setRetry(value => value + 1)} style={{ border: 0, padding: "11px 22px", borderRadius: 24, background: "#778d62", color: "#fff", cursor: "pointer" }}>重新入寺</button></div>}
    {ready && <>
      <div className="world-joystick" style={{ position: "absolute", left: 18, bottom: 39, display: "grid", justifyItems: "center", gap: 7, opacity: controlsDisabled ? 0.45 : 1 }}>
        <button aria-label="移动小和尚，按住并拖动摇杆" title="按住并拖动移动，电脑也可用WASD或方向键" disabled={controlsDisabled}
          onPointerDown={event => { joystickPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); updateJoystick(event); }}
          onPointerMove={updateJoystick} onPointerUp={endJoystick} onPointerCancel={endJoystick}
          style={{ position: "relative", width: 92, height: 92, borderRadius: "50%", border: "1px solid rgba(89,111,72,.25)", background: "rgba(250,251,238,.64)", boxShadow: "inset 0 0 0 12px #ffffff25,0 3px 14px #344e2520", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", padding: 0, touchAction: "none", cursor: controlsDisabled ? "default" : "grab" }}>
          <span style={{ position: "absolute", top: 4, left: 0, right: 0, fontSize: 14, fontWeight: 700, color: "#657650" }}>⌃</span>
          <span style={{ position: "absolute", left: "50%", top: "50%", width: 36, height: 36, marginLeft: -18, marginTop: -18, borderRadius: "50%", background: "#8e9f75", border: "2px solid #e7eddb", boxShadow: "0 3px 8px #415c3930", transform: `translate(${knob.x}px,${knob.y}px)`, pointerEvents: "none" }} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#465b3e", textShadow: "0 1px 3px #ffffff" }}>{props.auto || props.meditating ? "安心修行中" : "摇杆行走"}</span>
      </div>
      <div className={`world-landmarks ${placeMenu ? "is-open" : ""}`} style={{ position: "absolute", right: 17, bottom: 43, display: "grid", justifyItems: "end", gap: 9 }}>
        <div className="world-nav-buttons" style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
          <button aria-label="地图导航，去走走" aria-expanded={placeMenu} disabled={controlsDisabled} onClick={() => setPlaceMenu(value => !value)} style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #79916844", borderRadius: 20, background: "rgba(250,251,238,.94)", color: "#465b3e", fontSize: 14, fontWeight: 750, minHeight: 44, padding: "8px 9px", whiteSpace: "nowrap" }}>⌖ 地图导航</button>
          <button aria-label="到处走走，随机前往一个地点" disabled={controlsDisabled} onClick={() => { const place = places[Math.floor(Math.random() * places.length)]; if (place) travel.current(place); setPlaceMenu(false); }} style={{ border: "1px solid #79916844", borderRadius: 20, padding: "8px 9px", minHeight: 44, background: "#e3eccff2", color: "#405438", fontSize: 14, fontWeight: 750, whiteSpace: "nowrap" }}>到处走走</button>
        </div>
        {placeMenu && <div role="group" aria-label="前往寺庙地点" style={{ display: "grid", gap: 5, padding: 7, borderRadius: 14, background: "rgba(251,251,240,.95)", border: "1px solid #899b7633", boxShadow: "0 4px 20px #314c3020" }}>
          {places.map((place, index) => <button key={`${place.name}-${index}`} aria-label={`前往${place.name}`} title={place.name} disabled={controlsDisabled}
            onClick={() => { travel.current(place); setPlaceMenu(false); }}
            style={{ border: 0, borderRadius: 8, minHeight: 44, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
            ⌖ &nbsp; {place.name}
          </button>)}
        </div>}
        <span className="world-look-hint" style={{ fontSize: 14, fontWeight: 700, color: "#465b3e", textShadow: "0 1px 3px #fff" }}>{props.cameraMode === "map" ? "上下左右拖动地图" : "拖动右侧看风景"}</span>
      </div>
      <div className="world-zoom-controls" role="group" aria-label="缩放视角" style={{ position: "absolute", right: "var(--hud-right, 12px)", top: "calc(var(--hud-top, 12px) + 52px)", display: "flex", zIndex: 9, borderRadius: 22, overflow: "hidden", boxShadow: "0 2px 10px #344e251a", background: "#f7faedee" }}>
        <button aria-label="拉近视角" onClick={() => zoomView.current(0.85)} style={{ width: 44, height: 40, border: 0, background: "transparent", fontSize: 24, color: "#405438" }}>+</button>
        <button aria-label="拉远视角" onClick={() => zoomView.current(1 / 0.85)} style={{ width: 44, height: 40, border: 0, borderLeft: "1px solid #83946d33", background: "transparent", fontSize: 24, color: "#405438" }}>−</button>
      </div>
    </>}
  </div>;
}

