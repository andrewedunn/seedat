// ABOUTME: Parcel map: MapLibre over an OpenFreeMap basemap, parcels from /tiles/parcels.pmtiles, highlighted by the
// ABOUTME: chosen layer (GEOPIN list from /api/layer). Clicking a parcel shows a card linking to its property page.
(() => {
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  const css = getComputedStyle(document.documentElement);
  const cobalt = css.getPropertyValue("--cobalt").trim() || "#1f4c8f";
  const amber = css.getPropertyValue("--amber").trim() || "#d9822b";

  const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/positron",
    center: [-90.0715, 29.9511], zoom: 12.5, minZoom: 10, maxZoom: 19,
    attributionControl: { compact: true, customAttribution: "Parcels: City of New Orleans" },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  let highlighted = [];
  const countEl = document.querySelector(".map-count");
  const card = document.querySelector(".map-card");

  // Zoomed out, small parcels are dropped from the tiles, so highlighted parcels also draw as dots until z15.
  // Each request gets a sequence number; a slower, older response never overwrites a newer choice.
  let layerSeq = 0;
  async function showLayer(name) {
    const mine = ++layerSeq;
    countEl.textContent = "Loading…";
    let rows;
    try {
      const res = await fetch(`/api/layer?name=${name}`);
      if (!res.ok) throw new Error(String(res.status));
      rows = await res.json();
    } catch {
      if (mine === layerSeq) countEl.textContent = "Couldn’t load this layer. Choose it again to retry.";
      return;
    }
    if (mine !== layerSeq) return;
    for (const id of highlighted) map.setFeatureState({ source: "parcels", sourceLayer: "parcels", id }, { on: false });
    for (const [id] of rows) map.setFeatureState({ source: "parcels", sourceLayer: "parcels", id }, { on: true });
    highlighted = rows.map((r) => r[0]);
    map.getSource("dots").setData({
      type: "FeatureCollection",
      features: rows.map(([id, lat, lon]) => ({ type: "Feature", id, properties: { geopin: id }, geometry: { type: "Point", coordinates: [lon, lat] } })),
    });
    countEl.textContent = `${rows.length.toLocaleString()} parcels`;
  }

  map.on("load", () => {
    map.addSource("parcels", { type: "vector", url: `pmtiles://${location.origin}/tiles/parcels.pmtiles`, promoteId: "geopin" });
    map.addLayer({
      id: "parcel-fill", type: "fill", source: "parcels", "source-layer": "parcels",
      paint: { "fill-color": ["case", ["boolean", ["feature-state", "on"], false], amber, cobalt], "fill-opacity": ["case", ["boolean", ["feature-state", "on"], false], 0.75, 0.06] },
    });
    map.addSource("dots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "dots", type: "circle", source: "dots", maxzoom: 15,
      paint: { "circle-color": amber, "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 14, 4], "circle-opacity": 0.85 },
    });
    map.addLayer({
      id: "parcel-line", type: "line", source: "parcels", "source-layer": "parcels", minzoom: 14,
      paint: {
        "line-color": ["case", ["boolean", ["feature-state", "sel"], false], "#111", cobalt],
        "line-opacity": ["case", ["boolean", ["feature-state", "sel"], false], 1, 0.35],
        "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 3, 0.5],
      },
    });
    const chosen = () => document.querySelector('input[name="layer"]:checked').value;
    document.querySelectorAll('input[name="layer"]').forEach((r) => r.addEventListener("change", () => showLayer(chosen())));
    map.once("idle", () => showLayer(chosen()));

    const fromHash = () => {
      const hash = location.hash.slice(1);
      if (/^\d{8}$/.test(hash)) openCard(Number(hash), true);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
  });

  let selected = null, cardSeq = 0;
  async function openCard(geopin, fly) {
    const mine = ++cardSeq;
    let r;
    try {
      const res = await fetch(`/api/parcel/${geopin}`);
      if (!res.ok) return;
      r = await res.json();
    } catch { return; }
    if (mine !== cardSeq) return;   // a newer click is already loading
    if (selected !== null) map.setFeatureState({ source: "parcels", sourceLayer: "parcels", id: selected }, { sel: false });
    selected = geopin;
    map.setFeatureState({ source: "parcels", sourceLayer: "parcels", id: geopin }, { sel: true });
    const h = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = r.address || r.situs || `Parcel ${geopin}`;
    const facts = document.createElement("p");
    facts.textContent = [r.zoning && `Zoned ${r.zoning}`, r.local_historic_district && `${r.local_historic_district} (${r.hdlc_control} control)`].filter(Boolean).join(" · ");
    const activity = document.createElement("p");
    activity.textContent = `${r.permits_total ?? 0} permits (${r.permits_open ?? 0} open) · ${r.code_cases_open ?? 0} open code cases${r.str_active ? " · active STR license" : ""}`;
    const link = document.createElement("a");
    link.href = `/p/${geopin}`;
    link.textContent = "Everything on record here →";
    h.append(title, facts, activity, link);
    card.replaceChildren(h);
    card.hidden = false;
    if (fly && r.lat && r.lon) map.flyTo({ center: [r.lon, r.lat], zoom: 17 });
  }

  map.on("click", "dots", (e) => {
    const f = e.features && e.features[0];
    if (f) { history.replaceState(null, "", `#${f.properties.geopin}`); openCard(f.properties.geopin, false); }
  });
  map.on("click", "parcel-fill", (e) => {
    const f = e.features && e.features[0];
    if (f) { history.replaceState(null, "", `#${f.id}`); openCard(f.id, false); }
  });
  map.on("mouseenter", "parcel-fill", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "parcel-fill", () => { map.getCanvas().style.cursor = ""; });
})();
