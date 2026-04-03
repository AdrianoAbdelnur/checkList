"use client";

import * as React from "react";
import L from "leaflet";

type Props = {
  lat: number;
  lng: number;
};

export default function LocationMapView({ lat, lng }: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!mapRef.current) {
      const map = L.map(container, {
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      L.circleMarker([lat, lng], {
        radius: 8,
        color: "#2563eb",
        weight: 3,
      })
        .addTo(map)
        .bindPopup(`Ubicacion del checklist<br/>${lat.toFixed(6)}, ${lng.toFixed(6)}`);

      map.setView([lat, lng], 16);
      mapRef.current = map;
    } else {
      mapRef.current.setView([lat, lng], 16);
    }

    window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 60);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
