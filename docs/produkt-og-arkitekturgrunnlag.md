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

## 3.5 Routing-aware cartography

RuteApp skal ha én funksjonell sannhet for nettet som produktet selv presenterer som rutbart:

> Rutbare lineære objekter som vises som RuteApps eget sti-/veinett, skal avledes fra samme normaliserte datagrunnlag som brukes til snapping og ruteberegning.

Routinggrafens directed edges og kartets fysiske presentasjonssegmenter er separate modeller. Kartmodellen skal deduplisere samme fysiske segment og skal ikke fremstille virtuelle terrengforbindelser som registrerte stier. Terreng- og orienteringsinformasjon som høydekurver, topper, vann, myr, navn og bygninger kan fortsatt komme fra et uavhengig bakgrunnskart.

Prinsippet er en akseptert arkitekturbeslutning dokumentert i [ADR-003: Routing-aware cartography](decisions/ADR-003-routing-aware-cartography.md).

---

# 4. MVP 1

Første MVP skal være bevisst liten.

Målet er å bevise at RuteApps grunnidé fungerer.

## 4.1 Brukerhistorie

> Som bruker ønsker jeg å velge et startpunkt og et målpunkt i kartet og få beregnet korteste egnede fotturrute mellom punktene via tilgjengelige stier og nødvendige korte terrengforbindelser.

---

## 4.2 Brukerflyt

Brukeren:

1. åpner RuteApp
2. ser et topografisk kart
3. velger startpunkt
4. velger målpunkt
5. angir eller bruker standard maksimal stikoblingsavstand
6. velger «Finn rute»
7. får beregnet korteste egnede fotturrute
8. ser ruten i kartet
9. ser grunnleggende informasjon om ruten

## 4.3 Implementert rutepunktplanlegging

Før rutemotoren etableres, støtter applikasjonen interaktiv planlegging med en ordnet liste av geografiske rutepunkter. Første punkt er A, siste punkt er B når minst to punkter finnes, og punktene mellom dem er nummererte mellompunkter. Nye punkt legges sist, slik at tidligere B blir et mellompunkt når et nytt mål legges til.

Punkter kan dras, fjernes enkeltvis med høyreklikk og tømmes samlet. Roller og nummerering utledes på nytt etter hver endring. React-featurelaget eier punktlisten; MapLibre viser markører og rapporterer interaksjoner tilbake.

Når minst to punkt finnes, viser kartet en svak, prikket app-generert GeoJSON-hjelpelinje gjennom punktene. Samlet direkte avstand beregnes on the fly som summen av geografisk storcirkelavstand mellom påfølgende punkt. Hjelpelinjen og avstanden representerer direkte geometri, ikke en beregnet rute. Hjelpelinjen er synlig som standard i development mode og skjules i produksjon når en gyldig beregnet rute finnes.

Rutepunktene er nå koblet til det statiske Nerskogen-datasettet. Punkt innenfor datasettgrensen snappes til nærmeste punkt på en ordinær routing-edge når dette ligger maksimalt 100 meter unna. Brukerens opprinnelige koordinat og kartmarkør beholdes, mens snapped koordinat inngår i rutegeometrien. A* beregner en delrute for hvert påfølgende punktpar, og delrutene slås sammen til én rute med faktisk lengde langs routinggrafens edges. Den beregnede ruten er visuelt primær over hjelpelinjen. Ordinære rutesegmenter vises heltrukket, mens virtuelle terrengforbindelser vises lilla og stiplet. Endring, flytting eller fjerning av punkt beregner resultatet på nytt umiddelbart.

Etter vellykket routing samples den faktiske rutegeometrien, inkludert via-punkter og virtuelle segmenter, og høyder hentes gjennom en separat adapter mot Kartverkets Høydedata-API. Panelet viser en enkel høydeprofil, samlet stigning/fall og estimert gangtid. Dette er etterprosessering og presentasjon: høydedataene endrer ikke rutevalget eller routingkostnaden. Gangtiden er et statisk, generelt planleggingsestimat og ikke personlig hastighet eller live ETA.

Kartet er den primære arbeidsflaten. På desktop vises ruteinformasjonen i et smalt sidepanel; på mobil ligger et enkelt panel under kartet. Ruteoversikten prioriterer rutelengde, estimert tid, stigning, fall og høydeprofil før den kompakte listen over A, B og eventuelle mellompunkter. Direkte avstand og utviklingsdiagnostikk er sekundær informasjon. Virtuelle terrengforbindelser skal oppsummeres tydelig, men nøkternt, og skilles fra ordinære rutedeler uten å framstå som en garanti for farbarhet eller sikker ferdsel. Videre kartografisk utforming og evaluering av kartprofilene er et eget senere steg.

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
* vilkårlig antall mellompunkter
* flytting og fjerning av rutepunkter
* foreløpig planleggingslinje og geografisk avstand

### Ruting

* finne korteste egnede fotturrute
* følge registrerte stier og relevante gangbare veier
* bruke virtuelle terrengforbindelser
* konfigurere maksimal tillatt stikobling, eksempelvis 200 meter

### Presentasjon

Resultatet skal minimum vise:

* total distanse
* distanse på registrert nettverk
* distanse via virtuelle terrengforbindelser
* antall virtuelle forbindelser
* høydeprofil og samlet stigning/fall
* et enkelt estimat for gangtid

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
* løpende ETA basert på faktisk fremdrift
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

MapLibre GL JS er valgt som kart- og presentasjonsmotor. Kartverkets toporaster/turkart beholdes som etablert visuelt bakgrunnsalternativ, mens alternative profiler kan prøves uten å endre routingarkitekturen.

Kartarkitekturen skal være lagbasert og kildeuavhengig. MapLibre er presentasjonsmotor, mens bakgrunnskart og tematiske kartlag skal kunne konfigureres, byttes og kombineres uten at MapView eller routingarkitekturen må bygges om.

Kartverket-kartet er et presentasjonsgrunnlag og skal ikke behandles som routingdata eller kilde til routingtopologi. Første implementasjon bruker Kartverkets offisielle WMTS-cache for `toporaster` i Web Mercator (EPSG:3857). Tile-mønsteret og øvrig kartkonfigurasjon er isolert under `src/map/`, slik at bakgrunnskartet senere kan byttes uten å påvirke routingarkitekturen. Gjeldende krav til kreditering og bruksvilkår skal ivaretas og kontrolleres på nytt før produksjonssetting.

MapLibre skal vise bakgrunnskart, geografiske objekter og beregnede ruter, men skal ikke eie rutelogikk.

Kartverket toporaster er det første implementerte bakgrunnskartet og beholdes som alternativ, men løsningen er ikke permanent bundet til dette kartproduktet. Nerskogen brukes som standard utviklings- og testutsnitt.

Kartarkitekturen skal senere kunne kombinere bakgrunnskart med flere sommerstier og fotturruter, vinter- og skiløyper, sykkelruter, høyde- og terrenglag og andre relevante temalag. Fotrute er første implementerte temalag; konkrete datakilder for de øvrige framtidige lagene er ikke besluttet. Synlige temalag og routingdata er separate arkitekturbegreper; et lag brukeren ser, er ikke automatisk samme datasett eller representasjon som rutemotoren bruker.

### Kartografisk profilstudie

Kartverket Turkart (`toporaster`) beholdes som standard og referanse. To avgrensede utviklingsprofiler gjør det mulig å sammenligne Kartverkets skjermtilpassede fargekart (`topo`) og gråtonekart (`topograatone`) med samme Fotrute-lag og de samme applikasjonsgenererte objektene. Profilene er presentasjonsvalg og endrer ikke routing, høydedata eller vurderingen av virtuelle forbindelser.

Den tidligere OpenFreeMap-/Mapterhorn-baserte profilen RuteApp Sommer er fjernet. Studien fant ikke tilstrekkelig kartografisk gevinst til å beholde den ekstra leverandør- og lagstakken. Turkart anbefales fortsatt som primær profil fordi kritisk turinformasjon er tydeligst. Kartverket Topo er den sterkeste videre kandidaten for et roligere skjermkart og skal valideres bredere før et eventuelt bytte. Gråtoneprofilen gir sterk rutekontrast, men svekker den raske visuelle tolkningen av vann, myr og vegetasjon. Full sammenligning, tjenestegrunnlag og anbefaling er dokumentert i [Kartografisk profilstudie](architecture/cartographic-profile-study.md).

### Routing-aware cartography

Development-profilen RuteApp Routing bruker Kartverket Topo som midlertidig terrengbakgrunn og tegner RuteApps eget `path`/`track`/`road`-nett fra det normaliserte Nerskogen-datasettet. Motsatt rettede edges dedupliseres til fysiske kartsegmenter, mens virtuelle edges holdes utenfor basiskartet. Fotrute er slått av i denne profilen fordi laget kan vise registrerte ruter som ikke finnes i routinggrafen.

Den gjennomførte spiken demonstrerer samsvar mellom RuteApps synlige nett, snapping og A*. Prinsippet er akseptert i [ADR-003: Routing-aware cartography](decisions/ADR-003-routing-aware-cartography.md). Kartverkets rasterbakgrunn har fortsatt egne stier og veier bakt inn; dette er den viktigste gjenværende visuelle begrensningen. Implementasjon og måleresultater er dokumentert i [Routing-aware cartography](architecture/routing-aware-cartography.md).

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

Første OSM-preprocessing er implementert for en avgrenset bbox rundt Nerskogen. Overpass brukes kun som utviklingsverktøy for å hente rådata. Et separat script filtrerer et konservativt sommer-/fotturutvalg, splitter ways mellom påfølgende OSM-noder og genererer et kompakt statisk RuteApp-datasett. Nettleseren skal senere laste den genererte filen og skal ikke kontakte Overpass ved vanlig bruk.

Første import inkluderer `path`, `footway`, `pedestrian`, `steps`, `track`, `service`, `unclassified`, `residential` og `living_street`. Eksplisitt `foot=no`/`private` avvises, og generell `access=no`/`private` avvises dersom den ikke overstyres av eksplisitt tillatt fotgjengeradgang. Vanlige segmenter opprettes begge veier; enkel `oneway:foot` støttes. Detaljene er dokumentert i [OSM-import for routing](architecture/osm-routing-import.md).

Det visuelle Norgeskart-grunnlaget og OSM-routingdatasettet kan inneholde forskjellige stier og ulik topologi. Edge-snapping kobler brukerpunktet mer presist til de OSM-edgene som faktisk finnes, men skal ikke konstruere en sti som bare er synlig i bakgrunnskartet. Slike datagap skal diagnostiseres. En identifisert eksisterende ferdselsåre hører til senere databerikelse eller import, mens den første virtual-edge-regelen bare kan foreslå en eksplisitt, geometrisk terrengforbindelse mellom ulike ordinære komponenter.

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

Disse kildene er ikke primært routinggrunnlag i første MVP. Kartverkets høyder brukes nå til profil og generell tidsberegning etter at ruten er valgt, men påvirker ikke routinggraf eller kostnad. Høyde-, terreng- og barrieredata er særlig relevante for senere vurdering av virtuelle terrengforbindelser, for eksempel om en kort geometrisk forbindelse innebærer urimelig høydeforskjell eller andre terrengmessige problemer.

OSM skal derfor ikke bygges inn som en antakelse om at dette alltid vil være eneste rutekilde. Konkrete regler for berikelse og moden vurdering av virtuelle forbindelser er fortsatt åpne; den første implementerte avstandsregelen er bare en begrenset prototype.

## 7.4 Kartlagmodell

Kartinnhold skal forstås i fire kategorier:

1. **Bakgrunnslag** gir visuell kontekst. Kartverket toporaster er første implementerte bakgrunnslag og brukes ikke som routingdata.
2. **Tematiske lag** viser eksterne fagdata oppå et bakgrunnslag. Første implementerte temalag er Kartverkets Turrutebase – Fotrute. Fotrute beskriver registrerte fotturruter, ikke alle ordinære stier i terrenget. Laget kan senere vurderes som berikelse eller kvalitetssignal for routing, men visualisering og eventuell bruk i routing er separate roller. Det er ikke besluttet om eller hvordan Fotrute skal påvirke rutekostnad.
3. **RuteApps rutbare nett** er fysiske `path`/`track`/`road`-segmenter avledet fra samme normaliserte grunnlag som snapping og routing. Det er en kartpresentasjon av rutbar geometri, ikke en kopi av directed edges eller en separat rutekilde.
4. **Applikasjonsgenererte kartobjekter** omfatter blant annet rutepunkter, foreløpige planleggingslinjer, beregnede ruter, virtuelle forbindelser, markører og analyseresultater. Rutepunkter og den foreløpige linjen er nå implementert som dynamisk kartpresentasjon fra React-featurets state og inngår ikke i det statiske kartlagregisteret for eksterne kilder.

MapLibre presenterer innholdet i disse kategoriene, men skal ikke eie routinglogikk. Fotrute hentes fra Kartverkets Turrutebase WMS (`https://wms.geonorge.no/skwms1/wms.friluftsruter2`) med WMS 1.1.1 og vises som transparent raster i Web Mercator over de tre Kartverket-profilene. Dette er kun visualisering og inngår ikke i routingkjernen. Den separate OSM-integrasjonen bruker det preprocesserte, statiske Nerskogen-datasettet.

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
fromNodeId
toNodeId
distanceMeters
edgeType
cost
```

For virtuelle forbindelser kommer ytterligere metadata.

Det første genererte datasettet bruker OSM-noder som `RoutingNode` og oppretter rettede edges mellom hvert par av påfølgende noder i en inkludert way. `distanceMeters` beregnes geografisk mellom endepunktene og `cost` settes lik distansen. Datasetadapteren bygger den samme interne `RoutingGraph` som de deterministiske testgrafene bruker. OSM-topologien beholdes uendret; separate komponenter kobles ikke sammen i dette steget.

Nettleseren laster det genererte Nerskogen-datasettet fra `/data/routing/nerskogen.json`, validerer runtime-formatet og bygger grafen én gang per sesjon. Rutepunkt utenfor bbox-en, punkt uten routing-edge innenfor maksimal snap-avstand og punktpar uten sammenhengende rute gir separate, eksplisitte statuser. Det beregnes ingen delvis rute dersom ett av via-segmentene feiler.

Når et punkt snapper til midten av en edge, opprettes en midlertidig node i en avledet graf for den aktuelle ruteberegningen. Berørte rettede edges splittes proporsjonalt med bevart retning, fysisk lengde, kostnad og edge-type. Den cachede grafen modifiseres ikke. Flere A/B/via-punkter på samme edge behandles i stabil rekkefølge. Routingresultatet beholder originalt punkt, snapped koordinat, snap-avstand, valgt edge og en oppsummering av edge-typene i ruten som utviklingsdiagnostikk.

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

Den første implementasjonen er en enkel topologi- og avstandsbasert prototype:

1. finn svakt sammenhengende komponenter i det ordinære routingnettet
2. søk edge-til-edge mellom ulike komponenter innenfor maksimalt 200 meter
3. behold én deterministisk korteste kandidat per komponentpar
4. opprett nødvendige logiske koblingspunkter ved å splitte ordinære edges i en avledet graf
5. opprett rett geometrisk forbindelse begge veier med `edgeType = virtual`
6. sett fysisk distanse til luftlinjen og `cost` til distansen multiplisert med 3,0
7. la den uendrede A*-motoren vurdere forbindelsen etter samlet kostnad

Originalgrafen og OSM-datasettet muteres ikke. Kandidatgenereringen skjer én gang ved innlasting og er separat fra OSM-importen, rutemotoren, kartpresentasjonen og React. A/B/via-punkter snapper fortsatt bare til ordinære edges.

Prototypen vurderer ikke vann, myr, høyde, helning, bygninger, gjerder, eiendom, adgang, andre barrierer eller sikker ferdsel. Den kan derfor ikke bekrefte at en kandidat er fysisk farbar eller anbefalt. Foreløpig genereres bare forbindelser mellom ulike ordinære komponenter; urimelige omveier innenfor samme komponent utløser ikke en virtuell snarvei. En kjent eksisterende FKB-sti eller annen identifisert ferdselsåre skal behandles som databerikelse/import og aldri maskeres som en virtuell forbindelse. Detaljene er dokumentert i [Virtuelle terrengforbindelser – første MVP](architecture/virtual-terrain-connections.md).

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

MVP skal i utgangspunktet finne korteste egnede fotturrute. Den første routing-MVP-en gjelder ferdsel til fots. Ski- og sykkelruting er mulig framtidig utvikling, men skal ikke generaliseres inn i den første rutemodellen uten et konkret behov.

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

Første routingkjerne er nå implementert i TypeScript og kjører i nettleseren, uavhengig av React og MapLibre. Den bruker A* på en eksplisitt graf med ordinære og virtuelle edges. Geografisk luftlinjeavstand brukes som admissible heuristikk under modellens krav om at `cost` aldri er lavere enn fysisk `distanceMeters`.

En deterministisk testgraf beviser ordinær korteste rute, at en straffet virtuell edge kan velges bort, at en virtuell edge kan forbinde ellers adskilte nettverk, og at manglende rute returneres tydelig. I tillegg verifiseres A* mot det genererte OSM-datasettet for Nerskogen med en automatisk valgt fler-edge-rute.

UI-integrasjonen bruker samme routingkjerne. Via-punkter håndteres ved å beregne en delrute mellom hvert par av påfølgende rutepunkter og slå sammen nodesekvens, edges, distanse og kostnad uten duplikat i skjøten. Rutegeometrien starter og slutter ved de faktiske snapped koordinatene på routingnettet. Ordinære rutesegmenter er heltrukne, virtuelle segmenter er lilla og stiplede, og begge ligger visuelt over den svake, prikkede hjelpelinjen for direktegeometri. Lagene reetableres ved stilbytte. Resultatet oppgir eksplisitt antall virtuelle edges og samlet virtuell distanse. Høydedata behandles separat etter at rutegeometrien er funnet, og brukes nå til profil, stigning/fall og et enkelt gangtidsestimat som beskrevet i [Høydeprofil og estimert gangtid](architecture/elevation-and-walking-time.md). Beslutningen er dokumentert i [ADR-002: Routingarkitektur for første MVP](decisions/ADR-002-routingarkitektur.md).

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

Routingkjernen for første MVP kjører i nettleseren. Diagrammet under illustrerer en mulig senere fysisk oppdeling med et API dersom behov og datamengde tilsier det; det beskriver ikke dagens kjøremekanisme. De logiske grensene mellom presentasjon, dataintegrasjon og routingdomene gjelder uavhengig av en eventuell senere fysisk flytting.

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

Første MVP bruker routingkjernen direkte i nettleseren når UI-integrasjonen senere implementeres. Eksemplet under viser kun en mulig framtidig kontrakt dersom rutemotoren senere flyttes bak et API.

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
* korteste egnede fotturrute
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

> **Å bevise at vi kan velge to punkter i et norsk kart og automatisk finne en fornuftig korteste fotturrute mellom dem gjennom et stinett som også kan inneholde virtuelle forbindelser.**

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

> Brukeren på mobil eller desktop kan åpne RuteApp i nettleseren, velge A og B i kartet og få presentert en troverdig korteste fotturrute som følger tilgjengelig stinett og ved behov bruker tydelig identifiserte virtuelle terrengforbindelser.

Hvis dette fungerer godt i reelle områder hvor ordinære kart- og ruteløsninger har problemer med manglende sammenkobling av stier, er RuteApps viktigste tekniske hypotese bevist.

---

# 25. Arkitekturprinsipp i én setning

> **RuteApp skal behandle kartlagt stinett som det foretrukne, men ikke absolutte, ferdselsnettverket og kunne komplettere dette med kontrollerte virtuelle terrengforbindelser for å finne ruter mellom vilkårlige punkter i naturen.**
