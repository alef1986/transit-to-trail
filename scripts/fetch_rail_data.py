#!/usr/bin/env python3
"""
Transit-Trail Commons — Railway Geometry & Station Updater
==========================================================
Fetches real curved railway tracks (main, branch, narrow_gauge) and passenger
stations/halts for the Neisse–Nysa–Nisa cross-border region (Lower Silesia,
Saxony, Northern Bohemia) from OpenStreetMap via Overpass API.

Zero external dependencies (uses Python standard library only).

Usage:
    python scripts/fetch_rail_data.py
    python scripts/fetch_rail_data.py --keep-existing-stations-only
"""

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# Bounding box covering Lower Silesia (PL), Northern Bohemia (CZ), Upper Lusatia & Saxon Switzerland (DE)
# Format: (south, west, north, east)
BBOX = (50.05, 13.95, 51.35, 17.15)

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
STATIONS_JS_PATH = os.path.join(PROJECT_ROOT, "js", "data", "stations.js")
RAIL_LINES_JS_PATH = os.path.join(PROJECT_ROOT, "js", "data", "railLines.js")


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def point_line_distance(pt, start, end):
    if start == end:
        return math.hypot(pt[0] - start[0], pt[1] - start[1])
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    t = ((pt[0] - start[0]) * dx + (pt[1] - start[1]) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    proj_x = start[0] + t * dx
    proj_y = start[1] + t * dy
    return math.hypot(pt[0] - proj_x, pt[1] - proj_y)


def douglas_peucker(points, epsilon=0.00045):
    """Simplify polyline while preserving smooth curves (~40m tolerance at 50°N)."""
    if len(points) < 3:
        return points
    dmax = 0.0
    index = 0
    end = len(points) - 1
    for i in range(1, end):
        d = point_line_distance(points[i], points[0], points[end])
        if d > dmax:
            index = i
            dmax = d
    if dmax > epsilon:
        left = douglas_peucker(points[: index + 1], epsilon)
        right = douglas_peucker(points[index:], epsilon)
        return left[:-1] + right
    return [points[0], points[end]]


def query_overpass(ql_query, timeout=90):
    data = urllib.parse.urlencode({"data": ql_query}).encode("utf-8")
    last_err = None
    for mirror in OVERPASS_MIRRORS:
        print(f"  -> Querying {mirror} ...")
        req = urllib.request.Request(
            mirror,
            data=data,
            headers={
                "User-Agent": "TransitTrailCommons/1.0 (https://github.com/alef1986/transit-to-trail)"
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            print(f"     Mirror failed: {exc}")
            last_err = exc
            time.sleep(2)
    raise RuntimeError(f"All Overpass mirrors failed: {last_err}")


def stitch_ways(ways_coords):
    """
    Merge adjacent OSM railway way coordinate lists into longer continuous polylines
    whenever endpoints match (within ~1e-5 deg).
    """
    def pt_key(pt):
        return (round(pt[0], 5), round(pt[1], 5))

    unused = [list(w) for w in ways_coords if len(w) >= 2]
    stitched = []

    while unused:
        current = unused.pop()
        extended = True
        while extended:
            extended = False
            head = pt_key(current[0])
            tail = pt_key(current[-1])
            for i in range(len(unused) - 1, -1, -1):
                cand = unused[i]
                c_head = pt_key(cand[0])
                c_tail = pt_key(cand[-1])
                if tail == c_head:
                    current.extend(cand[1:])
                    unused.pop(i)
                    extended = True
                    tail = pt_key(current[-1])
                elif tail == c_tail:
                    current.extend(reversed(cand[:-1]))
                    unused.pop(i)
                    extended = True
                    tail = pt_key(current[-1])
                elif head == c_tail:
                    current = cand[:-1] + current
                    unused.pop(i)
                    extended = True
                    head = pt_key(current[0])
                elif head == c_head:
                    current = list(reversed(cand[1:])) + current
                    unused.pop(i)
                    extended = True
                    head = pt_key(current[0])
        stitched.append(current)
    return stitched


def load_existing_stations():
    """Parse existing js/data/stations.js to preserve all curated IDs & presets."""
    if not os.path.exists(STATIONS_JS_PATH):
        return []
    with open(STATIONS_JS_PATH, "r", encoding="utf-8") as f:
        text = f.read()

    stations = []
    # Match single-line station objects: { id: '...', name: '...', ... }
    pattern = re.compile(
        r"\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*operator:\s*'([^']+)',"
        r"\s*country:\s*'([^']+)',\s*lines:\s*'([^']*)',\s*lat:\s*([0-9.\-]+),\s*lon:\s*([0-9.\-]+)\s*\}"
    )
    for m in pattern.finditer(text):
        stations.append(
            {
                "id": m.group(1),
                "name": m.group(2),
                "operator": m.group(3),
                "country": m.group(4),
                "lines": m.group(5),
                "lat": float(m.group(6)),
                "lon": float(m.group(7)),
            }
        )
    return stations


def guess_operator_by_nearest_station(lat, lon, stations):
    best_op = "KD"
    best_d = 1e9
    for st in stations:
        d = (st["lat"] - lat) ** 2 + (st["lon"] - lon) ** 2
        if d < best_d:
            best_d = d
            best_op = st["operator"]
    return best_op


def slugify(text):
    repl = {
        "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
        "á": "a", "č": "c", "ď": "d", "é": "e", "ě": "e", "í": "i", "ň": "n", "ř": "r", "š": "s",
        "ť": "t", "ú": "u", "ů": "u", "ý": "y", "ž": "z",
        "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
    }
    s = text.lower()
    for k, v in repl.items():
        s = s.replace(k, v)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "station"


def main():
    parser = argparse.ArgumentParser(description="Fetch curved OSM rail lines & stations")
    parser.add_argument(
        "--keep-existing-stations-only",
        action="store_true",
        help="Only update js/data/railLines.js without adding new OSM stations",
    )
    parser.add_argument(
        "--epsilon",
        type=float,
        default=0.00045,
        help="Douglas-Peucker simplification tolerance in degrees (default: 0.00045 ≈ 40m)",
    )
    args = parser.parse_args()

    existing_stations = load_existing_stations()
    print(f"Loaded {len(existing_stations)} curated stations from {STATIONS_JS_PATH}")

    s, w, n, e = BBOX
    print(f"\n[1/3] Fetching passenger railway geometry in bbox ({s}, {w}, {n}, {e})...")
    rail_ql = f"""
    [out:json][timeout:90];
    (
      way["railway"="rail"]["usage"~"^(main|branch)$"]["service"!~"."]({s},{w},{n},{e});
      way["railway"="narrow_gauge"]["passenger"!="no"]["service"!~"."]({s},{w},{n},{e});
    );
    out geom;
    """
    rail_data = query_overpass(rail_ql)
    elements = rail_data.get("elements", [])
    print(f"  Received {len(elements)} raw OSM railway ways.")

    # Group ways by inferred operator using midpoint nearest station
    grouped_ways = {"KD": [], "CD": [], "Trilex": []}
    raw_vertices = 0
    for el in elements:
        geom = el.get("geometry")
        if not geom or len(geom) < 2:
            continue
        coords = [[round(pt["lat"], 5), round(pt["lon"], 5)] for pt in geom]
        raw_vertices += len(coords)

        tags = el.get("tags", {})
        op_tag = (tags.get("operator") or "").lower()
        mid = coords[len(coords) // 2]
        if "pkp" in op_tag or "dolnośląsk" in op_tag or "dsdik" in op_tag:
            op = "KD"
        elif "správa železnic" in op_tag or "szdc" in op_tag or "čd" in op_tag:
            op = "CD"
        elif "db " in op_tag or "soeg" in op_tag or "trilex" in op_tag:
            op = "Trilex"
        else:
            op = guess_operator_by_nearest_station(mid[0], mid[1], existing_stations)

        grouped_ways[op].append(coords)

    print("\n[2/3] Stitching & simplifying curved railway corridors...")
    corridors_out = []
    op_labels = {
        "KD": "Lower Silesia Regional Rail Network (PL · PKP / DSDiK / KD)",
        "CD": "Northern Bohemia Regional Rail Network (CZ · SŽ / ČD)",
        "Trilex": "Upper Lusatia & Saxon Switzerland Rail Network (DE · DB / SOEG / Trilex)",
    }

    total_final_vertices = 0
    for op in ("KD", "CD", "Trilex"):
        stitched = stitch_ways(grouped_ways[op])
        simplified_segments = []
        for seg in stitched:
            simp = douglas_peucker(seg, epsilon=args.epsilon)
            # Filter out tiny isolated yard stubs (< 350m)
            if len(simp) >= 2 and haversine_km(simp[0][0], simp[0][1], simp[-1][0], simp[-1][1]) >= 0.35:
                rounded = [[round(p[0], 5), round(p[1], 5)] for p in simp]
                simplified_segments.append(rounded)
                total_final_vertices += len(rounded)
        print(f"  {op:6s}: {len(grouped_ways[op]):4d} raw ways -> {len(simplified_segments):3d} stitched curved segments")
        corridors_out.append(
            {
                "name": op_labels[op],
                "operator": op,
                "segments": simplified_segments,
            }
        )

    print(f"  Vertices simplified: {raw_vertices} -> {total_final_vertices}")

    # Write js/data/railLines.js
    with open(RAIL_LINES_JS_PATH, "w", encoding="utf-8") as f:
        f.write("// Auto-generated by scripts/fetch_rail_data.py from OpenStreetMap (Overpass API)\n")
        f.write("export const RAIL_CORRIDORS = ")
        json.dump(corridors_out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    size_kb = os.path.getsize(RAIL_LINES_JS_PATH) / 1024
    print(f"  Saved {RAIL_LINES_JS_PATH} ({size_kb:.1f} KB)")

    if args.keep_existing_stations_only:
        print("\nSkipping station discovery (--keep-existing-stations-only). Done!")
        return

    print("\n[3/3] Fetching regional passenger stations & halts from OSM...")
    st_ql = f"""
    [out:json][timeout:60];
    (
      node["railway"~"^(station|halt)$"]["name"]({s},{w},{n},{e});
    );
    out body;
    """
    st_data = query_overpass(st_ql)
    osm_nodes = st_data.get("elements", [])
    print(f"  Received {len(osm_nodes)} OSM station/halt nodes.")

    # Flatten a sparse sample of track points to ensure we only keep stations on active passenger tracks
    track_pts = []
    for corr in corridors_out:
        for seg in corr["segments"]:
            track_pts.extend(seg[::2])

    merged = list(existing_stations)
    used_ids = {st["id"] for st in merged}
    added_count = 0

    for node in osm_nodes:
        tags = node.get("tags", {})
        if tags.get("disused") == "yes" or tags.get("abandoned") == "yes":
            continue
        if tags.get("station") in ("subway", "light_rail", "miniature"):
            continue
        name = (tags.get("name") or "").strip()
        if not name:
            continue
        lat = round(float(node["lat"]), 5)
        lon = round(float(node["lon"]), 5)

        # Skip if already within 0.45 km of an existing station
        if any(haversine_km(lat, lon, ex["lat"], ex["lon"]) < 0.45 for ex in merged):
            continue

        # Keep only if within 0.35 km of an active fetched passenger rail segment
        near_track = any(
            abs(lat - tp[0]) < 0.005 and abs(lon - tp[1]) < 0.008
            for tp in track_pts
        )
        if not near_track:
            continue

        op = guess_operator_by_nearest_station(lat, lon, existing_stations)
        country = {"KD": "PL", "CD": "CZ", "Trilex": "DE"}[op]
        prefix = country.lower()
        base_id = f"{prefix}-{slugify(name)}"
        st_id = base_id
        suffix = 2
        while st_id in used_ids:
            st_id = f"{base_id}-{suffix}"
            suffix += 1
        used_ids.add(st_id)

        merged.append(
            {
                "id": st_id,
                "name": name,
                "operator": op,
                "country": country,
                "lines": "OSM",
                "lat": lat,
                "lon": lon,
            }
        )
        added_count += 1

    merged.sort(key=lambda x: (x["country"], x["name"]))
    with open(STATIONS_JS_PATH, "w", encoding="utf-8") as f:
        f.write("// Curated + OSM passenger stations (updated by scripts/fetch_rail_data.py)\n")
        f.write("export const STATIONS = [\n")
        for st in merged:
            safe_name = st["name"].replace("'", "\\'")
            safe_lines = st["lines"].replace("'", "\\'")
            f.write(
                f"  {{ id: '{st['id']}', name: '{safe_name}', operator: '{st['operator']}', "
                f"country: '{st['country']}', lines: '{safe_lines}', lat: {st['lat']}, lon: {st['lon']} }},\n"
            )
        f.write("];\n")

    print(f"  Added {added_count} new stations (total: {len(merged)}) -> {STATIONS_JS_PATH}")
    print("\nAll done! Refresh your local server or push to GitHub Pages.")


if __name__ == "__main__":
    main()
