"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { EventResponse } from "@/types/booking";

interface EventsMapProps {
  events: EventResponse[];
  className?: string;
  onEventClick?: (eventId: string) => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function EventsMap({ events, className = "h-[400px] w-full rounded-xl", onEventClick }: EventsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  // Filter events that have venue coordinates
  const eventsWithCoords = events.filter(
    (e) => e.venue?.latitude != null && e.venue?.longitude != null
  );

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!MAPBOX_TOKEN) {
      setMapError("Mapbox token not configured");
      return;
    }
    if (eventsWithCoords.length === 0) {
      setMapError("No venue locations available");
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      // Calculate center from all events
      const avgLat = eventsWithCoords.reduce((sum, e) => sum + (e.venue.latitude || 0), 0) / eventsWithCoords.length;
      const avgLng = eventsWithCoords.reduce((sum, e) => sum + (e.venue.longitude || 0), 0) / eventsWithCoords.length;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [avgLng, avgLat],
        zoom: 3,
        attributionControl: false,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.current.addControl(new mapboxgl.AttributionControl({ compact: true }));

      // Add markers for each event
      map.current.on("load", () => {
        // Clear existing markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        eventsWithCoords.forEach((event) => {
          const statusColor = event.status === "ON_SALE" ? "#22c55e" : event.status === "SOLD_OUT" ? "#ef4444" : "#f59e0b";
          const formattedDate = new Date(event.eventDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          const popupHtml = `
            <div style="min-width: 200px; padding: 4px 0;">
              <strong style="font-size: 14px;">${event.name}</strong>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">
                📍 ${event.venue.name}, ${event.venue.city}
              </p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">
                📅 ${formattedDate}
              </p>
              <p style="margin: 2px 0; font-size: 12px;">
                🎟️ ${event.availableTickets} / ${event.totalTickets} tickets
              </p>
              <span style="display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; color: white; background: ${statusColor};">
                ${event.status.replace("_", " ")}
              </span>
              ${onEventClick ? `<br/><a href="/events/${event.id}" style="display: inline-block; margin-top: 6px; font-size: 12px; color: #3b82f6; text-decoration: none; font-weight: 600;">View Event →</a>` : ""}
            </div>
          `;

          const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "280px" }).setHTML(popupHtml);

          // Create custom marker element
          const el = document.createElement("div");
          el.style.cssText = `
            width: 32px; height: 32px; border-radius: 50%; background: ${statusColor}; 
            border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer; transition: transform 0.15s;
          `;
          el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
          el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([event.venue.longitude!, event.venue.latitude!])
            .setPopup(popup)
            .addTo(map.current!);

          markersRef.current.push(marker);
        });

        // Fit map to all markers
        if (eventsWithCoords.length > 1) {
          const bounds = new mapboxgl.LngLatBounds();
          eventsWithCoords.forEach((e) => {
            bounds.extend([e.venue.longitude!, e.venue.latitude!]);
          });
          map.current!.fitBounds(bounds, { padding: 60, maxZoom: 12 });
        }
      });
    } catch (err) {
      setMapError("Failed to load map");
      console.error("Mapbox error:", err);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.current?.remove();
    };
  }, [eventsWithCoords.map((e) => e.id).join(",")]);

  if (mapError) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center text-sm text-muted-foreground rounded-xl border`}>
        <span>{mapError}</span>
      </div>
    );
  }

  return <div ref={mapContainer} className={className} />;
}
