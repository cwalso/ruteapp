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

En første isolert routingkjerne er implementert og testet, men den er ennå ikke koblet til applikasjonens rutepunkter eller ekte geografiske data.

MapLibre GL JS er installert og integrert. Applikasjonen har to valgbare kartprofiler: den eksperimentelle standardprofilen RuteApp Sommer og Kartverket Turkart. Turrutebase – Fotrute vises som tematisk lag over begge profilene.

Nerskogen brukes som standard utviklings- og testutsnitt med sentrum omtrent ved lengdegrad 9.6012 og breddegrad 62.7802.

En intern rutegraf og A*-rutemotor er implementert under `src/routing/`. OSM-integrasjon, automatisk generering av virtuelle forbindelser og kobling mellom rutemotoren og UI-et er foreløpig ikke implementert.

Interaktiv rutepunktplanlegging er implementert som et eget featurelag. Brukeren kan legge til en ordnet liste med punkt A, vilkårlig antall mellompunkter og punkt B, dra punktene, fjerne enkeltpunkter med høyreklikk og tømme listen. En foreløpig planleggingslinje og geografisk storcirkelavstand oppdateres umiddelbart når punktgeometrien endres. Linjen og avstanden er direkte geometri mellom punktene, ikke faktisk routing på sti- og veinett. Høydeprofil er heller ikke implementert.

## Besluttet kart- og datagrunnlag

MapLibre GL JS brukes som presentasjonsmotor. Kartverkets toporaster brukes i profilen Kartverket Turkart, mens OpenFreeMap Positron testes i RuteApp Sommer. OpenStreetMap-rådata er valgt som planlagt primært grunnlag for det routbare sti- og veinettet; renderte kartfliser og vektortiles brukt til visning skal ikke brukes som routingdata.

Kartverkets høyde-, terreng- og friluftsdata kan senere berike routinggrunnlaget og vurderingen av virtuelle terrengforbindelser. Kartintegrasjonen er implementert under `src/map/`, mens OSM-import, rutegraf og rutemotor fortsatt ikke er implementert. Skillet mellom visuelt kartgrunnlag og routinggrunnlag er dokumentert i [ADR-001](decisions/ADR-001-kart-og-geografisk-datagrunnlag.md).

Kartarkitekturen er lagbasert og kildeuavhengig. MapLibre er presentasjonsmotor, mens kartprofiler, bakgrunnskart og tematiske kartlag skal kunne konfigureres, byttes og kombineres uten at `MapView` eller routingarkitekturen må bygges om. Kartverket toporaster beholdes i profilen Kartverket Turkart, og Fotrute er aktivt temalag over begge profiler.

RuteApp Sommer er en kartografisk spike som bruker OpenFreeMap Positron som dempet vektorbasert bakgrunn. En subtil 2D-hillshade fra Mapterhorn legges under ferdselsnett og etiketter, mens `class=path` og `class=track` fra OpenMapTiles-laget `transportation` fremheves separat over bakgrunnen. Dette er kun visualisering av vektortiledata, ikke OSM-import eller routinggrunnlag. OpenFreeMap, Mapterhorn og den konkrete kartografien er ikke permanente valg.

Arkitekturen skal senere kunne støtte flere sommerstier og fotturruter, vinter- og skiløyper, sykkelruter, høyde- og terrenglag og andre relevante temalag. Konkrete datakilder for disse framtidige lagene er ikke besluttet. Et synlig tematisk kartlag og dataene rutemotoren bruker er separate arkitekturbegreper.

Kartinnholdet deles konseptuelt i tre kategorier:

1. Bakgrunnslag gir visuell kontekst. Kartverket toporaster er første implementerte bakgrunnslag og er ikke routingdata.
2. Tematiske lag viser eksterne fagdata oppå bakgrunnskartet. Første implementerte temalag er Kartverkets Turrutebase – Fotrute, som beskriver registrerte fotturruter og ikke alle ordinære stier. Fotrute kan senere vurderes som berikelse eller kvalitetssignal for routing, men denne rollen er separat fra visualisering og er ikke besluttet.
3. Applikasjonsgenererte kartobjekter, som punkt A og B, beregnede ruter, virtuelle forbindelser, markører og analyseresultater, kommer fra applikasjonens tilstand og beregninger. De trenger ikke ligge i det statiske kartlagregisteret for eksterne kilder.

Fotrute hentes fra Kartverkets Turrutebase WMS med WMS 1.1.1 og vises som et transparent rasterlag i Web Mercator over begge kartprofilene. Dette er kun kartvisualisering og inngår ikke i routingkjernen; OSM-integrasjon er fortsatt ikke implementert.

## Besluttet routingarkitektur

Routingkjernen for første MVP kjører i nettleseren og er implementert i TypeScript uten avhengigheter til React, MapLibre eller OSM-format. A* er første algoritme og arbeider på en eksplisitt intern graf med noder og rettede edges.

Grafmodellen skiller mellom fysisk `distanceMeters` og optimaliseringsverdien `cost`. Ordinære edges kan ha typene `path`, `track` og `road`, mens virtuelle terrengforbindelser representeres eksplisitt med typen `virtual`. A* har ingen særlogikk for edge-typene og vurderer alle forbindelser gjennom deres `cost`. I den første modellen kan cost ikke være lavere enn fysisk distanse.

Geografisk luftlinjeavstand brukes som A*-heuristikk. Den samme delte Haversine-funksjonen brukes av den foreløpige avstandsberegningen i route-planning-featuret. En deterministisk testgraf dekker ordinær korteste rute, en straffet virtuell edge, en nødvendig virtuell edge og ingen rute.

OSM-rådata skal senere transformeres til den interne grafmodellen i et separat steg. Via-routing kan senere bygges som delruter mellom påfølgende rutepunkter. Høydedata og høydeprofil skal behandles separat etter at en rutegeometri er funnet. Beslutningen og åpne spørsmål er dokumentert i [ADR-002](decisions/ADR-002-routingarkitektur.md).

## Repositorystruktur

### `/src`

Inneholder applikasjonens kildekode.

### `/src/components`

Generelle og gjenbrukbare UI-komponenter som ikke tilhører én bestemt domenefunksjon.

Eksempler kan senere være knapper, paneler, dialoger og felles layoutkomponenter.

### `/src/features`

Funksjonsorientert applikasjonskode.

Denne mappen brukes når en funksjon består av flere relaterte UI-elementer, tilstand og oppførsel.

`features/route-planning/` eier den ordnede rutepunktlisten, endringsoperasjonene, rolleutledningen for A/B/mellompunkter og den foreløpige avstandsberegningen. State eies av React-featurelaget og ikke av MapLibre-instansen.

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

`MapView.tsx` eier MapLibre-kartets livssyklus, en midlertidig profilvelger og kartpresentasjonen av rutepunkter. Komponenten mottar punktlisten som props og rapporterer kartklikk, dragging og høyreklikkfjerning tilbake til featurelaget. `routePlanningLayer.ts` synkroniserer den foreløpige GeoJSON-linjen som et app-generert lag og reetablerer den etter stilbytte. `mapProfiles.ts` beskriver RuteApp Sommer og Kartverket Turkart og komponerer hver base-style med profilens tilleggslag. `mapLayers.ts` beskriver de konkrete eksterne kartkildene og lagene. `mapConfig.ts` inneholder standardutsnittet for Nerskogen.

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

Routinglogikken kan brukes og testes uavhengig av React-komponenter, MapLibre og OSM-format. Første MVP kjører kjernen i nettleseren, men UI-et bruker den ikke ennå.

### `/src/services`

Kommunikasjon med eksterne datakilder, API-er og senere backend-tjenester.

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
