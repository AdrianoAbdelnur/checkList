"use client";

import * as React from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useMap } from "react-leaflet";

type Props = {
  lat: number;
  lng: number;
};

function EnsureMapLayout() {
  const map = useMap();

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

export default function LocationMapView({ lat, lng }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom
      dragging
      touchZoom
      doubleClickZoom
      boxZoom
      keyboard
      style={{ width: "100%", height: "100%" }}
    >
      <EnsureMapLayout />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: "#2563eb", weight: 3 }}>
        <Popup>
          Ubicacion del checklist
          <br />
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </Popup>
      </CircleMarker>
    </MapContainer>
  );
}
