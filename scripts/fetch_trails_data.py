#!/usr/bin/env python3
"""
Transit-Trail Commons — Hiking Trails Static Dataset Builder
=============================================================
Fetches official marked hiking routes (route=hiking) across the Neisse–Nysa–Nisa
cross-border region (Lower Silesia, Saxony, Northern Bohemia) from OpenStreetMap
via Overpass API, stitches member ways into simplified polylines, generates
human-readable labels even when OSM `name` is empty, and writes
`js/data/hikingTrails.js` for fast, CORS-free client-side lookup, map preview,
and route steering.

Zero external dependencies (uses Python standard library only).

Usage:
    python scripts/fetch_trails_data.py
    python scripts/fetch_trails_data.py --max-trails 250 --epsilon 0.0005
"""

import argparse
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request

# Bounding box covering Lower Silesia (PL), Northern Bohemia (CZ), Upper Lusatia & Saxon Switzerland (DE)
# Format: (south, west, north, east)
BBOX = (50.08, 13.98, 51.32, 17.05)

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUT_JS_PATH = os.path.join(PROJECT_ROOT, "js", "data", "hikingTrails.js")

COLOR_HEX = {
    "red": "#dc2626",
    "blue": "#2563eb",
    "green": "#16a34a",
    "yellow": "#eab308",
    "black": "#1e293b",
    "orange": "#ea580c",
    "purple": "#7c3aed",
    "brown": "#92400e",
    "white": "#e2e8f0",
}


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


def douglas_peucker(points, epsilon=0.0005):
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


def stitch_way_segments(way_lists):
    """Stitch [lat, lon] way coordinate arrays into continuous polylines."""
    def key(pt):
        return (round(pt[0], 5), round(pt[1], 5))

    pool = [list(w) for w in way_lists if len(w) >= 2]
    lines = []

    while pool:
        cur = pool.pop()
        grew = True
        while grew:
            grew = False
            h = key(cur[0])
            t = key(cur[-1])
            for i in range(len(pool) - 1, -1, -1):
                cand = pool[i]
                ch = key(cand[0])
                ct = key(cand[-1])
                if t == ch:
                    cur.extend(cand[1:])
                    pool.pop(i)
                    grew = True
                    t = key(cur[-1])
                elif t == ct:
                    cur.extend(reversed(cand[:-1]))
                    pool.pop(i)
                    grew = True
                    t = key(cur[-1])
                elif h == ct:
                    cur = cand[:-1] + cur
                    pool.pop(i)
                    grew = True
                    h = key(cur[0])
                elif h == ch:
                    cur = list(reversed(cand[1:])) + cur
                    pool.pop(i)
                    grew = True
                    h = key(cur[0])
        lines.append(cur)
    return lines


def query_overpass(ql, timeout=120):
    payload = urllib.parse.urlencode({"data": ql}).encode("utf-8")
    last_err = None
    for mirror in OVERPASS_MIRRORS:
        print(f"  -> Querying {mirror} ...")
        req = urllib.request.Request(
            mirror,
            data=payload,
            headers={
                "User-Agent": "TransitTrailCommons-TrailBuilder/1.0 (https://github.com/alef1986/transit-to-trail)"
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


def detect_color_and_label(tags, rel_id):
    name = (tags.get("name") or "").strip()
    ref = (tags.get("ref") or "").strip()
    osmc = (tags.get("osmc:symbol") or "").lower()
    colour = (tags.get("colour") or tags.get("color") or "").lower()

    detected_color = None
    for c_name in COLOR_HEX:
        if c_name in colour or c_name in osmc.split(":")[0:1]:
            detected_color = c_name
            break
    if not detected_color:
        for c_name in COLOR_HEX:
            if f":{c_name}" in osmc or f"{c_name}:" in osmc or c_name in name.lower():
                detected_color = c_name
                break

    if not detected_color:
        low_n = name.lower()
        if "czerwon" in low_n or "červen" in low_n or "rot" in low_n:
            detected_color = "red"
        elif "niebiesk" in low_n or "modr" in low_n or "blau" in low_n:
            detected_color = "blue"
        elif "zielon" in low_n or "zelen" in low_n or "grün" in low_n:
            detected_color = "green"
        elif "żółt" in low_n or "žlut" in low_n or "gelb" in low_n:
            detected_color = "yellow"
        elif "czarn" in low_n or "čern" in low_n or "schwarz" in low_n:
            detected_color = "black"

    hex_color = COLOR_HEX.get(detected_color, "#d4af37")

    if name:
        label = name if not ref or ref in name else f"{name} ({ref})"
    elif ref:
        label = f"Trail {ref}"
    elif detected_color:
        label = f"{detected_color.capitalize()} marked trail #{rel_id}"
    else:
        label = f"Hiking trail #{rel_id}"

    # Determine network rank (local/regional preferred over continental)
    net = (tags.get("network") or "").lower()
    if "lwn" in net or "local" in net:
        rank = 1
    elif "rwn" in net or "regional" in net:
        rank = 2
    elif "nwn" in net or "national" in net:
        rank = 3
    elif "iwn" in net or "international" in net:
        rank = 4
    else:
        rank = 5

    return label, hex_color, rank


def main():
    parser = argparse.ArgumentParser(description="Build static hikingTrails.js from OSM")
    parser.add_argument("--max-trails", type=int, default=220, help="Max trails to keep (default: 220)")
    parser.add_argument("--epsilon", type=float, default=0.00055, help="Simplification tolerance in deg")
    args = parser.parse_args()

    s, w, n, e = BBOX
    print(f"Fetching route=hiking relations with geometry in bbox ({s}, {w}, {n}, {e})...")
    ql = f"""
    [out:json][timeout:120];
    relation["route"="hiking"]({s},{w},{n},{e});
    out body geom;
    """
    data = query_overpass(ql)
    elements = data.get("elements", [])
    print(f"Received {len(elements)} OSM hiking relations.")

    trails = []
    for el in elements:
        if el.get("type") != "relation":
            continue
        rel_id = el.get("id")
        tags = el.get("tags", {})
        members = el.get("members", [])

        way_lists = []
        for m in members:
            if m.get("type") == "way" and m.get("role") not in ("alternate", "subroute"):
                geom = m.get("geometry")
                if geom and len(geom) >= 2:
                    way_lists.append([[round(pt["lat"], 5), round(pt["lon"], 5)] for pt in geom])

        if not way_lists:
            continue

        stitched = stitch_way_segments(way_lists)
        segments = []
        total_len_km = 0.0
        min_lat, min_lon, max_lat, max_lon = 90.0, 180.0, -90.0, -180.0

        for line in stitched:
            simp = douglas_peucker(line, epsilon=args.epsilon)
            if len(simp) < 2:
                continue
            seg_len = 0.0
            for i in range(1, len(simp)):
                seg_len += haversine_km(simp[i - 1][0], simp[i - 1][1], simp[i][0], simp[i][1])
            if seg_len >= 0.25:
                total_len_km += seg_len
                for pt in simp:
                    if pt[0] < min_lat: min_lat = pt[0]
                    if pt[0] > max_lat: max_lat = pt[0]
                    if pt[1] < min_lon: min_lon = pt[1]
                    if pt[1] > max_lon: max_lon = pt[1]
                segments.append(simp)

        if not segments or total_len_km < 0.5:
            continue

        label, hex_color, rank = detect_color_and_label(tags, rel_id)
        trails.append({
            "id": rel_id,
            "name": label,
            "color": hex_color,
            "rank": rank,
            "lenKm": round(total_len_km, 1),
            "bbox": [round(min_lat, 4), round(min_lon, 4), round(max_lat, 4), round(max_lon, 4)],
            "segments": segments,
        })

    # Sort so local/regional named trails come first and trim to max-trails
    trails.sort(key=lambda t: (t["rank"], 0 if not t["name"].startswith("Hiking trail #") else 1, -t["lenKm"]))
    trails = trails[: args.max_trails]
    for item in trails:
        del item["rank"]

    with open(OUT_JS_PATH, "w", encoding="utf-8") as f:
        f.write("// Pre-extracted static hiking trails dataset generated by scripts/fetch_trails_data.py\n")
        f.write("// Source: OpenStreetMap (route=hiking relations, ODbL)\n")
        f.write("export const HIKING_TRAILS = ")
        json.dump(trails, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    size_kb = os.path.getsize(OUT_JS_PATH) / 1024
    print(f"Wrote {len(trails)} trails to {OUT_JS_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
