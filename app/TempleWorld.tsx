"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { SHRINES, type ShrineId } from "./shrines";
import { MARTIAL_DURATION } from "./three/martial";
import { getTempleSchedule } from "./templeSchedule";
import type { NpcResidentId } from "./npcResidents";
import { findNpcEncounter } from "./npcEncounters";
import { TEMPLE_INTERACTIONS, isTempleInteraction, type TempleInteractionKind } from "./templeInteractions";
import type { PondSpecies } from "./pondGame";
import type { AbbotSnapshot } from "./abbotQuest";
import type { AbbotAccessoryId, AbbotOutfit } from "../abbot-accessories.mjs";
import { createRemoteMotion } from "./three/remoteMotion";
import { CAT_HIDEOUTS, CAT_SEARCH_RADIUS, TEMPLE_CAT_PLACES, type CatHideout } from "./templeCat";
import TempleLoading from "./TempleLoading";
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
  at?: number;
  accessoryId?: AbbotAccessoryId | null;
  accessories?: AbbotOutfit;
};

type Position = { x: number; z: number; heading: number; floor: 1 };
type Landmark = { name: string; x: number; z: number };
type CatGuideStatus = "idle" | "walking" | "near";
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
  selfName?: string;
  paused?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onReadyChange?: (ready: boolean) => void;
  catHunt?: { id: number; checked: readonly CatHideout[]; inspection: number; found: CatHideout | null; guide?: { target: CatHideout; request: number } } | null;
  onCatNearbyChange?: (id: number, nearby: CatHideout | null) => void;
  onCatInspect?: (id: number, place: CatHideout) => void;
  onCatGuideStatus?: (id: number, request: number, status: CatGuideStatus) => void;
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
  pondRelease?: { requestId: string; species: PondSpecies } | null;
  onPondReleaseResult?: (result: { requestId: string; species: PondSpecies; stage: "released" | "cancelled" }) => void;
  onSkyLanternStage?: (stage: "begin" | "release" | "complete") => void;
  talkingNpcId?: NpcResidentId | null;
  onNpcEncounter?: (id: NpcResidentId | null) => void;
  onInteractionStage?: (kind: TempleInteractionKind, stage: "begin" | "impact" | "complete") => void;
  abbot?: AbbotSnapshot | null;
  abbotTalking?: boolean;
  abbotNavigatePulse?: number;
  abbotCinematic?: { id: number; kind: "greeting" | "blessing"; variant?: number } | null;
  onAbbotNearbyChange?: (nearby: boolean) => void;
  onAbbotCinematicEnd?: () => void;
  onPrayerComplete?: () => void;
  onBeadsComplete?: () => void;
  practiceTiers?: { wood: number; beads: number; flower: number };
  practiceTravelPulse?: number;
};

type MonkInstance = {
  group: THREE.Group;
  update: (action: string, time: number, walking: boolean, phase?: number) => void;
  setReleaseSpecies: (species: PondSpecies) => void;
  setPracticeTiers: (tiers: { wood: number; beads: number; flower: number }) => void;
  setAccessory: (id: AbbotAccessoryId | null) => void;
  setAccessories: (outfit: AbbotOutfit) => void;
  dispose: () => void;
};

const remoteColors = [0x96a78d, 0xb39274, 0x8ba7a0, 0xbd9c83, 0xaca17d];
// Keep a monk-radius clearance inside every wall, including the open mountain gate.
const TEMPLE_BOUNDS = { minX: -51.5, maxX: 51.5, minZ: -39.5, maxZ: 39.5 };
const CAT_GUIDE_REVEAL_RADIUS = 8;
const CAT_GUIDE_STEPS = 5;
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
  const consumedCatGuide = useRef<string | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    props.onLoadingChange?.(!ready && !error);
    props.onReadyChange?.(ready && !error);
  }, [ready, error, props.onLoadingChange, props.onReadyChange]);
  const [retry, setRetry] = useState(0);
  const [places, setPlaces] = useState<Landmark[]>([]);
  const [placeMenu, setPlaceMenu] = useState(false);

  useEffect(() => {
    let alive = true;
    let disposeWorld = () => {};
    setReady(false);
    setError(false);
    latest.current.onSeatedChange?.(false);
    latest.current.onAbbotNearbyChange?.(false);
    latest.current.onContextChange?.({ nearCushion: false, nearAltar: false, nearFlowers: false, nearRitual: false });

    void (async () => {
      try {
        const [T, { createMonk }, { createTempleEnvironment }, { createIncenseOffering }, { createMysteriousAbbot }, { createCinematicCamera }, { RoomEnvironment }, { createTempleCatWorldModel }] = await Promise.all([
          import("three"),
          import("./three/monk"),
          import("./three/environment"),
          import("./three/incense"),
          import("./three/mysteriousAbbot"),
          import("./three/cinematicCamera"),
          import("three/addons/environments/RoomEnvironment.js"),
          import("./three/templeCatWorldModel"),
        ]);
        const host = hostRef.current;
        const labels = labelsRef.current;
        const hotspots = hotspotsRef.current;
        if (!alive || !host || !labels || !hotspots) return;

        const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.01;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
        renderer.domElement.tabIndex = 0;
        renderer.domElement.setAttribute("aria-label", "三维寺庙。地图视角可向上下左右拖动，轻点地面行走，走近场景中的地点可互动。电脑可用方向键或WASD移动。");
        host.insertBefore(renderer.domElement, host.firstChild);

        const scene = new T.Scene();
        scene.background = new T.Color(0xc9dacf);
        scene.fog = new T.Fog(0xc9dacf, 120, 360);
        const camera = new T.PerspectiveCamera(42, 1, 0.1, 650);
        let mobile = host.clientWidth < 640;
        let yaw = 0.18;
        let cameraRadius = mobile ? 7.8 : 10;
        let cameraHeight = mobile ? 7.4 : 9.4;
        let cameraMode = latest.current.cameraMode ?? "third";
        let ritualCameraActive = false;
        let firstPersonPitch = -0.06;
        let firstPersonHeight = 1.1;
        const cameraTarget = new T.Vector3(0, 0.65, 2.9);
        const mapFocus = new T.Vector3(0, 0.65, 2.9);
        const cameraGoal = new T.Vector3();
        camera.position.set(Math.sin(yaw) * cameraRadius, cameraHeight, 9 + Math.cos(yaw) * cameraRadius);
        camera.lookAt(cameraTarget);

        const skyLight = new T.HemisphereLight(0xffedcd, 0x5d8278, 1.55);
        const sunlight = new T.DirectionalLight(0xffd7a7, 3.8);
        sunlight.position.set(-38, 55, 24);
        sunlight.target.position.set(0, 0, -2);
        sunlight.castShadow = true;
        sunlight.shadow.mapSize.set(mobile ? 1024 : 1536, mobile ? 1024 : 1536);
        sunlight.shadow.camera.left = -62;
        sunlight.shadow.camera.right = 62;
        sunlight.shadow.camera.top = 52;
        sunlight.shadow.camera.bottom = -52;
        sunlight.shadow.camera.near = 0.5;
        sunlight.shadow.camera.far = 200;
        sunlight.shadow.bias = -0.00025;
        sunlight.shadow.normalBias = 0.025;
        scene.add(skyLight, sunlight, sunlight.target);

        let environment: ReturnType<typeof createTempleEnvironment> | undefined;
        let local: MonkInstance | undefined;
        let abbot: ReturnType<typeof createMysteriousAbbot> | undefined;
        const offerings = new Map<ShrineId, ReturnType<typeof createIncenseOffering>>();
        let frame = 0;
        let holdTimer: ReturnType<typeof setTimeout> | undefined;
        let observer: ResizeObserver | undefined;
        const remote = new Map<string, { monk: MonkInstance; label: HTMLDivElement; motion: ReturnType<typeof createRemoteMotion>; lastSampleAt: number; seat: number | null; floor: number; action: string; actionStart: number; bowSpeed: number }>();
        const cleanupListeners: (() => void)[] = [];
        const hotspotButtons: HTMLButtonElement[] = [];
        const ownedGeometries: THREE.BufferGeometry[] = [];
        const ownedMaterials: THREE.Material[] = [];
        let catModel: ReturnType<typeof createTempleCatWorldModel> | undefined;
        const selfLabel = document.createElement("div");
        selfLabel.style.cssText = "position:absolute;top:0;left:0;padding:4px 8px;border-radius:8px;background:rgba(244,234,213,.94);border:1px solid #b4925b66;color:#263f39;font:600 12px/16px system-ui;white-space:nowrap;max-width:min(45vw,240px);overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 12px #263f391f;will-change:transform";
        const selfNameLabel = document.createElement("span");
        selfNameLabel.style.cssText = "display:block;overflow:hidden;text-overflow:ellipsis";
        selfNameLabel.textContent = latest.current.selfName || "你的小和尚";
        const selfTitleLabel = document.createElement("span");
        selfTitleLabel.style.cssText = "display:none;color:#79532f;font-weight:500;overflow:hidden;text-overflow:ellipsis";
        selfLabel.append(selfNameLabel, selfTitleLabel);
        labels.appendChild(selfLabel);
        const abbotLabel = document.createElement("div");
        abbotLabel.style.cssText = selfLabel.style.cssText;
        abbotLabel.style.background = "rgba(244,234,213,.97)";
        abbotLabel.style.color = "#79532f";
        abbotLabel.textContent = "云隐住持 · 奇遇";
        abbotLabel.style.display = "none";
        labels.appendChild(abbotLabel);

        disposeWorld = () => {
          cancelAnimationFrame(frame);
          if (holdTimer) clearTimeout(holdTimer);
          observer?.disconnect();
          cleanupListeners.forEach(remove => remove());
          remote.forEach(({ monk, label }) => { monk.dispose(); label.remove(); });
          local?.dispose();
          abbot?.dispose();
          catModel?.dispose();
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
          abbotLabel.remove();
          hotspotButtons.forEach(button => button.remove());
          joystick.current = { x: 0, y: 0 };
          travel.current = () => {};
          latest.current.onAbbotNearbyChange?.(false);
        };

        const reflectionRoom = new RoomEnvironment();
        const reflectionGenerator = new T.PMREMGenerator(renderer);
        const reflection = reflectionGenerator.fromScene(reflectionRoom, .04);
        scene.environment = reflection.texture;
        scene.environmentIntensity = .24;
        reflectionRoom.dispose();
        reflectionGenerator.dispose();
        cleanupListeners.push(() => reflection.dispose());
        environment = createTempleEnvironment(scene);
        abbot = createMysteriousAbbot();
        abbot.group.visible = false;
        scene.add(abbot.group);
        local = createMonk(0xcc9365);
        scene.add(local.group);
        local.group.position.set(0, 0, 9);
        local.group.rotation.y = 0;
        const actor = local;
        const world = environment;
        const master = abbot;
        const hotspotStyle = "position:absolute;top:0;left:0;display:none;height:44px;max-height:44px;padding:0 12px;border:1px solid #b4925b99;border-radius:12px;background:rgba(244,234,213,.97);color:#284e4c;font:600 14px/20px system-ui;white-space:nowrap;max-width:min(45vw,240px);overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 16px #263f392e;pointer-events:auto;touch-action:manipulation;will-change:transform";
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
            if (state.catHunt || state.auto || state.meditating || Math.hypot(actor.group.position.x - point.x, actor.group.position.z - point.z) > 5) return;
            if (point.kind === "martial" && (approachingMartial || sceneAction?.kind === "martial")) return;
            if ((point.kind === "fish" || point.kind === "pondFeed" || point.kind === "release") && (approachingFish || sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" || sceneAction?.kind === "release")) return;
            if (performance.now() < nextActivation) return;
            nextActivation = performance.now() + (point.kind === "fish" ? 4000 : point.kind === "towerBell" ? 3500 : 1200);
            if (point.kind === "release") { state.onContextAction?.("release"); return; }
            if (isTempleInteraction(point.kind)) {
              if (approachingInteraction === point.kind || sceneAction?.kind === point.kind) return;
              if (point.kind === "flower" || point.kind === "ritual") state.onContextAction?.(point.kind);
              else approachInteraction(point.kind);
              return;
            }
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
            if (point.kind === "fish" || point.kind === "pondFeed") {
              approachingIncense = false;
              incensePrayerUntil = 0;
              approachingLamp = false;
              lampPrayerUntil = 0;
              const shore = FISH_ACTIONS[point.kind];
              walkTo(shore.x, shore.z);
              approachingFish = point.kind;
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
          if (state.catHunt || nearestCushionIndex < 0 || state.seat !== null || state.auto || state.meditating) return;
          state.onSeatSelect(nearestCushionIndex);
        };
        cushionButton.addEventListener("click", sitOnNearbyCushion);
        cleanupListeners.push(() => cushionButton.removeEventListener("click", sitOnNearbyCushion));
        hotspots.appendChild(cushionButton);
        hotspotButtons.push(cushionButton);
        for (const [id, shrine] of Object.entries(SHRINES)) {
          offerings.set(id as ShrineId, createIncenseOffering(scene, { x: shrine.x, z: shrine.furnaceZ, smoke: id !== "caishen" }));
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
        const cinematicCamera = createCinematicCamera([world.ground.parent!], new Set(roofSurfaces));
        cleanupListeners.push(() => cinematicCamera.dispose());
        const cinematicGoal = new T.Vector3();
        const cinematicFocus = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
        const abbotFacing = { origin: new T.Vector3(), direction: new T.Vector3(), minDot: .4 };
        let lastCinematicCheck = -Infinity;
        let lastCinematicKey = "";
        let cinematicAvoidedObstacle = false;
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

        const catMarkGeometry = new T.RingGeometry(.37, .45, 32);
        const catMarkMaterial = new T.MeshBasicMaterial({ color: 0xf0b763, transparent: true, opacity: .9, depthWrite: false });
        ownedGeometries.push(catMarkGeometry);
        ownedMaterials.push(catMarkMaterial);
        const catMark = new T.Mesh(catMarkGeometry, catMarkMaterial);
        catMark.rotation.x = -Math.PI / 2;
        catMark.visible = false;
        scene.add(catMark);
        function pawGeometry(expansion = 0) {
          const pads = [[0, -.072, .13, .104], [-.143, .048, .053, .067], [-.058, .144, .058, .069], [.058, .144, .058, .069], [.143, .048, .053, .067]];
          const shapes = pads.map(([x, y, rx, ry]) => {
            const shape = new T.Shape();
            shape.absellipse(x, y, rx + expansion, ry + expansion, 0, Math.PI * 2, false, 0);
            return shape;
          });
          const geometry = new T.ShapeGeometry(shapes, 10).rotateX(-Math.PI / 2);
          ownedGeometries.push(geometry);
          return geometry;
        }

        function pawTrail(outline: boolean) {
          const material = new T.MeshBasicMaterial({ color: outline ? 0x61442e : 0xffcf77, toneMapped: false });
          ownedMaterials.push(material);
          const trail = new T.InstancedMesh(pawGeometry(outline ? .023 : 0), material, CAT_GUIDE_STEPS);
          trail.visible = false;
          trail.frustumCulled = false;
          scene.add(trail);
          cleanupListeners.push(() => trail.dispose());
          return trail;
        }
        const catPawOutline = pawTrail(true);
        const catPaws = pawTrail(false);
        const pawTransform = new T.Object3D();
        let trailTarget: CatHideout | null = null;
        const catCamera = new T.Vector3();
        const catTarget = new T.Vector3();
        const catFocus = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
        let catRound = 0;
        let catInspection = 0;
        let lastCatNearby: CatHideout | null = null;

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
        let guideOwnedRoute: typeof route | null = null;
        let catGuideKey: string | null = null;
        let lastCatGuideStatus: CatGuideStatus | null = null;
        let lastSeat: number | null | undefined;
        let releasedSeat = false;
        let userMoved = false;
        let hydratedIdentity: string | undefined;
        let actionPulse = latest.current.actionPulse;
        let localAction = latest.current.action;
        let actionStart = 0;
        let prayerPending = false;
        let beadsPending = false;
        let practiceTravelPulse = latest.current.practiceTravelPulse ?? 0;
        let practiceTierKey = "";
        let abbotNearby = false;
        let abbotWasTalking = false;
        let abbotNavigatePulse = latest.current.abbotNavigatePulse ?? 0;
        let abbotCinematicId = -1;
        let abbotScene: { kind: "greeting" | "blessing"; variant: number; start: number; duration: number; x: number; z: number } | null = null;
        let abbotSnapshot: AbbotSnapshot | null | undefined;
        let abbotClockOffset = 0;
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
        let pondRequestId = latest.current.pondRelease?.requestId ?? "";
        let activePondRelease: { requestId: string; species: PondSpecies } | null = null;
        let skyLanternPulse = latest.current.skyLanternPulse ?? 0;
        let approachingSkyLantern = false;
        let approachingInteraction: TempleInteractionKind | null = null;
        let zoomScale = 1;
        let mapFollowing = false;
        let sceneAction: { kind: "martial" | "fish" | "pondFeed" | "release" | "skyLantern" | TempleInteractionKind; start: number; duration: number; offered?: boolean; impactsHandled?: number } | null = null;
        cleanupListeners.push(cancelFish);
        let lastScheduleCheck = -Infinity;
        let lessonActive = false;
        const touchPoints = new Map<number, { x: number; y: number }>();
        let pinchDistance = 0;
        function changeZoom(amount: number) { zoomScale = clamp(zoomScale * amount, 0.3, 4.5); }
        zoomView.current = changeZoom;
        let currentPlace = "静心庭院";
        let actualSeated: boolean | undefined;
        let lastContext: WorldContext | undefined;
        let encounteredNpc: NpcResidentId | null = null;
        let talkingNpc: NpcResidentId | null = null;
        let lastSent = -1;
        let lastPosition: Position = { x: 100, z: 100, heading: 0, floor: 1 };
        let lastRemoteSync = -1;
        let lastParticipantSnapshot: Participant[] | null = null;
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

        function stopCatGuide() {
          // Dropping a hint must leave a subsequent map tap or joystick move alone.
          if (guideOwnedRoute && route === guideOwnedRoute) {
            route = [];
            destination.visible = false;
          }
          guideOwnedRoute = null;
        }

        function showCatTrail(target: CatHideout | null) {
          catPaws.visible = catPawOutline.visible = target !== null;
          if (!target || target === trailTarget) return;
          trailTarget = target;
          const spot = TEMPLE_CAT_PLACES[target];
          const dx = spot.x - spot.guide.x;
          const dz = spot.z - spot.guide.z;
          const length = Math.hypot(dx, dz);
          for (let step = 0; step < CAT_GUIDE_STEPS; step++) {
            const progress = (step + 1) / CAT_GUIDE_STEPS;
            const offset = progress === 1 ? 0 : step % 2 === 0 ? -.18 : .18;
            const centerX = spot.guide.x + dx * progress;
            const centerZ = spot.guide.z + dz * progress;
            let x = centerX + dz / length * offset;
            let z = centerZ - dx / length * offset;
            if (blocked(x, z)) { x = centerX; z = centerZ; }
            const y = world.floorHeightAt(x, z) + .075;
            pawTransform.position.set(x, y, z);
            pawTransform.rotation.y = Math.atan2(-dx, -dz);
            pawTransform.scale.setScalar(.9 + progress * .34);
            pawTransform.updateMatrix();
            catPawOutline.setMatrixAt(step, pawTransform.matrix);
            pawTransform.position.y += .008;
            pawTransform.updateMatrix();
            catPaws.setMatrixAt(step, pawTransform.matrix);
          }
          catPawOutline.instanceMatrix.needsUpdate = catPaws.instanceMatrix.needsUpdate = true;
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
          if (latest.current.catHunt?.found || latest.current.auto || latest.current.meditating || abbotScene) return;
          cancelMartial();
          cancelFish();
          cancelSkyLantern();
          cancelInteraction();
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
          if (activePondRelease) {
            latest.current.onPondReleaseResult?.({ ...activePondRelease, stage: "cancelled" });
            activePondRelease = null;
          }
          approachingFish = null;
          if (sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" || sceneAction?.kind === "release") sceneAction = null;
        }
        function cancelSkyLantern() {
          approachingSkyLantern = false;
          if (sceneAction?.kind === "skyLantern") sceneAction = null;
        }
        function cancelInteraction() {
          approachingInteraction = null;
          if (sceneAction && isTempleInteraction(sceneAction.kind)) sceneAction = null;
        }
        function approachInteraction(kind: TempleInteractionKind) {
          approachingIncense = false;
          incensePrayerUntil = 0;
          approachingLamp = false;
          lampPrayerUntil = 0;
          const target = TEMPLE_INTERACTIONS[kind];
          walkTo(target.x, target.z);
          approachingInteraction = kind;
        }

        function updatePointer(event: PointerEvent) {
          const bounds = renderer.domElement.getBoundingClientRect();
          pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
          raycaster.setFromCamera(pointer, camera);
          return bounds;
        }

        function pointerDown(event: PointerEvent) {
          if (latest.current.catHunt?.found) return;
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
          if (pointerState.self && !latest.current.catHunt && !latest.current.auto && !latest.current.meditating) {
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
            if (cushion && !latest.current.catHunt) latest.current.onSeatSelect(cushion.object.userData.seat as number);
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
              existing = { monk, label, motion: createRemoteMotion({ x, z, heading: person.heading ?? 0 }), lastSampleAt: -Infinity, seat: person.seat, floor: person.floor ?? 1, action: "idle", actionStart: time, bowSpeed: person.bowSpeed ?? 1 };
              remote.set(person.id, existing);
            }
            const heading = seatPosition ? Math.PI : person.heading ?? 0;
            if (existing.seat !== person.seat || existing.floor !== (person.floor ?? 1)) {
              existing.motion.reset({ x, z, heading });
              existing.lastSampleAt = -Infinity;
            }
            existing.seat = person.seat;
            if (person.accessories) existing.monk.setAccessories(person.accessories);
            else existing.monk.setAccessory(person.accessoryId ?? null);
            existing.floor = person.floor ?? 1;
            const sampleAt = person.at ?? Date.now();
            if (sampleAt > existing.lastSampleAt) {
              existing.motion.push({ x, z, heading, at: sampleAt });
              existing.lastSampleAt = sampleAt;
            }
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
          if (state.paused) {
            if (keys.size || joystick.current.x || joystick.current.y || pointerState.id >= 0) releaseControls();
            if (guideOwnedRoute) {
              stopCatGuide();
              showCatTrail(null);
            }
            return;
          }
          if (now - lastScheduleCheck >= 1000) {
            lastScheduleCheck = now;
            lessonActive = Boolean(getTempleSchedule(Date.now()).lesson);
          }
          const position = actor.group.position;
          const catHunt = state.catHunt;
          const catFound = catHunt?.found ? TEMPLE_CAT_PLACES[catHunt.found] : null;
          if ((catHunt?.id ?? 0) !== catRound) {
            catRound = catHunt?.id ?? 0;
            catInspection = 0;
            lastCatNearby = null;
            if (catRound) {
              cancelMartial(); cancelFish(); cancelSkyLantern(); cancelInteraction();
              incensePrayerUntil = 0; approachingIncense = false;
              lampPrayerUntil = 0; approachingLamp = false;
              route = [];
              destination.visible = false;
              userMoved = true;
              releaseControls();
            }
          }
          if (!catFound && catModel?.root.visible) {
            catModel.hide();
            mapFocus.set(position.x, position.y + .65, position.z - 1.2);
          }
          const wardrobe = state.abbot?.wardrobe;
          if (wardrobe?.equippedBySlot) actor.setAccessories(wardrobe.equippedBySlot);
          else actor.setAccessory(wardrobe?.equipped ?? null);
          const practiceTiers = state.practiceTiers ?? { wood: 0, beads: 0, flower: 0 };
          const nextPracticeTierKey = `${practiceTiers.wood}:${practiceTiers.beads}:${practiceTiers.flower}`;
          if (nextPracticeTierKey !== practiceTierKey) {
            actor.setPracticeTiers(practiceTiers);
            practiceTierKey = nextPracticeTierKey;
          }
          if ((state.practiceTravelPulse ?? 0) !== practiceTravelPulse) {
            practiceTravelPulse = state.practiceTravelPulse ?? 0;
            travel.current({ name: "庭院蒲团", x: 0, z: 7 });
          }
          if (state.abbot !== abbotSnapshot) {
            abbotSnapshot = state.abbot;
            abbotClockOffset = (state.abbot?.now ?? Date.now()) - Date.now();
          }
          const encounter = state.abbot?.encounter;
          const abbotPresent = Boolean(encounter?.active && Date.now() + abbotClockOffset < encounter.leavesAt);
          if (abbotScene && (!state.abbotCinematic || lessonActive)) {
            abbotScene = null;
            state.onAbbotCinematicEnd?.();
          }
          if (state.abbotCinematic && state.abbotCinematic.id !== abbotCinematicId) {
            abbotCinematicId = state.abbotCinematic.id;
            if (abbotPresent && encounter && !lessonActive && !state.auto && !state.meditating && Math.hypot(position.x - encounter.location.x, position.z - encounter.location.z) <= 3.5) {
              cancelMartial(); cancelFish(); cancelSkyLantern(); cancelInteraction();
              approachingIncense = false; incensePrayerUntil = 0;
              approachingLamp = false; lampPrayerUntil = 0;
              leaveSeat();
              route = [];
              destination.visible = false;
              keys.clear();
              joystick.current = { x: 0, y: 0 };
              setKnob({ x: 0, y: 0 });
              abbotScene = { kind: state.abbotCinematic.kind, variant: state.abbotCinematic.variant ?? state.abbot?.quest.ceremony ?? 0, start: time, duration: state.abbotCinematic.kind === "blessing" ? 11 : 7, ...encounter.location };
            } else state.onAbbotCinematicEnd?.();
          }
          if (abbotScene && time - abbotScene.start >= abbotScene.duration) {
            abbotScene = null;
            state.onAbbotCinematicEnd?.();
          }
          master.group.visible = abbotPresent || Boolean(abbotScene);
          const abbotLocation = abbotScene ?? encounter?.location;
          if (master.group.visible && abbotLocation) {
            master.group.position.set(abbotLocation.x, world.floorHeightAt(abbotLocation.x, abbotLocation.z), abbotLocation.z);
            const facingPlayer = state.abbotTalking || Boolean(abbotScene) || abbotNearby;
            const heading = facingPlayer ? Math.atan2(position.x - abbotLocation.x, position.z - abbotLocation.z) : Math.PI * .15;
            master.group.rotation.y += angleDelta(master.group.rotation.y, heading) * Math.min(1, dt * 4);
            master.animate(time, lessonActive ? "chant" : abbotScene?.kind ?? "idle", abbotScene ? clamp((time - abbotScene.start) / abbotScene.duration, 0, 1) : 0, abbotScene?.variant ?? state.abbot?.quest.ceremony ?? 0);
          }
          if ((state.abbotNavigatePulse ?? 0) !== abbotNavigatePulse) {
            abbotNavigatePulse = state.abbotNavigatePulse ?? 0;
            if (abbotPresent && encounter) travel.current({ name: "云隐住持", x: encounter.location.x, z: encounter.location.z + 2.1 });
          }
          if (state.pondRelease && state.pondRelease.requestId !== pondRequestId) {
            pondRequestId = state.pondRelease.requestId;
            if (state.auto || state.meditating) state.onPondReleaseResult?.({ ...state.pondRelease, stage: "cancelled" });
            else {
              approachingIncense = false; incensePrayerUntil = 0;
              approachingLamp = false; lampPrayerUntil = 0;
              const shore = FISH_ACTIONS.release;
              walkTo(shore.x, shore.z);
              activePondRelease = { ...state.pondRelease };
              actor.setReleaseSpecies(activePondRelease.species);
              world.setReleaseSpecies(activePondRelease.species);
              approachingFish = "release";
              if (!route.length && Math.hypot(position.x - shore.x, position.z - shore.z) >= .25) cancelFish();
            }
          }
          const conversationResident = lessonActive ? undefined : world.residents.find(resident => resident.id === state.talkingNpcId);
          const abbotConversation = master.group.visible && (Boolean(abbotScene) || (state.abbotTalking && Math.hypot(position.x - master.group.position.x, position.z - master.group.position.z) <= 3.5));
          if (abbotConversation && !abbotWasTalking) {
            route = [];
            destination.visible = false;
            keys.clear();
            joystick.current = { x: 0, y: 0 };
            setKnob({ x: 0, y: 0 });
          }
          abbotWasTalking = Boolean(abbotConversation);
          const conversationPartner = abbotConversation ? master.group.position : conversationResident;
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
            approachInteraction("flower");
          }
          if ((state.ritualPulse ?? 0) !== ritualPulse) {
            ritualPulse = state.ritualPulse ?? 0;
            approachInteraction("ritual");
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
              cancelInteraction();
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
            cancelInteraction();
            const cushion = world.cushions[state.seat];
            position.set(cushion.x, 0.12, cushion.z);
            route = [];
          }

          const dialogOpen = Boolean(catFound || abbotScene || document.querySelector("[role='dialog']"));
          if (dialogOpen) keys.clear();
          let inputX = dialogOpen ? 0 : joystick.current.x;
          let inputY = dialogOpen ? 0 : joystick.current.y;
          if (keys.has("KeyA") || keys.has("ArrowLeft")) inputX -= 1;
          if (keys.has("KeyD") || keys.has("ArrowRight")) inputX += 1;
          if (keys.has("KeyW") || keys.has("ArrowUp")) inputY -= 1;
          if (keys.has("KeyS") || keys.has("ArrowDown")) inputY += 1;
          const strength = Math.min(1, Math.hypot(inputX, inputY));
          const controlsBlocked = state.auto || state.meditating || dialogOpen;
          const catGuide = catHunt?.guide && !catHunt.found && !catHunt.checked.includes(catHunt.guide.target) ? catHunt.guide : null;
          const guideSpot = catGuide ? TEMPLE_CAT_PLACES[catGuide.target] : null;
          const guideKey = catGuide ? `${catRound}:${catGuide.target}:${catGuide.request}` : null;
          if (guideKey !== catGuideKey) {
            stopCatGuide();
            catGuideKey = guideKey;
            lastCatGuideStatus = null;
          }
          if (controlsBlocked) stopCatGuide();
          if (catGuide && guideSpot && guideKey && catGuide.request > 0 && consumedCatGuide.current !== guideKey) {
            consumedCatGuide.current = guideKey;
            const alreadyNear = Math.hypot(position.x - guideSpot.x, position.z - guideSpot.z) <= CAT_GUIDE_REVEAL_RADIUS
              && clearLine(position.x, position.z, guideSpot.x, guideSpot.z);
            if (!controlsBlocked && strength <= .1 && !alreadyNear) {
              walkTo(guideSpot.guide.x, guideSpot.guide.z);
              guideOwnedRoute = route;
              const end = route.at(-1);
              if (!end || Math.hypot(end.x - guideSpot.x, end.z - guideSpot.z) <= CAT_SEARCH_RADIUS
                || !clearLine(end.x, end.z, guideSpot.x, guideSpot.z)) stopCatGuide();
            }
          }
          let dx = 0;
          let dz = 0;
          if (!controlsBlocked) {
            if (strength > 0.1) {
              cancelMartial();
              cancelFish();
              cancelSkyLantern();
              cancelInteraction();
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
          const catNearby = catHunt && !dialogOpen && !state.auto && !state.meditating
            ? CAT_HIDEOUTS.find(id => {
                if (catHunt.checked.includes(id)) return false;
                const spot = TEMPLE_CAT_PLACES[id];
                return Math.hypot(position.x - spot.x, position.z - spot.z) <= CAT_SEARCH_RADIUS
                  && clearLine(position.x, position.z, spot.x, spot.z);
              }) ?? null
            : null;
          if (catHunt && catNearby !== lastCatNearby) {
            lastCatNearby = catNearby;
            state.onCatNearbyChange?.(catRound, catNearby);
          }
          if (catHunt && catHunt.inspection !== catInspection) {
            catInspection = catHunt.inspection;
            // Recheck at the moment of interaction, even if a queued tap began in range.
            if (catNearby) {
              route = [];
              destination.visible = false;
              releaseControls();
              state.onCatInspect?.(catRound, catNearby);
            }
          }
          if (guideOwnedRoute && (route !== guideOwnedRoute || !route.length)) stopCatGuide();
          const guideNear = !controlsBlocked && guideSpot !== null
            && Math.hypot(position.x - guideSpot.x, position.z - guideSpot.z) <= CAT_GUIDE_REVEAL_RADIUS
            && clearLine(position.x, position.z, guideSpot.x, guideSpot.z);
          showCatTrail(catGuide && guideNear ? catGuide.target : null);
          if (catGuide) {
            const status = guideOwnedRoute ? "walking" : guideNear ? "near" : "idle";
            if (lastCatGuideStatus !== status) {
              lastCatGuideStatus = status;
              state.onCatGuideStatus?.(catRound, catGuide.request, status);
            }
          }
          catMark.visible = catNearby !== null;
          if (catNearby) {
            const spot = TEMPLE_CAT_PLACES[catNearby];
            catMark.position.set(spot.x, world.floorHeightAt(spot.x, spot.z) + .065, spot.z);
            catMark.scale.setScalar(1 + Math.sin(time * 3) * .09);
          }
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
            } else if (approachingFish === "release") cancelFish();
          }
          if (approachingInteraction && route.length === 0 && !dialogOpen && !state.auto && !state.meditating) {
            const kind = approachingInteraction;
            const target = TEMPLE_INTERACTIONS[kind];
            if (Math.hypot(position.x - target.x, position.z - target.z) < .25) {
              approachingInteraction = null;
              actor.group.rotation.y = target.heading;
              sceneAction = { kind, start: time, duration: target.duration, impactsHandled: 0 };
              state.onInteractionStage?.(kind, "begin");
            }
          }
          if (sceneAction && isTempleInteraction(sceneAction.kind)) {
            const current = sceneAction;
            const kind = sceneAction.kind;
            const animation = TEMPLE_INTERACTIONS[kind];
            const age = time - current.start;
            let handled = current.impactsHandled ?? 0;
            while (handled < animation.impacts.length && age >= animation.impacts[handled] * current.duration) {
              if (kind === "flower") world.offerFlowers();
              else if (kind === "ritual") world.startRitual();
              else if (kind === "drum" || kind === "towerBell" || kind === "bell" || kind === "lamp" || kind === "pagoda") world.interact(kind);
              if (age - animation.impacts[handled] * current.duration < .4) state.onInteractionStage?.(kind, "impact");
              handled++;
            }
            current.impactsHandled = handled;
          }
          if (sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" || sceneAction?.kind === "release") {
            const kind = sceneAction.kind;
            if (!sceneAction.offered && time - sceneAction.start >= FISH_ACTIONS[kind].offerAt) {
              sceneAction.offered = true;
              world.interact(kind);
              if (kind === "release" && activePondRelease) {
                state.onPondReleaseResult?.({ ...activePondRelease, stage: "released" });
                activePondRelease = null;
              }
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
              cancelInteraction();
              sceneAction = null;
              approachingIncense = false;
              incensePrayerUntil = 0;
              approachingLamp = false;
              lampPrayerUntil = 0;
            }
            actionPulse = state.actionPulse;
            localAction = state.action;
            actionStart = time;
            prayerPending = localAction === "prayer";
            beadsPending = localAction === "beads";
          }
          if (prayerPending && localAction === "prayer" && !walking && time - actionStart >= 2.6) {
            prayerPending = false;
            state.onPrayerComplete?.();
          }
          if (walking) prayerPending = false;
          if (beadsPending && localAction === "beads" && !walking && time - actionStart >= 2.6) {
            beadsPending = false;
            state.onBeadsComplete?.();
          }
          if (walking) beadsPending = false;
          const incenseAge = time - incensePrayerStart;
          if (sceneAction && time - sceneAction.start >= sceneAction.duration) {
            if (sceneAction.kind === "martial") state.onMartialStage?.("complete");
            if (sceneAction.kind === "fish" || sceneAction.kind === "pondFeed" || sceneAction.kind === "release") state.onFishStage?.(sceneAction.kind === "release" ? "release" : "fish", "complete");
            if (sceneAction.kind === "skyLantern") state.onSkyLanternStage?.("complete");
            if (isTempleInteraction(sceneAction.kind)) state.onInteractionStage?.(sceneAction.kind, "complete");
            sceneAction = null;
          }
          const martialView = sceneAction?.kind === "martial";
          const fishView = sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" || sceneAction?.kind === "release";
          const skyLanternView = sceneAction?.kind === "skyLantern";
          const practiceView = seated && ["prayer", "beads", "meditate"].includes(state.action);
          const firstPersonBow = seated && state.cameraMode === "first" && (state.action === "bow" || state.auto);
          const conversationView = Boolean(conversationPartner);
          const interactionView = Boolean(sceneAction && isTempleInteraction(sceneAction.kind));
          const ritualView = sceneAction?.kind === "ritual";
          const cinematicView = Boolean(martialView || fishView || practiceView || skyLanternView || conversationView || interactionView || incensePrayer || lampPrayer);
          const martialProgress = sceneAction?.kind === "martial" ? clamp((time - sceneAction.start) / MARTIAL_DURATION, 0, 1) : 0;
          if (cinematicView) { firstPerson = false; mapMode = false; }
          if (catFound) {
            firstPerson = false;
            mapMode = false;
            actor.group.rotation.y += angleDelta(actor.group.rotation.y, Math.atan2(catFound.x - position.x, catFound.z - position.z)) * Math.min(1, dt * 7);
          }
          if (firstPersonBow) firstPerson = false;
          if (conversationPartner) actor.group.rotation.y += angleDelta(actor.group.rotation.y, Math.atan2(conversationPartner.x - position.x, conversationPartner.z - position.z)) * Math.min(1, dt * 7);
          const schedulePose = lessonActive && state.action === "idle" ? seated ? "chantSit" : "chant" : state.action;
          const pose = abbotScene ? "salute" : walking ? "idle" : incensePrayer ? "incense" : lampPrayer ? "light" : sceneAction?.kind === "fish" || sceneAction?.kind === "pondFeed" ? "feed" : sceneAction?.kind === "release" ? "releaseFish" : sceneAction && isTempleInteraction(sceneAction.kind) ? TEMPLE_INTERACTIONS[sceneAction.kind].pose : sceneAction ? sceneAction.kind : schedulePose === "idle" && seated ? "sit" : schedulePose;
          const bowPhase = Math.min((time - actionStart) * (state.bowSpeed ?? 1), 1);
          const incensePhase = incensePrayer ? incenseAge / 8.4 : sceneAction ? (time - sceneAction.start) / sceneAction.duration : 0;
          actor.update(pose, time, walking, pose === "incense" ? incensePhase : pose === "light" ? (time - lampPrayerStart) / 24 : sceneAction ? incensePhase : pose === "bow" ? bowPhase : undefined);
          selfRing.position.set(position.x, position.y + 0.025, position.z);
          selfRing.scale.setScalar(1 + Math.sin(time * 2) * 0.035);
          selfRing.visible = !seated && !firstPerson && !abbotConversation;
          actor.group.visible = !firstPerson && !abbotConversation;

          if (state.participants !== lastParticipantSnapshot || time - lastRemoteSync > .3) {
            syncRemote(time);
            lastRemoteSync = time;
            lastParticipantSnapshot = state.participants;
          }
          remote.forEach(person => {
            const movement = person.motion.sample();
            person.monk.group.position.set(movement.x, world.floorHeightAt(movement.x, movement.z) + (person.seat === null ? 0 : .12), movement.z);
            person.monk.group.rotation.y = movement.heading;
            const walking = movement.moving && person.seat === null && person.action !== "meditate";
            const remotePose = lessonActive && !walking && (person.action === "idle" || person.action === "sit") ? person.action === "sit" ? "chantSit" : "chant" : person.action;
            person.monk.update(remotePose, time, walking, person.action === "bow" ? Math.min(((time - person.actionStart) * person.bowSpeed) % 1.25, 1) : undefined);
          });
          world.animate(time);
          offerings.forEach(offering => offering.animate(time));

          const activeRoom = world.rooms.find(room => position.x > room.minX && position.x < room.maxX && position.z > room.minZ && position.z < room.maxZ);
          const indoors = Boolean(activeRoom);
          const floorHeight = world.floorHeightAt(position.x, position.z);
          if (mapMode) mapFocus.y = floorHeight + 0.65;
          const nextCameraMode = catFound || cinematicView || firstPersonBow ? "third" : state.cameraMode ?? "third";
          const cameraChanged = nextCameraMode !== cameraMode || ritualView !== ritualCameraActive;
          ritualCameraActive = ritualView;
          const fieldOfView = catFound ? 48 : firstPerson ? clamp(64 * Math.sqrt(zoomScale), 34, 92) : mapMode || martialView ? 48 : 42;
          if (cameraChanged || camera.fov !== fieldOfView) {
            cameraMode = nextCameraMode;
            camera.fov = fieldOfView;
            camera.near = firstPerson ? 0.06 : 0.1;
            camera.updateProjectionMatrix();
          }
          if (catFound) {
            if (!catModel) {
              catModel = createTempleCatWorldModel();
              scene.add(catModel.root);
            }
            if (!catModel.root.visible) {
              const y = world.floorHeightAt(catFound.x, catFound.z);
              const awayX = position.x - catFound.x;
              const awayZ = position.z - catFound.z;
              const angle = (Math.hypot(awayX, awayZ) > .25 ? Math.atan2(awayX, awayZ) : .6) + 1.08;
              const distance = Math.max(4.1, 1.05 / (Math.tan(Math.PI * 48 / 360) * camera.aspect));
              catTarget.set(catFound.x + awayX * .25, y + .53, catFound.z + awayZ * .25);
              cameraGoal.set(catTarget.x + Math.sin(angle) * distance, y + 2.65, catTarget.z + Math.cos(angle) * distance);
              catFocus[0].set(catFound.x, y + .63, catFound.z);
              catFocus[1].set(catFound.x, y + .24, catFound.z);
              catFocus[2].set(position.x, floorHeight + 1.1, position.z);
              catCamera.copy(cinematicCamera.resolve(cameraGoal, catTarget, catFocus));
              catModel.show(catFound.x, y + .045, catFound.z, Math.atan2(catCamera.x - catFound.x, catCamera.z - catFound.z));
            }
            catModel.update(dt);
            camera.position.copy(catCamera);
            cameraTarget.copy(catTarget);
          } else if (mapMode) {
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
            if (abbotConversation) cameraLook.set(master.group.position.x * .72 + position.x * .28, master.group.position.y + 1.0, master.group.position.z * .72 + position.z * .28);
            else if (conversationPartner) cameraLook.set((position.x + conversationPartner.x) / 2, floorHeight + 0.9, (position.z + conversationPartner.z) / 2);
            else if (martialView) cameraLook.set(28, 1.1, 12);
            else if (skyLanternView) cameraLook.set(0, 1.4, 28);
            else if (practiceView) cameraLook.set(position.x, floorHeight + 0.65, position.z);
            else if (interactionView || incensePrayer) cameraLook.set(position.x + Math.sin(actor.group.rotation.y) * .35, floorHeight + .9, position.z + Math.cos(actor.group.rotation.y) * .35);
            else if (fishView) cameraLook.set(position.x + (sceneAction?.kind === "fish" ? 0.5 : -0.5), floorHeight + 0.6, position.z);
            else if (lampPrayer) cameraLook.set(40, 3.8, 28);
            else cameraLook.set(position.x, floorHeight + (indoors ? 0.95 : 0.8), position.z - (indoors ? 0.2 : 0.8));
            if (cameraChanged) cameraTarget.copy(cameraLook);
            else cameraTarget.lerp(cameraLook, 1 - Math.exp(-dt * 4));
            if (abbotConversation) {
              const heading = master.group.rotation.y;
              const distance = Math.max(3.7, 1.1 / (Math.tan(Math.PI * 42 / 360) * camera.aspect)) * clamp(zoomScale, .85, 1.25);
              cameraGoal.set(cameraLook.x + (Math.sin(heading) * .9 + Math.cos(heading) * .55) * distance, floorHeight + 2.05, cameraLook.z + (Math.cos(heading) * .9 - Math.sin(heading) * .55) * distance);
            } else if (conversationPartner) {
              const distance = Math.max(4.2, 1.3 / (Math.tan(Math.PI * 42 / 360) * camera.aspect)) * clamp(zoomScale, 0.85, 1.25);
              const directionX = conversationPartner.x - position.x;
              const directionZ = conversationPartner.z - position.z;
              const length = Math.max(0.1, Math.hypot(directionX, directionZ));
              cameraGoal.set(cameraLook.x - directionZ / length * distance, floorHeight + 2.4, cameraLook.z + directionX / length * distance);
            } else if (interactionView || incensePrayer) {
              const heading = actor.group.rotation.y;
              const distance = Math.max(4.5, 1.1 / (Math.tan(Math.PI * 42 / 360) * camera.aspect)) * clamp(zoomScale, .85, 1.25);
              // The ritual platform's western side borders the solid wall of Guanyun Hall.
              const side = ritualView ? -1 : 1;
              cameraGoal.set(cameraLook.x + Math.sin(heading + Math.PI / 2) * distance * .9 * side - Math.sin(heading) * distance * .35, floorHeight + 2.5, cameraLook.z + Math.cos(heading + Math.PI / 2) * distance * .9 * side - Math.cos(heading) * distance * .35);
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
            } else if (firstPersonBow) {
              const heading = actor.group.rotation.y;
              const distance = 4.8 * zoomScale;
              cameraGoal.set(position.x - Math.sin(heading) * distance, floorHeight + 2.4 * zoomScale, position.z - Math.cos(heading) * distance);
            } else if (activeRoom) {
              const indoorZoom = clamp(zoomScale, 0.65, 1.35);
              for (const turn of [0, Math.PI / 3, -Math.PI / 3, Math.PI * 2 / 3, -Math.PI * 2 / 3, Math.PI]) {
                cameraGoal.set(clamp(position.x + Math.sin(yaw + turn) * 5.2 * indoorZoom, activeRoom.minX + 0.4, activeRoom.maxX - 0.4), floorHeight + 2.6 * indoorZoom, clamp(position.z + Math.cos(yaw + turn) * 5.2 * indoorZoom, activeRoom.minZ + 0.4, activeRoom.maxZ - 0.4));
                if (!blocked(cameraGoal.x, cameraGoal.z) && Math.hypot(cameraGoal.x - position.x, cameraGoal.z - position.z) > 1.8) break;
              }
            } else cameraGoal.set(position.x + Math.sin(yaw) * cameraRadius * zoomScale, floorHeight + cameraHeight * zoomScale, position.z + Math.cos(yaw) * cameraRadius * zoomScale);
            const cinematicKey = cinematicView ? `${conversationView ? abbotConversation ? "abbot" : conversationId : sceneAction?.kind ?? (incensePrayer ? "incense" : lampPrayer ? "longLamp" : pose)}` : "";
            const cinematicChanged = cinematicKey !== lastCinematicKey;
            if (cinematicChanged) cameraTarget.copy(cameraLook);
            if (cinematicView) {
              const abbotCameraX = cinematicGoal.x - master.group.position.x;
              const abbotCameraZ = cinematicGoal.z - master.group.position.z;
              const abbotCameraFront = (abbotCameraX * Math.sin(master.group.rotation.y) + abbotCameraZ * Math.cos(master.group.rotation.y)) / Math.max(.01, Math.hypot(abbotCameraX, abbotCameraZ));
              if (cinematicChanged || time - lastCinematicCheck >= .25 || (abbotConversation && abbotCameraFront < .45)) {
                cinematicFocus[0].set(position.x, floorHeight + (seated ? .65 : .95), position.z);
                cinematicFocus[1].copy(cameraLook);
                if (conversationPartner) cinematicFocus[1].set(conversationPartner.x, world.floorHeightAt(conversationPartner.x, conversationPartner.z) + 1.1, conversationPartner.z);
                else if (lampPrayer) cinematicFocus[1].set(40, 3.8, 30.4);
                cinematicFocus[2].set(position.x, floorHeight + (martialView ? 2.7 : seated ? .95 : 1.35), position.z);
                cinematicFocus[3].set(position.x + Math.sin(actor.group.rotation.y) * .55, floorHeight + (fishView ? .65 : seated ? .65 : 1.05), position.z + Math.cos(actor.group.rotation.y) * .55);
                if (abbotConversation) {
                  cinematicFocus[2].set(master.group.position.x, master.group.position.y + 1.45, master.group.position.z);
                  cinematicFocus[3].set(master.group.position.x + Math.sin(master.group.rotation.y) * .4, master.group.position.y + 1.0, master.group.position.z + Math.cos(master.group.rotation.y) * .4);
                  abbotFacing.origin.copy(master.group.position);
                  abbotFacing.direction.set(Math.sin(master.group.rotation.y), 0, Math.cos(master.group.rotation.y));
                }
                const limits = activeRoom ? { minX: activeRoom.minX + .4, maxX: activeRoom.maxX - .4, minZ: activeRoom.minZ + .4, maxZ: activeRoom.maxZ - .4, minY: floorHeight + 1.5, maxY: floorHeight + 3.6 } : undefined;
                cinematicGoal.copy(cinematicCamera.resolve(cameraGoal, cameraLook, cinematicFocus, limits, abbotConversation ? abbotFacing : undefined));
                cinematicAvoidedObstacle = cinematicGoal.distanceToSquared(cameraGoal) > .25;
                lastCinematicCheck = time;
              }
              cameraGoal.copy(cinematicGoal);
            }
            lastCinematicKey = cinematicKey;
            if (cameraChanged || cinematicChanged || (cinematicView && cinematicAvoidedObstacle)) camera.position.copy(cameraGoal);
            else camera.position.lerp(cameraGoal, 1 - Math.exp(-dt * 5));
            if (activeRoom && !cinematicView) camera.position.set(
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
            obscuredRoofs.clear();
            const roofTargets = catFound ? catFocus : cinematicView ? cinematicFocus : [position];
            roofTargets.forEach(target => {
              occlusionDirection.copy(target);
              if (!catFound && !cinematicView) occlusionDirection.y += .85;
              occlusionDirection.sub(camera.position);
              occlusionRay.far = occlusionDirection.length() - .2;
              occlusionRay.ray.set(camera.position, occlusionDirection.normalize());
              occlusionRay.intersectObjects(roofSurfaces, false).forEach(hit => obscuredRoofs.add(hit.object));
            });
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
          const nearAbbot = master.group.visible && !lessonActive && !state.auto && !state.meditating && !seated && !sceneAction && Math.hypot(position.x - master.group.position.x, position.z - master.group.position.z) <= (abbotNearby ? 3.4 : 2.7) && clearLine(position.x, position.z, master.group.position.x, master.group.position.z);
          if (nearAbbot !== abbotNearby) { abbotNearby = nearAbbot; state.onAbbotNearbyChange?.(nearAbbot); }
          const canEncounter = !nearAbbot && !state.abbotTalking && !abbotScene && !lessonActive && !state.auto && !state.meditating && !seated && !sceneAction && !approachingIncense && !approachingLamp && !approachingFish && !approachingMartial && !approachingSkyLantern && !approachingInteraction && !incensePrayer && !lampPrayer && (!dialogOpen || conversationView);
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
            positionHotspot(point.button, point.x, point.y, point.z, nearby && !catHunt && Boolean(state.onContextAction) && !state.auto && !state.meditating && !dialogOpen && !martialView && !fishView && !practiceView && !skyLanternView && !interactionView);
          });
          const availableCushion = world.cushions[nearestCushionIndex];
          positionHotspot(cushionButton, availableCushion?.x ?? 0, 0.55, availableCushion?.z ?? 0, nearestCushionIndex >= 0 && !catHunt && !state.auto && !state.meditating && !dialogOpen && !martialView && !fishView && !practiceView && !skyLanternView && !interactionView);
          if (firstPerson || martialView || fishView || practiceView || skyLanternView || interactionView || conversationView) selfLabel.style.display = "none";
          else positionLabel(selfLabel, actor.group, walking ? 1.72 : seated ? 1.4 : 1.72);
          const playerName = state.participants.find(person => person.id === state.selfId)?.name || state.selfName || "你的小和尚";
          const playerTitle = state.abbot?.rewards.activeTitle || "";
          if (selfNameLabel.textContent !== playerName) selfNameLabel.textContent = playerName;
          if (selfTitleLabel.textContent !== playerTitle) selfTitleLabel.textContent = playerTitle;
          selfTitleLabel.style.display = playerTitle ? "block" : "none";
          selfLabel.title = playerTitle ? `${playerName} · ${playerTitle}` : playerName;
          remote.forEach(person => positionLabel(person.label, person.monk.group, person.action === "sit" || person.action === "meditate" ? 1.4 : 1.65));
          if (master.group.visible) positionLabel(abbotLabel, master.group, 2.03);
          else abbotLabel.style.display = "none";

          if (state.selfId && time - lastSent > .12 && (Math.hypot(position.x - lastPosition.x, position.z - lastPosition.z) > 0.035 || Math.abs(angleDelta(lastPosition.heading, actor.group.rotation.y)) > 0.05)) {
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
    {!ready && !error && !props.onLoadingChange && <TempleLoading stage="world" />}
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

