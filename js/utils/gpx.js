export function downloadRouteGpx(route, startName, endName) {
  if (!route?.coords?.length) return;
  const safeName = `${startName}_to_${endName}`.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const trkpts = route.coords
    .map(([lon, lat, ele]) => {
      const eleTag = ele !== undefined ? `<ele>${Number(ele).toFixed(1)}</ele>` : '';
      return `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${eleTag}</trkpt>`;
    })
    .join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Transit-Trail Commons (BRouter)" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${startName} → ${endName}</name>
    <desc>Generated via Transit-Trail Commons (OpenTopoMap + BRouter hiking-mountain)</desc>
  </metadata>
  <trk>
    <name>${startName} → ${endName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
