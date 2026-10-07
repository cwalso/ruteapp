# RuteApp – kodekontekst

## Formål

Dette dokumentet gir en kortfattet teknisk oversikt over kodebasen i RuteApp.

Dokumentet supplerer:

`docs/produkt-og-arkitekturgrunnlag.md`

Produkt- og arkitekturgrunnlaget er fortsatt den overordnede kilden for mål, omfang, arkitektur og sentrale prinsipper.

## Nåværende status

RuteApp er i etableringsfasen.

Frontend er opprettet med:

React
TypeScript
Vite
ESLint
npm
Vitest

En første routingkjerne og et statisk OSM-basert datasett for Nerskogen er implementert, testet og koblet til applikasjonens rutepunkter. Når minst to punkt finnes innenfor datasettet, snappes de til nærmeste punkt på routingnettets edges og A* beregner en sammenhengende rute gjennom eventuelle mellompunkter.

MapLibre GL JS er installert og integrert. Kartverket Turkart er fortsatt standardprofil. Kartverket Topo og Kartverket Topo gråtone kan velges for kartografisk sammenligning. Development-profilen RuteApp Routing tegner i tillegg RuteApps normaliserte `path`/`track`/`road`-nett som eget GeoJSON-lag. Turrutebase – Fotrute vises over de tre Kartverket-profilene, men er bevisst slått av i RuteApp Routing fordi laget ikke er identisk med routingnettet.

Nerskogen brukes som standard utviklings- og testutsnitt med sentrum omtrent ved lengdegrad 9.6012 og breddegrad 62.7802.

En intern rutegraf og A*-rutemotor er implementert under `src/routing/`. Et utviklingssteg henter og transformerer OSM-data til et kompakt RuteApp-datasett som nettleseren laster én gang per sesjon. Ved innlasting bygges en avledet graf med den første enkle modellen for virtuelle terrengforbindelser mellom ordinære komponenter som ligger maksimalt 200 meter fra hverandre.

Interaktiv rutepunktplanlegging er implementert som et eget featurelag. Brukeren kan legge til en ordnet liste med punkt A, vilkårlig antall mellompunkter og punkt B, dra punktene, fjerne enkeltpunkter med høyreklikk og tømme listen. En svak, prikket hjelpelinje og geografisk storcirkelavstand viser den direkte geometrien mellom punktene. Den beregnede ruten er visuelt primær, og faktisk rutelengde oppdateres umiddelbart når punktene endres. Ordinære rutedeler vises heltrukket, mens virtuelle terrengforbindelser vises med en tydelig lilla stipling og oppsummeres med antall og distanse i panelet. Hjelpelinjen vises som standard i development mode og skjules i produksjon når en gyldig beregnet rute finnes.

En første høydeprofil er implementert som separat etterprosessering av faktisk rutegeometri. Ruten samples med konfigurert 25-metersintervall, mens start, slutt og edge-knekkpunkter bevares. Kartverkets åpne Høydedata-API leverer terrenghøyder i batcher på maksimalt 50 punkt. Profil, samlet stigning/fall og et enkelt Naismith-basert gangtidsestimat oppdateres etter debounce når ruten endres. Høydefeil har egen status og påvirker ikke ruteresultatet.

Brukergrensesnittet prioriterer kartet som hovedflate og viser ruteinformasjon i et smalt, scrollbar sidepanel på desktop og som et panel under kartet på mobil. Når en rute finnes, samles distanse, estimert tid, stigning og fall i en kompakt ruteoversikt, fulgt av høydeprofilen og sekundær informasjon. A, B og alle mellompunkter vises som en kompakt ordnet liste med lokal scrolling ved mange punkt. Development-diagnostikk holdes visuelt adskilt og bygges ikke inn i produksjonsgrensesnittet. Videre kartografisk utforming er et separat senere steg og inngår ikke i denne layouten.

## Besluttet kart- og datagrunnlag

MapLibre GL JS brukes som presentasjonsmotor. Kartverkets `toporaster`, `topo` og `topograatone` brukes som alternative visuelle bakgrunnskart. OpenStreetMap-rådata er valgt som primært grunnlag for det routbare sti- og veinettet; renderte kartfliser brukt til visning skal ikke brukes som routingdata.

Kartverkets høyde-, terreng- og friluftsdata kan senere berike routinggrunnlaget og vurderingen av virtuelle terrengforbindelser. Kartintegrasjonen er implementert under `src/map/`, mens routingkjernen og den separate OSM-preprocessingen ligger utenfor kartmodulen. Skillet mellom visuelt kartgrunnlag og routinggrunnlag er dokumentert i [ADR-001](decisions/ADR-001-kart-og-geografisk-datagrunnlag.md).

Kartarkitekturen er lagbasert og kildeuavhengig. MapLibre er presentasjonsmotor, mens kartprofiler, bakgrunnskart og tematiske kartlag skal kunne konfigureres, byttes og kombineres uten at `MapView` eller routingarkitekturen må bygges om. Kartverket toporaster beholdes som standard i profilen Kartverket Turkart. Kartverket Topo prøver det skjermtilpassede fargekartet, mens Kartverket Topo gråtone undersøker maksimal kontrast mot applikasjonsgenerert rutegeometri. Fotrute er aktivt temalag over de tre Kartverket-profilene.

Routing-aware cartography er en akseptert arkitekturbeslutning: linjer som presenteres som RuteApps eget rutbare nett, skal avledes fra samme normaliserte grunnlag som snapping og A* bruker. Routinggrafen er fortsatt en directed beregningsmodell; `routableNetworkData.ts` lager en separat fysisk presentasjonsmodell, dedupliserer motsatt rettede edges og filtrerer ut virtuelle edges. Nerskogen-datasettets 26 806 directed edges blir 13 403 fysiske GeoJSON-segmenter. Beslutningen er dokumentert i [ADR-003](decisions/ADR-003-routing-aware-cartography.md), mens implementasjon og spike-resultat er beskrevet i [Routing-aware cartography](architecture/routing-aware-cartography.md).

Den tidligere eksperimentprofilen RuteApp Sommer og dens OpenFreeMap-/Mapterhorn-lag er fjernet. Den ga ikke tilstrekkelig bedre lokal turinformasjon til å forsvare en ekstra leverandørstakk ved siden av Kartverkets profiler. Resultatene og de undersøkte tjenestene er dokumentert i [Kartografisk profilstudie](architecture/cartographic-profile-study.md).

Arkitekturen skal senere kunne støtte flere sommerstier og fotturruter, vinter- og skiløyper, sykkelruter, høyde- og terrenglag og andre relevante temalag. Konkrete datakilder for disse framtidige lagene er ikke besluttet. Et synlig tematisk kartlag og dataene rutemotoren bruker er separate arkitekturbegreper.

Kartinnholdet deles konseptuelt i fire kategorier:

1. Bakgrunnslag gir visuell kontekst. Kartverkets tre konfigurerte WMTS-bakgrunner er presentasjonsdata og ikke routingdata.
2. Tematiske lag viser eksterne fagdata oppå bakgrunnskartet. Første implementerte temalag er Kartverkets Turrutebase – Fotrute, som beskriver registrerte fotturruter og ikke alle ordinære stier. Fotrute kan senere vurderes som berikelse eller kvalitetssignal for routing, men denne rollen er separat fra visualisering og er ikke besluttet.
3. RuteApps rutbare nett avledes fra samme normaliserte grunnlag som snapping og routing, men uttrykkes som dedupliserte fysiske kartsegmenter.
4. Applikasjonsgenererte kartobjekter, som punkt A og B, beregnede ruter, virtuelle forbindelser, markører og analyseresultater, kommer fra applikasjonens tilstand og beregninger. De trenger ikke ligge i det statiske kartlagregisteret for eksterne kilder.

Fotrute hentes fra Kartverkets Turrutebase WMS med WMS 1.1.1 og vises som et transparent rasterlag i Web Mercator over Kartverket Turkart, Kartverket Topo og Kartverket Topo gråtone. Dette er kun kartvisualisering og inngår ikke i det separate OSM-baserte routingdatasettet. Laget er ikke med i RuteApp Routing-profilen.

## Besluttet routingarkitektur

Routingkjernen for første MVP kjører i nettleseren og er implementert i TypeScript uten avhengigheter til React, MapLibre eller OSM-format. A* er første algoritme og arbeider på en eksplisitt intern graf med noder og rettede edges.

Grafmodellen skiller mellom fysisk `distanceMeters` og optimaliseringsverdien `cost`. Ordinære edges kan ha typene `path`, `track` og `road`, mens virtuelle terrengforbindelser representeres eksplisitt med typen `virtual`. A* har ingen særlogikk for edge-typene og vurderer alle forbindelser gjennom deres `cost`. I den første modellen kan cost ikke være lavere enn fysisk distanse.

Den første virtuelle modellen analyserer svakt sammenhengende komponenter i det ordinære nettet og finner den korteste edge-til-edge-kandidaten for hvert komponentpar innenfor `maxVirtualDistanceMeters = 200`. Kandidatpunkter kan ligge inne på begge edges. Berørte ordinære edges splittes i en avledet graf, og forbindelsen legges inn begge veier med `edgeType = virtual` og `cost = distanceMeters * 3`. Originalgrafen og OSM-datasettet muteres ikke. Kandidatgenereringen kjøres én gang ved innlasting og er separat fra A*, MapLibre, React og OSM-importen.

Dette er bevisst en topologi- og avstandsbasert prototype. Den kontrollerer ikke vann, elver, myr, bratthet, bygninger, gjerder, eiendom, adgang eller sikker ferdsel, og UI-et gir derfor ingen anbefaling eller garanti. Produksjonsmodellen lager foreløpig bare kandidater mellom ulike ordinære komponenter. En separat diagnostikkspike finner mulige same-component shortcuts der direkteavstanden er 10–200 meter, ordinær nettverksavstand minst 500 meter og detour ratio minst 5. Det komplette kandidatsettet eksporteres bare til Git-ignorert GeoJSON. Et kontrollert development-eksperiment har en full-ID-basert allowlist og en liten preberegnet fixture for `SC-C4239590`, `SC-9F0B4DCE`, `SC-D959F701` og `SC-CF2E56FE`. Toggle er av som standard; når den er på, materialiseres bare disse fire som vanlige `virtual`-edges med samme kostnadsfaktor som component-gap-forbindelser. `SC-F7D90B7B` er eksplisitt avvist. `SC-E6B34D30` er ikke relevant som shortcut-case fordi den registrerte ordinary stien allerede går over elva ved et vadested. En registrert sti forblir ordinary routing selv når den krysser et terrengelement. En same-component virtual edge uttrykker en mulig lokal forbindelse, ikke nødvendigvis en centimeterpresis GPS-trase; det implementeres ingen lokal omgåelsesalgoritme. Ingen automatisk produksjonspolicy eller barriereregel er besluttet. En kjent FKB-sti eller annen identifisert eksisterende ferdselsåre skal ikke modelleres som virtuell edge. Detaljene er dokumentert i [Virtuelle terrengforbindelser – første MVP](architecture/virtual-terrain-connections.md) og [Same-component shortcut candidates](architecture/same-component-shortcuts.md).

Geografisk luftlinjeavstand brukes som A*-heuristikk. Den samme delte Haversine-funksjonen brukes av den foreløpige avstandsberegningen i route-planning-featuret. En deterministisk testgraf dekker ordinær korteste rute, en straffet virtuell edge, en nødvendig virtuell edge og ingen rute.

OSM-rådata transformeres nå til den interne grafmodellen i et separat utviklingssteg. Overpass brukes bare til å hente rådata; den genererte statiske JSON-filen er runtime-artefakten. Nerskogen-datasettet dekker bbox-en `62.735, 9.50, 62.825, 9.69`, har 13 341 noder og 26 806 rettede edges og bevarer OSM-topologien uten snapping eller virtuelle edges. Området er moderat utvidet for å dekke naturlig manuell testing vest for den tidligere grensen.

OSM-preprocessingen skiller nå mellom råsnapshot og aktiv highway-policy. `fetchOsm.ts` henter både aktive og audit-relevante highway-klasser i samme snapshot, mens `buildDataset.ts` fortsatt filtrerer med den aktive policyen. `osmWalkingPolicy.ts` eier den eksplisitte mappingen og den første access-tolkningen. `osmHighwayCoverage.ts` og `routing:audit-highways` kan sammenligne dagens policy med en bredere analysepolicy uten å endre runtime-datasettet. En Nerskogen-audit 7. oktober 2026 viste at de 10 utelatte `secondary`-wayene på Fv. 6516 reduserer antall ordinary komponenter fra 60 til 16 ved at 45 baseline-komponenter samles i én større komponent. Dette identifiserer `secondary` som et manglende ordinært road backbone som bør rettes før flere gap løses med FKB eller virtuelle forbindelser.

Via-routing beregnes som delruter mellom påfølgende rutepunkter. Delrutene slås sammen uten duplikat i skjøten, og hele resultatet forkastes dersom én delrute mangler. Alle punkt må ligge innenfor datasettets bbox og maksimalt 100 meter fra nærmeste punkt på routingnettet. Brukerens valgte koordinat beholdes uendret, mens snapped koordinat brukes som start, via eller mål i rutegrafen. Høydedata og høydeprofil behandles separat etter at en rutegeometri er funnet, som dokumentert i [Høydeprofil og estimert gangtid](architecture/elevation-and-walking-time.md). Routingbeslutningen er dokumentert i [ADR-002](decisions/ADR-002-routingarkitektur.md), og importreglene i [OSM-import for routing](architecture/osm-routing-import.md).

## Repositorystruktur

### `/src`

Inneholder applikasjonens kildekode.

### `/src/components`

Generelle og gjenbrukbare UI-komponenter som ikke tilhører én bestemt domenefunksjon.

Eksempler kan senere være knapper, paneler, dialoger og felles layoutkomponenter.

### `/src/features`

Funksjonsorientert applikasjonskode.

Denne mappen brukes når en funksjon består av flere relaterte UI-elementer, tilstand og oppførsel.

`features/route-planning/` eier den ordnede rutepunktlisten, endringsoperasjonene, rolleutledningen for A/B/mellompunkter og den foreløpige avstandsberegningen. Featurelaget starter også routing på nytt når punktene endres og presenterer status og resultat. Punkt-state eies av React-featurelaget og ikke av MapLibre-instansen; rutegrafen holdes i tjenestelaget og kopieres ikke inn i React-state.

`useRouteElevation.ts` kobler ferdig rutegeometri til høydegrensen med debounce og avbrytelse av utdaterte kall. `ElevationProfileChart.tsx` presenterer den ferdige profilen som enkel responsiv SVG. Featurelaget holder routingstatus og høydestatus separate.

### `/src/elevation`

Inneholder UI- og routing-uavhengige typer og funksjoner for rutesampling, høydeprofil, stigning/fall og estimert gangtid. `elevationConfig.ts` samler intervallet, noise-threshold, debounce og de første gangtidsparametrene. Modulen velger ikke rute og kjenner ikke MapLibre eller Kartverkets transportformat.

### `/src/map`

Kartspesifikk funksjonalitet.

Forventede ansvarsområder:

MapLibre-oppsett
kartets livssyklus
kartlag
datakilder
markører
kartinteraksjon
visualisering av geografiske objekter

Ruteberegningsalgoritmer skal ikke ligge her.

`MapView.tsx` eier MapLibre-kartets livssyklus, en midlertidig profilvelger og kartpresentasjonen av rutepunkter. Komponenten mottar punktlisten, det avledede rutbare kartnettet og beregnede rutesegmenter som props og rapporterer kartklikk, dragging og høyreklikkfjerning tilbake til featurelaget. `routableNetworkData.ts` er en MapLibre-uavhengig transformasjon fra ordinær routinggraf til fysiske segmenter og GeoJSON. `routableNetworkLayer.ts` eier MapLibre-kilden og de tre presentasjonslagene for `path`, `track` og `road`. `routePlanningLayer.ts` synkroniserer den svake, prikkede hjelpelinjen for direktegeometri. `routeResultLayer.ts` synkroniserer beregnede rutesegmenter som et separat app-generert lag over nettet: ordinære edges er heltrukne og virtuelle edges tydelig lilla og stiplede. Lagene reetableres idempotent etter stilbytte. `mapProfiles.ts` beskriver Kartverket Turkart, Kartverket Topo, Kartverket Topo gråtone og development-profilen RuteApp Routing. `mapLayers.ts` beskriver de konkrete eksterne kartkildene og lagene. `mapConfig.ts` inneholder standardutsnittet for Nerskogen.

### `/src/routing`

Inneholder den første UI-uavhengige routingkjernen.

Forventede ansvarsområder:

routinggraf
forbindelser mellom noder og stier
ruteberegning
kostnadsmodeller
virtuelle terrengforbindelser
routingrelaterte domeneregler

`routingTypes.ts` definerer noder, edges, graf og ruteresultat. `routingGraph.ts` bygger nodeoppslag og adjacency for utgående edges fra vanlige TypeScript-data. `aStar.ts` beregner ruter etter laveste cost og returnerer ordnede node-id-er og edges samt samlet distanse og cost.

`routingDataset.ts` beskriver og validerer det kompakte statiske datasettformatet og transformerer det til eksisterende `RoutingGraph`. `nearestRoutingEdgePoint.ts` finner nærmeste geografiske punkt på en ordinær routing-edge innenfor en eksplisitt maksimalavstand. `routingSnapGraph.ts` oppretter midlertidige snap-noder og splitter berørte rettede edges i en avledet graf; den cachede grafen endres ikke. `virtualConnections.ts` analyserer ordinære komponenter, finner og dedupliserer edge-til-edge-kandidater og materialiserer virtuelle edges i en separat avledet graf. `sameComponentShortcutCandidates.ts` analyserer separat nærliggende segmenter i samme ordinary component, måler den ordinære omveien med eksisterende A* og returnerer deterministiske diagnostikkandidater uten å mutere eller utvide grafen. `sameComponentShortcutDevAllowlist.ts` og `sameComponentShortcutDevCandidates.ts` avgrenser det kontrollerte development-eksperimentet til fire full-ID-kandidater; `sameComponentShortcutMaterialization.ts` splitter nødvendige ordinary edges i en ekstra derived graph og materialiserer kandidatene som `virtual` uten å endre A*. `routeWaypoints.ts` kontrollerer datasettgrensen, snapper A/B/via-punkter og slår sammen A*-delruter med eksplisitt antall og distanse for virtuelle edges. Modulene inneholder ingen React-, MapLibre- eller OSM-formatspesifikk logikk.

Routinglogikken kan brukes og testes uavhengig av React-komponenter, MapLibre og OSM-format. Første MVP kjører kjernen direkte i nettleseren. Nåværende lineære edge-søk er bevisst beholdt fordi Nerskogen-datasettet er lite nok; grensen i `nearestRoutingEdgePoint.ts` gjør at søket senere kan erstattes av en romlig indeks uten å endre UI-et eller A*.

Routingresultatet inneholder utviklingsdiagnostikk med originalt punkt, snapped koordinat og avstand, valgt edge og dens endenoder/type, samt edge-ID-er, edge-typer og antall `path`/`track`/`road`/`virtual` i den ferdige ruten. Resultatet eksponerer også `virtualEdgeCount` og `virtualDistanceMeters`. Snap-søket bruker den avledede ordinære grafen uten virtuelle edges, slik at et brukerpunkt ikke snapper direkte til en terrengforbindelse. Et stisegment som er synlig i Norgeskart, men mangler i OSM-datasettet, blir fortsatt ikke konstruert eller reparert automatisk.

### `/scripts/routing`

Utviklingsverktøy for den eksplisitte OSM-dataflyten. `fetchOsm.ts` henter et konfigurert område og både aktive/audit-relevante highway-klasser fra Overpass, mens `buildDataset.ts` bruker den aktive policyen til å filtrere gangbare ways, beregne segmentlengder og generere kompakt routing-JSON. `osmWalkingPolicy.ts` samler highway-mapping og access-regler for preprocessing, og `osmHighwayCoverage.ts` brukes av `routing:audit-highways` til samme-snapshot-analyse av policydekning og topologi. Nerskogen-konfigurasjonen ligger i `routingAreas.ts`, ikke i routingkjernen. `npm run routing:virtual-candidates` kjører den separate, deterministiske Nerskogen-diagnosen for component-gap-kandidater. `npm run routing:same-component-candidates` diagnostiserer mulige lokale snarveier med stor ordinær nettverksomvei og eksporterer dem til Git-ignorert GeoJSON. Ingen av scriptkjøringene endrer det committed routingdatasettet.

### `/data/routing/raw`

Regenererbare, Git-ignorerte Overpass-rådata.

### `/public/data/routing`

Genererte statiske routingdatasett som lastes av nettleseren ved vanlig bruk. Første datasett er `nerskogen.json`.

### `/src/services`

Kommunikasjon med eksterne datakilder, API-er og senere backend-tjenester.

`nerskogenRoutingData.ts` henter og validerer det statiske Nerskogen-datasettet, bygger den ordinære grafen og avleder grafen med virtuelle forbindelser én gang. I development mode bygges i tillegg en alternativ graf med de fire allowlistede shortcutene; UI-toggle velger graf, og baseline er standard. Development-grenen og fixture-dataene fjernes fra produksjonsbundle ved bygging. Resultatet caches på modulnivå slik at filen og component-gap-kandidatgenereringen bare kjøres én gang per nettlesersesjon. `kartverketElevation.ts` er den separate, validerende nettleseradapteren for Kartverkets Høydedata-API og cacher ferdig hentede koordinater i minnet.

### `/src/types`

Felles TypeScript-typer og interfaces for domeneobjekter og datastrukturer.

`routePoint.ts` definerer den minimale rutepunktmodellen med stabil id, longitude og latitude. Modellen inneholder foreløpig ingen routing-, høyde- eller terrengegenskaper.

### `/src/utils`

Generelle hjelpefunksjoner.

Mappen skal ikke brukes som oppsamlingssted for domenelogikk som egentlig hører hjemme i andre moduler.

`geographicDistance.ts` inneholder den delte geografiske storcirkelberegningen som brukes av både rutepunktplanleggingen og A*-heuristikken.

### `/docs`

Varig prosjektdokumentasjon.

### `/docs/architecture`

Detaljert teknisk dokumentasjon for bestemte deler av løsningen.

Aktuelle tema etter hvert kan være:

kartarkitektur
routingarkitektur
geografiske data
virtuelle terrengforbindelser
backendarkitektur

### `/docs/decisions`

Architecture Decision Records, ADR.

Brukes for viktige beslutninger der ulike alternativer er vurdert, og der det er nyttig at senere utviklere eller AI-agenter kan forstå hvorfor beslutningen ble tatt.

## Sentralt domenekonsept

Rutegrafen kan ikke forutsette at topologien i kartgrunnlaget gir en perfekt representasjon av hvor det faktisk er mulig å ferdes.

To stisegmenter kan ligge så nær hverandre at ferdsel mellom dem er mulig, selv om de ikke er koblet sammen i kildedataene.

RuteApp skiller derfor mellom:

1. Ordinære forbindelser i sti- og veinettet
2. Virtuelle terrengforbindelser

Virtuelle terrengforbindelser skal behandles som egne forbindelser i routinggrafen.

De skal senere kunne ha egne egenskaper og regler for blant annet:

maksimal avstand
rutekostnad
terrengforhold
sikkerhet
visualisering
brukerpreferanser

Den første arkitekturen må bevare dette skillet.

## Arkitekturgrenser

UI-komponenter skal vise informasjon og samle inn brukerhandlinger.

Kartmodulen skal vise og håndtere geografisk informasjon.

Routingmodulen skal håndtere forbindelser og beregne ruter.

Routingkjernen for første MVP kjører i nettleseren, men modulgrensen holder den uavhengig av UI og kartpresentasjon.

Tjenestelaget skal hente og eventuelt transformere eksterne data.

Disse ansvarsområdene skal ikke kobles tettere sammen enn nødvendig.

## Første vertikale MVP

Den første nyttige ende-til-ende-funksjonen er:

Brukeren velger punkt A

↓

Brukeren velger punkt B

↓

RuteApp oppretter eller bruker et rutbart nettverk

↓

Ruteberegningen vurderer ordinære forbindelser og tillatte virtuelle forbindelser

↓

Korteste egnede fotturrute beregnes

↓

Ruten vises i kartet

Denne kjeden skal styre prioriteringene i den tidlige utviklingen.

Den første routing-MVP-en gjelder fottur. Ski- og sykkelruting hører til mulig framtidig utvikling og skal ikke drive fram en generell fleraktivitetsmodell nå.

## Vedlikehold av dokumentet

Dokumentet skal oppdateres når:

viktige moduler legges til
ansvar mellom moduler endres
nye sentrale domenekonsepter introduseres
arkitekturen endres vesentlig

Dokumentet skal ikke oppdateres for hver mindre kodeendring.

Detaljert teknisk design hører hjemme i:

`docs/architecture/`

Viktige arkitekturbeslutninger og begrunnelsen for dem hører hjemme i:

`docs/decisions/`
