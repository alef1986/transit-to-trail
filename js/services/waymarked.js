const WMT_API = 'https://hiking.waymarkedtrails.org/api/v1/list/by_area';
const bboxCache = new Map();

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

function getRouteBbox(coords) {
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
  return [minLon, minLat, maxLon, maxLat];
}

export async function fetchCorridorTrails(coords, signal) {
  if (!coords || coords.length < 2) return [];
  const [minLon, minLat, maxLon, maxLat] = getRouteBbox(coords);
  const key = [minLon, minLat, maxLon, maxLat].map((n) => n.toFixed(3)).join(',');

  if (bboxCache.has(key)) {
    return bboxCache.get(key);
  }

  try {
    const url = `${WMT_API}?bbox=${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)}&limit=25`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
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
    const top = cleaned.slice(0, 4);
    bboxCache.set(key, top);
    return top;
  } catch (err) {
    if (err.name === 'AbortError') return [];
    return [];
  }
}
