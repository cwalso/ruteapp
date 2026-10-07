# Kartverket-data som mulig supplement til routing

## Status og formål

Dette dokumentet oppsummerer en avgrenset diagnose utført 2026-08-09. Formålet var å undersøke om Kartverkets vektordata inneholder en reell forbindelse som mangler i OpenStreetMap-grunnlaget ved Kvalsjordænget i Nerskogen.

Diagnosen er ikke en beslutning om å integrere Kartverket-data i routinggrafen. Ingen routingdata, kostnadsregler, snapping eller virtuelle forbindelser ble endret.

Det kjente OSM-gapet ligger mellom:

- OSM-node `8332065102` på way `896319498` (`highway=service`): 62.768411, 9.554025
- OSM-node `13276455322` på way `1446990760` (`highway=path`): 62.7676604, 9.5536718
- geografisk luftlinje mellom nodene: 85,376 meter

## Undersøkte kilder og tilgang

### FKB-TraktorvegSti

Den offentlige spesialiserte WFS-tjenesten ble brukt:

```text
https://wms.geonorge.no/skwms1/wms.traktorveg_skogsbilveger
```

WFS-en svarte uten API-nøkkel eller innlogging. Den støttet blant annet GML og GeoJSON og eksponerte featuretypene `ms:traktorveg_sti` og `ms:skogsbilveg`. Et bbox-uttrekk på omtrent 600 × 600 meter rundt gapet ga 43 `LineString`-objekter fra `ms:traktorveg_sti`.

Den spesialiserte tjenesten har et redusert skjema. For objektene ved gapet ble følgende egenskaper eksponert:

- `objtype=Veglenke`
- `kommunenummer=5021`
- `typeveg=sti`
- vegkategori, vegfase, vegnummer, strekningnummer og klasselandbruksveg var tomme

GeoJSON-responsen inneholdt ikke objekt-ID. GML-responsen hadde tjenestespesifikke `gml:id`-verdier, men eksponerte ikke FKB-modellens stabile `identifikasjon.lokalId`, kvalitetsfelter eller `konnekteringslenke`. Disse GML-ID-ene må derfor ikke uten videre behandles som stabile kilde-ID-er.

Geonorges nedlastings-API opplyste at full FKB-nedlasting støtter polygon-, område-, format- og projeksjonsvalg, men krever en av rollene `nd.filnedlasting`, `nd.landbrukspart` eller `nd.filnedlasting.fkb`. Direkte tilgang gjennom NGIS/NGIS-OpenAPI krever også opprettet bruker og tildelte rettigheter.

### N50 Kartdata

N50 ble hentet anonymt fra Geonorges nedlastings-API som GML i EPSG:25833. API-et annonserte polygonvalg og godkjente et polygon på 1 × 1 kilometer, men leverte i praksis ferdigproduserte kommunefiler. Bare Oppdal-filen ble lastet ned og analysert midlertidig.

Leveransen var 29,7 MB komprimert. Analysen leste kun `N50Samferdsel`-delen, som var 7,2 MB ukomprimert. Samferdselsfilen inneholdt 5 524 `Veglenke`-objekter for kommunen.

N50 tilbys gjennom nedlastings-API-et som GML, SOSI, ESRI File Geodatabase og PostGIS. Datasettet er kartografisk generalisert for målestokk 1:50 000 og er derfor mindre detaljert enn FKB.

## Resultat for FKB-TraktorvegSti

FKB inneholder to `sti`-objekter som sammen danner en topologisk sammenhengende forbindelse mellom de to OSM-sidene:

| WFS `gml:id` | Treffer | Avstand til OSM-geometri | Lengde fra felles FKB-endepunkt |
| --- | --- | ---: | ---: |
| `traktorveg_sti.1524706` | OSM-side A | 0,057 m | 146,152 m |
| `traktorveg_sti.1524755` | OSM-side B | 0,165 m | 129,737 m |

Objektene deler nøyaktig samme endekoordinat i GeoJSON-uttrekket:

```text
latitude:  62.76817959050419
longitude: 9.551408406527013
```

Den samlede FKB-geometrien mellom nærmeste punkt på side A og side B er omtrent 275,890 meter. FKB fyller dermed ikke gapet med en direkte 85-meters linje. Kilden beskriver i stedet en kildeført, kurvet sti-geometri vestover fra side A til det felles endepunktet og tilbake mot side B.

Geometriene er topologisk koblet til hverandre i FKB-uttrekket. Koblingen mot OSM er geometrisk svært nær, men ikke representert ved felles kilde-ID-er. En eventuell sammenslåing av kildene må derfor utføre eksplisitt konnektering og duplikathåndtering.

Den reduserte WFS-en oppgir ikke om objektene er merket som `konnekteringslenke`. Full FKB-leveranse må undersøkes før objektene eventuelt kan klassifiseres som kildebekreftede, fysiske stier i routinggrafen.

## Resultat for N50 Kartdata

N50 bekreftet veien inn mot side A, men inneholdt ikke den sammenhengende stien som FKB viste mellom side A og side B.

Nærmeste N50-objekt ved side A var:

- `gml:id=id302d2868-74aa-45b0-b2e5-abce08fb73ad`
- `typeVeg=enkelBilveg`
- avstand til side A: 0,058 meter
- datafangstdato: 2014-06-14
- oppdateringsdato: 2017-03-08
- målemetode: `fot`
- oppgitt nøyaktighet: `100`

Dette objektet endte ved side A og hadde ingen annen N50-veglenke koblet til endepunktet. Det samme objektet var 85,677 meter fra side B. Nærmeste øvrige N50-veglenke til side B var 99,328 meter unna, og nærmeste objekt med `typeVeg=sti` var 126,716 meter unna.

N50 inneholdt derfor ingen topologisk forbindelse som fyller dette gapet. Resultatet er konsistent med at N50 er generalisert og primært tilrettelagt for kartframstilling i mindre målestokk.

## Vurdering av egnethet

FKB-TraktorvegSti er den klart mest relevante supplerende kilden for dette konkrete gapet. Den inneholder den manglende geometrien, skiller mellom stier og traktorveger og har i full datamodell stabile UUID-er, kvalitetsinformasjon, datoer og egenskapen `konnekteringslenke`.

Den offentlige spesial-WFS-en er teknisk enkel å bruke for små bbox-uttrekk og egner seg til diagnose. Den er ikke tilstrekkelig som produksjonsgrunnlag uten videre avklaring fordi den:

- har redusert attributtsett
- mangler stabile FKB-UUID-er i responsen
- mangler kvalitet, dato og `konnekteringslenke`
- er knyttet til et datasett som er klassifisert med begrenset tilgang

N50 er åpent, enkelt å laste ned og egnet som sekundært kontroll- eller fallbackgrunnlag. Det er ikke et godt førstevalg for automatisk komplettering av lokale stinett fordi generalisering kan fjerne eller flytte forbindelser som er viktige for routing.

## Isolert OSM + FKB-conflation-spike

En avgrenset implementasjonsspike ble gjennomført for det kjente A/B-caset. Spiken er et utviklingsverktøy under `scripts/routing/diagnostics/`; den er ikke koblet til browser-runtime, endrer ikke `public/data/routing/nerskogen.json` og tilfører ingen virtuelle edges.

Live-kontrollen hentet kun `ms:traktorveg_sti` i bbox-en `62.765,9.548,62.771,9.560,EPSG:4326`, omtrent 670 × 610 meter. WFS-en svarte HTTP 200 både som GML 3.2.1 og GeoJSON. GML ble brukt til å knytte de observerte, ikke-stabile tjeneste-ID-ene til objektene, mens GeoJSON ble brukt til høypresisjonsgeometrien. Det unngår at GML-responsens avrunding til seks desimaler påvirker de små conflation-avstandene.

En minimal deterministisk fixture beholder bare de to nødvendige `Veglenke`/`typeveg=sti`-objektene, kildeangivelse, midlertidig GML-ID og original `LineString`-geometri. Fixturen finnes utelukkende for den isolerte testen; den er ikke et FKB-uttrekk for produksjon eller distribusjon.

Normaliseringen gjorde følgende:

1. Behandlet begge kildeobjektene som ordinære `path`-edges med `distanceMeters` beregnet med Haversine og `cost = distanceMeters`.
2. Segmenterte de valgte linjene mellom påfølgende koordinater og dedupliserte det eksakt felles FKB-endepunktet.
3. Klippet `traktorveg_sti.1524706` ved OSM-node `8332065102`, 0,056922 meter unna.
4. Klippet `traktorveg_sti.1524755` ved nærmeste punkt til OSM-node `13276455322`, 0,164548 meter unna. Resten av dette objektet fortsetter langs nettet sør for koblingen og ble ikke importert, for å unngå å legge inn en åpenbar overlappende strekning.
5. La inn toveis, ordinære `path`-koblinger mellom OSM- og FKB-nodene. Koblingene er kildekonnektering av praktisk sammenfallende registrert geometri, ikke virtuelle terrengforbindelser.

Conflation-toleransen var konfigurerbar og satt til 1,0 meter. Den brukes bare når den diagnostiske hybridgrafen bygges og er helt separat fra brukerpunktets snap-avstand på 100 meter. En test bekrefter at 0,01 meter ikke er tilstrekkelig. Verdien 1 meter er bare validert for dette caset og er ikke besluttet som generell importregel.

Den avledede grafen består av den uendrede OSM-grafen, den manglende delen av de to FKB-objektene og de korte kildekoblingene. De importerte FKB-delene har 86 og 41 koordinater, som gir 125 fysiske FKB-segmenter. Ingen eksakt duplikate segmenter ble funnet; den kjente overlappen ble håndtert ved klipping, ikke av en generell dedupliseringsalgoritme.

### Routingresultat

Det samme A/B-caset ga følgende deterministiske resultater:

| Graf | Lengde | Antall valgte edges |
| --- | ---: | ---: |
| Ren OSM | 5 049,273725 m | 199 |
| OSM + FKB-spike | 720,253212 m | 204 |

Hybridruten er 4 329,020513 meter, eller omtrent 85,7 prosent, kortere enn OSM-ruten. Edgefordelingen i hybridruten var:

- OSM `path`: 66
- OSM `track`: 0
- OSM `road`: 11
- FKB `path`: 127, hvorav 125 følger FKB-kildegeometrien og 2 er conflation-koblinger
- `virtual`: 0

Ruten bruker begge FKB-objektene og passerer deres eksakt felles punkt ved longitude `9.551408406527013`, latitude `62.76817959050419`. Et generert, Git-ignorert GeoJSON viser valgt OSM-del, valgt FKB-del, importert FKB-geometri og de to conflation-punktene. Geometrien følger dermed den registrerte, kurvede FKB-stien og ikke en konstruert rett linje over OSM-gapet.

Den eksisterende rene OSM-regresjonstesten er beholdt uendret. En separat deterministisk test dokumenterer begge rutelengdene, proveniensfordelingen, at grunngrafen ikke muteres, at ingen virtuelle edges finnes, og at alle nye edges bevarer `distanceMeters >= luftlinje` og `cost >= distanceMeters`. A* og vanlig edge-snapping trengte ingen endringer.

Spiken kan kjøres mot fixturen med:

```text
npm run routing:conflation-spike
```

Live WFS kan kontrolleres eksplisitt med:

```text
npm run routing:conflation-spike -- --live
```

Live WFS brukes kun av utviklingsscriptet. Testene har ingen nettverksavhengighet.

## Utvidet validering i Nerskogen

En ny avgrenset valideringsspike ble gjennomført 2026-08-09 for å undersøke om resultatet fra det kjente Kvalsjordænget-caset også finnes andre steder i Nerskogen. Dette er fortsatt et utviklingsforsøk, ikke en produksjonsimport eller en endring av routingarkitekturen.

Kandidatfinneren hentet `ms:traktorveg_sti` fra den offentlige WFS-en i bbox-en `62.745,9.53,62.815,9.67,EPSG:4326`. Tjenesten svarte HTTP 200 både som GeoJSON og GML 3.2.1. Uttrekket inneholdt 2 429 `LineString`-objekter: 2 155 med `typeveg=sti` og 274 med `typeveg=traktorveg`. GeoJSON ble brukt til geometri, mens GML ble brukt til å knytte de valgte objektene til tjenestens `gml:id`. ID-ene er fortsatt markert som ikke-stabile fordi den reduserte WFS-en ikke eksponerer FKB-modellens `identifikasjon.lokalId`.

Det programatiske kandidatsøket valgte enkeltobjekter med minst 50 meter geometri, begge ender høyst 1 meter fra OSM-grafen og minst 5 meter avvik fra OSM ved et representativt midtpunkt. Deretter ble geografisk og topologisk ulike tilfeller valgt manuelt fra den rangerte listen. Denne utvelgelsen er bevisst skjev mot tilfeller der 1 meter allerede fungerer, og kan derfor ikke brukes som dokumentasjon for en generell 1-metersregel.

For hvert tilfelle ble det bygget en ny, avledet graf fra den uendrede OSM-grafen. FKB-endepunktene ble projisert til nærmeste OSM-edge, de berørte OSM-edgene ble splittet i den avledede grafen, og FKB-geometrien ble lagt inn toveis. `sti` ble behandlet som ordinær `path`, `traktorveg` som ordinær `track`, og alle nye edges fikk `cost = distanceMeters`. Ingen virtuelle edges ble opprettet. Sammenligningen bruker de projiserte OSM-posisjonene som A og B, slik at resultatet måler nettverkstopologien og ikke påvirkes av brukerpunktets snap-avstand på 100 meter.

### Valgte tilfeller og routingresultater

Fire positive tilfeller og ett negativt overlappstilfelle ble beholdt som deterministiske fixtures:

| Tilfelle | A (lat, lon) | B (lat, lon) | FKB-objekt og type | Ren OSM | Hybrid | Forbedring | Resultat |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| Østlig lang sti | 62.77899184, 9.63533292 | 62.77961838, 9.65414884 | `traktorveg_sti.1918241`, `sti` | 1 741,978 m | 1 005,076 m | 736,903 m / 42,3 % | Løst av FKB |
| Sørvestlig kort stikobling | 62.76065376, 9.53877539 | 62.76033832, 9.53948821 | `traktorveg_sti.1513650`, `sti` | 753,726 m | 56,872 m | 696,854 m / 92,5 % | Løst av FKB |
| Nordvestlig sti gjennom OSM-sløyfe | 62.79029028, 9.56571089 | 62.79109088, 9.56656692 | `traktorveg_sti.1916421`, `sti` | 340,777 m | 102,857 m | 237,920 m / 69,8 % | Løst av FKB |
| Sentral sti mellom vegsegmenter | 62.78677892, 9.58760074 | 62.78760147, 9.59038904 | `traktorveg_sti.1917705`, `sti` | 208,750 m | 170,183 m | 38,567 m / 18,5 % | Løst av FKB |
| Overlappende traktorveg | 62.76620339, 9.60684007 | 62.77206947, 9.60944005 | `traktorveg_sti.2397408`, `traktorveg` | 708,413 m | 708,413 m | 0,000 m / 0,0 % | Negativ kontroll; OSM ble valgt |

Alle fire positive hybridruter brukte den valgte FKB-geometrien og de to korte conflation-koblingene. Antall FKB-edges i rutene var henholdsvis 74, 36, 67 og 51. Den negative kontrollen brukte 48 OSM-`track`-edges og ingen FKB-edge. Samtlige fem ruter hadde `virtual=0`.

Tilfellene er både geografisk og topologisk forskjellige:

- Den østlige stien er 1 004,144 meter lang og forbinder OSM-way `520070983` (`highway=track`) med way `1467824571` (`highway=path`). Et punkt omtrent midt på FKB-linjen ligger 180,604 meter fra nærmeste OSM-edge. Dette er en lang, separat kildegeometri, ikke en liten rett kobling.
- Den sørvestlige stien er 56,331 meter lang og forbinder to forskjellige OSM-`path`-ways, `1446990790` og `1446990783`. OSM-nettet mangler den korte tverrforbindelsen og går 753,726 meter rundt.
- Det nordvestlige tilfellet er en 102,116 meter lang FKB-sti mellom to steder på samme OSM-way `127415121` (`highway=path`, `fixme=resurvey`). OSM-geometrien bruker en 340,777 meter lang sløyfe mellom stedene.
- Det sentrale tilfellet er en 170,166 meter lang FKB-sti mellom way `739634040` (`highway=service`) og way `300979292` (`highway=service`, `name=Sørøyåsveien`, `surface=gravel`, `toll=yes`). Her er gevinsten mindre, men fortsatt deterministisk og geometrisk sammenhengende.
- Den negative kontrollen er en 708,233 meter lang FKB-traktorveg som følger OSM-way `1103907918` (`highway=track`, `piste:type=nordic`). Alle de 163 FKB-koordinatene ligger innenfor 1 meter fra OSM, med gjennomsnittlig avstand 0,204 meter og maksimum 0,970 meter. OSM-ruten er marginalt kortere, så hybridgrafen velger korrekt den eksisterende OSM-kanten.

### Conflation-punkter

Alle koblinger lå innenfor den eksplisitte toleransen på 1 meter:

| Tilfelle | Endepunkt | OSM-edge | OSM-noder | OSM-type | Avstand |
| --- | --- | --- | --- | --- | ---: |
| Østlig lang sti | A | `520070983:17:f` | `6925396246`–`5069888587` | `track` | 0,098 m |
|  | B | `1467824571:51:f` | `13462519335`–`13462519334` | `path` | 0,834 m |
| Sørvestlig kort stikobling | A | `1446990790:13:f` | `13276456143`–`13276456142` | `path` | 0,193 m |
|  | B | `1446990783:72:f` | `13276455939`–`13276455938` | `path` | 0,349 m |
| Nordvestlig sti gjennom OSM-sløyfe | A | `127415121:18:f` | `12926382725`–`12926382724` | `path` | 0,110 m |
|  | B | `127415121:36:f` | `1410360370`–`5784910994` | `path` | 0,630 m |
| Sentral sti mellom vegsegmenter | A | `739634040:3:f` | `6925394244`–`6925394245` | `road` | 0,003 m |
|  | B | `300979292:2:f` | `6925387991`–`6925387992` | `road` | 0,014 m |
| Overlappende traktorveg | A | `1103907918:50:f` | `10101761635`–`10101761634` | `track` | 0,126 m |
|  | B | `1103907918:3:f` | `10101761668`–`10101761578` | `track` | 0,255 m |

Den største observerte endepunktsavstanden var 0,834 meter. Dette viser at 1 meter er tilstrekkelig for akkurat de selekterte tilfellene, men ikke at toleransen kan generaliseres. Kandidatfilteret utelukket på forhånd tilfeller med større avstand, og den reduserte WFS-en mangler målemetode og nøyaktighet som burde inngå i en generell regel.

### Overlapp, deduplisering og topologi

Ingen eksakt duplikate segmenter ble funnet i noen av de fem tilfellene. Den negative kontrollen viser hvorfor eksakt koordinatlikhet er utilstrekkelig: FKB og OSM beskriver praktisk talt samme traktorveg, men bruker ulike koordinatserier og segmentering. En generell importer må derfor kunne måle langsgående geometrisk overlapp og sammenligne klasse, retning og kildekvalitet før den legger inn parallelle edges.

Spiken kobler bare endepunktene til ett valgt FKB-objekt. Det var tilstrekkelig i de fire positive tilfellene, der de øvrige FKB-koordinatene i hovedsak ligger utenfor 1 meter fra OSM. Modellen er likevel for svak som generell topologibygger. Den oppdager ikke nødvendigvis interne kryss, nærtreff mellom objekter, kryss mellom FKB og OSM midt på linjer, planskilte kryss eller forbindelser som krever flere FKB-objekter. Det tidligere Kvalsjordænget-caset viser allerede behovet for å bevare topologi mellom flere FKB-objekter.

Fixtures og tester ligger bare under diagnostikk- og testområdene. Den eksisterende OSM-regresjonstesten er uendret. De nye testene dokumenterer de fem resultatene, typekoblingen `sti` → `path` og `traktorveg` → `track`, `cost = distanceMeters`, avstandsinvarianten, conflation-toleransen, fravær av virtuelle edges og at OSM-grunngrafen ikke muteres. Testene har ingen nettverksavhengighet.

Kandidatsøket kan gjentas mot live WFS med:

```text
npm run routing:fkb-candidates
```

De fem deterministiske tilfellene kan kjøres med:

```text
npm run routing:fkb-validation
```

Detaljerte resultater og GeoJSON skrives til det Git-ignorerte området `data/routing/diagnostics/`. Hele FKB-uttrekket beholdes ikke i repoet eller i `public/`.

### Anbefaling etter valideringen

Resultatene styrker hypotesen om at FKB-TraktorvegSti kan komplettere OSM med kildeførte, ordinære `path`-/`track`-forbindelser. Fire nye og topologisk ulike tilfeller ga kortere ruter uten virtuelle edges, mens den negative kontrollen viste at hybridgrafen kan beholde OSM-ruten når FKB ikke tilfører noe.

Det anbefales likevel mer validering før en generell importer eller ny ADR besluttes. Neste avgrensede arbeid bør bruke en autorisert full FKB-leveranse med stabile ID-er og kvalitetsmetadata, og må særskilt validere robust overlappsmatching, interne kryss, flerobjektstopologi, tilgang/gangbarhet, oppdaterbarhet og et ikke-selektert utvalg med avstander både under og over 1 meter. ADR-003 opprettes derfor ikke på grunnlag av denne spiken alene.

## Regler en generell conflation-løsning må avklare

Spiken beviser at supplerende, kildeført FKB-geometri kan brukes av dagens routingkjerne som ordinære edges. Den beviser ikke en generell eller landsdekkende conflation-algoritme. En senere løsning må minst avklare:

- **Kildeprioritet:** OSM kan fortsatt være basisgraf, mens FKB bare tilfører dokumentert manglende topologi. Ved overlapp må valget være eksplisitt og proveniens må beholdes; flere parallelle edges skal ikke oppstå bare fordi begge kilder beskriver samme ferdselslinje.
- **Geometrisk matching:** toleranse må bestemmes ut fra kildepresisjon, målemetode og objekttype. Én meter fungerte her, men må ikke generaliseres uten flere representative caser og kvalitetsmetadata.
- **Kryss og splitting:** geometriske kryss eller nærtreff som ikke deler node-ID krever eksplisitt projeksjon, splitting og kontroll av at objektene faktisk møtes i samme plan. Nærhet alene er ikke nok ved broer, kulverter eller planskilte kryss.
- **Dubletter:** linjer med litt ulik geometri må sammenlignes over en strekning, ikke bare ved endepunkter. Retning, overlapp, avvik, klasse og kildekvalitet må inngå før ett objekt velges eller geometrier flettes.
- **Klassifikasjon:** mapping mellom OSM `path`/`track`/`service` og FKB `typeVeg` må være eksplisitt. `typeVeg=sti` kan mappes til `path` i denne spiken, men øvrige verdier, adgang og gangbarhet krever egne regler.
- **Kildeproveniens:** en permanent modell bør kunne skille minst `osm`, `fkb` og `virtual`, beholde stabil kilde-ID når den finnes, uttrekks-/versjonsinformasjon, original geometri og om en edge er kildegeometri eller en conflation-kobling. Dette bør utformes som en egen import-/datasettkontrakt før `RoutingEdge` eventuelt utvides.
- **Oppdatering:** hybridgrafen må kunne regenereres deterministisk når OSM eller FKB endres. Endringer i kilde-ID-er, geometri og klassifikasjon må kunne spores, og gamle conflation-resultater må ikke bli liggende uten ny validering.

Resultatet støtter en ny kontrollert spike med flere representative testområder og full, autorisert FKB-leveranse. Det er for tidlig å anbefale en generell produksjonsimporter før tilgang, stabile identifikatorer, kvalitetsmetadata, lisens/distribusjon og reglene over er avklart.

## Krav til en eventuell generell importer

En framtidig generell importer bør ikke legge FKB-geometri direkte inn i dagens OSM-graf. Den bør minst:

1. hente en autorisert full FKB-leveranse med alle relevante egenskaper
2. transformere geometrien til et felles koordinatsystem og bevare kildegeometrien
3. beholde kilde, stabil objekt-ID, uttrekksdato, typeveg, kvalitet og `konnekteringslenke`
4. bygge intern topologi fra faktiske endepunkter og kryss i FKB
5. sammenligne FKB-segmenter med OSM og unngå doble, parallelle edges der geometriene overlapper
6. koble kildegeometrier med en dokumentert, liten toleranse og eksplisitt proveniens
7. skille kildebekreftede stier fra virtuelle terrengforbindelser
8. kontrollere tilgangs-, ferdsels- og sikkerhetsregler separat; `typeveg=sti` alene dokumenterer ikke alle slike forhold

Det kjente gapet bør brukes som en fast akseptansefixture: en FKB-basert import skal kunne representere den omtrent 276 meter lange stien, samtidig som eksisterende OSM-segmenter ikke dupliseres og dagens OSM-regresjonstest forblir uendret.

## Midlertidig runtime-bruk rundt 837/844

Den publiserte Nerskogen-prototypen inneholder per 2026-10-07 et kuratert FKB-supplement på 55 objekter rundt 837/844. Dette er et avgrenset utviklingsgrunnlag, ikke en beslutning om generell FKB-distribusjon eller produksjonsbruk.

Etter utvidelsen ble det funnet flere FKB-endepunkter som ligger praktisk sammenfallende med OSM-nettet, men som manglet eksplisitt topologisk kobling. Ti slike FKB–OSM-koblingspunkter er nå kuratert totalt. Alle ligger innenfor den eksisterende, case-spesifikke toleransen på 1 meter og kobles til en eksplisitt forventet OSM-edge. Dette er fortsatt ikke en generell conflation-regel.

Det offentlige FKB-uttrekket skal ikke utvides videre før rett til lagring og videre distribusjon er avklart. Videre arbeid med bredere FKB-dekning skal derfor skje i diagnostikk-/testgrunnlag eller med en autorisert leveranse, ikke ved å legge større uttrekk i `public/`.

## Lisens og kreditering

N50 Kartdata er oppført med Creative Commons Navngivelse 4.0 Internasjonal. Kartverkets anbefalte kreditering for åpne produkter er `© Kartverket`, med lenke til Kartverket der det er praktisk.

FKB-situasjonen er mer begrenset. Den undersøkte WFS-en var teknisk tilgjengelig uten autentisering, men FKB-datasettet er klassifisert med begrenset tilgang, full nedlasting krever Norge digitalt-/FKB-rolle, og metadataene viser til Norge digitalt-lisensen. Rett til produksjonsbruk, lagring og videre distribusjon må avklares med Kartverket/Geovekst før en integrasjon besluttes.

## Kilder

- [FKB-TraktorvegSti 5.1 produktspesifikasjon](https://dokument.geonorge.no/produktspesifikasjoner/fkb-traktorvegsti/Versjon%205.1/index.html)
- [FKB-TraktorvegSti og offentlig WFS i data.norge.no](https://data.norge.no/nb/datasets/bf7dae8d-4c90-3608-a761-252f3378e901/fkb-traktorvegsti)
- [NGIS-tilgang](https://kartverket.no/geodataarbeid/ngis)
- [N50 Kartdata i data.norge.no](https://data.norge.no/nb/datasets/b5f35cda-4c89-43a8-ad74-54cb218266ac/n50-kartdata)
- [Geonorge nedlastings-API](https://nedlasting.geonorge.no/swagger/index.html)
- [Kartverkets vilkår for åpne data](https://kartverket.no/api-og-data/vilkar-for-bruk)
