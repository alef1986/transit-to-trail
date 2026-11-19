// Effort levels: 'high' (88%, #dc2626), 'medium' (55%, #d97706), 'low' (24%, #16a34a), 'passive' (10%, #38bdf8)
export const EFFORT_STYLE = {
  high: { pct: 88, color: '#ef4444' },
  medium: { pct: 55, color: '#f59e0b' },
  low: { pct: 24, color: '#22c55e' },
  passive: { pct: 10, color: '#38bdf8' }
};

export const STAKEHOLDERS = [
  {
    id: 'university',
    x: 435,
    y: 108,
    isCoUser: false,
    effort: { pilot: 'high', ops: 'passive' },
    i18n: {
      en: {
        short: 'University (R&D)',
        title: 'University & Research Consortium',
        role: 'R&D General Contractor',
        contribute: {
          pilot: 'Carries the main build load: applies for EU funding, orchestrates Systems Engineering, Sociology, CS, and Management teams to deliver the pilot and institutional playbook.',
          ops: 'Steps back from daily operations — uses live anonymised telemetry for follow-up publications, theses, and mentoring new regions.'
        },
        gain: 'Flagship interdisciplinary EU grant, real-world empirical laboratory, high-impact publications, and hands-on student projects.',
        avoid: 'No permanent IT helpdesk or long-term operational liability after the grant ends.'
      },
      pl: {
        short: 'Uczelnia (R&D)',
        title: 'Uczelnia i konsorcjum badawcze',
        role: 'Generalny wykonawca R&D',
        contribute: {
          pilot: 'Bierze główny ciężar wdrożenia: składa wniosek o grant UE, koordynuje zespoły inżynierii systemów, socjologii, informatyki i zarządzania.',
          ops: 'Wychodzi z bieżącej obsługi — korzysta z otwartych danych do publikacji naukowych, prac dyplomowych i wspierania kolejnych regionów.'
        },
        gain: 'Prestiżowy interdyscyplinarny grant UE, żywy poligon badawczy, publikacje i realne projekty dla studentów.',
        avoid: 'Brak obowiązku utrzymywania działu IT i kosztów serwerowych po zakończeniu grantu.'
      },
      cs: {
        short: 'Univerzita (R&D)',
        title: 'Univerzita a výzkumné konsorcium',
        role: 'Hlavní řešitel R&D',
        contribute: {
          pilot: 'Nese hlavní zátěž vývoje: podává grant EU, koordinuje týmy systémového inženýrství, sociologie, informatiky a managementu.',
          ops: 'Ustupuje z běžného provozu — využívá data pro výzkum, diplomové práce a metodickou pomoc dalším regionům.'
        },
        gain: 'Mezioborový grant EU, živá laboratoř pro výzkum a prestižní praktické projekty pro studenty.',
        avoid: 'Žádná dlouhodobá provozní zátěž ani údržba těžké IT infrastruktury po skončení projektu.'
      },
      de: {
        short: 'Universität (F&E)',
        title: 'Universität & Forschungskonsortium',
        role: 'F&E-Generalunternehmer',
        contribute: {
          pilot: 'Trägt die Hauptlast der Entwicklung: beantragt EU-Fördermittel und orchestriert Systems Engineering, Soziologie, Informatik und Management.',
          ops: 'Zieht sich aus dem Tagesbetrieb zurück — nutzt das System als empirisches Labor für Publikationen und Abschlussarbeiten.'
        },
        gain: 'Interdisziplinäres EU-Leuchtturmprojekt, reale Feldforschung und praxisnahe Studierendenprojekte.',
        avoid: 'Keine dauerhafte IT-Betreuung oder Serverkosten nach Ablauf der Förderperiode.'
      }
    }
  },
  {
    id: 'sponsors',
    x: 280,
    y: 56,
    isCoUser: false,
    effort: { pilot: 'medium', ops: 'passive' },
    i18n: {
      en: {
        short: 'EU & Sponsors',
        title: 'EU Funds & Regional Sponsors',
        role: 'Funder (Interreg / Horizon)',
        contribute: {
          pilot: 'Funds the initial R&D pilot and cross-border institutional coordination through existing Interreg PL–SN / CZ–PL or Horizon Europe streams.',
          ops: 'Zero ongoing subsidy required — the zero-backend static architecture sustains itself at negligible hosting cost.'
        },
        gain: 'Two-stage return: an immediate working tool for the Euroregion PLUS a forkable, zero-lock-in blueprint reusable across all EU borderlands.',
        avoid: 'Avoids the classic EU-grant trap of expensive custom portals that die the day funding stops.'
      },
      pl: {
        short: 'UE i Sponsorzy',
        title: 'Fundusze UE i sponsorzy regionalni',
        role: 'Finansowanie (Interreg / Horyzont)',
        contribute: {
          pilot: 'Finansuje etap R&D, pilotaż w regionie i wypracowanie lekkich porozumień między instytucjami.',
          ops: 'Zero stałych dotacji na utrzymanie — architektura statyczna bez backendu działa przy minimalnym koszcie.'
        },
        gain: 'Podwójny efekt: działające narzędzie dla regionu ORAZ otwarty, skalowalny framework dla innych regionów przygranicznych UE.',
        avoid: 'Unika typowej pułapki drogich portali grantowych, które umierają dzień po zakończeniu finansowania.'
      },
      cs: {
        short: 'EU a Sponzoři',
        title: 'Fondy EU a regionální sponzoři',
        role: 'Financování (Interreg / Horizont)',
        contribute: {
          pilot: 'Financuje vývoj pilotního řešení a přeshraniční koordinaci z programů Interreg nebo Horizont Evropa.',
          ops: 'Nevyžaduje trvalé provozní dotace — statická architektura bez serveru má téměř nulové náklady.'
        },
        gain: 'Dvoukrokový přínos: funkční nástroj pro region PLUS škálovatelná metodika pro další evropské příhraniční regiony.',
        avoid: 'Předchází typickému riziku drahých grantových portálů, které zaniknou po skončení dotace.'
      },
      de: {
        short: 'EU & Förderer',
        title: 'EU-Fonds & Regionale Förderer',
        role: 'Fördergeber (Interreg / Horizon)',
        contribute: {
          pilot: 'Finanziert die F&E-Pilotphase und die grenzüberschreitende Abstimmung über Interreg oder Horizon Europe.',
          ops: 'Keine laufenden Betriebszuschüsse nötig — die statische Zero-Backend-Architektur läuft nahezu kostenfrei.'
        },
        gain: 'Zweistufiger Nutzen: ein sofort nutzbares Werkzeug für die Euroregion PLUS eine skalierbare Blaupause für ganz Europa.',
        avoid: 'Vermeidet teure Förderportale, die mangels Wartungsbudget nach Projektende abgeschaltet werden.'
      }
    }
  },
  {
    id: 'rail',
    x: 125,
    y: 108,
    isCoUser: true,
    effort: { pilot: 'low', ops: 'low' },
    i18n: {
      en: {
        short: 'Rail Operators',
        title: 'Rail Operators (KD, ČD, Trilex)',
        role: 'Co-User & Open-Data Provider',
        contribute: {
          pilot: 'Confirms open GTFS/NeTEx station feeds and cross-border tariff hints (EURO-NEISSE-Ticket+).',
          ops: 'Continues publishing standard GTFS schedules (already mandated by EU ITS directives). Zero extra editorial work.'
        },
        gain: 'Actively uses the platform as a leisure-demand engine: fills empty weekend/off-peak seats and makes cross-border tickets visible in one place.',
        avoid: 'No need to build a proprietary tourism portal or negotiate custom API integrations with neighbouring countries.'
      },
      pl: {
        short: 'Kolej (KD/ČD/DE)',
        title: 'Przewoźnicy kolejowi (KD, ČD, Trilex)',
        role: 'Współużytkownik i dostawca danych',
        contribute: {
          pilot: 'Wskazuje otwarte źródła GTFS/NeTEx oraz zasady istniejących biletów transgranicznych (EURO-NEISSE-Ticket+).',
          ops: 'Dalej publikuje standardowy rozkład GTFS (wymagany dyrektywami UE). Zero prac redakcyjnych.'
        },
        gain: 'Używa platformy jako darmowego kanału pozyskiwania pasażerów: zapełnia pociągi w weekendy i poza szczytem, promując bilety sieciowe.',
        avoid: 'Nie musi budować własnego portalu turystycznego ani ręcznie aktualizować opisów szlaków.'
      },
      cs: {
        short: 'Dopravci (ČD/KD)',
        title: 'Železniční dopravci (KD, ČD, Trilex)',
        role: 'Spoluuživatel a poskytovatel dat',
        contribute: {
          pilot: 'Potvrdí otevřené zdroje GTFS/NeTEx a informace o stávajících přeshraničních jízdenkách.',
          ops: 'Nadále publikuje standardní data GTFS bez jakékoli redakční práce navíc.'
        },
        gain: 'Využívá platformu k přilákání víkendových a volnočasových cestujících do regionálních vlaků.',
        avoid: 'Nemusí vyvíjet vlastní turistický portál ani spravovat pěší trasy.'
      },
      de: {
        short: 'Bahnen (KD/ČD/DE)',
        title: 'Bahnbetreiber (KD, ČD, Trilex)',
        role: 'Mitnutzer & Datenlieferant',
        contribute: {
          pilot: 'Stellt Verweise auf bestehende GTFS/NeTEx-Daten und Tarife (EURO-NEISSE-Ticket+) bereit.',
          ops: 'Pflegt weiterhin nur den regulären GTFS-Fahrplan — null zusätzlicher Redaktionsaufwand.'
        },
        gain: 'Nutzt die Plattform als Nachfrage-Motor für Freizeitverkehr in Nebenverkehrszeiten und stärkt grenzüberschreitende Tickets.',
        avoid: 'Kein eigener Freizeitportal-Betrieb und keine manuelle Tourenpflege nötig.'
      }
    }
  },
  {
    id: 'gminas',
    x: 88,
    y: 200,
    isCoUser: true,
    effort: { pilot: 'low', ops: 'low' },
    i18n: {
      en: {
        short: 'Municipalities',
        title: 'Municipalities & Gminas',
        role: 'Co-User & POI Curator',
        contribute: {
          pilot: 'Selects key local heritage/nature POIs and validates lightweight curation rules.',
          ops: 'Maintains only atomic POI entries (viewpoints, castles, trailsheads) in its own territory — minutes per season.'
        },
        gain: 'Uses the tool to steer car-free visitors into lesser-known villages and landmarks, reducing parking congestion in mountain hotspots.',
        avoid: 'Never has to author cross-border GPX tours, run a heavy CMS, or coordinate trail maps with neighbouring municipalities.'
      },
      pl: {
        short: 'Gminy i Miasta',
        title: 'Gminy, miasta i samorządy',
        role: 'Współużytkownik i kurator POI',
        contribute: {
          pilot: 'Wskazuje kluczowe atrakcje na swoim terenie i uzgadnia proste zasady weryfikacji punktów POI.',
          ops: 'Aktualizuje wyłącznie pojedyncze, atomowe punkty POI u siebie — kilka minut na sezon.'
        },
        gain: 'Korzysta z narzędzia do kierowania ruchu turystycznego bez samochodów do mniej znanych miejscowości i odciążania zatłoczonych parkingów.',
        avoid: 'Nie musi tworzyć całych tras GPX, utrzymywać drogiego portalu ani uzgadniać map z sąsiednimi gminami.'
      },
      cs: {
        short: 'Obce a Města',
        title: 'Obce a místní samosprávy',
        role: 'Spoluuživatel a kurátor POI',
        contribute: {
          pilot: 'Vybere klíčové památky a rozhledny na svém území a potvrdí jednoduchá pravidla správy POI.',
          ops: 'Aktualizuje jen drobné atomické záznamy POI na vlastním území — pár minut za sezónu.'
        },
        gain: 'Využívá nástroj k přivedení bezautových turistů do méně známých obcí a snížení tlaku na parkoviště.',
        avoid: 'Nemusí spravovat dálkové GPX trasy ani provozovat složitý obecní turistický portál.'
      },
      de: {
        short: 'Kommunen',
        title: 'Kommunen & Gemeinden',
        role: 'Mitnutzer & POI-Kurator',
        contribute: {
          pilot: 'Benennt lokale Sehenswürdigkeiten und bestätigt schlanke Kurationsregeln für POIs.',
          ops: 'Pflegt ausschließlich atomare POI-Einträge im eigenen Gemeindegebiet — minimaler Saisonaufwand.'
        },
        gain: 'Nutzt die Plattform, um autofreien Tourismus gezielt in kleinere Orte zu lenken und Parkdruck zu reduzieren.',
        avoid: 'Kein teures eigenes Tourenportal und keine grenzüberschreitende GPX-Wartung.'
      }
    }
  },
  {
    id: 'business',
    x: 125,
    y: 292,
    isCoUser: true,
    effort: { pilot: 'low', ops: 'low' },
    i18n: {
      en: {
        short: 'Local Business',
        title: 'Local Businesses (Cafés, Lodges, Museums)',
        role: 'Co-User & POI Contributor',
        contribute: {
          pilot: 'Tests the future corridor POI workflow (e.g., mountain huts, local breweries, craft workshops).',
          ops: 'Submits a single thin POI card (coordinates + short label + external link) that hikers can click as a +15 min detour.'
        },
        gain: 'Direct, high-intent footfall right off the generated route — turns passing train hikers into paying guests without ad budgets.',
        avoid: 'No need to invent full hiking loops or keep complex opening-hour databases synced across five portals.'
      },
      pl: {
        short: 'Lokalny Biznes',
        title: 'Lokalni przedsiębiorcy (gastronomia, schroniska)',
        role: 'Współużytkownik i autor POI',
        contribute: {
          pilot: 'Testuje dodawanie punktów w korytarzu trasy (schroniska, lokalne browary, małe muzea, kawiarnie).',
          ops: 'Utrzymuje jedną prostą wizytówkę POI (współrzędne + krótki opis + link), którą wędrowiec może dodać jako krótkie odbicie.'
        },
        gain: 'Bezpośredni dopływ gości prosto ze szlaku i pociągu — darmowa widoczność dokładnie w momencie planowania wycieczki.',
        avoid: 'Nie musi samodzielnie układać tras ani płacić za drogie kampanie reklamowe.'
      },
      cs: {
        short: 'Podnikatelé',
        title: 'Místní podnikatelé (gastronomie, chaty, muzea)',
        role: 'Spoluuživatel a autor POI',
        contribute: {
          pilot: 'Testuje přidávání bodů zájmu v koridoru tras (horské chaty, lokální pivovary, malá muzea).',
          ops: 'Spravuje jednu jednoduchou kartu POI, kterou si turista kliknutím přidá jako krátkou odbočku.'
        },
        gain: 'Přímý přísun návštěvníků přímo z vlaku a trasy v momentě, kdy si plánují výlet.',
        avoid: 'Nemusí vymýšlet celé okruhy ani spravovat složité profily na mnoha portálech.'
      },
      de: {
        short: 'Lokales Gewerbe',
        title: 'Lokale Betriebe (Hütten, Cafés, Museen)',
        role: 'Mitnutzer & POI-Anbieter',
        contribute: {
          pilot: 'Erprobt die Einbindung von Einkehr- und Kultur-POIs im Routenkorridor.',
          ops: 'Pflegt lediglich eine schlanke POI-Karte (Koordinaten, Kurztext, Link) für optionale Abstecher.'
        },
        gain: 'Direkte Besucherströme von Bahn-Wanderern ohne Marketingbudget — sichtbar genau bei der Tourenplanung.',
        avoid: 'Keine eigene Routenredaktion und keine doppelte Pflege in schweren Portalen.'
      }
    }
  },
  {
    id: 'hikers',
    x: 280,
    y: 344,
    isCoUser: true,
    effort: { pilot: 'passive', ops: 'passive' },
    i18n: {
      en: {
        short: 'Hikers & Cyclists',
        title: 'Hikers, Cyclists & Day-Trippers',
        role: 'Primary End-User',
        contribute: {
          pilot: 'Provides usability feedback on real station-to-station trips across PL, CZ, and DE.',
          ops: 'Uses the app freely with zero login; optionally reports broken trail signs to NGOs/OSM.'
        },
        gain: 'Plans car-free cross-border trips in one place (instead of juggling 3 websites), with elevation profiles, marked-trail priority, and GPX export.',
        avoid: 'No more stranded return logistics, confusing border-crossing apps, or paywalled basic routes.'
      },
      pl: {
        short: 'Turyści / Piesi',
        title: 'Wędrowcy, rowerzyści i pasażerowie',
        role: 'Główny użytkownik końcowy',
        contribute: {
          pilot: 'Testuje użyteczność aplikacji podczas realnych wycieczek kolejowo-pieszych w regionie.',
          ops: 'Korzysta bez logowania i opłat; opcjonalnie zgłasza uwagi do szlaków w OSM.'
        },
        gain: 'Planuje transgraniczne wycieczki pociągiem w jednym miejscu zamiast na trzech stronach — z profilem wysokości i eksportem GPX.',
        avoid: 'Koniec z ręcznym składaniem rozkładów jazdy, map szlaków i biletów z różnych krajów.'
      },
      cs: {
        short: 'Turisté a Cyklisté',
        title: 'Turisté, cyklisté a cestující',
        role: 'Koncový uživatel',
        contribute: {
          pilot: 'Poskytuje zpětnou vazbu z reálných přeshraničních výletů vlakem.',
          ops: 'Používá aplikaci zdarma bez registrace; volitelně hlásí změny značení do OSM.'
        },
        gain: 'Naplánuje přeshraniční výlet vlakem na jednom místě s výškovým profilem a exportem GPX.',
        avoid: 'Konec přepínání mezi třemi různými weby a aplikacemi přes hranici.'
      },
      de: {
        short: 'Wanderer & Radler',
        title: 'Wanderer, Radfahrer & Tagesgäste',
        role: 'Primärer Endnutzer',
        contribute: {
          pilot: 'Liefert Praxis-Feedback auf realen Bahn-zu-Pfad-Touren im Dreiländereck.',
          ops: 'Nutzt das Tool frei und ohne Login; meldet optional Wegänderungen an OSM.'
        },
        gain: 'Plant autofreie grenzüberschreitende Touren an einem Ort statt auf drei verschiedenen Portalen — inklusive Höhenprofil und GPX.',
        avoid: 'Kein mühsames Kombinieren nationaler Fahrpläne und Wanderkarten mehr.'
      }
    }
  },
  {
    id: 'ngos',
    x: 435,
    y: 292,
    isCoUser: true,
    effort: { pilot: 'low', ops: 'low' },
    i18n: {
      en: {
        short: 'NGOs (PTTK/KČT)',
        title: 'Hiking NGOs & Volunteers (PTTK, KČT, Wandervereine)',
        role: 'Trail Custodians & Co-Beneficiaries',
        contribute: {
          pilot: 'Advises on trail-priority weighting and verifies OSM route=hiking data quality.',
          ops: 'Keeps doing what they already do best: painting physical blazes and keeping OSM trails current.'
        },
        gain: 'Explicit attribution ("Built on NGO-marked trails") drives visibility and respect for volunteer work while keeping hikers safely on marked paths.',
        avoid: 'Completely freed from manually authoring or maintaining hundreds of static station-to-station GPX files.'
      },
      pl: {
        short: 'PTTK / KČT / OSM',
        title: 'Organizacje turystyczne i wolontariusze (PTTK, KČT)',
        role: 'Opiekunowie szlaków',
        contribute: {
          pilot: 'Konsultuje priorytetyzację szlaków i jakość danych route=hiking w OpenStreetMap.',
          ops: 'Robi dokładnie to, co dotychczas: znakuje szlaki w terenie i dba o ich aktualność w OSM.'
        },
        gain: 'Wyraźna atrybucja w aplikacji („Oparte na szlakach znakowanych”) zwiększa widoczność pracy społecznej i trzyma turystów na oficjalnych szlakach.',
        avoid: 'Brak konieczności ręcznego tworzenia i pilnowania setek statycznych plików GPX od stacji do stacji.'
      },
      cs: {
        short: 'KČT / PTTK / OSM',
        title: 'Turistické kluby a dobrovolníci (KČT, PTTK)',
        role: 'Správci značení',
        contribute: {
          pilot: 'Konzultuje prioritu značených tras a kvalitu dat route=hiking v OSM.',
          ops: 'Pokračuje ve své běžné práci: obnově značení v terénu a aktualizaci v OSM.'
        },
        gain: 'Viditelná atribuce v aplikaci zhodnocuje práci dobrovolníků a vede turisty po oficiálních stezkách.',
        avoid: 'Žádná ruční správa statických GPX balíčků mezi jednotlivými nádražími.'
      },
      de: {
        short: 'Vereine (PTTK/KČT)',
        title: 'Wandervereine & Ehrenamt (PTTK, KČT, SachsenForst)',
        role: 'Wegewarte & Mitprofitierende',
        contribute: {
          pilot: 'Berät bei der Gewichtung markierter Wege und prüft OSM-Qualität.',
          ops: 'Führt die bestehende Arbeit fort: Wegemarkierung im Gelände und Pflege in OSM.'
        },
        gain: 'Sichtbare Quellenangabe würdigt ehrenamtliche Arbeit und lenkt Besucher zuverlässig auf offizielle Wege.',
        avoid: 'Keine manuelle Pflege hunderter statischer A→B-GPX-Dateien mehr.'
      }
    }
  },
  {
    id: 'steward',
    x: 472,
    y: 200,
    isCoUser: false,
    effort: { pilot: 'low', ops: 'low' },
    i18n: {
      en: {
        short: 'Ops Steward',
        title: 'Lightweight Regional Steward (Euroregion / Tourism Org)',
        role: 'Steady-State Host (Post-Grant)',
        contribute: {
          pilot: 'Participates in governance design so handover after the university pilot is seamless.',
          ops: 'Hosts the static zero-build files (GitHub Pages / municipal web server) and runs a quarterly station/POI refresh script.'
        },
        gain: 'Owns a flagship cross-border public service for the Neisse–Nysa–Nisa Euroregion at a fraction of traditional IT costs.',
        avoid: 'No backend servers, no database patching, no vendor lock-in, and no full-time software engineering team needed.'
      },
      pl: {
        short: 'Opiekun (Ops)',
        title: 'Lekki opiekun operacyjny (Euroregion / DOT)',
        role: 'Utrzymanie po pilotażu',
        contribute: {
          pilot: 'Uczestniczy w projektowaniu prostego modelu zarządzania, by płynnie przejąć gotowe narzędzie od uczelni.',
          ops: 'Utrzymuje statyczne pliki (GitHub Pages lub serwer regionalny) i raz na kwartał odświeża listę stacji/POI.'
        },
        gain: 'Zyskuje flagową usługę transgraniczną dla Euroregionu Nysa przy ułamku kosztów tradycyjnych systemów IT.',
        avoid: 'Zero serwerów bazodanowych, brak uzależnienia od dostawcy (vendor lock-in) i brak potrzeby zatrudniania zespołu IT.'
      },
      cs: {
        short: 'Správce (Ops)',
        title: 'Lehký provozní správce (Euroregion / Destinační agentura)',
        role: 'Provoz po skončení grantu',
        contribute: {
          pilot: 'Podílí se na návrhu lehké správy, aby hladce převzal hotový nástroj od univerzity.',
          ops: 'Hostuje statické soubory a čtvrtletně aktualizuje otevřená data stanic a POI.'
        },
        gain: 'Získává vlajkovou přeshraniční službu pro Euroregion Nisa za zlomek běžných IT nákladů.',
        avoid: 'Žádné databázové servery, žádný vendor lock-in ani potřeba vlastního vývojového týmu.'
      },
      de: {
        short: 'Betriebsträger',
        title: 'Schlanker Betriebsträger (Euroregion / Tourismusverband)',
        role: 'Dauerbetrieb nach Pilotphase',
        contribute: {
          pilot: 'Begleitet das Governance-Design für eine reibungslose Übergabe nach der Uni-Pilotphase.',
          ops: 'Hostet die statischen Zero-Build-Dateien und aktualisiert quartalsweise Stations-/POI-Listen.'
        },
        gain: 'Erhält ein sichtbares grenzüberschreitendes Vorzeigeprojekt für die Euroregion Neisse zu minimalen Betriebskosten.',
        avoid: 'Keine Backend-Server, keine Datenbank-Wartung, kein Vendor-Lock-in und kein eigenes Entwicklerteam.'
      }
    }
  }
];
