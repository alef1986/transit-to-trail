const BROUTER_ENDPOINT = 'https://brouter.de/brouter';

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function destinationPoint(lat, lon, distanceKm, bearingDeg) {
  const R = 6371;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const dr = distanceKm / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dr) * Math.cos(lat1),
      Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI
  };
}

function parseSurfaceStats(messages) {
  let marked = 0;
  let natural = 0;
  let paved = 0;
  if (!Array.isArray(messages) || messages.length < 2) {
    return { markedPct: 60, naturalPct: 25, pavedPct: 15 };
  }
  const headers = messages[0];
  const distIdx = headers.indexOf('Distance');
  const tagsIdx = headers.indexOf('WayTags');
  for (let i = 1; i < messages.length; i++) {
    const row = messages[i];
    const d = Number(row[distIdx]) || 0;
    const tags = String(row[tagsIdx] || '');
    if (
      tags.includes('route_hiking') ||
      tags.includes('iwn=') ||
      tags.includes('nwn=') ||
      tags.includes('rwn=') ||
      tags.includes('lwn=') ||
      tags.includes('osmc:symbol')
    ) {
      marked += d;
    } else if (
      tags.includes('highway=path') ||
      tags.includes('highway=track') ||
      tags.includes('highway=footway') ||
      tags.includes('surface=ground') ||
      tags.includes('surface=gravel') ||
      tags.includes('surface=unpaved')
    ) {
      natural += d;
    } else {
      paved += d;
    }
  }
  const total = marked + natural + paved || 1;
  const markedPct = Math.round((marked / total) * 100);
  const naturalPct = Math.round((natural / total) * 100);
  const pavedPct = Math.max(0, 100 - markedPct - naturalPct);
  return { markedPct, naturalPct, pavedPct };
}

function computeNaismithMinutes(distanceKm, ascentM) {
  const hours = distanceKm / 4.0 + ascentM / 450;
  return Math.max(10, Math.round(hours * 60));
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

async function fetchSingleBRouterRoute(points, profile, altIdx, signal, meta = {}) {
  const lonlats = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join('|');
  const url = `${BROUTER_ENDPOINT}?lonlats=${encodeURIComponent(lonlats)}&profile=${encodeURIComponent(profile)}&alternativeidx=${altIdx}&format=geojson`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`BRouter HTTP ${res.status}`);
  const geojson = await res.json();
  const feat = geojson?.features?.[0];
  if (!feat?.geometry?.coordinates?.length) return null;

  const props = feat.properties || {};
  const distKm = Number(props['track-length'] || 0) / 1000;
  const ascentM = Math.round(Number(props['filtered ascend'] || 0));
  const coords = feat.geometry.coordinates;

  let descentM = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;
  for (let i = 0; i < coords.length; i++) {
    const ele = Number(coords[i][2] ?? 0);
    if (ele < minEle) minEle = ele;
    if (ele > maxEle) maxEle = ele;
    if (i > 0) {
      const prev = Number(coords[i - 1][2] ?? ele);
      if (prev > ele) descentM += prev - ele;
    }
  }

  const surfaces = parseSurfaceStats(props.messages);
  const durationMin = computeNaismithMinutes(distKm, ascentM);

  return {
    altIdx,
    distKm: Number(distKm.toFixed(2)),
    ascentM,
    descentM: Math.round(descentM),
    minEle: Number.isFinite(minEle) ? Math.round(minEle) : 0,
    maxEle: Number.isFinite(maxEle) ? Math.round(maxEle) : 0,
    durationMin,
    surfaces,
    coords,
    geojson,
    waypoints: points,
    ...meta
  };
}

export async function fetchBRouterAlternatives(points, profile = 'hiking-mountain', signal) {
  const indices = [0, 1, 2];
  const settled = await Promise.allSettled(
    indices.map((altIdx) => fetchSingleBRouterRoute(points, profile, altIdx, signal))
  );

  const routes = [];
  const seenSignatures = new Set();

  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value) {
      const sig = `${Math.round(item.value.distKm * 10)}_${Math.round(item.value.ascentM / 15)}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        routes.push(item.value);
      }
    }
  }

  if (routes.length === 0) {
    const firstErr = settled.find((s) => s.status === 'rejected');
    throw firstErr ? firstErr.reason : new Error('No routes returned by BRouter');
  }

  return routes;
}

/**
 * Generates up to 3 circular loop hikes starting and ending at a single station.
 * Places two triangular anchor points at radius ~ targetKm / 3.4 so BRouter snaps
 * them onto nearby marked trails and avoids out-and-back retracing.
 */
export async function fetchBRouterLoops(station, targetKm = 10, direction = 'AUTO', customVias = [], profile = 'hiking-mountain', signal) {
  // If user added manual via-points, route A -> vias -> A with 2 alternatives
  if (customVias.length > 0) {
    const pts = [station, ...customVias, station];
    const settled = await Promise.allSettled([
      fetchSingleBRouterRoute(pts, profile, 0, signal, { loopCompass: 'Custom' }),
      fetchSingleBRouterRoute(pts, profile, 1, signal, { loopCompass: 'Custom' })
    ]);
    const routes = [];
    const seen = new Set();
    for (const item of settled) {
      if (item.status === 'fulfilled' && item.value && item.value.distKm >= 1.0) {
        const sig = `${Math.round(item.value.distKm * 10)}_${Math.round(item.value.ascentM / 15)}`;
        if (!seen.has(sig)) {
          seen.add(sig);
          routes.push(item.value);
        }
      }
    }
    if (routes.length) return routes;
    const err = settled.find((s) => s.status === 'rejected');
    throw err ? err.reason : new Error('No loop routes returned by BRouter');
  }

  // Radius heuristic: triangular chord ~ 3.4 * r after road/trail winding
  const radiusKm = Math.max(1.2, targetKm / 3.5);
  const spreadDeg = 68;

  const sectorConfigs = {
    AUTO: [
      { bearing: 20, tag: 'N / NE' },
      { bearing: 140, tag: 'SE / S' },
      { bearing: 260, tag: 'W / NW' }
    ],
    N: [
      { bearing: 0, tag: 'N' },
      { bearing: 35, tag: 'NE' },
      { bearing: 325, tag: 'NW' }
    ],
    E: [
      { bearing: 90, tag: 'E' },
      { bearing: 55, tag: 'NE' },
      { bearing: 125, tag: 'SE' }
    ],
    S: [
      { bearing: 180, tag: 'S' },
      { bearing: 145, tag: 'SE' },
      { bearing: 215, tag: 'SW' }
    ],
    W: [
      { bearing: 270, tag: 'W' },
      { bearing: 235, tag: 'SW' },
      { bearing: 305, tag: 'NW' }
    ]
  };

  const sectors = sectorConfigs[direction] || sectorConfigs.AUTO;

  const settled = await Promise.allSettled(
    sectors.map((sec, idx) => {
      const p1 = destinationPoint(station.lat, station.lon, radiusKm, sec.bearing - spreadDeg / 2);
      const p2 = destinationPoint(station.lat, station.lon, radiusKm, sec.bearing + spreadDeg / 2);
      const pts = [station, p1, p2, station];
      return fetchSingleBRouterRoute(pts, profile, 0, signal, {
        altIdx: idx,
        loopCompass: sec.tag
      });
    })
  );

  const routes = [];
  const seen = new Set();
  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value && item.value.distKm >= 1.5) {
      const sig = `${Math.round(item.value.distKm * 10)}_${Math.round(item.value.ascentM / 20)}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        routes.push(item.value);
      }
    }
  }

  if (routes.length === 0) {
    const firstErr = settled.find((s) => s.status === 'rejected');
    throw firstErr ? firstErr.reason : new Error('No loop routes returned by BRouter');
  }

  return routes;
}
