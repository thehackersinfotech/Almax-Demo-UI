import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ExecutiveClientMapPoint } from "@/services/dashboard";

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface Props {
  clients: ExecutiveClientMapPoint[];
}

interface CountryGroup {
  country: string;
  count: number;
  invoiced_fy: number;
  latitude: number;
  longitude: number;
  clients: ExecutiveClientMapPoint[];
}

function groupByCountry(clients: ExecutiveClientMapPoint[]): CountryGroup[] {
  const byCountry = new Map<string, ExecutiveClientMapPoint[]>();
  clients.forEach((c) => {
    const key = c.country || "India";
    const list = byCountry.get(key) ?? [];
    list.push(c);
    byCountry.set(key, list);
  });
  return Array.from(byCountry.entries()).map(([country, list]) => ({
    country,
    count: list.length,
    invoiced_fy: list.reduce((sum, c) => sum + c.invoiced_fy, 0),
    latitude: list.reduce((sum, c) => sum + c.latitude, 0) / list.length,
    longitude: list.reduce((sum, c) => sum + c.longitude, 0) / list.length,
    clients: list,
  }));
}

export default function ExecutiveClientMap({ clients }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const countryGroups = useMemo(() => groupByCountry(clients), [clients]);
  const showWorldView = selectedCountry === null;

  const visibleClients = showWorldView
    ? []
    : selectedCountry
      ? clients.filter((c) => (c.country || "India") === selectedCountry)
      : clients;

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const container = containerRef.current;
    const map = L.map(container, { scrollWheelZoom: false });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    const invalidate = () => {
      requestAnimationFrame(() => map.invalidateSize());
    };

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(invalidate)
      : null;
    resizeObserver?.observe(container);

    if (clients.length === 0) {
      map.setView([20.5937, 78.9629], 2);
      invalidate();
      return () => {
        resizeObserver?.disconnect();
        map.remove();
        mapRef.current = null;
      };
    }

    if (showWorldView) {
      const maxCount = Math.max(...countryGroups.map((g) => g.count));
      const bounds: L.LatLngTuple[] = [];
      countryGroups.forEach((g) => {
        const latlng: L.LatLngTuple = [g.latitude, g.longitude];
        bounds.push(latlng);
        const radius = 12 + (g.count / maxCount) * 18;
        const marker = L.circleMarker(latlng, {
          radius,
          color: "#1677ff",
          fillColor: "#1677ff",
          fillOpacity: 0.6,
          weight: 2,
        }).addTo(map);
        marker.bindTooltip(`${g.country}: ${g.count}`, { direction: "top" });
        marker.bindPopup(`
          <div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:160px">
            <strong>${g.country}</strong><br/>
            ${g.count} client(s)<br/>
            FY invoiced: <strong>${fmt(g.invoiced_fy)}</strong><br/>
            <span style="font-size:11px;color:#9ca3af">Click to view clients</span>
          </div>
        `);
        marker.on("click", () => setSelectedCountry(g.country));
      });
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
      invalidate();
      return () => {
        resizeObserver?.disconnect();
        map.remove();
        mapRef.current = null;
      };
    }

    const bounds: L.LatLngTuple[] = [];
    visibleClients.forEach((c) => {
      const latlng: L.LatLngTuple = [c.latitude, c.longitude];
      bounds.push(latlng);
      const marker = L.circleMarker(latlng, {
        radius: 8,
        color: "#1677ff",
        fillColor: "#1677ff",
        fillOpacity: 0.85,
        weight: 2,
      }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:160px">
          <strong>${c.name}</strong><br/>
          <span style="color:#6b7280;font-size:12px">${c.code}</span><br/>
          ${c.project_count} project(s)<br/>
          FY invoiced: <strong>${fmt(c.invoiced_fy)}</strong>
          ${c.address ? `<br/><span style="font-size:11px;color:#9ca3af">${c.address}</span>` : ""}
        </div>
      `);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    } else {
      map.setView([20.5937, 78.9629], 4);
    }
    invalidate();

    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, showWorldView, selectedCountry]);

  return (
    <div style={{ position: "relative", height: "100%" }}>
      {!showWorldView && (
        <button
          onClick={() => setSelectedCountry(null)}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 1000,
            background: "#fff",
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          ← World view
        </button>
      )}
      <div ref={containerRef} className="exec-map-fill" />
    </div>
  );
}
