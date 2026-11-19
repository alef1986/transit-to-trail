import { HIKING_TRAILS } from '../data/hikingTrails.js';
import { haversineKm } from './brouter.js';

function getExpandedBbox(coords, padDeg = 0.012) {
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
  // [minLat, minLon, maxLat, maxLon]
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function minDistanceToSegmentsKm(coords, segments) {
  // Sample route points for fast distance check
  const step = Math.max(1, Math.floor(coords.length / 80));
  const routePts = [];
  for (let i = 0; i < coords.length; i += step) {
    routePts.push([coords[i][1], coords[i][0]]); // [lat, lon]
  }
  routePts.push([coords[coords.length - 1][1], coords[coords.length - 1][0]]);

  let bestKm = Infinity;
  for (const seg of segments) {
    const segStep = Math.max(1, Math.floor(seg.length / 60));
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

/**
 * Finds pre-packaged official marked trails (from js/data/hikingTrails.js)
 * passing near or through the active route corridor. No external API or CORS issues.
 */
export async function fetchCorridorTrails(coords) {
  if (!coords || coords.length < 2 || !Array.isArray(HIKING_TRAILS)) {
    return { trails: [] };
  }

  const routeBox = getExpandedBbox(coords, 0.015);
  const candidates = [];

  for (const tr of HIKING_TRAILS) {
    if (!tr?.segments?.length) continue;
    if (tr.bbox && !bboxesOverlap(routeBox, tr.bbox)) continue;

    const proxKm = minDistanceToSegmentsKm(coords, tr.segments);
    if (proxKm <= 2.5) {
      candidates.push({
        id: tr.id,
        name: tr.name,
        color: tr.color || '#d4af37',
        lenKm: tr.lenKm,
        proxKm,
        url: `https://hiking.waymarkedtrails.org/#route?id=${tr.id}`,
        segments: tr.segments
      });
    }
  }

  candidates.sort((a, b) => a.proxKm - b.proxKm);
  return { trails: candidates.slice(0, 6) };
}

/**
 * Returns Leaflet [lat, lon] segments for a static trail entry.
 */
export async function fetchTrailGeometry(relationId) {
  const tr = HIKING_TRAILS.find((item) => item.id === relationId);
  return tr?.segments || [];
}

/**
 * Picks an optimal mid-corridor point on the official trail so BRouter steers
 * the generated route onto that trail between Start (A) and End (B).
 */
export function pickSteerPoint(segments, startSt, endSt) {
  const allPts = [];
  for (const seg of segments) {
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
