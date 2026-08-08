# RuteApp

## Produkt-, arkitektur- og utviklingsgrunnlag

**Status:** Første prosjektbaseline
**Plattform:** Webapplikasjon, mobile first
**Primær bruk:** Personlig turplanlegging og navigasjon i naturen

---

# 1. Bakgrunn

Det finnes mange gode kart- og turapplikasjoner, blant annet Norgeskart, AllTrails og Marka Trails. De løser imidlertid ulike deler av behovet.

Utgangspunktet for RuteApp er et konkret navigasjonsproblem:

> Jeg befinner meg på ett sted i naturen og ønsker å komme meg til et annet. Hvilken rute bør jeg følge?

Et tradisjonelt topografisk kart viser stier, veier og terreng, men overlater i stor grad selve ruteplanleggingen til brukeren.

RuteApp skal kombinere gode norske kartdata med automatisk ruteberegning for ferdsel til fots.

AllTrails og Marka Trails brukes som referanser og inspirasjonskilder for funksjonalitet og brukeropplevelse. RuteApp skal imidlertid ikke i utgangspunktet være en katalog over ferdigdefinerte turer.

Kjernefunksjonen er navigasjon fra et vilkårlig punkt A til et vilkårlig punkt B.

---

# 2. Produktvisjon

RuteApp skal gjøre det enkelt å finne og følge en god rute fra et vilkårlig punkt til et annet i naturen, primært gjennom eksisterende stinett, men med mulighet for korte forbindelser gjennom terrenget der kartlagte stier ikke henger sammen.

På lengre sikt skal RuteApp kunne utvikles til et personlig navigasjonsverktøy som lærer av brukerens faktiske turer, preferanser og fremdrift.

---

# 3. Grunnleggende prinsipper

## 3.1 A til B er kjerneproblemet

RuteApp skal først og fremst svare på:

> «Jeg er her og vil dit. Hvordan kommer jeg meg dit?»

Dette skiller løsningen fra tjenester som primært hjelper brukeren med å finne ferdigdefinerte turer.

---

## 3.2 Stinettet må behandles som ufullstendig

Et helt sentralt premiss er:

> Manglende topologisk forbindelse i kartdata betyr ikke nødvendigvis at det er umulig å gå mellom punktene.

To stier kan eksempelvis stoppe 70 meter fra hverandre i kartgrunnlaget selv om det i virkeligheten er fullt mulig å gå mellom dem.

RuteApp skal derfor ikke behandle det registrerte stinettet som en absolutt beskrivelse av hvor det er mulig å ferdes.

---

## 3.3 Virtuelle terrengforbindelser er kjernefunksjonalitet

RuteApp skal kunne etablere syntetiske forbindelser mellom ellers adskilte deler av stinettet.

Disse betegnes:

**Virtuelle terrengforbindelser**, eller **stikoblinger**.

Eksempel:

```text
Registrert sti             Registrert sti

──────────────●           ●──────────────
               \         /
                \ 87 m  /
                 \...../
                 
            virtuell forbindelse
```

Dette skal ikke implementeres som en senere ekstrafunksjon. Datamodell, rutegraf og rutemotor skal fra starten støtte slike forbindelser.

---

## 3.4 Mobile first, browser first

RuteApp skal brukes på mobiltelefon under tur.

Første versjon bygges likevel som en ordinær webapplikasjon som kjører i nettleseren.

Prinsippet er derfor:

> **Browser first, mobile first.**

Løsningen skal fungere på desktop under utvikling og planlegging, men brukergrensesnittet skal fra starten utformes slik at kart, kontroller og ruteinformasjon fungerer på mobilskjerm og med touch.

Arkitekturen skal ikke knytte kjernelogikken til nettleseren. Dette gjør det mulig senere å utvikle løsningen videre som PWA eller native mobilapplikasjon.

---

# 4. MVP 1

Første MVP skal være bevisst liten.

Målet er å bevise at RuteApps grunnidé fungerer.

## 4.1 Brukerhistorie

> Som bruker ønsker jeg å velge et startpunkt og et målpunkt i kartet og få beregnet korteste rute mellom punktene via tilgjengelige stier og nødvendige korte terrengforbindelser.

---

## 4.2 Brukerflyt

Brukeren:

1. åpner RuteApp
2. ser et topografisk kart
3. velger startpunkt
4. velger målpunkt
5. angir eller bruker standard maksimal stikoblingsavstand
6. velger «Finn rute»
7. får beregnet korteste rute
8. ser ruten i kartet
9. ser grunnleggende informasjon om ruten

---

# 5. Funksjonelt omfang for MVP

MVP skal støtte:

### Kart

* vise topografisk kart
* panorering
* zoom
* touch-operasjoner på mobil
* valg av startpunkt
* valg av målpunkt

### Ruting

* finne korteste rute
* følge registrerte stier og relevante gangbare veier
* bruke virtuelle terrengforbindelser
* konfigurere maksimal tillatt stikobling, eksempelvis 200 meter

### Presentasjon

Resultatet skal minimum vise:

* total distanse
* distanse på registrert nettverk
* distanse via virtuelle terrengforbindelser
* antall virtuelle forbindelser

Registrerte og virtuelle deler av ruten skal visuelt kunne skilles fra hverandre.

Eksempel:

```text
Total distanse:        6,4 km
Registrert nettverk:   6,1 km
Utenfor sti:           0,3 km
Stikoblinger:          2
```

---

# 6. Utenfor MVP 1

Følgende skal ikke være nødvendig for første MVP:

* brukerkonto
* sosial funksjonalitet
* anmeldelser
* bilder
* ferdigdefinerte turer
* turhistorikk
* vær
* GPX
* offline-kart
* offline-ruting
* kontinuerlig GPS-navigasjon
* automatisk omruting
* ETA
* personlig ganghastighet
* høydemeter som rutekriterium
* avansert terrenganalyse
* AI eller maskinlæring

Arkitekturen bør likevel ikke skape unødvendige hindringer for senere implementering.

---

# 7. Kart- og datakilder

RuteApp skal skille mellom:

1. kartet brukeren ser
2. data som brukes til ruteberegning
3. supplerende geografiske data

Dette er separate ansvarsområder og skal ikke behandles som samme datagrunnlag. Beslutningen er dokumentert i [ADR-001: Skille mellom visuelt kartgrunnlag og routinggrunnlag](decisions/ADR-001-kart-og-geografisk-datagrunnlag.md).

---

## 7.1 Visuelt kartgrunnlag

MapLibre GL JS er valgt som kart- og presentasjonsmotor. Kartverkets toporaster/turkart skal brukes som primært visuelt bakgrunnskart i første versjon.

Kartverket-kartet er et presentasjonsgrunnlag og skal ikke behandles som routingdata eller kilde til routingtopologi. Implementasjonen skal bruke en Kartverket-tjeneste som er egnet for MapLibre og Web Mercator (EPSG:3857). Gjeldende krav til kreditering og bruksvilkår skal ivaretas og kontrolleres på nytt før produksjonssetting.

MapLibre skal vise bakgrunnskart, geografiske objekter og beregnede ruter, men skal ikke eie rutelogikk.

---

## 7.2 Routinggrunnlag

OpenStreetMap-rådata, OSM, er valgt som primær datakilde for etablering av routbart sti- og veinett i MVP-en. RuteApp skal bruke de underliggende geografiske OSM-dataene, ikke ferdig renderte OSM-kartfliser, som routinggrunnlag.

OSM inneholder blant annet:

* stier
* gangveier
* skogsveier
* vanlige veier
* broer
* porter
* barrierer
* tilgangsinformasjon
* underlag
* ulike typer ferdselsnettverk

OSM-data skal transformeres til en graf som rutemotoren kan arbeide på. Routinggrafen skal etableres uavhengig av MapLibre og det visuelle bakgrunnskartet.

Konkret import-, prosesserings- og kjøremekanisme for OSM-data og rutemotor er foreløpig ikke besluttet.

---

## 7.3 Norske supplerende datasett

Routinggrunnlaget skal senere kunne berikes med norske offentlige data, blant annet:

* høydedata
* nasjonal høydemodell
* N50/topografiske data
* Kartverkets Turrutebase
* andre tur- og friluftsruter
* FKB-TraktorvegSti
* relevante vann- og terrengdata
* andre relevante barriere- og terrengdata

Disse kildene er ikke primært routinggrunnlag i første MVP. Høyde-, terreng- og barrieredata er særlig relevante for senere vurdering av virtuelle terrengforbindelser, for eksempel om en kort geometrisk forbindelse innebærer urimelig høydeforskjell eller andre terrengmessige problemer.

OSM skal derfor ikke bygges inn som en antakelse om at dette alltid vil være eneste rutekilde. Konkrete regler for berikelse og vurdering av virtuelle forbindelser er fortsatt åpne.

---

# 8. Rutegraf

Rutegrafen er kjernen i RuteApp.

Grafen består av:

## Noder

Eksempler:

* stikryss
* vei-/stikryss
* stiendepunkter
* startpunkt
* målpunkt
* innkoblingspunkt på en sti
* virtuelle koblingspunkter

## Kanter

Eksempler:

```text
TRAIL
TRACK
PATH
ROAD
CONNECTOR
USER_CONNECTOR
```

Hver kant bør minimum inneholde:

```text
id
fromNode
toNode
geometry
distanceMeters
type
source
```

For virtuelle forbindelser kommer ytterligere metadata.

---

# 9. Virtuelle terrengforbindelser

Dette er en egen domenekomponent i RuteApp.

## 9.1 Grunnregel

Hvis to deler av nettverket ikke er koblet sammen, kan RuteApp undersøke om en forbindelse kan opprettes.

Eksempel:

```text
Maksimal stikobling = 200 meter
```

Dersom nærmeste relevante del av et annet nettverk ligger 83 meter unna, kan systemet opprette:

```text
CONNECTOR
distance = 83 m
```

---

## 9.2 Ikke bare endepunkt til endepunkt

Systemet må støtte:

```text
stiendepunkt → stiendepunkt
```

men også:

```text
stiendepunkt → nærmeste punkt på annen sti
```

Eksempel:

```text
            ●
            .
            . 64 m
            .
────────────×──────────────────
```

Punktet `×` blir da et nytt logisk knutepunkt i rutegrafen.

---

## 9.3 Første implementasjon

MVP kan starte enkelt:

1. finn frie stiendepunkter
2. søk etter nærmeste relevante nettverk innenfor maksimal avstand
3. opprett rett geometrisk forbindelse
4. merk forbindelsen som virtuell
5. legg forbindelsen inn i rutegrafen
6. la rutemotoren vurdere forbindelsen

Dette gjør det mulig å teste kjerneideen tidlig.

---

# 10. Videre utvikling av terrengforbindelser

Senere kan systemet undersøke om en forbindelse:

* krysser vann
* krysser større elv
* krysser jernbane
* krysser utilgjengelig vei
* går gjennom bygning
* går gjennom adgangsbegrenset område
* går gjennom svært bratt terreng
* går gjennom myr

På et enda høyere modenhetsnivå kan en virtuell forbindelse beregnes gjennom terrenget i stedet for som en rett linje.

Da kan systemet finne:

> den mest hensiktsmessige forbindelsen gjennom terrenget

i stedet for:

> den geometrisk korteste forbindelsen.

---

# 11. Rutekostnad

MVP skal i utgangspunktet finne korteste rute.

En registrert kant kan derfor ha:

```text
cost = distanceMeters
```

En viktig arkitekturbeslutning er likevel at `distance` og `cost` skal være separate konsepter.

Eksempel:

```text
distance = 100 meter
cost = 100
```

Dette gjør at vi senere kan gi ulike segmenter forskjellige kostnader.

Eksempel:

```text
sti:
100 meter → cost 100

bilvei:
100 meter → cost 140

terreng:
100 meter → cost 180
```

Dermed kan RuteApp senere finne **beste rute** i stedet for bare matematisk korteste rute uten å endre grunnarkitekturen.

---

# 12. Rutemotor

Første versjon bør bruke en standard korteste-vei-algoritme.

Aktuelle algoritmer:

* Dijkstra
* A*

A* vil sannsynligvis være naturlig når grafen blir større.

Rutemotoren skal ikke kjenne brukergrensesnittet eller kartvisningen.

Den skal i prinsippet motta:

```text
start
destination
routingProfile
connectorSettings
```

og returnere:

```text
route
distance
cost
segments
metadata
```

---

# 13. Overordnet arkitektur

Diagrammet under illustrerer en mulig senere fysisk oppdeling med et API. Det er ikke besluttet om rutemotoren skal kjøre i nettleseren, i en backend eller på annen måte. De logiske grensene mellom presentasjon, dataintegrasjon og routingdomene gjelder uavhengig av valgt kjøremekanisme.

```text
┌─────────────────────────────────────┐
│             RuteApp Web             │
│                                     │
│ React + TypeScript                  │
│ MapLibre                            │
│ Mobile-first UI                     │
└──────────────────┬──────────────────┘
                   │
                   │ REST API
                   ▼
┌─────────────────────────────────────┐
│             RuteApp API             │
│                                     │
│ Route API                           │
│ Connector API                       │
│ Map/Data integration                │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│           Routing Domain            │
│                                     │
│ Graph Builder                       │
│ Connector Engine                    │
│ Routing Engine                      │
│ Route Analysis                      │
└─────────┬─────────────────┬─────────┘
          │                 │
          ▼                 ▼
┌────────────────┐   ┌────────────────┐
│ Routing data   │   │ Geographic data│
│                │   │                │
│ OSM            │   │ Kartverket     │
│ Turrutebase    │   │ høyde          │
│ FKB            │   │ vann etc.      │
└────────────────┘   └────────────────┘
```

---

# 14. Teknologistakk

Foreløpig anbefalt stack:

## Frontend

* React
* TypeScript
* Vite
* MapLibre GL JS
* TanStack Query

## Backend

* Node.js
* TypeScript
* Fastify
* Zod

## Geografiske data

* GeoJSON
* OpenStreetMap
* Kartverket
* senere PostGIS

## Database

Ingen database er nødvendig for den aller første tekniske prototypen.

Når behovet oppstår:

* PostgreSQL
* PostGIS

## Utvikling

* Git
* GitHub
* Docker
* Docker Compose
* VS Code / valgt vibe coding-miljø

---

# 15. Modulstruktur

Systemet bør deles i tydelige domener.

## Map

Ansvar:

* kartvisning
* zoom
* panorering
* kartlag
* markører
* rutegeometri

---

## Location

Ansvar:

* startpunkt
* målpunkt
* senere GPS-posisjon

---

## Routing

Ansvar:

* ruteberegning
* korteste vei
* ruteprofiler
* rutekostnader

---

## Graph

Ansvar:

* noder
* kanter
* nettverk
* topologi
* splitting av kanter
* grafbygging

---

## Connector

Ansvar:

* finne manglende forbindelser
* søke etter nærliggende nettverk
* opprette virtuelle forbindelser
* validere forbindelser
* beregne connector-kostnad

Connector skal være et førsteklasses domene i systemet, ikke hjelpekode inne i routing-modulen.

---

## Data Sources

Ansvar:

* OSM
* Kartverket
* senere Turrutebase
* senere FKB
* andre geografiske tjenester

Dette isolerer eksterne datakilder fra domenelogikken.

---

# 16. Foreslått mappestruktur

```text
ruteapp/
│
├── apps/
│   │
│   ├── web/
│   │   ├── src/
│   │   │
│   │   ├── components/
│   │   │
│   │   ├── features/
│   │   │   ├── map/
│   │   │   ├── location/
│   │   │   ├── route-planning/
│   │   │   └── route-result/
│   │   │
│   │   ├── services/
│   │   ├── stores/
│   │   ├── hooks/
│   │   └── types/
│   │
│   └── api/
│       ├── src/
│       │
│       ├── routes/
│       │
│       ├── domain/
│       │   ├── graph/
│       │   ├── routing/
│       │   └── connectors/
│       │
│       ├── integrations/
│       │   ├── osm/
│       │   ├── kartverket/
│       │   └── elevation/
│       │
│       └── server.ts
│
├── packages/
│   │
│   ├── contracts/
│   ├── geo/
│   └── shared/
│
├── data/
│   ├── osm/
│   └── generated/
│
├── infrastructure/
│   ├── docker/
│   └── docker-compose.yml
│
├── docs/
│   ├── architecture.md
│   ├── product.md
│   ├── data-sources.md
│   └── decisions/
│
├── tests/
│
├── README.md
└── package.json
```

---

# 17. API-prinsipp

Frontend skal ikke kjenne detaljene i rutemotoren.

Eksemplet under viser en mulig framtidig kontrakt. Det fastsetter ikke at rutemotoren skal eksponeres som et REST-API eller kjøre i en backend; dette er fortsatt et åpent arkitekturspørsmål.

Den skal eksempelvis kunne sende:

```http
POST /api/routes
```

med:

```json
{
  "start": {
    "latitude": 63.419,
    "longitude": 10.398
  },
  "destination": {
    "latitude": 63.405,
    "longitude": 10.355
  },
  "connectorSettings": {
    "enabled": true,
    "maxDistanceMeters": 200
  }
}
```

API-et kan returnere:

```json
{
  "distanceMeters": 4820,
  "networkDistanceMeters": 4590,
  "connectorDistanceMeters": 230,
  "connectorCount": 2,
  "geometry": {},
  "segments": []
}
```

Dette gjør frontend uavhengig av hvordan ruteberegningen faktisk implementeres.

---

# 18. Mobile-first-prinsipper

Selv om første løsning kjører i browser, skal følgende gjelde fra starten:

* touch skal være primær interaksjonsform
* knapper skal være store nok for mobil
* kartet skal bruke mesteparten av skjermen
* viktig informasjon skal kunne vises uten sidepanel
* funksjoner skal ikke kreve hover
* start og mål skal enkelt kunne flyttes med touch
* layout skal fungere i portrait-format
* nettverksbruk skal holdes moderat
* GPS-støtte skal kunne innføres uten redesign

Desktop skal naturligvis fungere, men skal ikke være den eneste designreferansen.

---

# 19. Personlige/kjente forbindelser

En viktig fremtidig funksjon er at brukeren skal kunne bekrefte en virtuell forbindelse.

Eksempel:

RuteApp foreslår:

```text
Sti A ●.........● Sti B
          137 m
```

Brukeren går forbindelsen og konstaterer at den fungerer.

Denne kan senere lagres som:

```text
USER_CONNECTOR
```

med eksempelvis:

```text
verified = true
```

Over tid kan RuteApp dermed bygge opp et personlig forbedret stinett.

Dette er spesielt relevant fordi løsningen i utgangspunktet utvikles for personlig bruk.

---

# 20. Videre produktutvikling

## MVP 1 – Finn veien

A → B.

* kart
* start
* mål
* korteste rute
* stinett
* virtuelle stikoblinger

Dette er nåværende fokus.

---

## MVP 2 – Følg ruten

* GPS
* nåværende posisjon
* fremdrift
* avstand til mål
* avvik fra ruten

---

## MVP 3 – ETA

* faktisk ganghastighet
* gjenværende distanse
* forventet ankomsttid
* stoppdeteksjon
* senere høydejustering

---

## MVP 4 – Bedre rutevalg

Profiler som:

* kortest
* mest sti
* minst bilvei
* minst stigning
* merkede ruter

---

## MVP 5 – Mitt turkart

* turhistorikk
* egne steder
* kjente stikoblinger
* personlige ruter
* egen hastighetsprofil
* GPX

---

## Senere

Mulige funksjoner:

* offline-kart
* offline-ruting
* rundtur
* ønsket distanse
* alternative ruter
* vær
* solnedgang
* terrenganalyse
* hundevennlige ruter
* vanskelighetsgrad
* kartlag
* mer avansert personlig rutemodell

---

# 21. Prinsipper for vibe coding

Utviklingen skal gjennomføres inkrementelt.

AI skal ikke få oppgaven:

> «Lag RuteApp.»

Arbeidet deles opp i små, testbare leveranser.

Eksempel:

### Steg 1

Opprett webapplikasjonen og vis kart.

### Steg 2

Velg startpunkt.

### Steg 3

Velg målpunkt.

### Steg 4

Last inn et begrenset stinett.

### Steg 5

Bygg graf.

### Steg 6

Beregn korteste rute gjennom sammenhengende graf.

### Steg 7

Identifiser frie stiendepunkter.

### Steg 8

Generer virtuelle forbindelser.

### Steg 9

La rutemotoren bruke virtuelle forbindelser.

### Steg 10

Visualiser forskjellen mellom registrert rute og virtuell forbindelse.

Hvert steg skal fungere før neste bygges.

---

# 22. Regler for generert kode

Følgende prinsipper skal brukes i vibe coding:

* TypeScript strict mode
* unngå `any`
* tydelige domenegrenser
* eksterne datakilder isoleres
* valider eksterne data
* ingen API-nøkler i frontend
* ikke installer biblioteker uten begrunnelse
* kritisk rutelogikk skal testes
* dokumenter arkitekturbeslutninger
* oppdater README når oppsettet endres
* ikke bygg funksjonalitet som ikke er etterspurt

Særlig viktig:

> AI skal ikke forenkle bort Connector-modulen ved å anta at manglende topologi betyr at det ikke finnes en rute.

---

# 23. Første tekniske mål

Første milepæl er ikke en komplett turapp.

Den er:

> **Å bevise at vi kan velge to punkter i et norsk kart og automatisk finne en fornuftig korteste rute mellom dem gjennom et stinett som også kan inneholde virtuelle forbindelser.**

Dette skal testes i områder brukeren kjenner godt.

Vi bør bevisst velge testcaser med:

1. fullstendig sammenhengende stinett
2. to stier med et lite gap
3. sti som stopper nær midten av en annen sti
4. flere mulige stikoblinger
5. tilfelle hvor ordinær sti gir omvei
6. tilfelle hvor ingen rute finnes uten virtuell forbindelse

Disse testene vil være viktigere enn design og ekstra funksjonalitet i første fase.

---

# 24. Suksesskriterium for MVP 1

MVP 1 er vellykket når:

> Brukeren på mobil eller desktop kan åpne RuteApp i nettleseren, velge A og B i kartet og få presentert en troverdig korteste rute som følger tilgjengelig stinett og ved behov bruker tydelig identifiserte virtuelle terrengforbindelser.

Hvis dette fungerer godt i reelle områder hvor ordinære kart- og ruteløsninger har problemer med manglende sammenkobling av stier, er RuteApps viktigste tekniske hypotese bevist.

---

# 25. Arkitekturprinsipp i én setning

> **RuteApp skal behandle kartlagt stinett som det foretrukne, men ikke absolutte, ferdselsnettverket og kunne komplettere dette med kontrollerte virtuelle terrengforbindelser for å finne ruter mellom vilkårlige punkter i naturen.**
