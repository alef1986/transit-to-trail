import { createApp, ref, computed, watch, onMounted, nextTick } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { STATIONS } from './data/stations.js';
import { RAIL_CORRIDORS } from './data/railLines.js';
import { REGION_PRESETS } from './data/presets.js';
import { STAKEHOLDERS, EFFORT_STYLE } from './data/stakeholders.js';
import { I18N } from './i18n.js';
import { fetchBRouterAlternatives, fetchBRouterLoops, haversineKm, formatDuration } from './services/brouter.js';
import { fetchCorridorTrails, fetchTrailGeometry, pickSteerPoint } from './services/waymarked.js';
import { GEOPORTAL_WMS_LAYERS, createGeoportalWmsLayer, fetchGeoportalVectorGeoJson } from './services/geoportal.js';
import { downloadRouteGpx } from './utils/gpx.js';
import { buildElevationSeries, buildSvgPaths } from './utils/elevation.js';

const ROUTE_COLORS = ['#ea580c', '#2563eb', '#7c3aed'];
const OP_COLORS = { KD: '#eab308', CD: '#2563eb', Trilex: '#0d9488' };
const OP_DASH_COLORS = { KD: '#facc15', CD: '#60a5fa', Trilex: '#2dd4bf' };

createApp({
  setup() {
    const lang = ref('en');
    const activeTab = ref('map');
    const operatorFilter = ref('ALL');
    const selectedRegion = ref('dolina-bobru');
    const routeMode = ref('p2p'); // 'p2p' | 'loop'
    const loopKm = ref(12);
    const loopDir = ref('AUTO');
    const stationSearch = ref('');
    const sidebarOpen = ref(window.innerWidth > 820);
    let touchStartX = 0;
    let touchStartY = 0;
    const startId = ref('pl-pilchowice-zapora');
    const endId = ref('pl-rybnica');
    const profile = ref('hiking-mountain');
    const viaMode = ref(false);
    const viaPoints = ref([]);

    const showWaymarked = ref(true);
    const showRailCorridors = ref(true);
    const wmsDefs = GEOPORTAL_WMS_LAYERS;
    const activeWms = ref({
      culinary: false,
      cultural: false,
      underground: false,
      agrotourism: false
    });
    const wmsLayerInstances = {};

    // Trail corridor data source toggle ('static' = local file, 'live' = Overpass API)
    const trailDataSource = ref('static');
    const corridorError = ref(false);

    const routes = ref([]);
    const activeRouteIdx = ref(0);
    const routingStatus = ref('ready');
    const errorDetail = ref('');

    // Corridor marked trails (preview & steer)
    const corridorTrails = ref([]);
    const corridorLoading = ref(false);
    const previewTrailId = ref(null);
    const steeringTrailId = ref(null);

    const hoverInfo = ref(null);

    // Stakeholder Map State
    const lifecyclePhase = ref('pilot');
    const selectedStakeholderId = ref('university');

    let map = null;
    let waymarkedLayer = null;
    let railLayerGroup = null;
    let stationLayerGroup = null;
    let routeLayerGroup = null;
    let previewTrailLayerGroup = null;
    let viaLayerGroup = null;
    let hoverMarker = null;
    let abortCtrl = null;
    let wmtAbortCtrl = null;
    let routeDebounceTimer = null;

    const t = computed(() => I18N[lang.value] || I18N.en);
    const presets = REGION_PRESETS;
    const stakeholders = STAKEHOLDERS;
    const stationMap = new Map(STATIONS.map((s) => [s.id, s]));

    const selectedStakeholder = computed(() => {
      const st = STAKEHOLDERS.find((s) => s.id === selectedStakeholderId.value) || STAKEHOLDERS[0];
      const loc = st.i18n[lang.value] || st.i18n.en;
      const effKey = st.effort[lifecyclePhase.value];
      const effStyle = EFFORT_STYLE[effKey] || EFFORT_STYLE.low;
      const effLabels = {
        high: t.value.effortHigh,
        medium: t.value.effortMedium,
        low: t.value.effortLow,
        passive: t.value.effortPassive
      };
      return {
        ...st,
        ...loc,
        contributeText: loc.contribute[lifecyclePhase.value],
        effortKey: effKey,
        effortPct: effStyle.pct,
        effortColor: effStyle.color,
        effortLabel: effLabels[effKey] || ''
      };
    });

    function getStakeholderNodeMeta(st) {
      const loc = st.i18n[lang.value] || st.i18n.en;
      const effKey = st.effort[lifecyclePhase.value];
      const effStyle = EFFORT_STYLE[effKey] || EFFORT_STYLE.low;
      return { short: loc.short, color: effStyle.color };
    }

    const loopKmBounds = computed(() =>
      profile.value === 'trekking'
        ? { min: 5, max: 180, defaultKm: 30 }
        : { min: 3, max: 60, defaultKm: 12 }
    );

    const filteredStations = computed(() => {
      let list = operatorFilter.value === 'ALL'
        ? STATIONS
        : STATIONS.filter((s) => s.operator === operatorFilter.value);

      const q = stationSearch.value.trim().toLowerCase();
      if (q) {
        list = list.filter((s) =>
          s.name.toLowerCase().includes(q) ||
          (s.lines && s.lines.toLowerCase().includes(q)) ||
          s.country.toLowerCase().includes(q) ||
          s.operator.toLowerCase().includes(q)
        );
      }

      // Always keep currently selected A / B in the dropdown so v-model never blanks
      const result = [...list];
      for (const keepId of [startId.value, endId.value]) {
        if (keepId && !result.some((s) => s.id === keepId)) {
          const st = stationMap.get(keepId);
          if (st) result.unshift(st);
        }
      }
      return result;
    });

    function normalizeLoopKm() {
      const { min, max, defaultKm } = loopKmBounds.value;
      const val = Number(loopKm.value);
      if (!Number.isFinite(val) || val <= 0) {
        loopKm.value = defaultKm;
      } else if (val < min) {
        loopKm.value = min;
      } else if (val > max) {
        loopKm.value = max;
      } else {
        loopKm.value = Math.round(val);
      }
    }

    function onSidebarTouchStart(e) {
      if (!e.touches || e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }

    function onSidebarTouchEnd(e) {
      if (!e.changedTouches || e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
      // Swipe left > 55px horizontally closes the mobile drawer
      if (dx < -55 && dy < 70 && window.innerWidth <= 820) {
        sidebarOpen.value = false;
      }
    }

    const startStation = computed(() => stationMap.get(startId.value) || STATIONS[0]);
    const endStation = computed(() => stationMap.get(endId.value) || STATIONS[1]);
    const activeRoute = computed(() => routes.value[activeRouteIdx.value] || null);

    const elevSeries = computed(() =>
      activeRoute.value ? buildElevationSeries(activeRoute.value.coords) : []
    );

    const elevSvg = computed(() => buildSvgPaths(elevSeries.value, 600, 70));

    function getPresetLabel(p) {
      return p.labels[lang.value] || p.labels.en;
    }

    function getRouteLabel(idx, rt) {
      if (routeMode.value === 'loop') {
        const tag = rt?.loopCompass ? ` (${rt.loopCompass})` : '';
        return `${t.value.loopTitlePrefix} #${idx + 1}${tag}`;
      }
      if (idx === 0) return t.value.altPrimary;
      if (idx === 1) return t.value.altSecondary;
      return t.value.altTertiary;
    }

    function onRegionChange() {
      const preset = REGION_PRESETS.find((p) => p.id === selectedRegion.value);
      if (!preset) return;
      operatorFilter.value = 'ALL';
      viaPoints.value = [];
      clearTrailPreview();
      startId.value = preset.startId;
      endId.value = preset.endId;
      profile.value = preset.profile || 'hiking-mountain';
    }

    function onManualStationChange() {
      const match = REGION_PRESETS.find(
        (p) => p.startId === startId.value && p.endId === endId.value
      );
      selectedRegion.value = match ? match.id : '';
    }

    function swapStations() {
      const tmp = startId.value;
      startId.value = endId.value;
      endId.value = tmp;
      viaPoints.value = [...viaPoints.value].reverse();
      onManualStationChange();
    }

    function removeVia(idx) {
      viaPoints.value.splice(idx, 1);
    }

    function exportActiveGpx(route) {
      const endName = routeMode.value === 'loop' ? `${startStation.value.name}_Loop` : endStation.value.name;
      downloadRouteGpx(route, startStation.value.name, endName);
    }

    function getBrouterWebUrl(route) {
      const rawPts = route?.waypoints?.length
        ? route.waypoints
        : (routeMode.value === 'loop'
            ? [startStation.value, ...viaPoints.value, startStation.value]
            : [startStation.value, ...viaPoints.value, endStation.value]);
      const pts = rawPts
        .map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`)
        .join(';');
      const c = startStation.value;
      return `https://brouter.de/brouter-web/#map=13/${c.lat.toFixed(4)}/${c.lon.toFixed(4)}/OpenTopoMap&lonlats=${pts}&profile=${profile.value}&alternativeidx=${routeMode.value === 'loop' ? 0 : route.altIdx}`;
    }

    function clearTrailPreview() {
      previewTrailId.value = null;
      if (previewTrailLayerGroup) previewTrailLayerGroup.clearLayers();
    }

    async function togglePreviewTrail(trail) {
      if (previewTrailId.value === trail.id) {
        clearTrailPreview();
        return;
      }
      clearTrailPreview();
      previewTrailId.value = trail.id;
      try {
        const segments = await fetchTrailGeometry(trail.id);
        if (previewTrailId.value !== trail.id || !previewTrailLayerGroup) return;
        for (const seg of segments) {
          L.polyline(seg, {
            color: '#0f172a',
            weight: 7,
            opacity: 0.7,
            interactive: false
          }).addTo(previewTrailLayerGroup);
          L.polyline(seg, {
            color: '#06b6d4',
            weight: 3.5,
            opacity: 0.98,
            dashArray: '8, 5'
          })
            .bindTooltip(`<b>${trail.name}</b>`, { sticky: true })
            .addTo(previewTrailLayerGroup);
        }
      } catch {
        clearTrailPreview();
      }
    }

    async function steerRouteViaTrail(trail) {
      steeringTrailId.value = trail.id;
      try {
        const segments = await fetchTrailGeometry(trail.id);
        const pt = pickSteerPoint(segments, startStation.value, endStation.value);
        if (pt) {
          // Replace any previous trail-steer via point or append a new one
          const existingIdx = viaPoints.value.findIndex((v) => v.trailId === trail.id);
          if (existingIdx >= 0) {
            viaPoints.value.splice(existingIdx, 1);
          } else {
            viaPoints.value.push({
              lat: pt.lat,
              lon: pt.lon,
              label: trail.name,
              trailId: trail.id
            });
          }
          // Also highlight the trail on map for visual confirmation
          if (previewTrailId.value !== trail.id) {
            await togglePreviewTrail(trail);
          }
        }
      } finally {
        steeringTrailId.value = null;
      }
    }

    async function loadCorridorTrailsForActive() {
      if (wmtAbortCtrl) wmtAbortCtrl.abort();
      corridorTrails.value = [];
      corridorError.value = false;

      const rt = activeRoute.value;
      if (!rt || !rt.coords?.length) return;

      corridorLoading.value = true;
      wmtAbortCtrl = new AbortController();
      const { trails, error } = await fetchCorridorTrails(
        rt.coords,
        profile.value,
        trailDataSource.value,
        wmtAbortCtrl.signal
      );
      corridorTrails.value = trails;
      corridorError.value = Boolean(error);
      corridorLoading.value = false;
    }

    function drawRailCorridors() {
      if (!railLayerGroup) return;
      railLayerGroup.clearLayers();
      if (!showRailCorridors.value) return;

      for (const corr of RAIL_CORRIDORS) {
        // Supports BOTH real curved `segments` (from scripts/fetch_rail_data.py) and legacy `ids`
        let segmentList = [];
        if (Array.isArray(corr.segments) && corr.segments.length) {
          segmentList = corr.segments;
        } else if (Array.isArray(corr.ids) && corr.ids.length >= 2) {
          const pts = corr.ids
            .map((id) => stationMap.get(id))
            .filter(Boolean)
            .map((s) => [s.lat, s.lon]);
          if (pts.length >= 2) segmentList = [pts];
        }

        for (const latlngs of segmentList) {
          if (latlngs.length < 2) continue;

          L.polyline(latlngs, {
            color: '#ffffff',
            weight: 6.2,
            opacity: 0.85,
            interactive: false
          }).addTo(railLayerGroup);

          L.polyline(latlngs, {
            color: '#141416',
            weight: 3.8,
            opacity: 0.92,
            interactive: false
          }).addTo(railLayerGroup);

          const dashLine = L.polyline(latlngs, {
            color: OP_DASH_COLORS[corr.operator] || '#facc15',
            weight: 2.1,
            opacity: 0.98,
            dashArray: '6, 6'
          });
          dashLine.bindTooltip(corr.name, { sticky: true });
          dashLine.addTo(railLayerGroup);
        }
      }
    }

    function openStationPopup(st, latlng) {
      if (!map) return;
      const container = document.createElement('div');
      container.className = 'st-popup';

      const titleEl = document.createElement('div');
      titleEl.className = 'st-popup-title';
      titleEl.textContent = st.name;

      const metaEl = document.createElement('div');
      metaEl.className = 'st-popup-meta';
      metaEl.textContent = `${st.country} · ${st.operator}${st.lines ? ' · ' + st.lines : ''}`;

      const actionsEl = document.createElement('div');
      actionsEl.className = 'st-popup-actions';

      if (routeMode.value === 'loop') {
        const btnLoop = document.createElement('button');
        btnLoop.className = 'st-popup-btn loop';
        btnLoop.textContent = t.value.popupSetLoop;
        btnLoop.addEventListener('click', () => {
          startId.value = st.id;
          viaPoints.value = [];
          onManualStationChange();
          map.closePopup();
        });
        actionsEl.appendChild(btnLoop);
      } else {
        const btnA = document.createElement('button');
        btnA.className = 'st-popup-btn start';
        btnA.textContent = t.value.popupSetStart;
        btnA.addEventListener('click', () => {
          startId.value = st.id;
          onManualStationChange();
          map.closePopup();
        });

        const btnB = document.createElement('button');
        btnB.className = 'st-popup-btn end';
        btnB.textContent = t.value.popupSetEnd;
        btnB.addEventListener('click', () => {
          endId.value = st.id;
          onManualStationChange();
          map.closePopup();
        });

        actionsEl.appendChild(btnA);
        actionsEl.appendChild(btnB);
      }

      container.appendChild(titleEl);
      container.appendChild(metaEl);
      container.appendChild(actionsEl);

      L.popup({ closeButton: true, offset: [0, -6] })
        .setLatLng(latlng || [st.lat, st.lon])
        .setContent(container)
        .openOn(map);
    }

    function drawStations() {
      if (!stationLayerGroup) return;
      stationLayerGroup.clearLayers();

      for (const st of STATIONS) {
        const isStart = st.id === startId.value;
        const isEnd = routeMode.value === 'p2p' && st.id === endId.value;
        const visible = operatorFilter.value === 'ALL' || st.operator === operatorFilter.value || isStart || isEnd;
        if (!visible) continue;

        if (isStart || isEnd) {
          const icon = L.divIcon({
            className: '',
            html: `<div class="station-pin ${isStart ? 'station-pin-a' : 'station-pin-b'}">${isStart ? 'A' : 'B'}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });
          const pin = L.marker([st.lat, st.lon], { icon, zIndexOffset: 900 });
          pin.bindTooltip(
            `<b>${isStart ? 'A · ' : 'B · '}${st.name}</b> <span style="opacity:.75">[${st.country} · ${st.operator} ${st.lines}]</span>`,
            { direction: 'top', offset: [0, -12] }
          );
          pin.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            openStationPopup(st, e.latlng);
          });
          pin.addTo(stationLayerGroup);
          continue;
        }

        L.circleMarker([st.lat, st.lon], {
          radius: 8,
          fillColor: '#ffffff',
          fillOpacity: 0.88,
          stroke: false,
          interactive: false
        }).addTo(stationLayerGroup);

        const marker = L.circleMarker([st.lat, st.lon], {
          radius: 5.5,
          fillColor: OP_COLORS[st.operator] || '#334155',
          color: '#141416',
          weight: 2,
          fillOpacity: 1
        });

        marker.bindTooltip(
          `<b>${st.name}</b> <span style="opacity:.75">[${st.country} · ${st.operator} ${st.lines}]</span>`,
          { direction: 'top', offset: [0, -8] }
        );

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          openStationPopup(st, e.latlng);
        });

        marker.addTo(stationLayerGroup);
      }
    }

    function drawViaPoints() {
      if (!viaLayerGroup) return;
      viaLayerGroup.clearLayers();
      viaPoints.value.forEach((vp, idx) => {
        const m = L.circleMarker([vp.lat, vp.lon], {
          radius: 7.5,
          fillColor: vp.trailId ? '#06b6d4' : '#f59e0b',
          color: '#141416',
          weight: 2.5,
          fillOpacity: 1
        });
        m.bindTooltip(vp.label ? `Via: ${vp.label}` : `Via #${idx + 1}`, { direction: 'top' });
        m.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          removeVia(idx);
        });
        m.addTo(viaLayerGroup);
      });
    }

    function drawRoutes(fit = true) {
      if (!routeLayerGroup) return;
      routeLayerGroup.clearLayers();
      if (hoverMarker) {
        map.removeLayer(hoverMarker);
        hoverMarker = null;
      }

      routes.value.forEach((rt, idx) => {
        const isActive = idx === activeRouteIdx.value;
        const latlngs = rt.coords.map(([lon, lat]) => [lat, lon]);

        if (isActive) {
          L.polyline(latlngs, {
            color: '#ffffff',
            weight: 8.5,
            opacity: 0.9,
            interactive: false
          }).addTo(routeLayerGroup);
        }

        const line = L.polyline(latlngs, {
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
          weight: isActive ? 5 : 3.2,
          opacity: isActive ? 0.98 : 0.45
        });
        line.on('click', () => {
          activeRouteIdx.value = idx;
          drawRoutes(false);
        });
        line.addTo(routeLayerGroup);
        if (isActive) line.bringToFront();
      });

      if (fit && activeRoute.value?.coords?.length) {
        const bounds = L.latLngBounds(
          activeRoute.value.coords.map(([lon, lat]) => [lat, lon])
        );
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14 });
      }
    }

    function scheduleComputeRoutes() {
      if (routeDebounceTimer) clearTimeout(routeDebounceTimer);
      routeDebounceTimer = setTimeout(() => {
        computeRoutes();
      }, 320);
    }

    async function computeRoutes() {
      if (abortCtrl) abortCtrl.abort();
      routes.value = [];
      corridorTrails.value = [];
      activeRouteIdx.value = 0;
      hoverInfo.value = null;
      errorDetail.value = '';

      const a = startStation.value;
      const b = endStation.value;

      if (routeMode.value === 'p2p') {
        if (a.id === b.id && viaPoints.value.length === 0) {
          routingStatus.value = 'same-station';
          drawRoutes(false);
          return;
        }
        const straightKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
        if (straightKm > 75) {
          routingStatus.value = 'too-far';
          drawRoutes(false);
          return;
        }
      }

      routingStatus.value = 'loading';
      abortCtrl = new AbortController();

      try {
        let result;
        if (routeMode.value === 'loop') {
          const safeKm = Math.max(
            loopKmBounds.value.min,
            Math.min(loopKmBounds.value.max, Number(loopKm.value) || loopKmBounds.value.defaultKm)
          );
          result = await fetchBRouterLoops(
            a,
            safeKm,
            loopDir.value,
            viaPoints.value,
            profile.value,
            abortCtrl.signal
          );
        } else {
          const waypoints = [a, ...viaPoints.value, b];
          result = await fetchBRouterAlternatives(waypoints, profile.value, abortCtrl.signal);
        }
        routes.value = result;
        activeRouteIdx.value = 0;
        routingStatus.value = 'ready';
        drawRoutes(true);
        loadCorridorTrailsForActive();
      } catch (err) {
        if (err.name === 'AbortError') return;
        routingStatus.value = 'error';
        errorDetail.value = err.message || 'Network error';
        drawRoutes(false);
      }
    }

    function onElevMove(e) {
      if (!elevSeries.value.length || !map) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const totalKm = elevSeries.value[elevSeries.value.length - 1].km;
      const targetKm = ratio * totalKm;

      let closest = elevSeries.value[0];
      for (const pt of elevSeries.value) {
        if (pt.km >= targetKm) {
          closest = pt;
          break;
        }
      }

      hoverInfo.value = {
        x: ratio * 600,
        km: closest.km.toFixed(1),
        ele: Math.round(closest.ele)
      };

      if (!hoverMarker) {
        hoverMarker = L.circleMarker([closest.lat, closest.lon], {
          radius: 7,
          fillColor: '#141416',
          color: '#d4af37',
          weight: 3,
          fillOpacity: 1
        }).addTo(map);
      } else {
        hoverMarker.setLatLng([closest.lat, closest.lon]);
      }
    }

    function onElevLeave() {
      hoverInfo.value = null;
      if (hoverMarker && map) {
        map.removeLayer(hoverMarker);
        hoverMarker = null;
      }
    }

    async function toggleWmsLayer(id) {
      activeWms.value[id] = !activeWms.value[id];
      const def = wmsDefs.find((d) => d.id === id);
      if (!map || !def) return;

      const existing = wmsLayerInstances[id];
      if (!activeWms.value[id]) {
        if (existing) map.removeLayer(existing);
        return;
      }

      // Try live ArcGIS REST GeoJSON vector layer first (crisp clickable POIs/lines)
      if (!existing) {
        try {
          const geojson = await fetchGeoportalVectorGeoJson(def);
          const vecLayer = L.geoJSON(geojson, {
            style: () => ({ color: def.color, weight: 3.5, opacity: 0.9 }),
            pointToLayer: (feat, latlng) =>
              L.circleMarker(latlng, {
                radius: 6.5,
                fillColor: def.color,
                color: '#ffffff',
                weight: 2,
                fillOpacity: 0.95
              }),
            onEachFeature: (feat, layer) => {
              const p = feat.properties || {};
              const title = p.NAZWA || p.nazwa || p.name || p.NAME || p.OBIEKT || Object.values(p).find((v) => typeof v === 'string' && v.length > 2) || def.id;
              layer.bindTooltip(`${def.icon} <b>${title}</b>`, { direction: 'top' });
              if (feat.geometry?.type === 'Point') {
                const [lon, lat] = feat.geometry.coordinates;
                layer.on('click', (e) => {
                  L.DomEvent.stopPropagation(e);
                  viaPoints.value.push({ lat, lon, label: String(title).slice(0, 32) });
                });
              }
            }
          });
          wmsLayerInstances[id] = vecLayer;
        } catch {
          // Graceful fallback to WMS tiles if server blocks CORS or layer has no vector query
          wmsLayerInstances[id] = createGeoportalWmsLayer(def);
        }
      }

      if (activeWms.value[id] && wmsLayerInstances[id]) {
        wmsLayerInstances[id].addTo(map);
      }
    }



    function initMap() {
      map = L.map('map', {
        center: [50.94, 15.64],
        zoom: 12,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        className: 'otm-base-tiles',
        attribution: 'Map data: © OpenStreetMap contributors, SRTM | Style: © OpenTopoMap (CC-BY-SA)'
      }).addTo(map);

      waymarkedLayer = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
        maxZoom: 17,
        opacity: 0.78,
        attribution: '© Waymarked Trails'
      });
      if (showWaymarked.value) waymarkedLayer.addTo(map);

      // Geoportal layers load lazily (ArcGIS vector GeoJSON first, WMS fallback)

      railLayerGroup = L.layerGroup().addTo(map);
      previewTrailLayerGroup = L.layerGroup().addTo(map);
      routeLayerGroup = L.layerGroup().addTo(map);
      viaLayerGroup = L.layerGroup().addTo(map);
      stationLayerGroup = L.layerGroup().addTo(map);

      map.on('click', (e) => {
        if (viaMode.value || e.originalEvent.shiftKey) {
          viaPoints.value.push({ lat: e.latlng.lat, lon: e.latlng.lng });
          viaMode.value = false;
        }
      });

      drawRailCorridors();
      drawStations();
      computeRoutes();
    }

    watch([routeMode, loopKm, loopDir, startId, endId, profile, () => viaPoints.value.length], () => {
      drawStations();
      drawViaPoints();
      scheduleComputeRoutes();
    });

    watch(operatorFilter, () => {
      drawStations();
    });

    watch(showWaymarked, (val) => {
      if (!map || !waymarkedLayer) return;
      if (val) waymarkedLayer.addTo(map);
      else map.removeLayer(waymarkedLayer);
    });

    watch(profile, (val) => {
      clearTrailPreview();
      if (val === 'trekking' && Number(loopKm.value) <= 15) {
        loopKm.value = 30;
      } else if (val === 'hiking-mountain' && Number(loopKm.value) > 60) {
        loopKm.value = 12;
      }
      if (waymarkedLayer) {
        const wmtType = val === 'trekking' ? 'cycling' : 'hiking';
        waymarkedLayer.setUrl(`https://tile.waymarkedtrails.org/${wmtType}/{z}/{x}/{y}.png`);
      }
    });

    watch(trailDataSource, () => {
      clearTrailPreview();
      loadCorridorTrailsForActive();
    });

    watch(showRailCorridors, () => {
      drawRailCorridors();
    });

    watch(activeRouteIdx, () => {
      drawRoutes(false);
      loadCorridorTrailsForActive();
    });

    watch(activeTab, async (tab) => {
      if (tab === 'map' && map) {
        await nextTick();
        map.invalidateSize();
      }
    });

    onMounted(() => {
      initMap();
    });

    return {
      lang,
      activeTab,
      operatorFilter,
      selectedRegion,
      routeMode,
      loopKm,
      loopKmBounds,
      loopDir,
      stationSearch,
      sidebarOpen,
      normalizeLoopKm,
      onSidebarTouchStart,
      onSidebarTouchEnd,
      startId,
      endId,
      profile,
      viaMode,
      viaPoints,
      showWaymarked,
      showRailCorridors,
      wmsDefs,
      activeWms,
      toggleWmsLayer,
      trailDataSource,
      corridorError,
      loadCorridorTrailsForActive,
      routes,
      activeRouteIdx,
      activeRoute,
      routingStatus,
      errorDetail,
      corridorTrails,
      corridorLoading,
      previewTrailId,
      steeringTrailId,
      hoverInfo,
      elevSvg,
      lifecyclePhase,
      selectedStakeholderId,
      stakeholders,
      selectedStakeholder,
      getStakeholderNodeMeta,
      t,
      presets,
      filteredStations,
      startStation,
      endStation,
      ROUTE_COLORS,
      formatDuration,
      getPresetLabel,
      getRouteLabel,
      onRegionChange,
      onManualStationChange,
      swapStations,
      removeVia,
      exportActiveGpx,
      getBrouterWebUrl,
      togglePreviewTrail,
      steerRouteViaTrail,
      onElevMove,
      onElevLeave
    };
  }
}).mount('#app');
