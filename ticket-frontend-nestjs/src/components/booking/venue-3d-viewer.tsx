"use client";

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SeatResponse, SeatMapResponse } from "@/types/booking";

/* ──────────────────────── constants ──────────────────────── */

const SEAT_SIZE = 0.4;
const SEAT_GAP = 0.15;
const ROW_GAP = 0.6;
const SECTION_GAP = 3;

const SECTION_COLORS: Record<string, string> = {
  VIP: "#f59e0b",
  PREMIUM: "#8b5cf6",
  GENERAL: "#3b82f6",
};

const SEAT_COLORS = {
  available: "#22c55e",
  selected: "#6366f1",
  reserved: "#94a3b8",
  sold: "#64748b",
  blocked: "#ef4444",
  locked: "#f97316",
};

/* ─────────────────── tier ordering for stadium ─────────────── */

const TIER_ORDER: Record<string, number> = {
  VIP: 0, PREM: 1, PREMIUM: 1, GEN: 2, GENERAL: 2, STD: 2, STANDARD: 2,
  ECO: 3, ECONOMY: 3, ORCH: 0, BALC: 2,
};

function getTierIndex(name: string): number {
  return TIER_ORDER[name.toUpperCase().replace(/\s+/g, "")] ?? 2;
}

/* ─────────────────── stadium layout helper ─────────────── */

interface StadiumSeatPos {
  seat: SeatResponse;
  x: number;
  y: number;
  z: number;
  tierIndex: number;
}

function layoutStadium(seatMap: SeatMapResponse): { positions: StadiumSeatPos[]; stageWidth: number; stageDepth: number; maxRadius: number } {
  const sectionEntries = Object.entries(seatMap.sections);
  const tierGroups = new Map<number, { section: string; seats: SeatResponse[] }[]>();
  for (const [section, seats] of sectionEntries) {
    const tierIdx = getTierIndex(section);
    if (!tierGroups.has(tierIdx)) tierGroups.set(tierIdx, []);
    tierGroups.get(tierIdx)!.push({ section, seats });
  }

  const sortedTiers = Array.from(tierGroups.entries()).sort((a, b) => a[0] - b[0]);

  const stageWidth = 6;
  const stageDepth = 3;
  const baseRadius = Math.max(stageWidth, stageDepth) / 2 + 2;

  const positions: StadiumSeatPos[] = [];
  let currentRadius = baseRadius;

  for (const [tierIdx, sections] of sortedTiers) {
    const allRows: { rowName: string; seats: SeatResponse[] }[] = [];
    for (const { seats } of sections) {
      const rowMap = new Map<string, SeatResponse[]>();
      seats.forEach((s) => {
        if (!rowMap.has(s.rowName)) rowMap.set(s.rowName, []);
        rowMap.get(s.rowName)!.push(s);
      });
      rowMap.forEach((rowSeats, rowName) => {
        rowSeats.sort((a, b) => a.seatNumber - b.seatNumber);
        allRows.push({ rowName, seats: rowSeats });
      });
    }
    allRows.sort((a, b) => a.rowName.localeCompare(b.rowName));

    for (let ri = 0; ri < allRows.length; ri++) {
      const { seats } = allRows[ri];
      const radius = currentRadius + ri * (SEAT_SIZE + ROW_GAP);
      const arcStart = -Math.PI * 0.83;
      const arcEnd = Math.PI * 0.83;
      const arcLength = arcEnd - arcStart;

      seats.forEach((seat, si) => {
        const angle = arcStart + (arcLength * (si + 0.5)) / seats.length;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const elevation = tierIdx * 0.3; // Higher tiers slightly elevated
        positions.push({ seat, x, y: elevation, z, tierIndex: tierIdx });
      });
    }

    currentRadius += allRows.length * (SEAT_SIZE + ROW_GAP) + 1;
  }

  return { positions, stageWidth, stageDepth, maxRadius: currentRadius };
}

/* ──────────────────── seat color helper ──────────────────── */

function getSeatColor(seat: SeatResponse, selected: boolean, hovered: boolean, lockedByOther?: boolean): string {
  if (selected) return SEAT_COLORS.selected;
  if (lockedByOther) return SEAT_COLORS.locked;
  if (hovered && seat.status === "AVAILABLE") return "#a5b4fc";
  switch (seat.status) {
    case "AVAILABLE": return SEAT_COLORS.available;
    case "RESERVED": return SEAT_COLORS.reserved;
    case "SOLD": return SEAT_COLORS.sold;
    case "BLOCKED": return SEAT_COLORS.blocked;
    default: return SEAT_COLORS.reserved;
  }
}

/* ──────────────────── create seat geometry ──────────────── */

function createSeatGroup(seat: SeatResponse, position: THREE.Vector3): {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  backMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.position.copy(position);

  // Seat body (cushion)
  const bodyGeom = new THREE.BoxGeometry(SEAT_SIZE, 0.15, SEAT_SIZE);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: getSeatColor(seat, false, false),
    metalness: 0.1,
    roughness: 0.4,
  });
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.userData = { seatId: seat.id, part: "body" };
  group.add(bodyMesh);

  // Seat back
  const backGeom = new THREE.BoxGeometry(SEAT_SIZE, 0.3, 0.06);
  const backMat = new THREE.MeshStandardMaterial({
    color: getSeatColor(seat, false, false),
    metalness: 0.1,
    roughness: 0.5,
  });
  const backMesh = new THREE.Mesh(backGeom, backMat);
  backMesh.position.set(0, 0.15, -(SEAT_SIZE / 2 - 0.03));
  backMesh.castShadow = true;
  backMesh.userData = { seatId: seat.id, part: "back" };
  group.add(backMesh);

  // Seat number label (canvas texture sprite)
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 64;
  labelCanvas.height = 64;
  const ctx = labelCanvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "white";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(seat.seatNumber), 32, 32);
  }
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  const labelMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
  const labelSprite = new THREE.Sprite(labelMat);
  labelSprite.position.set(0, 0.12, 0);
  labelSprite.scale.set(0.2, 0.2, 1);
  group.add(labelSprite);

  return { group, bodyMesh, backMesh };
}

/* ──────────────────── create stage ──────────────────── */

function createStage(scene: THREE.Scene, stageWidth: number, stageDepth: number) {
  const stageGroup = new THREE.Group();

  // Central stage platform (oval/rounded rectangle)
  const platformGeom = new THREE.CylinderGeometry(stageWidth / 2, stageWidth / 2 + 0.3, 0.5, 32);
  const platformMat = new THREE.MeshStandardMaterial({ color: "#1e293b", metalness: 0.3, roughness: 0.6 });
  const platform = new THREE.Mesh(platformGeom, platformMat);
  platform.receiveShadow = true;
  stageGroup.add(platform);

  // Stage surface detail
  const surfaceGeom = new THREE.CylinderGeometry(stageWidth / 2 - 0.2, stageWidth / 2 - 0.2, 0.05, 32);
  const surfaceMat = new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.1, roughness: 0.8 });
  const surface = new THREE.Mesh(surfaceGeom, surfaceMat);
  surface.position.y = 0.25;
  stageGroup.add(surface);

  // Stage label
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const ctx = labelCanvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 64px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S T A G E", 256, 64);
  }
  const tex = new THREE.CanvasTexture(labelCanvas);
  const labelGeom = new THREE.PlaneGeometry(stageWidth * 0.6, stageDepth * 0.4);
  const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const labelMesh = new THREE.Mesh(labelGeom, labelMat);
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.position.set(0, 0.28, 0);
  stageGroup.add(labelMesh);

  // Stage spotlights around the perimeter
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const light = new THREE.PointLight(0xfbbf24, 0.4, 10);
    light.position.set(Math.cos(angle) * (stageWidth / 2 + 0.5), 3, Math.sin(angle) * (stageWidth / 2 + 0.5));
    stageGroup.add(light);
  }

  scene.add(stageGroup);
}

/* ──────────────────────── legend overlay ──────────────────────── */

function Legend() {
  const items = [
    { label: "Available", color: SEAT_COLORS.available },
    { label: "Selected", color: SEAT_COLORS.selected },
    { label: "Locked", color: SEAT_COLORS.locked },
    { label: "Reserved", color: SEAT_COLORS.reserved },
    { label: "Sold", color: SEAT_COLORS.sold },
  ];
  return (
    <div className="absolute bottom-3 left-3 flex gap-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm text-xs">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ──────────────────────── tooltip ──────────────────────── */

function SeatTooltip({ seat }: { seat: SeatResponse | null }) {
  if (!seat) return null;
  return (
    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-xs space-y-0.5">
      <p className="font-bold text-sm">{seat.label}</p>
      <p className="text-muted-foreground">Section: {seat.section}</p>
      <p className="text-muted-foreground">Row: {seat.rowName}, Seat: {seat.seatNumber}</p>
      <p className="font-semibold">${seat.price.toFixed(2)} {seat.currency}</p>
      <p className={seat.status === "AVAILABLE" ? "text-green-600" : "text-gray-400"}>
        {seat.status}
      </p>
    </div>
  );
}

/* ──────────────────────── main component ──────────────────────── */

export interface Venue3DViewerProps {
  seatMap: SeatMapResponse;
  selectedSeats: string[];
  onToggleSeat: (seatId: string) => void;
  lockedSeats?: Record<string, string>;
  currentUserId?: string;
  className?: string;
}

export default function Venue3DViewer({
  seatMap,
  selectedSeats,
  onToggleSeat,
  lockedSeats = {},
  currentUserId,
  className = "",
}: Venue3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number>(0);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Map seatId → { bodyMesh, backMesh, seat }
  const seatMeshMapRef = useRef<
    Map<string, { bodyMesh: THREE.Mesh; backMesh: THREE.Mesh; seat: SeatResponse }>
  >(new Map());
  // All clickable meshes for raycasting
  const clickableMeshesRef = useRef<THREE.Mesh[]>([]);

  const [hoveredSeat, setHoveredSeat] = useState<SeatResponse | null>(null);
  const hoveredSeatIdRef = useRef<string | null>(null);

  const { positions, stageWidth, stageDepth, maxRadius } = useMemo(() => layoutStadium(seatMap), [seatMap]);

  // Stable ref for selectedSeats so event handlers use latest value
  const selectedSeatsRef = useRef(selectedSeats);
  selectedSeatsRef.current = selectedSeats;

  // ────────── Initialize Three.js scene ──────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Workaround for React 19 hideInstance (display:none!important)
    const ensureVisible = () => {
      if (container.style.getPropertyValue("display") === "none") {
        container.style.removeProperty("display");
      }
    };
    ensureVisible();
    const mo = new MutationObserver(ensureVisible);
    mo.observe(container, { attributes: true, attributeFilter: ["style"] });

    let sceneCleanup: (() => void) | null = null;

    const initScene = (): (() => void) | false => {
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return false;

      // ── Renderer ──
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      } catch {
        // WebGL context creation failed (e.g. GPU blocklisted, context limit)
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:14px;">3D view unavailable — WebGL not supported</div>';
        return false;
      }
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const gl = renderer.getContext();
      const supportsWebGL2 = gl instanceof WebGL2RenderingContext;
      renderer.shadowMap.enabled = supportsWebGL2;
      if (supportsWebGL2) {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      renderer.debug.checkShaderErrors = false;

      renderer.setClearColor(0x0f172a);
      renderer.domElement.style.display = "block";
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // ── Scene ──
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // ── Camera ── (looking down at stadium from above-front)
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
      const dist = maxRadius * 1.6;
      camera.position.set(0, dist * 0.7, dist * 0.5);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // ── Lights ──
      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(10, 15, 10);
      if (supportsWebGL2) {
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(1024, 1024);
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
      }
      scene.add(dirLight);
      scene.add(new THREE.HemisphereLight(0xbfdbfe, 0x475569, 0.3));

      // ── Ground (circular arena floor) ──
      const groundGeom = new THREE.CircleGeometry(maxRadius + 5, 64);
      const groundMat = new THREE.MeshStandardMaterial({ color: "#0f172a" });
      const ground = new THREE.Mesh(groundGeom, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.25;
      ground.receiveShadow = true;
      scene.add(ground);

      // ── Central Stage ──
      createStage(scene, stageWidth, stageDepth);

      // ── Seats in stadium layout ──
      const seatMeshMap = new Map<string, { bodyMesh: THREE.Mesh; backMesh: THREE.Mesh; seat: SeatResponse }>();
      const clickableMeshes: THREE.Mesh[] = [];

      for (const pos of positions) {
        const { seat, x, y, z } = pos;
        const position3D = new THREE.Vector3(x, y, z);
        const { group, bodyMesh, backMesh } = createSeatGroup(seat, position3D);

        // Rotate seat to face the center stage
        const angleToCenter = Math.atan2(-z, -x);
        group.rotation.y = angleToCenter + Math.PI / 2;

        scene.add(group);
        seatMeshMap.set(seat.id, { bodyMesh, backMesh, seat });
        clickableMeshes.push(bodyMesh, backMesh);
      }

      seatMeshMapRef.current = seatMeshMap;
      clickableMeshesRef.current = clickableMeshes;

      // ── OrbitControls ──
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.minDistance = 3;
      controls.maxDistance = 50;
      controls.maxPolarAngle = Math.PI / 2.1;
      controls.minPolarAngle = 0.2;
      controls.target.set(0, 0, 0);
      controls.update();
      controlsRef.current = controls;

      // ── Animation loop ──
      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // ── Resize handler ──
      const handleResize = () => {
        const { width: w, height: h } = container.getBoundingClientRect();
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      };
      const ro = new ResizeObserver(handleResize);
      ro.observe(container);

      return () => {
        ro.disconnect();
        cancelAnimationFrame(animationFrameRef.current);
        controls.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      };
    };

    // Try to init immediately
    const cleanup = initScene();
    if (cleanup) {
      mo.disconnect();
      return cleanup;
    }

    // Otherwise wait for container to have dimensions
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          const c = initScene();
          if (c) {
            sceneCleanup = c;
            ro.disconnect();
          }
        }
      }
    });
    ro.observe(container);

    return () => {
      mo.disconnect();
      ro.disconnect();
      sceneCleanup?.();
    };
  }, [seatMap, positions, stageWidth, stageDepth, maxRadius]);

  // Stable refs for locked seats
  const lockedSeatsRef = useRef(lockedSeats);
  lockedSeatsRef.current = lockedSeats;

  // ────────── Update seat colors on selection / lock change ──────────
  useEffect(() => {
    const map = seatMeshMapRef.current;
    map.forEach(({ bodyMesh, backMesh, seat }, seatId) => {
      const selected = selectedSeats.includes(seatId);
      const hovered = hoveredSeatIdRef.current === seatId;
      const lockedByOther = !!(lockedSeats[seatId] && lockedSeats[seatId] !== currentUserId);
      const color = getSeatColor(seat, selected, hovered, lockedByOther);
      (bodyMesh.material as THREE.MeshStandardMaterial).color.set(color);
      (backMesh.material as THREE.MeshStandardMaterial).color.set(color);
    });
  }, [selectedSeats, lockedSeats, currentUserId]);

  // ────────── Mouse interaction (click & hover) ──────────
  const handlePointerMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return;

      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(clickableMeshesRef.current, false);

      if (intersects.length > 0) {
        const seatId = intersects[0].object.userData.seatId as string;
        const entry = seatMeshMapRef.current.get(seatId);
        if (entry) {
          const { seat } = entry;
          if (hoveredSeatIdRef.current !== seatId) {
            // Unhover previous
            if (hoveredSeatIdRef.current) {
              const prev = seatMeshMapRef.current.get(hoveredSeatIdRef.current);
              if (prev) {
                const prevLockedByOther = !!(lockedSeatsRef.current[prev.seat.id] && lockedSeatsRef.current[prev.seat.id] !== currentUserId);
                const prevColor = getSeatColor(prev.seat, selectedSeatsRef.current.includes(prev.seat.id), false, prevLockedByOther);
                (prev.bodyMesh.material as THREE.MeshStandardMaterial).color.set(prevColor);
                (prev.backMesh.material as THREE.MeshStandardMaterial).color.set(prevColor);
              }
            }
            // Hover new
            hoveredSeatIdRef.current = seatId;
            const seatLockedByOther = !!(lockedSeatsRef.current[seatId] && lockedSeatsRef.current[seatId] !== currentUserId);
            const newColor = getSeatColor(seat, selectedSeatsRef.current.includes(seatId), true, seatLockedByOther);
            (entry.bodyMesh.material as THREE.MeshStandardMaterial).color.set(newColor);
            (entry.backMesh.material as THREE.MeshStandardMaterial).color.set(newColor);
            setHoveredSeat(seat);
            const canClick = seat.status === "AVAILABLE" && !seatLockedByOther;
            container.style.cursor = canClick ? "pointer" : "not-allowed";
          }
        }
      } else {
        if (hoveredSeatIdRef.current) {
          const prev = seatMeshMapRef.current.get(hoveredSeatIdRef.current);
          if (prev) {
            const prevLockedByOther = !!(lockedSeatsRef.current[prev.seat.id] && lockedSeatsRef.current[prev.seat.id] !== currentUserId);
            const prevColor = getSeatColor(prev.seat, selectedSeatsRef.current.includes(prev.seat.id), false, prevLockedByOther);
            (prev.bodyMesh.material as THREE.MeshStandardMaterial).color.set(prevColor);
            (prev.backMesh.material as THREE.MeshStandardMaterial).color.set(prevColor);
          }
          hoveredSeatIdRef.current = null;
          setHoveredSeat(null);
          container.style.cursor = "auto";
        }
      }
    },
    []
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const camera = cameraRef.current;
      const container = containerRef.current;
      if (!camera || !container) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycasterRef.current.setFromCamera(mouse, camera);
      const intersects = raycasterRef.current.intersectObjects(clickableMeshesRef.current, false);

      if (intersects.length > 0) {
        const seatId = intersects[0].object.userData.seatId as string;
        const entry = seatMeshMapRef.current.get(seatId);
        if (entry && entry.seat.status === "AVAILABLE") {
          onToggleSeat(seatId);
        }
      }
    },
    [onToggleSeat]
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-gradient-to-b from-slate-950 to-slate-900 rounded-xl overflow-hidden ${className}`}
      data-testid="venue-3d-viewer"
      onMouseMove={handlePointerMove}
      onClick={handleClick}
    >
      {/* Three.js canvas is appended imperatively by the useEffect */}

      {/* HTML Overlays */}
      <Legend />
      <SeatTooltip seat={hoveredSeat} />

      {/* View mode badge */}
      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-sm text-xs font-semibold text-slate-700">
        🎭 3D Venue View
      </div>
    </div>
  );
}
