import { haversineKm } from '../services/brouter.js';

export function buildElevationSeries(coords) {
  if (!coords || coords.length < 2) return [];
  const series = [];
  let cumKm = 0;
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat, ele] = coords[i];
    if (i > 0) {
      const [pLon, pLat] = coords[i - 1];
      cumKm += haversineKm(pLat, pLon, lat, lon);
    }
    series.push({ km: cumKm, ele: Number(ele ?? 0), lat, lon });
  }
  return series;
}

export function buildSvgPaths(series, width = 600, height = 74) {
  if (!series.length) return { linePath: '', areaPath: '', totalKm: 0, minEle: 0, maxEle: 0 };
  const totalKm = series[series.length - 1].km || 1;
  let minEle = Infinity;
  let maxEle = -Infinity;
  for (const pt of series) {
    if (pt.ele < minEle) minEle = pt.ele;
    if (pt.ele > maxEle) maxEle = pt.ele;
  }
  const pad = Math.max(15, (maxEle - minEle) * 0.12);
  const lo = minEle - pad;
  const hi = maxEle + pad;
  const span = hi - lo || 1;

  const step = Math.max(1, Math.floor(series.length / 220));
  const pts = [];
  for (let i = 0; i < series.length; i += step) {
    const p = series[i];
    const x = (p.km / totalKm) * width;
    const y = height - ((p.ele - lo) / span) * (height - 8) - 4;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const last = series[series.length - 1];
  pts.push(`${width.toFixed(1)},${(height - ((last.ele - lo) / span) * (height - 8) - 4).toFixed(1)}`);

  const linePath = `M ${pts.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  return { linePath, areaPath, totalKm, minEle: Math.round(minEle), maxEle: Math.round(maxEle) };
}
