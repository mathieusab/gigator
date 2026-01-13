import { useEffect, useMemo, useRef, useState } from 'react';

import type { Concert } from '../services/concerts';

let googleMapsLoadPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (globalThis.google?.maps) return Promise.resolve();
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise<void>((resolve, reject) => {
    const callbackName = '__gigator_google_maps_init__';

    const w = globalThis as unknown as Record<string, unknown>;
    if (typeof w[callbackName] !== 'undefined') {
      resolve();
      return;
    }

    w[callbackName] = () => {
      resolve();
      try {
        delete w[callbackName];
      } catch {
        w[callbackName] = undefined;
      }
    };

    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      callback: callbackName,
    });

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      reject(new Error('Impossible de charger le script Google Maps.'));
    };

    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

type MapPin = {
  concert: Concert;
  position: { lat: number; lng: number };
};

type Props = {
  concerts: Concert[];
  onOpenConcert: (id: string) => void;
  apiKey?: string;
  mapId?: string;
};

function formatDate(dateIso: string) {
  try {
    return new Date(dateIso).toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return dateIso;
  }
}

export default function MapView({ concerts, onOpenConcert, apiKey, mapId }: Props) {
  const resolvedApiKey = apiKey ?? (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined);
  const resolvedMapId =
    mapId ?? (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) ?? undefined;

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<any[]>([]);

  const [googleMaps, setGoogleMaps] = useState<typeof google | null>(null);
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const previous = (globalThis as unknown as { gm_authFailure?: (() => void) | undefined }).gm_authFailure;
    (globalThis as unknown as { gm_authFailure?: (() => void) | undefined }).gm_authFailure = () => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setLoadError(
        `Google Maps a refusé la requête (clé API / referrer / facturation). ` +
          (origin ? `Origine: ${origin}. ` : '') +
          `Vérifiez: (1) facturation activée, (2) API “Maps JavaScript API” activée, ` +
          `(3) restrictions HTTP referrers qui incluent cette origine.`,
      );
    };

    return () => {
      (globalThis as unknown as { gm_authFailure?: (() => void) | undefined }).gm_authFailure = previous;
    };
  }, []);

  const pins: MapPin[] = useMemo(() => {
    return concerts
      .map((concert) => {
        if (concert.lat == null || concert.lng == null) return null;
        const lat = typeof concert.lat === 'number' ? concert.lat : Number(concert.lat);
        const lng = typeof concert.lng === 'number' ? concert.lng : Number(concert.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { concert, position: { lat, lng } };
      })
      .filter((p): p is MapPin => p !== null);
  }, [concerts]);

  useEffect(() => {
    if (!resolvedApiKey) return;

    let isCancelled = false;

    void (async () => {
      try {
        setLoadError(null);
        await loadGoogleMapsScript(resolvedApiKey);

        const g = globalThis.google;
        if (!g?.maps) throw new Error('Google Maps failed to initialize');
        if (isCancelled) return;
        setGoogleMaps(g);
      } catch (e) {
        if (isCancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load Google Maps');
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [resolvedApiKey]);

  useEffect(() => {
    if (!googleMaps) return;
    if (!mapDivRef.current) return;

    const defaultCenter = { lat: 46.2276, lng: 2.2137 };
    const firstPin = pins[0]?.position;

    if (!mapRef.current) {
      mapRef.current = new googleMaps.maps.Map(mapDivRef.current, {
        center: firstPin ?? defaultCenter,
        zoom: firstPin ? 6 : 5,
        ...(resolvedMapId ? { mapId: resolvedMapId } : {}),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    // Clear existing markers
    for (const marker of markersRef.current) {
      if (marker && 'map' in marker) {
        marker.map = null;
      } else if (marker?.setMap) {
        marker.setMap(null);
      }
    }
    markersRef.current = [];

    if (!pins.length) return;

    const bounds = new googleMaps.maps.LatLngBounds();

    void (async () => {
      let AdvancedMarkerElement: any = null;
      try {
        // Advanced markers require a valid Map ID (vector map styling).
        if (!resolvedMapId) {
          AdvancedMarkerElement = null;
          throw new Error('No mapId configured');
        }

        const importer = (googleMaps.maps as any).importLibrary;
        if (typeof importer === 'function') {
          const markerLib = await importer('marker');
          AdvancedMarkerElement = (markerLib as any)?.AdvancedMarkerElement;
        }
        AdvancedMarkerElement = AdvancedMarkerElement ?? (googleMaps.maps as any).marker?.AdvancedMarkerElement;
      } catch {
        AdvancedMarkerElement = null;
      }

      for (const pin of pins) {
        const marker = AdvancedMarkerElement
          ? new AdvancedMarkerElement({
              map: mapRef.current,
              position: pin.position,
              title: pin.concert.venue_name,
            })
          : new googleMaps.maps.Marker({
              map: mapRef.current,
              position: pin.position,
              title: pin.concert.venue_name,
            });

        const clickHandler = () => {
          setSelectedConcert(pin.concert);
          mapRef.current?.panTo(pin.position);
          mapRef.current?.setZoom(12);
        };

        if (marker?.addListener) {
          marker.addListener(AdvancedMarkerElement ? 'gmp-click' : 'click', clickHandler);
        } else if ((googleMaps.maps as any).event?.addListener) {
          (googleMaps.maps as any).event.addListener(marker, AdvancedMarkerElement ? 'gmp-click' : 'click', clickHandler);
        }

        markersRef.current.push(marker);
        bounds.extend(pin.position);
      }

      if (pins.length === 1) {
        mapRef.current?.setCenter(pins[0].position);
        mapRef.current?.setZoom(12);
      } else {
        mapRef.current?.fitBounds(bounds);
      }
    })();
  }, [googleMaps, pins]);

  if (!resolvedApiKey) {
    return (
      <section>
        <p role="alert" data-testid="map-missing-key" style={{ color: 'crimson' }}>
          Clé Google Maps manquante. Définissez <code>VITE_GOOGLE_MAPS_API_KEY</code>.
        </p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section>
        <p role="alert" style={{ color: 'crimson' }}>
          {loadError}
        </p>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div
        ref={mapDivRef}
        data-testid="map-container"
        style={{ width: '100%', height: 460, borderRadius: 8, border: '1px solid #ddd' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ margin: 0 }} data-testid="map-pin-count">
          {pins.length} concert{pins.length === 1 ? '' : 's'} avec coordonnées
        </p>
        {selectedConcert ? (
          <button type="button" onClick={() => onOpenConcert(selectedConcert.id)}>
            Ouvrir le concert
          </button>
        ) : null}
      </div>

      {selectedConcert ? (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid #ddd',
            background: '#fafafa',
            display: 'grid',
            gap: 4,
          }}
        >
          <strong data-testid="map-selected-venue">{selectedConcert.venue_name}</strong>
          <span data-testid="map-selected-date">{formatDate(selectedConcert.date_start)}</span>
        </div>
      ) : (
        <p style={{ margin: 0, color: '#666' }}>Cliquez sur une épingle pour voir le détail.</p>
      )}
    </section>
  );
}
