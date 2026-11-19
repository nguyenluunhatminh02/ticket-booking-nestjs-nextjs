"use client";

import { useMemo, useState } from "react";
import type { SeatResponse, SeatMapResponse } from "@/types/booking";

/* ──────────────── Stadium Seat Map ──────────────── */
// Renders a 2D stadium/arena view with stage in the center
// VIP sections closest to stage, Premium in middle, General on outside
// Seats arranged in curved rows around the stage (like a football stadium)

interface StadiumSeatMapProps {
  seatMap: SeatMapResponse;
  selectedSeats: string[];
  onToggleSeat: (seatId: string) => void;
  lockedSeats?: Record<string, string>;
  currentUserId?: string;
  className?: string;
}

const TIER_ORDER: Record<string, number> = {
  VIP: 0,
  PREM: 1,
  PREMIUM: 1,
  GEN: 2,
  GENERAL: 2,
  STD: 2,
  STANDARD: 2,
  ECO: 3,
  ECONOMY: 3,
  ORCH: 0,
  BALC: 2,
};

const TIER_COLORS: Record<number, { fill: string; stroke: string; text: string; label: string }> = {
  0: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e", label: "VIP" },
  1: { fill: "#ede9fe", stroke: "#8b5cf6", text: "#5b21b6", label: "Premium" },
  2: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af", label: "General" },
  3: { fill: "#d1fae5", stroke: "#10b981", text: "#065f46", label: "Economy" },
};

const SEAT_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#22c55e",
  RESERVED: "#94a3b8",
  SOLD: "#64748b",
  BLOCKED: "#ef4444",
};

interface SeatPosition {
  seat: SeatResponse;
  x: number;
  y: number;
  tierIndex: number;
}

function getTierIndex(sectionName: string): number {
  const key = sectionName.toUpperCase().replace(/\s+/g, "");
  return TIER_ORDER[key] ?? 2;
}

/**
 * Arrange seats in curved rows around a central stage.
 * Stage is at the center, VIP closest, then Premium, then General.
 * Seats wrap around both sides of the stage in an oval/U-shape.
 */
function computeStadiumLayout(seatMap: SeatMapResponse): {
  seats: SeatPosition[];
  viewBox: { minX: number; minY: number; width: number; height: number };
  tierBands: { tierIndex: number; innerRadius: number; outerRadius: number; label: string }[];
} {
  // Group sections by tier proximity
  const sectionEntries = Object.entries(seatMap.sections);
  const tierGroups = new Map<number, { section: string; seats: SeatResponse[] }[]>();

  for (const [section, seats] of sectionEntries) {
    const tierIdx = getTierIndex(section);
    if (!tierGroups.has(tierIdx)) tierGroups.set(tierIdx, []);
    tierGroups.get(tierIdx)!.push({ section, seats });
  }

  const sortedTiers = Array.from(tierGroups.entries()).sort((a, b) => a[0] - b[0]);

  const stageW = 120;
  const stageH = 60;
  const baseRadius = Math.max(stageW, stageH) / 2 + 25;
  const rowHeight = 14;
  const seatSpacing = 12;

  const allSeats: SeatPosition[] = [];
  const tierBands: { tierIndex: number; innerRadius: number; outerRadius: number; label: string }[] = [];

  let currentRadius = baseRadius;

  for (const [tierIdx, sections] of sortedTiers) {
    // Collect all rows across sections in this tier
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

    const innerRadius = currentRadius;

    for (let ri = 0; ri < allRows.length; ri++) {
      const { seats } = allRows[ri];
      const radius = currentRadius + ri * rowHeight;
      const totalSeats = seats.length;

      // Distribute seats in an arc (about 240 degrees, leaving gap at bottom for entrance)
      const arcStart = -Math.PI * 0.83; // ~-150 degrees
      const arcEnd = Math.PI * 0.83;    // ~+150 degrees
      const arcLength = arcEnd - arcStart;

      seats.forEach((seat, si) => {
        const angle = arcStart + (arcLength * (si + 0.5)) / totalSeats;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        allSeats.push({ seat, x, y: -y, tierIndex: tierIdx }); // flip y for SVG
      });
    }

    currentRadius += allRows.length * rowHeight + 8;
    const outerRadius = currentRadius - 4;

    const colors = TIER_COLORS[tierIdx] || TIER_COLORS[2];
    tierBands.push({ tierIndex: tierIdx, innerRadius, outerRadius, label: colors.label });
  }

  const pad = 30;
  const maxR = currentRadius + pad;
  const viewBox = {
    minX: -maxR,
    minY: -maxR,
    width: maxR * 2,
    height: maxR * 2,
  };

  return { seats: allSeats, viewBox, tierBands };
}

export default function StadiumSeatMap({
  seatMap,
  selectedSeats,
  onToggleSeat,
  lockedSeats = {},
  currentUserId,
  className = "",
}: StadiumSeatMapProps) {
  const [hoveredSeat, setHoveredSeat] = useState<SeatResponse | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { seats, viewBox, tierBands } = useMemo(() => computeStadiumLayout(seatMap), [seatMap]);

  const stageW = 120;
  const stageH = 60;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className="w-full h-full"
        style={{ minHeight: 500 }}
      >
        <defs>
          <radialGradient id="stageGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <filter id="stageShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Background */}
        <rect x={viewBox.minX} y={viewBox.minY} width={viewBox.width} height={viewBox.height} fill="#0f172a" rx="16" />

        {/* Tier band arcs (decorative zones) */}
        {tierBands.map((band) => {
          const colors = TIER_COLORS[band.tierIndex] || TIER_COLORS[2];
          const arcStart = -Math.PI * 0.85;
          const arcEnd = Math.PI * 0.85;

          // Create arc path
          const innerStartX = Math.cos(arcStart) * band.innerRadius;
          const innerStartY = -Math.sin(arcStart) * band.innerRadius;
          const innerEndX = Math.cos(arcEnd) * band.innerRadius;
          const innerEndY = -Math.sin(arcEnd) * band.innerRadius;
          const outerStartX = Math.cos(arcStart) * band.outerRadius;
          const outerStartY = -Math.sin(arcStart) * band.outerRadius;
          const outerEndX = Math.cos(arcEnd) * band.outerRadius;
          const outerEndY = -Math.sin(arcEnd) * band.outerRadius;

          const largeArc = (arcEnd - arcStart) > Math.PI ? 1 : 0;

          const path = [
            `M ${outerStartX} ${outerStartY}`,
            `A ${band.outerRadius} ${band.outerRadius} 0 ${largeArc} 0 ${outerEndX} ${outerEndY}`,
            `L ${innerEndX} ${innerEndY}`,
            `A ${band.innerRadius} ${band.innerRadius} 0 ${largeArc} 1 ${innerStartX} ${innerStartY}`,
            "Z",
          ].join(" ");

          // Label position - at the middle of the band, on the right side
          const midRadius = (band.innerRadius + band.outerRadius) / 2;
          const labelAngle = Math.PI * 0.55;
          const labelX = Math.cos(labelAngle) * midRadius;
          const labelY = -Math.sin(labelAngle) * midRadius;

          return (
            <g key={band.tierIndex}>
              <path d={path} fill={colors.fill} opacity="0.12" stroke={colors.stroke} strokeWidth="0.5" strokeOpacity="0.3" />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={colors.stroke}
                fontSize="8"
                fontWeight="bold"
                opacity="0.6"
                transform={`rotate(${(-labelAngle * 180) / Math.PI + 90}, ${labelX}, ${labelY})`}
              >
                {band.label}
              </text>
            </g>
          );
        })}

        {/* Stage glow */}
        <ellipse cx="0" cy="0" rx={stageW * 0.8} ry={stageH * 0.8} fill="url(#stageGlow)" />

        {/* Stage */}
        <g filter="url(#stageShadow)">
          <rect
            x={-stageW / 2}
            y={-stageH / 2}
            width={stageW}
            height={stageH}
            rx="12"
            fill="url(#stageGradient)"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <defs>
            <linearGradient id="stageGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>
          {/* Stage text */}
          <text x="0" y="-6" textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize="14" fontWeight="bold" letterSpacing="6">
            STAGE
          </text>
          <text x="0" y="10" textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize="6" letterSpacing="2">
            ★ ★ ★
          </text>
          {/* Stage spotlights (decorative circles) */}
          {[-30, 0, 30].map((dx) => (
            <circle key={dx} cx={dx} cy={-stageH / 2 - 6} r="3" fill="#fbbf24" opacity="0.5" />
          ))}
        </g>

        {/* Entrance indicator at bottom */}
        <g>
          <text x="0" y={viewBox.minY + viewBox.height - 18} textAnchor="middle" fill="#64748b" fontSize="7" letterSpacing="3">
            ENTRANCE
          </text>
          <line x1="-25" y1={viewBox.minY + viewBox.height - 10} x2="25" y2={viewBox.minY + viewBox.height - 10} stroke="#64748b" strokeWidth="1" strokeDasharray="3,3" />
        </g>

        {/* Seats */}
        {seats.map(({ seat, x, y, tierIndex }) => {
          const isSelected = selectedSeats.includes(seat.id);
          const isHovered = hoveredSeat?.id === seat.id;
          const isAvailable = seat.status === "AVAILABLE";
          const lockedByOther = lockedSeats[seat.id] && lockedSeats[seat.id] !== currentUserId;
          const lockedBySelf = lockedSeats[seat.id] && lockedSeats[seat.id] === currentUserId;

          let fillColor: string;
          if (isSelected || lockedBySelf) {
            fillColor = "#6366f1";
          } else if (lockedByOther) {
            fillColor = "#f97316"; // orange for locked by others
          } else if (isAvailable) {
            const colors = TIER_COLORS[tierIndex] || TIER_COLORS[2];
            fillColor = isHovered ? colors.stroke : SEAT_STATUS_COLORS.AVAILABLE;
          } else {
            fillColor = SEAT_STATUS_COLORS[seat.status] || SEAT_STATUS_COLORS.SOLD;
          }

          const radius = isSelected ? 5.5 : isHovered ? 5 : 4;
          const clickable = isAvailable && !lockedByOther;

          return (
            <g key={seat.id}>
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={fillColor}
                stroke={isSelected ? "#4f46e5" : "transparent"}
                strokeWidth={isSelected ? 1.5 : 0}
                opacity={isAvailable || isSelected ? 1 : 0.4}
                cursor={clickable ? "pointer" : "not-allowed"}
                role={clickable ? "button" : undefined}
                aria-label={clickable ? `Seat ${seat.rowName}-${seat.seatNumber}, ${isSelected ? "selected" : "available"}` : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (clickable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onToggleSeat(seat.id);
                  }
                }}
                onClick={() => clickable && onToggleSeat(seat.id)}
                onMouseEnter={(e) => {
                  setHoveredSeat(seat);
                  const svg = (e.target as SVGElement).closest("svg");
                  if (svg) {
                    const rect = svg.getBoundingClientRect();
                    setTooltipPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }
                }}
                onMouseLeave={() => setHoveredSeat(null)}
                className="transition-all duration-150"
              />
              {isSelected && (
                <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="3.5" fontWeight="bold" pointerEvents="none">
                  {seat.seatNumber}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-500" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-500" /> Locked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-400" /> Unavailable
        </span>
        {tierBands.map((band) => {
          const colors = TIER_COLORS[band.tierIndex] || TIER_COLORS[2];
          return (
            <span key={band.tierIndex} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.stroke, opacity: 0.7 }} />
              {band.label}
            </span>
          );
        })}
      </div>

      {/* Seat tooltip */}
      {hoveredSeat && (
        <div
          className="absolute z-50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg text-xs pointer-events-none border border-gray-200"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 30,
          }}
        >
          <p className="font-bold text-sm">{hoveredSeat.label}</p>
          <p className="text-muted-foreground">Section: {hoveredSeat.section} · Row {hoveredSeat.rowName} · Seat {hoveredSeat.seatNumber}</p>
          <p className="font-semibold">${hoveredSeat.price.toFixed(2)} {hoveredSeat.currency}</p>
          <p className={hoveredSeat.status === "AVAILABLE" ? "text-green-600" : "text-gray-400"}>
            {hoveredSeat.status}
          </p>
        </div>
      )}

      {/* View badge */}
      <div className="absolute top-3 left-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-sm text-xs font-semibold text-slate-700 dark:text-slate-200">
        🏟️ Stadium View
      </div>
    </div>
  );
}
