# Virtuelle terrengforbindelser – første MVP

## Formål

Dette dokumentet beskriver den første, bevisst enkle implementasjonen av virtuelle terrengforbindelser i RuteApp. En virtuell forbindelse er en eksplisitt edge i rutegrafen mellom deler av det ordinære sti- og veinettet som ikke har topologisk forbindelse i routingdatasettet.

En virtuell forbindelse betyr ikke at terrenget er kontrollert eller at ferdsel er anbefalt, trygg eller tillatt.

## Skille mellom datakilder og virtuelle forbindelser

- OSM-rådata er det primære runtime-grunnlaget for ordinære `path`-, `track`- og `road`-edges.
- FKB-data er foreløpig bare brukt i avgrensede datakvalitets- og berikelsesspiker. En dokumentert FKB-sti er en eksisterende ferdselsåre og skal eventuelt inn som beriket/importert nett, ikke som `virtual`.
- En virtuell edge er en RuteApp-generert kandidat uten påstand om at en kartlagt sti finnes mellom koblingspunktene.

En registrert eller markert ordinær sti behandles som ordinært rutbart nett også når den krysser elv eller et annet terrengelement. Terrengobjektet alene skal ikke gjøre en registrert sti virtuell eller ugyldig. Prinsippet innebærer ikke en generell konklusjon om alle elvekryssinger; det bevarer skillet mellom registrert nett og RuteApp-genererte forbindelser.

Den rette geometrien til en same-component virtual edge representerer i MVP-en en mulig lokal forbindelse og dens omtrentlige direkteavstand. Den er ikke nødvendigvis en centimeterpresis GPS-trase som skal følges ordrett. Praktisk gange kan avvike lokalt, men denne versjonen beregner ikke kurvede omgåelser rundt bygninger, ballbinger eller andre objekter.

Marka Trails brukes som funksjonell benchmark for hva god baseline-routing bør kunne levere. Tjenesten er ikke datakilde for RuteApp og inngår ikke i kandidatgenereringen.

## Generering

Implementasjonen i `src/routing/virtualConnections.ts`:

1. lager en ordinær graf uten eksisterende virtuelle edges
2. finner svakt sammenhengende komponenter i denne grafen
3. dedupliserer motsatt rettede edges til fysiske segmenter
4. bruker en enkel romlig indeks til å finne segmentpar innenfor maksimalavstanden
5. beregner nærmeste punkt mellom begge edges, også når punktene ligger inne på edge-geometrien
6. beholder én deterministisk korteste kandidat per par av ordinære komponenter
7. splitter berørte ordinære edges i en avledet graf
8. legger inn forbindelsen begge veier med `edgeType = virtual`

Den første konfigurasjonen er:

```text
maxVirtualDistanceMeters = 200
virtualCostMultiplier = 3.0
```

Virtuell fysisk distanse er geografisk luftlinje mellom koblingspunktene. Routingkostnaden er distansen multiplisert med kostnadsfaktoren. Dette gjør ordinært nett billigere per meter, men lar A* velge en virtuell forbindelse når den gir lavere samlet kostnad eller er eneste kobling. A* er ikke endret og har ingen særlogikk for edge-typen.

Eksakt sammenfallende geometriske kryss med null meters avstand opprettes ikke automatisk i denne prototypen. Slike kryss kan blant annet være planskilte og krever en senere, eksplisitt regel.

## Grafgrenser og kjøretid

Det statiske OSM-datasettet og den opprinnelige cachede grafen muteres ikke. Virtuelle kandidater og nødvendige split-noder materialiseres i en avledet graf én gang når Nerskogen-dataene lastes. En parallell avledet snap-graf inneholder de samme ordinære splittene, men ingen virtuelle edges; A/B/via-punkter snapper derfor fortsatt bare til ordinært nett.

Generatoren er uavhengig av A*, MapLibre, React og OSM-importen. Den arbeider utelukkende på den interne `RoutingGraph`-modellen. Den kjente FKB-stien ved tidligere analysert OSM-gap importeres ikke og modelleres ikke som virtuell forbindelse. Identifiserte eksisterende ferdselsårer hører til databerikelse eller import, ikke virtualisering.

## Presentasjon og resultat

Et sammenslått waypoint-resultat eksponerer total distanse, total kostnad, ordnede edges, `virtualEdgeCount` og `virtualDistanceMeters`. Ordinære rutesegmenter vises heltrukket. Virtuelle segmenter vises med en tydelig lilla stipling som er forskjellig fra development-hjelpelinjen mellom brukerens rutepunkter. Ruteplanleggingspanelet viser en nøytral oppsummering når en rute inneholder terrengforbindelser.

App-genererte rutelag reetableres ved kartprofilbytte på samme måte som tidligere.

### Development-visning av kandidatsettet

I development mode vises hele det allerede genererte kandidatsettet som et separat, tynt og halvtransparent MapLibre-lag under den valgte ruten. Linjene bruker kandidatenes faktiske edge-til-edge-koblingskoordinater. Fire avstandskategorier fra 0–50 til 150–200 meter skilles med synkende linjebredde og opasitet. Klikkeflaten er bredere enn den synlige linjen, og et klikk viser kandidat-ID, distanse, komponenter og edges i en enkel popup. Kartlaget og klikkeflaten reetableres idempotent etter kartprofilbytte.

Development-ID-en har formatet `VC-XXXXXXXX` og er en deterministisk FNV-1a-hash av komponent-ID-er, edge-ID-er, posisjon langs begge edges og begge koblingskoordinatene. ID-en påvirkes derfor ikke av kandidatenes rekkefølge. Dersom datagrunnlag, kandidatgeometri eller generatorregler endres, kan ID-en endres fordi den da beskriver en annen kandidat.

Visningen brukes til empirisk gjennomgang av gode og dårlige kandidater før de første barrierereglene utformes. Den filtrerer ikke kandidatene og tilfører ingen ny vurdering: alle linjene bygger fortsatt bare på ordinær komponenttopologi og geografisk avstand.

`npm run routing:virtual-candidates` eksporterer det samme kandidatsettet og de samme development-ID-ene til `data/routing/diagnostics/virtual-candidates.geojson`. Området er Git-ignorert og er ikke del av runtime-dataene under `public/`.

## Begrensninger

Første MVP vurderer bare:

- at segmentene tilhører ulike ordinære komponenter
- at nærmeste geometriske avstand er større enn null og maksimalt 200 meter
- at samme komponentpar ikke får dupliserte kandidater

Den vurderer ikke:

- vann, elver, myr eller terrengtype
- høyde, helning eller stup
- bygninger, gjerder, jernbane eller andre barrierer
- eiendom, adgang eller ferdselsregler
- sesong, vær, underlag eller sikkerhet
- om en kort kobling innenfor samme komponent kan erstatte en urimelig lang omvei

Den siste begrensningen betyr at produksjonsgeneratoren ikke genererer virtuelle snarveier mellom to deler av samme sammenhengende OSM-komponent. Dette reduserer kandidatmengden og hindrer at den første geometriske modellen lager svært mange snarveier.

En separat diagnostikkspike analyserer slike mulige [same-component shortcuts](same-component-shortcuts.md) ved å sammenligne direkte geografisk avstand med ordinær nettverksavstand. Generatoren og hele kandidatsettet påvirker ikke vanlig routing eller den eksisterende component-gap-generatoren. Et kontrollert allowlist-eksperiment kan materialisere nøyaktig fire manuelt godkjente, preberegnede kandidater. Produksjonsrutingen bruker den godkjente shortcut-grafen, mens development-toggle brukes til å sammenligne baseline og godkjente shortcuts. De bruker samme `virtual`-semantikk og kostnadsfaktor som component-gap-forbindelser, men en separat allowlist og fixture; ingen automatisk produksjonspolicy er besluttet.

Den ekstra development-grafen bygges oppå dagens derived graph uten å mutere ordinary-grafen eller baseline-grafen. Kandidatens full-ID og underliggende edge-/punktdata er autoritative. Eksisterende splitting brukes også når koblingspunktet ligger inne på en edge, og shortcut-edges holdes utenfor snap-grafen og det ordinære routable map layer. I development mode bruker toggle av baseline-grafen; produksjonsbygget bruker den godkjente shortcut-grafen som standard.

## Nerskogen-diagnose

`npm run routing:virtual-candidates` kjører generatoren deterministisk mot det committed Nerskogen-datasettet. Etter at `secondary` ble tatt inn som ordinært road-backbone 7. oktober 2026, rapporterer gjeldende graf:

- 16 ordinære komponenter før generering
- 14 dedupliserte component-gap-kandidater
- 8 kandidater i 0–50 meter
- 3 kandidater i 50–100 meter
- 2 kandidater i 100–150 meter
- 1 kandidat i 150–200 meter
- 15 komponenter med minst én kandidat
- 3 svake komponenter etter at kandidatene er lagt til

Før `secondary` ble aktivert hadde samme område 57 ordinære komponenter, 91 kandidater, 52 komponenter med minst én kandidat og 7 komponenter etter materialisering. Policyendringen fjernet dermed 77 component-gap-kandidater som i stor grad skyldtes et manglende ordinært veinett i importen. Tallene beskriver fortsatt bare grafens topologi og geometriske nærhet; kandidatene er ikke dermed validert som sikre, tillatte eller fysisk farbare terrengforbindelser.

## Beskyttet case: Ørnkjellhaugan – kjent regresjon etter `secondary`

Før `secondary` ble aktivert var Ørnkjellhaugan et deterministisk golden case for sekvensen ordinært nett → virtuell terrengforbindelse → ordinært nett:

- startnode `8332025315`: longitude `9.554678`, latitude `62.769041`
- målnode `3079323663`: longitude `9.5515531`, latitude `62.7706953`
- ordinær edge A: `896319493:3:f`, `road`
- ordinær edge B: `303552729:1:f`, `track`
- virtuell distanse: `126.341823` meter
- total rutedistanse: omtrent `244,4` meter
- valgt edge-sekvens: `road → virtual → track`

Etter policyendringen ligger de to sidene fortsatt i forskjellige ordinary components, nå `10004160051` og `3079323657`. Caset er derfor fortsatt et component-gap og skal ikke flyttes til same-component-mekanismen.

Regresjonen skyldes i stedet regelen om at generatoren bare beholder én, globalt korteste kandidat per komponentpar. Når `secondary` gjør road-komponenten mye større, finnes en annen kobling på `72.873` meter mellom de samme to komponentene. Denne kandidaten fortrenger den lokale Ørnkjellhaugan-koblingen på `126.342` meter. Dagens rute mellom de to beskyttede punktene blir derfor omtrent `2 108,916` meter og bruker én virtuell forbindelse på `72.873` meter et annet sted i komponentparet.

Konsekvenskontrollen er låst i testene, sammen med en eksplisitt TODO for å gjenopprette den lokale forbindelsen. En senere retting må endre component-gap-kandidatutvalget slik at geografisk ulike, nyttige forbindelser mellom samme store komponentpar kan bevares uten å gjeninnføre de 77 obsolete kandidatene som `secondary` fjernet.
