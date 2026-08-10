# Routing-aware cartography

**Arkitekturbeslutning:** [ADR-003: Routing-aware cartography](../decisions/ADR-003-routing-aware-cartography.md) – Accepted 2026-08-10

## Problemet fra brukerens perspektiv

Et generisk topografisk bakgrunnskart kan vise en sti som ikke finnes i RuteApps routinggrunnlag. Brukeren ser da en tilsynelatende normal sti, men kan verken snappe et rutepunkt til den eller få A* til å bruke den. For et arbeidsverktøy for ruteplanlegging er dette funksjonelt misvisende.

RuteApp har derfor vedtatt prinsippet **routing-aware cartography**:

> Rutbare lineære objekter som presenteres som RuteApps eget sti-/veinett, skal avledes fra samme normaliserte graf/datagrunnlag som brukes til snapping og ruteberegning.

Målet er én funksjonell sannhet for det nettet RuteApp selv fremstiller som rutbart. Prinsippet endrer ikke ADR-001s skille mellom kartpresentasjon og routing. Kartets presentasjonsmodell og routinggrafens tekniske modell er fortsatt separate, men de avledes fra samme normaliserte kildegrunnlag.

## Tre kartsemantiske roller

1. **Routable network:** RuteApps egne linjer for `path`, `track` og `road`. Disse representerer det normaliserte nettet som snapping og A* kan bruke.
2. **Terrain/context:** høydekurver, topper, høyder, vann, elver, myr, navn og bygninger. Dette gir orientering, men er ikke i seg selv et løfte om rutbarhet.
3. **Virtual connection:** en beregnet mulig forbindelse i terrenget. Den er ikke en registrert sti og bruker fortsatt et eget lilla/stiplet visuelt språk bare i valgt rute eller development-debug.

## Fra directed routinggraf til fysisk kartnett

Det genererte Nerskogen-datasettet er kilde for både routing og kartpresentasjon. `LoadedRoutingData.ordinaryGraph` er den uendrede normaliserte grafen som deretter danner grunnlag for snappinggrafen og grafen med virtuelle forbindelser. Karttransformasjonen arbeider på denne ordinære grafen og er uavhengig av React og MapLibre:

```text
normalisert routinggraf
↓
RoutableMapSegment[]
↓
GeoJSON FeatureCollection
↓
MapLibre-kilde med separate path/track/road-lag
```

Toveisforbindelser er lagret som motsatt rettede edges. `routableNetworkData.ts` lager en fysisk nøkkel av sorterte endenode-ID-er og edge-type. `A → B` og `B → A` med samme type samles derfor til ett `RoutableMapSegment`. En enveis-edge beholdes som ett segment. Segmentgeometrien orienteres deterministisk etter node-ID, kilde-edge-ID-ene sorteres, og segment-ID-en avledes deterministisk fra type og endenoder.

Presentasjonsmodellen endrer ikke `RoutingGraph`. GeoJSON-egenskapene begrenses til `segmentId` og `edgeType`; tekniske edge-ID-er beholdes i den rene segmentmodellen, men sendes ikke til MapLibre i denne spiken.

Virtuelle edges filtreres eksplisitt ut. Et virtuelt segment skal aldri bli tegnet som permanent del av det ordinære stinettet.

## Kartlag og første stil

Development-profilen **RuteApp Routing** bruker:

- Kartverkets `topo` WMTS som midlertidig terreng-/orienteringsbakgrunn
- RuteApps eget GeoJSON-nett over bakgrunnen
- ingen Fotrute-WMS
- eksisterende A/B/via, planleggingslinje, rute, virtuelle segmenter og development-debug

Det routbare nettet tegnes i tre rolige lag:

- `path`: smal grønn stipling
- `track`: noe kraftigere okerfarget lang stipling
- `road`: rolig blågrå heltrukket linje

Breddene skaleres mellom zoom 11, 14 og 16. Den aktive ruten beholder hvit casing og fem pikslers rød/lilla hovedlinje og dominerer derfor nettet.

Fotrute er slått av bare i RuteApp Routing. Fotrute viser registrerte fotturruter, men er ikke identisk med routinggrafen og ville dermed introdusert synlige linjer som ikke nødvendigvis kan snappes eller routes. Laget beholdes uendret i de tre andre profilene.

## Begrensningen i offentlig rasterbakgrunn

Kartverkets åpne WMTS tilbyr per 10. august 2026 `topo`, `topograatone`, `toporaster` og `sjokartraster`. De topografiske bakgrunnene har transportinformasjon ferdig rendret i rasterbildet. Den eksisterende, fungerende `topo`-profilen er valgt for spiken, men den fjerner ikke bakgrunnens stier og veier. Den kjente Kartverket-only-stien sør for Ørnkjellhaugan er derfor fortsatt synlig som rasterpiksler selv om den korrekt mangler i RuteApps grønne/oker/blågrå routable network.

Topografisk norgeskart WMS eksponerer mange separate tema, men å sette sammen høyde, vann, myr, navn og bygninger til et nytt komplett bakgrunnskart ville i praksis være en egen kartografisk/GIS-stack. Det gjøres ikke i denne arkitekturspiken.

Kartverket har [varslet et nytt topografisk bakgrunnskart](https://kartverket.no/om-kartverket/nyheter/alle/2026/juni/nytt-topografisk-bakgrunnskart-i-norgeskart) med dempede farger og bedre kombinasjon med temadata. Lansering i Norgeskart er oppgitt til 19. august 2026, med WMS/WMTS i løpet av august. Tjenesten er ikke tilgjengelig og verifiserbar for denne spiken. Den bør vurderes når capabilities faktisk publiserer den.

Full oppnåelse av «det brukeren ser som RuteApp-sti, er rutbart» krever på sikt en terrengbakgrunn uten konkurrerende transportlinjer. Dagens rasterbakgrunn er den viktigste gjenværende begrensningen, ikke GeoJSON- eller routingarkitekturen.

## Resultat for Nerskogen

Det committed datasettet inneholder 26 806 directed edges. Transformasjonen gir 13 403 fysiske segmenter og 3,23 MB ukomprimert GeoJSON. Målingen under `npm run routing:verify` brukte 69,3 ms på transformasjon i den aktuelle kjøringen. Tallet er en utviklingsmåling og ikke en stabil ytelsesgaranti.

MapLibre kan tegne nettet responsivt i Nerskogen på zoom 11–16. I den rene headless Edge-kontrollen nådde profilbyttet `idle` med GeoJSON-kilden lastet etter omtrent 1,1 sekund med varme kartfliser. Profilbytte reetablerer kilden og de tre lagene idempotent sammen med eksisterende app-genererte lag. Panorering og zoom ga ingen tydelig interaksjonsforsinkelse i det avgrensede testområdet.

Den samme kildegeometrien ligger bak synlig segment og edge-snapping. Manuell kontroll av `path`, `track` og `road` viste derfor samsvar mellom den fargede RuteApp-linjen, snapped koordinat og edge-type. Den kjente manglende OSM-forbindelsen forblir fraværende fra RuteApps nett og kan ikke brukes som ordinær edge.

## Skalering

Ett GeoJSON på 3,23 MB er akseptabelt for denne regionale spiken, men modellen skal ikke skaleres til hele Norge som én klientlastet FeatureCollection. Ved større dekning blir regional lasting, romlig utsnitt og sannsynligvis tile-basert levering nødvendig. Den rene transformasjonen og det stabile skillet mellom segmentmodell og MapLibre-kilde gjør det mulig å endre transportformat senere uten å endre routingsemantikken.

## Framtidig normalisering med flere kilder

Arkitekturen kan senere utvides slik:

```text
OSM + godkjent FKB-TraktorvegSti + eventuelle andre kilder
↓
normalisering, deduplisering og kilde-/regelkontroll
↓
RuteApps normaliserte routingnett
↓
snapping + A* + routable network-kartlag
```

FKB er ikke integrert i runtime. Tilgang, lisens, geometri, konflasjon og regler må avklares separat. Routing-aware cartography gjør imidlertid gevinsten tydelig: når en godkjent kilde faktisk tas inn i det normaliserte nettet, blir den samtidig tilgjengelig for snapping, routing og RuteApps egen karttegning.

## Anbefalt videre retning

Spiken demonstrerer arkitekturprinsippet, men er ikke et ferdig hovedkart. Neste steg bør være å evaluere Kartverkets varslede nye bakgrunn når den er publisert, og deretter teste en bakgrunn uten eller med svakere transportlinjer. Før landsdekkende bruk må det også utformes en regional/tile-basert leveransemodell.

Prinsippet påvirker produktsemantikk, normalisert datagrunnlag, snapping, routing og kartpresentasjon og er akseptert i ADR-003. Dette dokumentet beholder den tekniske implementasjonen, måleresultatene og de åpne kartografiske begrensningene fra spiken.
