# OSM-import for routing

## Formål og dataflyt

Første routingdatasett dekker et avgrenset område rundt Nerskogen og beviser denne utviklingsflyten:

```text
OpenStreetMap via Overpass
        ↓
rå Overpass-JSON i data/routing/raw/
        ↓
preprocessing i scripts/routing/
        ↓
kompakt RuteApp-datasett i public/data/routing/
        ↓
loadRoutingDataset
        ↓
RoutingGraph → A*
```

Overpass brukes bare av utviklerkommandoen `routing:fetch`. React-applikasjonen og routingkjernen kontakter ikke Overpass ved vanlig bruk. Den genererte JSON-filen er den statiske artefakten nettleseren laster fra `/data/routing/nerskogen.json`.

Råimporten og den aktive routingpolicyen er nå eksplisitt skilt. `routing:fetch` henter unionen av dagens aktive highway-klasser og klassene som analyseres i coverage-auditen til samme Git-ignorerte råsnapshot. `routing:build` filtrerer deretter med den aktive policyen. Dermed kan to importpolicyer sammenlignes mot nøyaktig samme OSM-snapshot uten at endringer i OSM mellom to hentinger forveksles med policy-effekt.

## Testområde

Områder konfigureres i `scripts/routing/routingAreas.ts`. Første område er Nerskogen:

```text
south: 62.735
west:   9.50
north: 62.825
east:   9.69
```

Området ble moderat utvidet 2026-08-09 fordi et naturlig manuelt testpunkt ved latitude `62.80280`, longitude `9.52499` lå like vest for den tidligere grensen `west=9.53`. Ny vestgrense gir omtrent 1,3 kilometer margin rundt punktet. Samtidig ble sør-, nord- og østgrensene flyttet noe for å redusere risikoen for en ny kunstig testgrense, uten å gjøre datasettet større enn det nettleserbaserte MVP-et trenger.

Den tidligere bbox-en var `62.745, 9.53, 62.815, 9.67`. Etter regenerering økte datasettet fra 10 604 til 13 341 noder, fra 21 330 til 26 806 rettede edges og fra 2 287 862 til 2 877 519 bytes. Importregler, access-tolkning, edge-type-mapping og kostnadsmodell er uendret.

Overpass returnerer hele ways som berører en bbox. Preprocessoren beholder derfor bare segmenter hvor begge endenoder ligger innenfor den konfigurerte bbox-en. Nerskogen er kun en datasettkonfigurasjon og er ikke hardkodet i routingkjernen.

## Kommandoer

```text
npm run routing:fetch
npm run routing:build
npm run routing:verify
npm run routing:audit-highways
```

- `routing:fetch` henter aktive og audit-relevante highway-klasser samt tilhørende OSM-noder til én regenererbar, Git-ignorert råfil.
- `routing:build` filtrerer råsnapshotet med den aktive highway-policyen og transformerer resultatet til `public/data/routing/nerskogen.json`.
- `routing:verify` laster det genererte datasettet, validerer edge-invariantene og kjører eksisterende A* over en automatisk valgt fler-edge-rute.
- `routing:audit-highways` sammenligner dagens policy med en eksplisitt utvidet analysepolicy fra samme råsnapshot. Rapporten skrives til `data/routing/diagnostics/` og endrer ikke runtime-datasettet.

Scriptfilene kjøres med Node sin innebygde TypeScript type-stripping og er verifisert med Node 24. Det er ikke lagt til en egen script-runner eller GIS-avhengighet.

## Første fotturutvalg

Følgende `highway`-verdier inkluderes:

| OSM highway | RuteApp edgeType |
| --- | --- |
| `path`, `footway`, `pedestrian`, `steps` | `path` |
| `track` | `track` |
| `service`, `unclassified`, `residential`, `living_street` | `road` |

Klasser utenfor den aktive listen kan ligge i det lokale råsnapshotet når de inngår i coverage-auditen, men de tas ikke inn i runtime-datasettet av den grunn. Den utvidede analysepolicyen omfatter foreløpig `primary`, `secondary`, `tertiary`, relevante `*_link`, `bridleway` og `cycleway`. Analysepolicyen er diagnostikk, ikke en beslutning om at alle disse klassene er gangbare eller skal inngå i routing.

Første access-regel er bevisst liten:

- `foot=no` og `foot=private` ekskluderes.
- `access=no` og `access=private` ekskluderes, med mindre `foot=yes`, `foot=designated` eller `foot=permissive` eksplisitt tillater fotgjengere.
- Andre access-verdier tolkes ikke utover dette i første versjon.

Vanlige forbindelser genereres begge veier. `oneway:foot=yes`, `true` eller `1` gir bare OSM-retningen, mens `oneway:foot=-1` gir motsatt retning. Generell `oneway` for kjøretøy brukes ikke som fotgjengerregel.

## Highway coverage-audit 7. oktober 2026

Dagens eksplisitte highway-liste ble kontrollert mot en utvidet policy fordi et manglende road backbone kan få ordinære OSM-forbindelser til å fremstå som separate komponenter og dermed skape falskt behov for FKB-supplement eller virtuelle forbindelser.

Auditen brukte samme OSM-snapshot, med OSM-tidsstempel `2026-10-07T10:05:10Z`, for begge policyene.

| Mål | Dagens policy | Utvidet audit-policy | Endring |
| --- | ---: | ---: | ---: |
| Ways | 1 023 | 1 033 | +10 |
| Noder | 14 737 | 15 147 | +410 |
| Fysiske segmenter | 14 820 | 15 301 | +481 |
| Samlet fysisk lengde | 186,40 km | 199,47 km | +13,07 km |
| Svakt sammenhengende komponenter | 60 | 16 | -44 |
| Noder i største komponent | 8 948 | 13 764 | +4 816 |

I dette Nerskogen-snapshotet var `secondary` den eneste av de foreslåtte tilleggsklassene som faktisk forekom. Det var nøyaktig 10 slike ways. En separat kontroll av objekttaggene viste at samtlige er segmenter av fylkesvei 6516: Nerskogsveien/Nerskogvegen, Minnillbrua og Grønbrua. Alle er asfalterte, har `maxspeed=60` eller `80`, og ingen hadde `foot=no`, `access=no`, `access=private` eller annen eksplisitt fotgjengerbegrensning.

De 10 `secondary`-wayene gjør at 45 tidligere separate baseline-komponenter samles i én større komponent. Det reduserer komponentantallet med 44. Det lengste enkeltobjektet i auditen, OSM way `5051607` på Nerskogsveien, er 3,65 km innenfor bbox-en og berører alene 20 baseline-komponenter. Effekten skyldes derfor ikke ti tilfeldige ekstra veier, men at dagens importpolicy utelater selve fylkesvegen som mange av de allerede importerte stiene og sidevegene er koblet til.

OSMs norske access-defaults angir gangtilgang for `secondary` når ingen mer spesifikk restriksjon overstyrer dette. Den norske highway-veiledningen bruker dessuten `secondary` for sekundære/øvrige fylkesveger med firesifret vegnummer, som Fv. 6516.

**Konklusjon:** `secondary` bør behandles som ordinært road backbone i den norske fotturmodellen, med de samme eksplisitte access-kontrollene som øvrige road-typer. Dette bør korrigeres før flere OSM-gap forsøkes løst med FKB eller virtuelle forbindelser. Auditen alene endrer ikke det committed runtime-datasettet; policyendring og regenerering gjøres som en egen, testbar leveranse.

Auditen ga ikke empirisk grunnlag i Nerskogen for å ta stilling til `primary`, `tertiary`, `*_link`, `bridleway` eller `cycleway`, siden disse klassene ikke forekom i snapshotet. De beholdes derfor som audit-kandidater og må vurderes mot representative områder før eventuell generell policyendring.

Referanser for OSM-tagging og implisitt tilgang:

- [OSM default access restrictions – Norway](https://wiki.openstreetmap.org/wiki/OSM_tags_for_routing/Access_restrictions#Norway)
- [OSM Norway/Highways](https://wiki.openstreetmap.org/wiki/Norway/Highways)

## Transformasjon og format

Hver inkluderte way splittes mellom påfølgende OSM-noder. OSM-node-ID-en brukes som intern node-ID. Hvert segment får en stabil edge-ID basert på way-ID, segmentindeks og retning.

`distanceMeters` beregnes med samme Haversine-funksjon som A*-heuristikken, og første kostnadsmodell setter `cost = distanceMeters`. Preprocessoren stopper dersom en edge bryter `distanceMeters >= luftlinje` eller `cost >= distanceMeters`.

Datasettet bruker kompakte tupler for å unngå gjentatte JSON-feltnavn:

```text
node: [id, longitude, latitude]
edge: [id, fromNodeId, toNodeId, distanceMeters, edgeType, cost]
```

`src/routing/routingDataset.ts` er adapteren som transformerer tuplene til `RoutingNode` og `RoutingEdge` og bygger en vanlig `RoutingGraph`. A* kjenner verken datasettformatet eller OSM.

Ved runtime validerer adapteren metadata, bbox, node-tupler og edge-tupler før grafen bygges. `src/services/nerskogenRoutingData.ts` cacher innlasting og graf på modulnivå, slik at det statiske datasettet bare hentes én gang per nettlesersesjon.

Rutepunkt må ligge innenfor datasettets bbox og ha et punkt på en routing-edge maksimalt 100 meter unna. `nearestRoutingEdgePoint.ts` finner nærmeste punkt på edge-geometrien med et lineært søk. Dette er tilstrekkelig raskt for det avgrensede Nerskogen-datasettet og er isolert slik at en romlig indeks kan innføres senere uten å påvirke A*, kartet eller featurelaget.

Regresjonstesten for punktet `62.80280, 9.52499` bekrefter at det ligger innenfor den nye bbox-en og snapper til OSM-edgen `127416855:14:f` av typen `path`, 18,8 meter unna. Caset konstruerer ingen forbindelse og bruker ikke virtuelle edges for å tvinge dekning.

Et snap midt på en edge representeres med en midlertidig node i en avledet graf som bare finnes under den aktuelle ruteberegningen. Alle berørte rettede edges splittes i rekkefølge rundt snap-punktene. Distanse og cost fordeles proporsjonalt, edge-typen bevares, og en eventuell motsatt edge splittes separat slik at retning fortsatt uttrykkes av grafen. Den cachede datasettgrafen modifiseres ikke. Originalt brukerpunkt og snapped routingpunkt beholdes som separate koordinater.

Routingresultatet gjør valgt edge, endenoder, snapped koordinat, snap-avstand og rutens edge-typer tilgjengelige for utviklingsdiagnostikk. Det gjør det mulig å fastslå om en visuelt uventet rute følger `path`, `track` eller `road` i OSM-datasettet. En sti som finnes i Norgeskart, men ikke i OSM-importen, blir ikke automatisk konstruert, koblet eller gitt en kunstig kostnad.

## Topologi og videre arbeid

Importen bevarer OSM-topologien innenfor bbox-en. Den snapper ikke noder, kobler ikke komponenter og genererer ingen virtuelle edges. Antall separate komponenter rapporteres fordi dette er relevant grunnlag for en senere, separat fase for virtuelle terrengforbindelser.

Kartverkets synlige kartgrunnlag og OSM kan ha forskjellig dekning og topologi. Edge-snapping forbedrer bare koblingen til den importerte OSM-topologien; den reparerer ikke slike datagap.

Datasettet bygger på OpenStreetMap-data under ODbL. Ved bruk og distribusjon skal krediteringen `© OpenStreetMap contributors` og lenke til [OpenStreetMaps opphavsretts- og lisensside](https://www.openstreetmap.org/copyright) følge datasettet eller presentasjonen.
