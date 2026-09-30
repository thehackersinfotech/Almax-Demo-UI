/**
 * Pure Leaflet map — no react-leaflet wrapper.
 * Mounted/destroyed via useEffect; zero peer-dep issues.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  time: string;
  color: string;
}

const makeIcon = (color: string, label: string) =>
  L.divIcon({
    className: "",
    html: `<div style="
      background:${color};color:#fff;font-size:11px;font-weight:700;
      padding:3px 9px;border-radius:12px;white-space:nowrap;
      box-shadow:0 2px 8px rgba(0,0,0,0.30);border:2px solid #fff;
    ">${label}</div>`,
    iconAnchor: [26, 10],
    popupAnchor: [0, -14],
  });

interface Props {
  points: MapPoint[];
}

export default function LeafletMap({ points }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    // Destroy previous instance (e.g. on prop change)
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const latlngs: L.LatLngTuple[] = points.map((p) => [p.lat, p.lng]);

    // Add markers
    points.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: makeIcon(p.color, p.label) }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:sans-serif;font-size:13px;line-height:1.6">
          <strong>${p.label === "Start" ? "Check In" : "Check Out"}</strong><br/>
          ${p.time ? `<span style="color:#6b7280">${p.time}</span><br/>` : ""}
          <span style="font-size:11px;color:#9ca3af;font-family:monospace">
            ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}
          </span>
        </div>
      `);
    });

    // Dashed line between start and end
    if (latlngs.length >= 2) {
      L.polyline(latlngs, {
        color: "#1677ff",
        weight: 2,
        dashArray: "6 5",
        opacity: 0.75,
      }).addTo(map);
    }

    // Fit bounds
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    }

    // Force size recalc (needed when container was hidden on first render)
    setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points.map((p) => `${p.lat},${p.lng}`).join("|")]);

  return (
    <div
      ref={containerRef}
      style={{ height: 380, width: "100%", borderRadius: 8, overflow: "hidden", border: "1px solid var(--bms-border)" }}
    />
  );
}
