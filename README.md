# Transit-Trail Commons

**A lightweight, zero-build socio-technical framework for exploring regions by public transport—designed for minimal institutional overhead and maximum reuse of open data.**

**[Live Interactive Demonstrator](https://YOUR_USERNAME.github.io/transit-trail-commons/)** *(update link after enabling GitHub Pages)*

---

## Core Idea: Software as a Boundary Object

Most regional outdoor portals (such as *VGN Freizeit* in Franconia) rely on a heavy editorial model: a central team manually curates point-to-point tracks, negotiates cross-border updates, and maintains static landing pages. While effective within a single tariff union, this approach rarely scales across national borders or resource-constrained municipalities.

**Transit-Trail Commons** inverts this architecture. Instead of asking institutions to build a joint IT system or change their internal workflows, it aligns **data boundaries with existing institutional incentives**:

| Actor / Institution | Existing Asset & Interest | Minimal Contribution (No Workflow Change) |
| :--- | :--- | :--- |
| **Regional Rail & Bus Operators** *(e.g., KD, ČD, Trilex / ZVON)* | Attract off-peak leisure riders using existing cross-border tickets (*EURO-NEISSE-Ticket+*) | Publish standard open **GTFS / NeTEx** stops and schedules |
| **Hiking & Cycling NGOs / Volunteers** *(e.g., PTTK, KČT, Wandervereine)* | Maintain physical trail markings and attract responsible outdoor visitors | Keep trail networks updated in **OpenStreetMap** (`route=hiking` / `bicycle`) |
| **Municipalities & Local Businesses** | Promote regional heritage, viewpoints, and local gastronomy without running a CMS | Maintain lightweight, atomic **POI records** rather than full end-to-end GPX tours |
| **Client-Side Web App** | Zero-backend static interface deployable by any region | Dynamically combines stations and marked trails into station-to-station itineraries |

---

## Current Pilot: Neisse–Nysa–Nisa Euroregion (PL · CZ · DE)

The current demonstrator showcases the software layer across **Lower Silesia (Poland)**, **Northern Bohemia (Czechia)**, and **Upper Lusatia / Saxon Switzerland (Germany)**:

* **Station-to-Station Combined Routing:** Integrates **BRouter** (`hiking-mountain` and `trekking` profiles) to generate dynamic routes between any two railway stations, prioritizing official NGO-marked trails (`route=hiking`) while using local paths to bridge station access and trail junctions.
* **Cross-Border Rail Network:** Includes 130+ regional stations across *Koleje Dolnośląskie (KD)*, *České dráhy (ČD)*, and *Trilex / ZVON*.
* **Topographic & Trail Context:** Built on **OpenTopoMap** relief tiles paired with the **Waymarked Trails** vector overlay.
* **Interactive Telemetry & Export:** Real-time SVG elevation profile synced with the map, surface breakdown (marked trails vs. forest paths vs. paved), custom via-points (`Shift + Click`), and client-side **GPX 1.1** export.
* **Multilingual by Design:** Instant switching between **Polish (PL)**, **Czech (CS)**, **German (DE)**, and **English (EN)**.

---

## Architecture & Portability

The prototype is intentionally implemented as a **zero-build single-page application** (`index.html`) using Vue 3 (ES modules), Leaflet, and Turf.js:

* **Zero Server Maintenance:** Runs entirely on static hosting (GitHub Pages, BunnyCDN, or any municipal web server) with no database or backend runtime to patch.
* **Forkable Regional Blueprint:** Any region, national park, or volunteer group can adapt the demonstrator to their own territory simply by swapping the station dataset (`stops.txt` / GeoJSON) and map bounding box.

---

## Roadmap

1. **Corridor POI Layer:** Integrate lightweight municipal and cultural Points of Interest within a configurable buffer of generated routes, allowing users to add detours (*"+1.2 km / +20 min via viewpoint or local brewery"*) without requiring municipalities to author full tracks.
2. **Cycling & Multimodal Transit:** Extend routing profiles to regional bus stops and EuroVelo / local cycling corridors.
3. **Institutional Governance Playbook:** Document lightweight bilateral agreements and open-data interfaces for cross-border regional associations.

---

## Data & Attribution

* **Base Map & Relief:** [OpenTopoMap](https://opentopomap.org/) (`CC-BY-SA`) & [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (`ODbL`)
* **Marked Trail Overlay:** [Waymarked Trails](https://hiking.waymarkedtrails.org/)
* **Routing Engine:** [BRouter](https://brouter.de/)
* **Concept & Architecture:** Alexander Efremov ([Efremov Systems](https://efremov-systems.com))
