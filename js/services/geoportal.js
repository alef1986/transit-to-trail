// Official Polish Regional Open-Data Integration:
// Geoportal Dolny Śląsk (UMWD) — ArcGIS REST GeoJSON (vector POIs) with WMS fallback

export const GEOPORTAL_WMS_LAYERS = [
  {
    id: 'culinary',
    baseUrl: 'https://geoportal.dolnyslask.pl/gpservices/UMWD_dziedzictwo_kulinarne/MapServer',
    url: 'https://geoportal.dolnyslask.pl/gpservices/UMWD_dziedzictwo_kulinarne/MapServer/WMSServer',
    layers: '0',
    icon: '🍽️',
    color: '#d97706',
    i18nKey: 'wmsCulinary'
  },
  {
    id: 'cultural',
    baseUrl: 'https://geoportal.dolnyslask.pl/gpservices/UMWD_Szlaki_kulturowe/MapServer',
    url: 'https://geoportal.dolnyslask.pl/gpservices/UMWD_Szlaki_kulturowe/MapServer/WMSServer',
    layers: '0',
    icon: '🏛️',
    color: '#7c3aed',
    i18nKey: 'wmsCultural'
  },
  {
    id: 'underground',
    baseUrl: 'https://geoportal.dolnyslask.pl/gpservices/UMWD_Szlaki_podziemne/MapServer',
    url: 'https://geoportal.dolnyslask.pl/gpservices/UMWD_Szlaki_podziemne/MapServer/WMSServer',
    layers: '0',
    icon: '⛏️',
    color: '#0f766e',
    i18nKey: 'wmsUnderground'
  },
  {
    id: 'agrotourism',
    baseUrl: 'https://geoportal.dolnyslask.pl/gpservices/UMWD_agro_zag/MapServer',
    url: 'https://geoportal.dolnyslask.pl/gpservices/UMWD_agro_zag/MapServer/WMSServer',
    layers: '0',
    icon: '🏡',
    color: '#15803d',
    i18nKey: 'wmsAgrotourism'
  }
];

export function createGeoportalWmsLayer(def) {
  return L.tileLayer.wms(def.url, {
    layers: def.layers,
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    opacity: 0.9,
    updateWhenIdle: true,
    updateWhenZooming: false,
    attribution: '© Geoportal Dolny Śląsk (UMWD)'
  });
}

export async function fetchGeoportalVectorGeoJson(def, signal) {
  const url = `${def.baseUrl}/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.features) || data.features.length === 0) {
    throw new Error('Empty vector layer');
  }
  return data;
}
