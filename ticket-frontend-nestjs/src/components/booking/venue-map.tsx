"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface VenueMapProps {
  latitude: number;
  longitude: number;
  venueName: string;
  address?: string;
  className?: string;
  zoom?: number;
  interactive?: boolean;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function isForbiddenMapError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeStatus = (error as Error & { status?: number }).status;
  return maybeStatus === 403 || error.message.includes("403");
}

export default function VenueMap({
  latitude,
  longitude,
  venueName,
  address,
  className = "h-[300px] w-full rounded-xl",
  zoom = 14,
  interactive = true,
}: VenueMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!MAPBOX_TOKEN) {
      setMapError("Mapbox token not configured");
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [longitude, latitude],
        zoom,
        interactive,
        attributionControl: false,
      });

      // Handle tile/resource load errors (403, etc.)
      map.current.on("error", (e) => {
        if (isForbiddenMapError(e.error)) {
          setMapError("Map service unavailable (token expired)");
          map.current?.remove();
          map.current = null;
        }
      });

      // Add navigation controls
      if (interactive) {
        map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
        map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
      }

      // Add attribution
      map.current.addControl(new mapboxgl.AttributionControl({ compact: true }));

      // Add marker with popup
      const popupHtml = `
        <div style="padding: 4px 0;">
          <strong style="font-size: 14px;">${venueName}</strong>
          ${address ? `<p style="margin: 4px 0 0; font-size: 12px; color: #666;">${address}</p>` : ""}
          <a href="https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}" 
             target="_blank" rel="noopener noreferrer"
             style="display: inline-block; margin-top: 6px; font-size: 12px; color: #3b82f6; text-decoration: none;">
            Get Directions →
          </a>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml);

      marker.current = new mapboxgl.Marker({ color: "#ef4444" })
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map.current);

    } catch (err) {
      setMapError("Failed to load map");
      console.error("Mapbox error:", err);
    }

    return () => {
      marker.current?.remove();
      map.current?.remove();
    };
  }, [latitude, longitude, venueName, address, zoom, interactive]);

  if (mapError) {
    return (
      <div className={`${className} bg-gradient-to-br from-slate-100 to-slate-50 flex flex-col items-center justify-center text-sm text-muted-foreground rounded-xl border border-dashed border-slate-200`}>
        <div className="text-3xl mb-2">📍</div>
        <p className="font-medium text-foreground">{venueName}</p>
        {address && <p className="text-xs mt-0.5">{address}</p>}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-xs text-primary hover:underline"
        >
          Open in Google Maps →
        </a>
      </div>
    );
  }

  return <div ref={mapContainer} className={className} />;
}
