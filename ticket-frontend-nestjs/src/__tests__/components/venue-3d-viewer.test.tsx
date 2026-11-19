import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock Three.js and OrbitControls for JSDOM (no WebGL)
vi.mock("three", () => {
  const makeMaterial = () => ({ color: { set: vi.fn() }, dispose: vi.fn() });
  const makeGeometry = () => ({ translate: vi.fn(), dispose: vi.fn() });

  return {
    WebGLRenderer: vi.fn(function(this: any) {
      this.setSize = vi.fn();
      this.setPixelRatio = vi.fn();
      this.setClearColor = vi.fn();
      this.render = vi.fn();
      this.dispose = vi.fn();
      this.domElement = Object.assign(document.createElement("canvas"), { style: { display: "" } });
      this.shadowMap = { enabled: false, type: 0 };
    }),
    Scene: vi.fn(function(this: any) {
      this.add = vi.fn();
      this.traverse = vi.fn();
      this.children = [];
    }),
    PerspectiveCamera: vi.fn(function(this: any) {
      this.position = { set: vi.fn() };
      this.lookAt = vi.fn();
      this.aspect = 1;
      this.updateProjectionMatrix = vi.fn();
    }),
    AmbientLight: vi.fn(function() {}),
    DirectionalLight: vi.fn(function(this: any) {
      this.position = { set: vi.fn() };
      this.castShadow = false;
      this.shadow = { mapSize: { set: vi.fn() }, camera: { left: 0, right: 0, top: 0, bottom: 0 } };
    }),
    HemisphereLight: vi.fn(function() {}),
    PointLight: vi.fn(function(this: any) {
      this.position = { set: vi.fn() };
    }),
    Group: vi.fn(function(this: any) {
      this.position = { set: vi.fn(), copy: vi.fn() };
      this.add = vi.fn();
    }),
    Mesh: vi.fn(function(this: any) {
      this.position = { set: vi.fn(), copy: vi.fn() };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.castShadow = false;
      this.receiveShadow = false;
      this.userData = {};
      this.material = makeMaterial();
      this.geometry = makeGeometry();
    }),
    Sprite: vi.fn(function(this: any) {
      this.position = { set: vi.fn() };
      this.scale = { set: vi.fn() };
    }),
    SpriteMaterial: vi.fn(function() {}),
    MeshStandardMaterial: vi.fn(function(this: any) {
      Object.assign(this, makeMaterial());
    }),
    MeshBasicMaterial: vi.fn(function(this: any) {
      Object.assign(this, makeMaterial());
    }),
    BoxGeometry: vi.fn(function(this: any) {
      Object.assign(this, makeGeometry());
    }),
    PlaneGeometry: vi.fn(function(this: any) {
      Object.assign(this, makeGeometry());
    }),
    CanvasTexture: vi.fn(function() {}),
    Raycaster: vi.fn(function(this: any) {
      this.setFromCamera = vi.fn();
      this.intersectObjects = vi.fn().mockReturnValue([]);
    }),
    Vector2: vi.fn(function(this: any) { this.x = 0; this.y = 0; }),
    Vector3: vi.fn(function(this: any) {
      this.set = vi.fn().mockReturnThis();
      this.copy = vi.fn().mockReturnThis();
      this.x = 0; this.y = 0; this.z = 0;
    }),
    PCFSoftShadowMap: 2,
    MathUtils: { lerp: vi.fn((a: number, b: number, t: number) => a + (b - a) * t) },
  };
});

vi.mock("three/examples/jsm/controls/OrbitControls.js", () => ({
  OrbitControls: vi.fn(function(this: any) {
    this.enablePan = true;
    this.enableZoom = true;
    this.enableRotate = true;
    this.minDistance = 0;
    this.maxDistance = Infinity;
    this.maxPolarAngle = Math.PI;
    this.minPolarAngle = 0;
    this.target = { set: vi.fn() };
    this.update = vi.fn();
    this.dispose = vi.fn();
  }),
}));

import Venue3DViewer from "@/components/booking/venue-3d-viewer";
import type { SeatMapResponse, SeatResponse } from "@/types/booking";

describe("Venue3DViewer", () => {
  const mockSeatMap: SeatMapResponse = {
    eventId: "evt-1",
    eventName: "Test Concert",
    totalSeats: 4,
    availableSeats: 2,
    sections: {
      VIP: [
        { id: "s1", section: "VIP", rowName: "A", seatNumber: 1, status: "AVAILABLE", price: 500, currency: "VND", tierName: "VIP", label: "VIP-A-1" },
        { id: "s2", section: "VIP", rowName: "A", seatNumber: 2, status: "RESERVED", price: 500, currency: "VND", tierName: "VIP", label: "VIP-A-2" },
        { id: "s3", section: "VIP", rowName: "A", seatNumber: 3, status: "SOLD", price: 500, currency: "VND", tierName: "VIP", label: "VIP-A-3" },
      ],
      GENERAL: [
        { id: "s4", section: "GENERAL", rowName: "B", seatNumber: 1, status: "AVAILABLE", price: 200, currency: "VND", tierName: "General", label: "GEN-B-1" },
      ],
    },
  };

  const onToggleSeat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the 3D viewer container", () => {
    render(
      <Venue3DViewer
        seatMap={mockSeatMap}
        selectedSeats={[]}
        onToggleSeat={onToggleSeat}
      />
    );

    expect(screen.getByTestId("venue-3d-viewer")).toBeDefined();
  });

  it("should render legend with seat status labels", () => {
    render(
      <Venue3DViewer
        seatMap={mockSeatMap}
        selectedSeats={[]}
        onToggleSeat={onToggleSeat}
      />
    );

    expect(screen.getByText("Available")).toBeDefined();
    expect(screen.getByText("Selected")).toBeDefined();
    expect(screen.getByText("Reserved")).toBeDefined();
    expect(screen.getByText("Sold")).toBeDefined();
  });

  it("should display 3D Venue View badge", () => {
    render(
      <Venue3DViewer
        seatMap={mockSeatMap}
        selectedSeats={[]}
        onToggleSeat={onToggleSeat}
      />
    );

    expect(screen.getByText(/3D Venue View/)).toBeDefined();
  });

  it("should render with selected seats", () => {
    render(
      <Venue3DViewer
        seatMap={mockSeatMap}
        selectedSeats={["s1"]}
        onToggleSeat={onToggleSeat}
      />
    );

    const viewer = screen.getByTestId("venue-3d-viewer");
    expect(viewer).toBeDefined();
  });

  it("should render with multiple sections", () => {
    const { container } = render(
      <Venue3DViewer
        seatMap={mockSeatMap}
        selectedSeats={[]}
        onToggleSeat={onToggleSeat}
      />
    );

    // Component should mount successfully with VIP + GENERAL sections
    expect(container.querySelector("[data-testid='venue-3d-viewer']")).toBeTruthy();
  });
});
