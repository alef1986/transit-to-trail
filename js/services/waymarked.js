import { haversineKm } from './brouter.js';

const WMT_LIST_API = 'https://hiking.waymarkedtrails.org/api/v1/list/by_area';
const WMT_GEOM_API = 'https://hiking.waymarkedtrails.org/api/v1/details/relation';

const bboxCache = new Map();
const geomCache = new Map();

const COLOR_MAP = {
  red: '#dc2626',
  blue: '#2563eb',
  green: '#16a34a',
  yellow: '#eab308',
  black: '#1e293b',
  orange: '#ea580c',
  purple: '#7c3aed',
  brown: '#92400e',
  white: '#e2e8f0'
};

function inferTrailColor(item) {
  const text = `${item.symbol_description || ''} ${item.name || ''} ${item.ref || ''}`.toLowerCase();
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (text.includes(key)) return hex;
  }
  if (text.includes('czerwon') || text.includes('červen') || text.includes('rot')) return COLOR_MAP.red;
  if (text.includes('niebiesk') || text.includes('modr') || text.includes('blau')) return COLOR_MAP.blue;
  if (text.includes('zielon') || text.includes('zelen') || text.includes('grün')) return COLOR_MAP.green;
  if (text.includes('żółt') || text.includes('žlut') || text.includes('gelb')) return COLOR_MAP.yellow;
  if (text.includes('czarn') || text.includes('čern') || text.includes('schwarz')) return COLOR_MAP.black;
  return '#d4af37';
}

function getExpandedBbox(coords, padDeg = 0.006) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon - padDeg, minLat - padDeg, maxLon + padDeg, maxLat + padDeg];
}

/**
 * Fetches official marked trails passing through or alongside the active route corridor.
 */
export async function fetchCorridorTrails(coords, signal) {
  if (!coords || coords.length < 2) return { trails: [], error: false };
  const [minLon, minLat, maxLon, maxLat] = getExpandedBbox(coords);
  const key = [minLon, minLat, maxLon, maxLat].map((n) => n.toFixed(3)).join(',');

  if (bboxCache.has(key)) {
    return { trails: bboxCache.get(key), error: false };
  }

  try {
    const url = `${WMT_LIST_API}?bbox=${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)}&limit=30`;
    const res = await fetch(url, { signal });
    if (!res.ok) return { trails: [], error: true };
    const data = await res.json();
    const raw = Array.isArray(data?.results) ? data.results : [];

    const seen = new Set();
    const cleaned = [];
    for (const item of raw) {
      if (!item?.id || seen.has(item.id)) continue;
      const label = (item.name || item.ref || '').trim();
      if (!label) continue;
      seen.add(item.id);

      const groupRank = { lwn: 1, rwn: 2, nwn: 3, iwn: 4 }[item.group] || 5;
      cleaned.push({
        id: item.id,
        name: label,
        ref: item.ref || '',
        group: item.group || '',
        color: inferTrailColor(item),
        rank: groupRank,
        url: `https://hiking.waymarkedtrails.org/#route?id=${item.id}`
      });
    }

    cleaned.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length);
    const top = cleaned.slice(0, 6);
    bboxCache.set(key, top);
    return { trails: top, error: false };
  } catch (err) {
    if (err.name === 'AbortError') return { trails: [], error: false };
    return { trails: [], error: true };
  }
}

function extractLatLngSegments(geojson) {
  const segments = [];
  const collect = (geom) => {
    if (!geom) return;
    if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
      segments.push(geom.coordinates.map(([lon, lat]) => [lat, lon]));
    } else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
      for (const line of geom.coordinates) {
        segments.push(line.map(([lon, lat]) => [lat, lon]));
      }
    } else if (geom.type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
      geom.geometries.forEach(collect);
    } else if (geom.type === 'Feature') {
      collect(geom.geometry);
    } else if (geom.type === 'FeatureCollection' && Array.isArray(geom.features)) {
      geom.features.forEach(collect);
    }
  };
  collect(geojson);
  return segments;
}

/**
 * Fetches full GeoJSON geometry of a specific Waymarked Trails relation (cached).
 */
export async function fetchTrailGeometry(relationId, signal) {
  if (geomCache.has(relationId)) {
    return geomCache.get(relationId);
  }
  const url = `${WMT_GEOM_API}/${relationId}/geometry/geojson`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Waymarked geometry HTTP ${res.status}`);
  const geojson = await res.json();
  const segments = extractLatLngSegments(geojson);
  geomCache.set(relationId, segments);
  return segments;
}

/**
 * Picks an optimal mid-corridor point on the official trail so BRouter steers
 * the generated route onto that trail between Start (A) and End (B).
 */
export function pickSteerPoint(segments, startSt, endSt) {
  const allPts = [];
  for (const seg of segments) {
    // Subsample densely long trails for speed
    const step = seg.length > 300 ? Math.floor(seg.length / 150) : 1;
    for (let i = 0; i < seg.length; i += step) {
      allPts.push(seg[i]); // [lat, lon]
    }
  }
  if (!allPts.length) return null;

  const midLat = (startSt.lat + endSt.lat) / 2;
  const midLon = (startSt.lon + endSt.lon) / 2;
  const directKm = Math.max(1.0, haversineKm(startSt.lat, startSt.lon, endSt.lat, endSt.lon));

  let bestMid = null;
  let bestMidDist = Infinity;

  let bestFallback = null;
  let bestFallbackScore = Infinity;

  for (const [lat, lon] of allPts) {
    const dA = haversineKm(startSt.lat, startSt.lon, lat, lon);
    const dB = haversineKm(endSt.lat, endSt.lon, lat, lon);
    const totalVia = dA + dB;

    if (totalVia < bestFallbackScore && dA > 0.25 && dB > 0.25) {
      bestFallbackScore = totalVia;
      bestFallback = { lat, lon };
    }

    // Prefer a point inside the corridor ellipse, not right on top of A or B, closest to midpoint
    if (dA >= 0.6 && dB >= 0.6 && totalVia <= directKm * 1.7 + 4.0) {
      const dMid = haversineKm(midLat, midLon, lat, lon);
      if (dMid < bestMidDist) {
        bestMidDist = dMid;
        bestMid = { lat, lon };
      }
    }
  }

  return bestMid || bestFallback || { lat: allPts[Math.floor(allPts.length / 2)][0], lon: allPts[Math.floor(allPts.length / 2)][1] };
}
