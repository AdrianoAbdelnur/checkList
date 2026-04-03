"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import styles from "./page.module.css";

const LocationMapView = dynamic(() => import("./LocationMapView"), { ssr: false });

type Props = {
  lat: number | null;
  lng: number | null;
};

function hasValidCoordinates(lat: number | null, lng: number | null) {
  return lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
}

export default function LocationMapBadge({ lat, lng }: Props) {
  const [open, setOpen] = useState(false);
  const canOpen = hasValidCoordinates(lat, lng);

  if (!canOpen) {
    return <span className={`${styles.badge} ${styles.muted}`}>Ubicacion: sin coordenadas</span>;
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.badge} ${styles.locationBadgeButton}`}
        onClick={() => setOpen(true)}
      >
        Ubicacion: {lat!.toFixed(5)}, {lng!.toFixed(5)}
      </button>

      {open ? (
        <div className={styles.mapOverlay} role="dialog" aria-modal="true">
          <div className={styles.mapModal}>
            <div className={styles.mapHeader}>
              <h3>Ubicacion del checklist</h3>
              <button type="button" className={styles.mapCloseBtn} onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className={styles.mapFrame}>
              <LocationMapView lat={lat!} lng={lng!} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
