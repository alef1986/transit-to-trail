import { createApp, ref, computed, watch, onMounted, nextTick } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { STATIONS } from './data/stations.js';
import { RAIL_CORRIDORS } from './data/railLines.js';
import { REGION_PRESETS } from './data/presets.js';
import { I18N } from './i18n.js';
import { fetchBRouterAlternatives, haversineKm, formatDuration } from './services/brouter.js';
import { downloadRouteGpx } from './utils/gpx.js';
import { buildElevationSeries, buildSvgPaths } from './utils/elevation.js';

const ROUTE_COLORS = ['#d97706', '#2563eb', '#7c3aed'];
const OP_COLORS = { KD: '#ca8a04', CD: '#1d4ed8', Trilex: '#0f766e' };

createApp({
  setup() {
    const lang = ref('en');
    const activeTab = ref('map');
    const operatorFilter = ref('ALL');
    const selectedRegion = ref('dolina-bobru');
    const startId = ref('pl-pilchowice-zapora');
    const endId = ref('pl-rybnica');
    const profile = ref('hiking-mountain');
    const viaMode = ref(false);
    const viaPoints = ref([]);

    const showWaymarked = ref(true);
    const showRailCorridors = ref(true);

    const routes = ref([]);
    const activeRouteIdx = ref(0);
    const routingStatus = ref('ready'); // ready | loading | error | too-far | same-station
    const errorDetail = ref('');

    const hoverInfo = ref(null);

    let map = null;
    let waymarkedLayer = null;
    let railLayerGroup = null;
    let stationLayerGroup = null;
    let routeLayerGroup = null;
    let viaLayerGroup = null;
    let hoverMarker = null;
    let abortCtrl = null;

    const t = computed(() => I18N[lang.value] || I18N.en);
    const presets = REGION_PRESETS;
    const stationMap = new Map(STATIONS.map((s) => [s.id, s]));

    const filteredStations = computed(() => {
      if (operatorFilter.value === 'ALL') return STATIONS;
      return STATIONS.filter((s) => s.operator === operatorFilter.value);
    });

    const startStation = computed(() => stationMap.get(startId.value) || STATIONS[0]);
    const endStation = computed(() => stationMap.get(endId.value) || STATIONS[1]);
    const activeRoute = computed(() => routes.value[activeRouteIdx.value] || null);

    const elevSeries = computed(() =>
      activeRoute.value ? buildElevationSeries(activeRoute.value.coords) : []
    );

    const elevSvg = computed(() => buildSvgPaths(elevSeries.value, 600, 72));

    function getPresetLabel(p) {
      return p.labels[lang.value] || p.labels.en;
    }

    function getRouteLabel(idx) {
      if (idx === 0) return t.value.altPrimary;
      if (idx === 1) return t.value.altSecondary;
      return t.value.altTertiary;
    }

    function onRegionChange() {
      const preset = REGION_PRESETS.find((p) => p.id === selectedRegion.value);
      if (!preset) return;
      operatorFilter.value = 'ALL';
      viaPoints.value = [];
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
      downloadRouteGpx(route, startStation.value.name, endStation.value.name);
    }

    function getBrouterWebUrl(route) {
      const pts = [startStation.value, ...viaPoints.value, endStation.value]
        .map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`)
        .join(';');
      const c = startStation.value;
      return `https://brouter.de/brouter-web/#map=13/${c.lat.toFixed(4)}/${c.lon.toFixed(4)}/OpenTopoMap&lonlats=${pts}&profile=${profile.value}&alternativeidx=${route.altIdx}`;
    }

    function getMapyUrl() {
      const midLat = (startStation.value.lat + endStation.value.lat) / 2;
      const midLon = (startStation.value.lon + endStation.value.lon) / 2;
      return `https://mapy.com/en/turisticka?x=${midLon.toFixed(4)}&y=${midLat.toFixed(4)}&z=13`;
    }

    function drawStations() {
      if (!stationLayerGroup) return;
      stationLayerGroup.clearLayers();

      for (const st of STATIONS) {
        const isStart = st.id === startId.value;
        const isEnd = st.id === endId.value;
        const visible = operatorFilter.value === 'ALL' || st.operator === operatorFilter.value || isStart || isEnd;
        if (!visible) continue;

        let radius = 5;
        let fillColor = OP_COLORS[st.operator] || '#334155';
        let weight = 1.5;
        let color = '#ffffff';

        if (isStart) {
          radius = 8.5;
          fillColor = '#15803d';
          weight = 2.5;
        } else if (isEnd) {
          radius = 8.5;
          fillColor = '#b91c1c';
          weight = 2.5;
        }

        const marker = L.circleMarker([st.lat, st.lon], {
          radius,
          fillColor,
          color,
          weight,
          fillOpacity: 0.95
        });

        marker.bindTooltip(
          `<b>${st.name}</b> <span style="opacity:.75">[${st.country} · ${st.operator} ${st.lines}]</span>`,
          { direction: 'top', offset: [0, -6] }
        );

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (e.originalEvent.shiftKey) {
            endId.value = st.id;
          } else if (startId.value === st.id) {
            return;
          } else {
            endId.value = st.id;
          }
          onManualStationChange();
        });

        marker.addTo(stationLayerGroup);
      }
    }

    function drawRailCorridors() {
      if (!railLayerGroup) return;
      railLayerGroup.clearLayers();
      if (!showRailCorridors.value) return;

      for (const corr of RAIL_CORRIDORS) {
        const latlngs = corr.ids
          .map((id) => stationMap.get(id))
          .filter(Boolean)
          .map((s) => [s.lat, s.lon]);
        if (latlngs.length < 2) continue;

        L.polyline(latlngs, {
          color: corr.operator === 'KD' ? '#1e293b' : '#475569',
          weight: 2,
          opacity: 0.5,
          dashArray: '5, 5'
        }).addTo(railLayerGroup);
      }
    }

    function drawViaPoints() {
      if (!viaLayerGroup) return;
      viaLayerGroup.clearLayers();
      viaPoints.value.forEach((vp, idx) => {
        const m = L.circleMarker([vp.lat, vp.lon], {
          radius: 7,
          fillColor: '#f59e0b',
          color: '#141416',
          weight: 2,
          fillOpacity: 1
        });
        m.bindTooltip(`Via #${idx + 1}`, { direction: 'top' });
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
        const line = L.polyline(latlngs, {
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
          weight: isActive ? 5 : 3,
          opacity: isActive ? 0.95 : 0.42
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
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
      }
    }

    async function computeRoutes() {
      if (abortCtrl) abortCtrl.abort();
      routes.value = [];
      activeRouteIdx.value = 0;
      hoverInfo.value = null;
      errorDetail.value = '';

      const a = startStation.value;
      const b = endStation.value;

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

      routingStatus.value = 'loading';
      abortCtrl = new AbortController();

      try {
        const waypoints = [a, ...viaPoints.value, b];
        const result = await fetchBRouterAlternatives(waypoints, profile.value, abortCtrl.signal);
        routes.value = result;
        activeRouteIdx.value = 0;
        routingStatus.value = 'ready';
        drawRoutes(true);
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

    function initMap() {
      map = L.map('map', {
        center: [50.94, 15.64],
        zoom: 12,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: © OpenStreetMap contributors, SRTM | Style: © OpenTopoMap (CC-BY-SA)'
      }).addTo(map);

      waymarkedLayer = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
        maxZoom: 17,
        opacity: 0.78,
        attribution: '© Waymarked Trails'
      });
      if (showWaymarked.value) waymarkedLayer.addTo(map);

      railLayerGroup = L.layerGroup().addTo(map);
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

    watch([startId, endId, profile, () => viaPoints.value.length], () => {
      drawStations();
      drawViaPoints();
      computeRoutes();
    });

    watch(operatorFilter, () => {
      drawStations();
    });

    watch(showWaymarked, (val) => {
      if (!map || !waymarkedLayer) return;
      if (val) waymarkedLayer.addTo(map);
      else map.removeLayer(waymarkedLayer);
    });

    watch(showRailCorridors, () => {
      drawRailCorridors();
    });

    watch(activeRouteIdx, () => {
      drawRoutes(false);
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
      startId,
      endId,
      profile,
      viaMode,
      viaPoints,
      showWaymarked,
      showRailCorridors,
      routes,
      activeRouteIdx,
      activeRoute,
      routingStatus,
      errorDetail,
      hoverInfo,
      elevSvg,
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
      getMapyUrl,
      onElevMove,
      onElevLeave
    };
  }
}).mount('#app');
