import { HIKING_TRAILS } from '../data/hikingTrails.js';
import { haversineKm } from './brouter.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const liveBboxCache = new Map();
const liveGeomStore = new Map();

const COLOR_HEX = {
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

function inferTrailColor(tags, kind) {
  const osmc = (tags['osmc:symbol'] || '').toLowerCase();
  const colour = (tags.colour || tags.color || '').toLowerCase();
  const name = (tags.name || '').toLowerCase();
  const hay = `${colour} ${osmc} ${name}`;
  for (const [k, hex] of Object.entries(COLOR_HEX)) {
    if (hay.includes(k)) return hex;
  }
  if (hay.includes('czerwon') || hay.includes('červen') || hay.includes('rot')) return COLOR_HEX.red;
  if (hay.includes('niebiesk') || hay.includes('modr') || hay.includes('blau')) return COLOR_HEX.blue;
  if (hay.includes('zielon') || hay.includes('zelen') || hay.includes('grün')) return COLOR_HEX.green;
  if (hay.includes('żółt') || hay.includes('žlut') || hay.includes('gelb')) return COLOR_HEX.yellow;
  if (hay.includes('czarn') || hay.includes('čern') || hay.includes('schwarz')) return COLOR_HEX.black;
  return kind === 'bicycle' ? '#0284c7' : '#d4af37';
}

function getExpandedBbox(coords, padDeg = 0.015) {
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
  return [minLat - padDeg, minLon - padDeg, maxLat + padDeg, maxLon + padDeg];
}

function bboxesOverlap(a, b) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function minDistanceToSegmentsKm(coords, segments) {
  const step = Math.max(1, Math.floor(coords.length / 70));
  const routePts = [];
  for (let i = 0; i < coords.length; i += step) {
    routePts.push([coords[i][1], coords[i][0]]);
  }
  routePts.push([coords[coords.length - 1][1], coords[coords.length - 1][0]]);

  let bestKm = Infinity;
  for (const seg of segments) {
    const segStep = Math.max(1, Math.floor(seg.length / 50));
    for (let i = 0; i < seg.length; i += segStep) {
      const [sLat, sLon] = seg[i];
      for (const [rLat, rLon] of routePts) {
        const d = haversineKm(rLat, rLon, sLat, sLon);
        if (d < bestKm) bestKm = d;
      }
    }
  }
  return bestKm;
}

function buildTrailEntry(tr, proxKm, source = 'static') {
  const kind = tr.kind || 'hiking';
  const baseHost = kind === 'bicycle' ? 'cycling.waymarkedtrails.org' : 'hiking.waymarkedtrails.org';
  return {
    id: tr.id,
    kind,
    name: tr.name,
    color: tr.color || '#d4af37',
    lenKm: tr.lenKm,
    proxKm,
    source,
    url: `https://${baseHost}/#route?id=${tr.id}`,
    segments: tr.segments
  };
}

/**
 * Strictly filters pre-packaged static HIKING_TRAILS by transport mode ('hiking' vs 'bicycle').
 */
export function findLocalCorridorTrails(coords, profile = 'hiking-mountain') {
  if (!coords || coords.length < 2 || !Array.isArray(HIKING_TRAILS)) {
    return [];
  }

  const targetKind = profile === 'trekking' ? 'bicycle' : 'hiking';
  const routeBox = getExpandedBbox(coords, 0.018);
  const candidates = [];

  for (const tr of HIKING_TRAILS) {
    if (!tr?.segments?.length) continue;
    const itemKind = tr.kind || 'hiking';
    if (itemKind !== targetKind) continue;
    if (tr.bbox && !bboxesOverlap(routeBox, tr.bbox)) continue;

    const proxKm = minDistanceToSegmentsKm(coords, tr.segments);
    if (proxKm <= 3.0) {
      candidates.push(buildTrailEntry(tr, proxKm, 'static'));
    }
  }

  candidates.sort((a, b) => a.proxKm - b.proxKm);
  return candidates.slice(0, 8);
}

/**
 * LIVE CORS-enabled vector fetch from OpenStreetMap Overpass API,
 * strictly querying either hiking/foot OR bicycle/mtb routes.
 */
export async function fetchLiveOverpassTrails(coords, profile = 'hiking-mountain', signal) {
  if (!coords || coords.length < 2) return [];
  let [s, w, n, e] = getExpandedBbox(coords, 0.012);

  const midLat = (s + n) / 2;
  const midLon = (w + e) / 2;
  if (n - s > 0.35) { s = midLat - 0.175; n = midLat + 0.175; }
  if (e - w > 0.45) { w = midLon - 0.225; e = midLon + 0.225; }

  const targetKind = profile === 'trekking' ? 'bicycle' : 'hiking';
  const routeRegex = targetKind === 'bicycle' ? '^(bicycle|mtb)$' : '^(hiking|foot)$';
  const key = `${targetKind}:${[s, w, n, e].map((v) => v.toFixed(3)).join(',')}`;

  if (liveBboxCache.has(key)) {
    return liveBboxCache.get(key);
  }

  const ql = `[out:json][timeout:25];relation["route"~"${routeRegex}"](${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)});out body geom;`;
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: 'data=' + encodeURIComponent(ql)
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = await res.json();
  const elements = Array.isArray(data?.elements) ? data.elements : [];

  const results = [];
  for (const el of elements) {
    if (el.type !== 'relation' || !Array.isArray(el.members)) continue;
    const tags = el.tags || {};

    const segments = [];
    for (const m of el.members) {
      if (m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length >= 2) {
        const step = m.geometry.length > 40 ? Math.floor(m.geometry.length / 20) : 1;
        const pts = [];
        for (let i = 0; i < m.geometry.length; i += step) {
          pts.push([m.geometry[i].lat, m.geometry[i].lon]);
        }
        const last = m.geometry[m.geometry.length - 1];
        pts.push([last.lat, last.lon]);
        segments.push(pts);
      }
    }
    if (!segments.length) continue;

    const name =
      (tags.name || '').trim() ||
      (tags.ref
        ? `${targetKind === 'bicycle' ? 'Bike' : 'Trail'} ${tags.ref}`
        : `${targetKind === 'bicycle' ? 'Cycling' : 'Hiking'} route #${el.id}`);
    const color = inferTrailColor(tags, targetKind);
    const proxKm = minDistanceToSegmentsKm(coords, segments);
    if (proxKm > 3.5) continue;

    liveGeomStore.set(el.id, segments);
    results.push(buildTrailEntry({ id: el.id, kind: targetKind, name, color, segments }, proxKm, 'live'));
  }

  results.sort((a, b) => a.proxKm - b.proxKm);
  const top = results.slice(0, 8);
  liveBboxCache.set(key, top);
  return top;
}

/**
 * Strictly obeys the user's selected dataSource ('static' vs 'live').
 */
export async function fetchCorridorTrails(coords, profile = 'hiking-mountain', dataSource = 'static', signal) {
  if (dataSource === 'static') {
    return { trails: findLocalCorridorTrails(coords, profile), source: 'static', error: false };
  }
  try {
    const live = await fetchLiveOverpassTrails(coords, profile, signal);
    return { trails: live, source: 'live', error: false };
  } catch (err) {
    if (err.name === 'AbortError') return { trails: [], source: 'aborted', error: false };
    return { trails: [], source: 'live', error: true };
  }
}

export async function fetchTrailGeometry(relationId) {
  if (liveGeomStore.has(relationId)) {
    return liveGeomStore.get(relationId);
  }
  const tr = HIKING_TRAILS.find((item) => item.id === relationId);
  return tr?.segments || [];
}

export function pickSteerPoint(segments, startSt, endSt) {
  const allPts = [];
  for (const seg of segments) {
    const step = seg.length > 300 ? Math.floor(seg.length / 150) : 1;
    for (let i = 0; i < seg.length; i += step) {
      allPts.push(seg[i]);
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

    if (totalVia < bestFallbackScore && dA > 0.2 && dB > 0.2) {
      bestFallbackScore = totalVia;
      bestFallback = { lat, lon };
    }

    if (dA >= 0.5 && dB >= 0.5 && totalVia <= directKm * 1.8 + 4.0) {
      const dMid = haversineKm(midLat, midLon, lat, lon);
      if (dMid < bestMidDist) {
        bestMidDist = dMid;
        bestMid = { lat, lon };
      }
    }
  }

  return bestMid || bestFallback || { lat: allPts[Math.floor(allPts.length / 2)][0], lon: allPts[Math.floor(allPts.length / 2)][1] };
}
