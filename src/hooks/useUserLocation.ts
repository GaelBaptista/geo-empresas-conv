import { useCallback, useRef, useState } from 'react';
import {
  FORTALEZA_CENTER,
  setCachedUserLocation,
  type LatLng,
  type LocationSource,
} from '@/lib/user-location';

export type UserLocationStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'timeout';

type UseUserLocationOptions = {
  /**
   * @deprecated O pedido agora é só no clique do botão (gesto do usuário).
   * Mantido para não quebrar chamadas antigas.
   */
  autoRequest?: boolean;
};

/**
 * Localização serve principalmente para detectar a CIDADE.
 * GPS → cidade mais próxima. Sem permissão → Fortaleza.
 * Não dispara sozinho: precisa do clique em "Permitir".
 */
export function useUserLocation(_options: UseUserLocationOptions = {}) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [source, setSource] = useState<LocationSource | null>(null);
  const [status, setStatus] = useState<UserLocationStatus>('idle');
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestInFlightRef = useRef(false);

  const applyFortaleza = useCallback((message?: string | null) => {
    setPosition(FORTALEZA_CENTER);
    setCachedUserLocation(FORTALEZA_CENTER, 'fortaleza');
    setSource('fortaleza');
    setAccuracyM(null);
    setStatus('ready');
    setErrorMessage(message ?? null);
    requestInFlightRef.current = false;
  }, []);

  const applyGps = useCallback((coords: GeolocationCoordinates) => {
    const next = { lat: coords.latitude, lng: coords.longitude };
    setPosition(next);
    setCachedUserLocation(next, 'gps');
    setSource('gps');
    setAccuracyM(
      typeof coords.accuracy === 'number' && Number.isFinite(coords.accuracy)
        ? coords.accuracy
        : null
    );
    setStatus('ready');
    setErrorMessage(null);
    requestInFlightRef.current = false;
  }, []);

  const useFortaleza = useCallback(() => {
    applyFortaleza(null);
  }, [applyFortaleza]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      applyFortaleza('GPS indisponível. Abrindo o mapa em Fortaleza.');
      return;
    }

    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setStatus('requesting');
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (result) => {
        applyGps(result.coords);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          applyFortaleza(
            'Localização não permitida. Abrindo o mapa em Fortaleza.'
          );
        } else if (error.code === error.TIMEOUT) {
          applyFortaleza(
            'Não deu tempo de achar o GPS. Abrindo o mapa em Fortaleza.'
          );
        } else {
          applyFortaleza('Não foi possível detectar a cidade. Usando Fortaleza.');
        }
      },
      {
        // Cidade não precisa de alta precisão (mais rápido e estável)
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 10_000,
      }
    );
  }, [applyFortaleza, applyGps]);

  return {
    position,
    source: source ?? 'fortaleza',
    status,
    accuracyM,
    errorMessage,
    isReady: status === 'ready' && position != null,
    isRequesting: status === 'requesting',
    /** Ainda não escolheu (nem GPS nem Fortaleza). */
    isPending: status === 'idle' || status === 'requesting',
    usingGps: source === 'gps' && status === 'ready',
    usingFortalezaFallback: source === 'fortaleza' && status === 'ready',
    requestLocation,
    useFortaleza,
  };
}
