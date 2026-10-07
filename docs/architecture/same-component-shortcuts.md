# Same-component shortcut candidates

## Formål og status

Dette dokumentet beskriver en diagnostikkspike for mulige lokale forbindelser mellom geografisk nærliggende deler av samme ordinære routingkomponent. Den generelle spiken oppdager og eksporterer kandidater, men materialiserer dem ikke automatisk som `virtual`-edges. Vanlig ruteberegning og produksjonsbygget er derfor uendret.

Et separat, kontrollert development-eksperiment kan materialisere fire manuelt godkjente kandidater når brukeren slår på en toggle. Dette er ikke en ny arkitekturbeslutning eller en produksjonsregel. Kandidatene må fortsatt evalueres før terskler, terrengregler eller generell materialisering kan besluttes.

## To kandidattyper

RuteApp skiller diagnostisk mellom:

1. **Component-gap candidate:** to ordinære segmenter ligger i forskjellige weakly connected components. Eksisterende `virtualConnections.ts` finner og materialiserer én kandidat per komponentpar i en avledet graf.
2. **Same-component shortcut candidate:** to ordinære segmenter ligger i samme weakly connected component, men den korteste ordinære nettverksveien mellom dem er uforholdsmessig lang sammenlignet med den direkte geografiske avstanden. `sameComponentShortcutCandidates.ts` finner diagnostiske kandidater. Kun den eksplisitte development-allowlisten beskrevet under kan materialiseres.

Ørnkjellhaugan-golden-caset tilhører den første kategorien og skal ikke emitteres av same-component-generatoren.

## Kandidatmodell

En kandidat inneholder stabil kandidat-ID, komponent-ID, edge-ID og edge-type for begge sider, faktiske koblingskoordinater, posisjon langs begge edges, direkte geografisk avstand, ordinær nettverksavstand, nettverkskostnad og `detourRatio`:

```text
detourRatio = ordinaryNetworkDistanceMeters / directDistanceMeters
```

Modellen inneholder ingen UI-formatert tekst og kjenner ikke React, MapLibre, OSM-format eller eksterne datakilder.

## Diagnostiske terskler

Tersklene ligger separat i `sameComponentShortcutConfig.ts` og påvirker ikke produksjonskonfigurasjonen for virtuelle forbindelser:

```text
minimumDirectDistanceMeters = 10
maximumDirectDistanceMeters = 200
minimumOrdinaryNetworkDistanceMeters = 500
minimumDetourRatio = 5
deduplicationRadiusMeters = 30
```

Maksimal direkteavstand følger foreløpig samme 200-meters utgangspunkt som component-gap-modellen. Verdiene er konservative diagnostikkverdier, ikke vedtatte produksjonsterskler.

## Geografisk nærhet

Generatoren lager først én fysisk segmentrepresentasjon for motsatt rettede ordinary edges. `path`, `track` og `road` behandles separat; virtuelle edges filtreres ut før all analyse. Segmentene legges i en enkel lokal, meterbasert gridindeks, slik at bare romlig nærliggende segmentpar sammenlignes. Dette unngår full O(N²)-sammenligning av alle 15 301 fysiske Nerskogen-segmenter.

Nærmeste punkt beregnes edge-til-edge i en lokal planprojeksjon. Punktene kan ligge inne på begge segmentene; direkte avstand etterberegnes med den delte geografiske Haversine-funksjonen. Samme fysiske segment, segmenter som deler node, forskjellige komponenter og avstander utenfor 10–200 meter filtreres før nettverkssøk.

## Ordinær nettverksavstand

Nettverksmålingen arbeider på en ny ordinary graph uten `virtual`-edges. Et edge-interior-punkt håndteres uten å mutere eller materialisere en ny graf: den proporsjonale deldistansen og delkostnaden til hvert lovlig rettet endepunkt kombineres med eksisterende A* mellom endepunktene. Begge retninger vurderes, og korteste målte ordinære distanse beholdes. Dette tilsvarer edge-splitting for den nåværende lineære edge-modellen, men unngår å kopiere hele grafen for hvert kandidatpar.

A* er ikke endret. I dagens ordinære Nerskogen-datasett er `cost` lik fysisk distanse, slik at den kostnadsoptimale ruten også er riktig måling av ordinær nettverksdistanse for spiken. Ruter mellom samme node håndteres uten A*-kall, og gjentatte endenodepar caches innen én diagnosekjøring.

## Deduplisering

Mange edge-par kan beskrive samme lokale gap. Kandidater som passerer nettverks- og ratiofiltrene sorteres deterministisk etter høyest ratio, deretter kortest direkteavstand, lengst nettverksavstand og kandidat-ID. En kandidat forkastes dersom begge koblingspunktene ligger innenfor 30 meter fra et allerede valgt kandidatpar, uavhengig av orientering.

Dette er en enkel lokal klyngeregel. Den kan både beholde flere kandidater i et større gap og slå sammen nærliggende alternativer; resultatet er derfor et inspeksjonsgrunnlag, ikke et fasitsvar.

## Nerskogen-diagnostikk

`npm run routing:same-component-candidates` kjører mot det committed Nerskogen-datasettet og eksporterer Git-ignorert GeoJSON til `data/routing/diagnostics/same-component-shortcuts.geojson`.

Målingen mot gjeldende datasett 7. oktober 2026 ga:

- 16 ordinary components
- 15 301 fysiske ordinary-segmenter
- 3 733 804 unike geografiske segmentpar vurdert etter gridindeksering
- 750 865 par innenfor 10–200 meter sendt til nettverksmåling
- 1 565 848 faktiske A*-kjøringer etter cache
- 26 772 kandidater før lokal deduplisering
- 2 118 kandidater etter deduplisering
- omtrent 62,5 sekunder samlet kjøretid i den kontrollerte CI-kjøringen

Den tidligere målingen før `secondary` ble aktivert hadde 57 komponenter, 13 403 segmenter og 1 659 dedupliserte kandidater. Tallene er diagnostikkmålinger og ikke ytelsesgarantier.

Kjøretiden er akseptabel for et eksplisitt, lokalt diagnostikkscript, men ikke for runtime eller interaktiv bruk. Kandidatmengden viser også at terreng-, barriere- og datakvalitetsvurdering er nødvendig før eventuell materialisering. Videre ytelsesarbeid bør først vurderes etter manuell analyse av funnene.

## Kjent lang omvei sør for Ørnkjellhaugen

Det tidligere dokumenterte caset med omtrent 5 km ordinær omvei ble funnet:

- kandidat: `same-component-shortcut:1446990760:1:f:1.000000:896319498:8:f:1.000000`
- edges: `1446990760:1:f` (`path`) og `896319498:8:f` (`road`)
- direkte avstand: 85,4 meter
- ordinær nettverksavstand i gjeldende graf: omtrent 2 913,0 meter
- detour ratio i gjeldende graf: omtrent 34,1
- koblingspunktene samsvarer med de tidligere identifiserte gapnodene `13276455322` og `8332065102`

Etter at `secondary` ble aktivert er den ordinære ruten mellom brukerkoordinatene omtrent 2 911,7 meter over 235 edges. Spiken påviser fortsatt kandidaten, men endrer ikke ruten.

Ørnkjellhaugan-casets edges `896319493:3:f` og `303552729:1:f` ligger fortsatt i forskjellige ordinary components etter `secondary`, nå `10004160051` og `3079323657`. Paret emitteres derfor korrekt ikke av same-component-generatoren. Den observerte ruteregresjonen etter policyendringen må løses i component-gap-kandidatutvalget, ikke ved å flytte caset til same-component.

## GeoJSON og development-evaluering

GeoJSON-eksporten inneholder én `LineString` mellom hvert kandidats faktiske koblingspunkter. Properties omfatter kandidat-ID, direkte avstand, nettverksavstand, ratio, komponent, edge-ID-er og edge-typer. Artefakten er regenererbar og Git-ignorert.

Den komplette analysen kjøres fortsatt offline med diagnostikkscriptet. Vites development-server eksponerer den Git-ignorerte filen gjennom et lokalt development-endepunkt; generatoren importeres eller kjøres ikke i nettleseren. Endepunktet, kontrollene, popupen og det app-genererte MapLibre-laget finnes bare når `import.meta.env.DEV` er sann og inngår ikke i produksjonsbygget.

Development-kartet viser som standard de 20 kandidatene med høyest `detourRatio`. Kontrollene kan vise topp 20, 50, 100 eller alle og filtrere på minimum ratio og maksimal direkteavstand. Kandidatene tegnes som tynne, stiplede amberlinjer og kan inspiseres via et separat, bredere hit-test-lag. Popupen viser en kort deterministisk `SC-`-ID, direkteavstand, ordinær nettverksavstand, ratio og edge-typer; full kandidat-ID og edge-ID-er er sekundær informasjon.

Referansecaset sør for Ørnkjellhaugen kan åpnes med development-handlingen «Zoom til referansecase». Handlingen velger `RuteApp Routing` slik at shortcut-kandidaten kan vurderes sammen med det rutbare nettet. Den deterministiske full-ID-en er `same-component-shortcut:1446990760:1:f:1.000000:896319498:8:f:1.000000`.

Kartvisningen er bare et evalueringsverktøy. Den materialiserer ingen kandidat som edge, muterer ingen routinggraf og påvirker ikke A*, snapping eller beregnede ruter. Ved større geografisk dekning vil interaktiv evaluering sannsynligvis kreve preberegnede og geografisk avgrensede shortcut-data; den kostbare analysen skal fortsatt ikke flyttes til nettleseren.

## Manuell klassifisering og kontrollert routing-eksperiment

Et lite manuelt utvalg er vurdert for å teste selve routingmekanismen:

**Godkjent utvalg (fixture-metadata fra den opprinnelige manuelle vurderingen før `secondary`):**

- `SC-C4239590`, 85,4 meter direkte og 5 053,4 meter ordinary network distance: brukbar eksperimentell forbindelse.
- `SC-9F0B4DCE`, 41,1 meter direkte og 3 695,9 meter ordinary network distance: naturlig terrenggap.
- `SC-D959F701`, 57,1 meter direkte og 3 661,7 meter ordinary network distance: klassisk lokalt forbindelsesgap.
- `SC-CF2E56FE`, 38,4 meter direkte og 2 597,8 meter ordinary network distance: plausibel lokal forbindelse. Praktisk gange kan gå litt rundt ballbingen; den rette virtual-edge-geometrien er ikke en centimeterpresis GPS-instruksjon.

**Avvist:**

- `SC-F7D90B7B`: bratt terreng, bred elv og unaturlig lokal kobling.

**Ikke relevant som shortcut-evalueringscase:**

- `SC-E6B34D30`: den registrerte ordinære stien går allerede over elva ved et vadested. Elvekryssingen er derfor ordinary routing, ikke grunnlag for en virtual edge.

`sameComponentShortcutDevAllowlist.ts` inneholder kun de fire godkjente deterministiske full-ID-ene. Nettverksavstand og detour ratio i den preberegnede fixturen er historiske evalueringsmetadata; routingkostnaden for materialiserte shortcuts beregnes fra direkteavstanden og `virtualCostMultiplier`, ikke fra disse historiske nettverksmålene. `SC-XXXXXXXX` brukes fortsatt bare som display-ID og er ikke routingidentitet. En liten preberegnet fixture i `sameComponentShortcutDevCandidates.ts` inneholder full kandidatdata for de samme fire. Dermed kjøres ikke den 50–70 sekunder lange generatoren i nettleseren, og de øvrige 1 655 kandidatene legges ikke i runtime-fixturen.

I development mode bygges en ekstra derived graph fra dagens component-gap-graf. `sameComponentShortcutMaterialization.ts` finner kandidatens faktiske punkt på den navngitte ordinary edgen, bruker eksisterende robuste edge-splitting og legger forbindelsen inn begge veier med `edgeType = virtual`. Retning, proporsjonal distanse, proporsjonal cost og ordinary edge-type bevares i de splittede delene. Den cachede ordinary-grafen og dagens derived graph muteres ikke. Shortcutens cost bruker samme `virtualCostMultiplier = 3` som component-gap-forbindelsene.

Development-kontrollen «Bruk godkjente shortcuts i routing» er av som standard. Av betyr dagens graf og dagens rutevalg. På velger den ekstra grafen med fire mulige virtual edges. Brukte shortcuts inngår dermed automatisk i eksisterende lilla stiplede rutevisualisering, `virtualEdgeCount`, `virtualDistanceMeters`, høydegeometri og gangtidsgrunnlag. De inngår aldri i RuteApps ordinære routable map layer.

En same-component virtual edge representerer i denne MVP-en en mulig lokal forbindelse mellom to deler av nettet. Den rette linjen uttrykker routingkoblingen og dens omtrentlige direkteavstand, men skal ikke tolkes som at brukeren nødvendigvis må følge nøyaktig denne GPS-traseen. Lokale objekter kan gjøre at praktisk gange avviker noe. Eksperimentet beregner ikke en kurvet omgåelse rundt slike objekter.

En registrert eller markert ordinary sti forblir ordinært rutbart nett også når den krysser elv eller et annet terrengelement. Terrengobjektet alene gjør ikke en registrert sti virtuell eller ugyldig. Dette sier ikke at alle elvekryssinger er uproblematiske; det presiserer skillet mellom eksisterende ordinær nettgeometri og RuteApp-genererte virtual edges.

Dette eksperimentet innfører ingen automatisk policy basert på ratio, avstand eller kandidatklasse. Det innfører heller ingen vann-, elve-, bratthets-, bygnings- eller myrregel. En eventuell generalisering krever en senere eksplisitt beslutning.

## Begrensninger og videre retning

Kandidatgeneratoren vurderer ikke vann, elv, myr, høyde, bratthet, bygninger, eiendom, adgang eller sikker ferdsel. Den bruker heller ikke Kartverkets rasterkart, FKB eller andre eksterne datakilder som routingdata.

Neste naturlige steg er manuell A/B-evaluering av de fire godkjente forbindelsene i kartet. Resultatene bør brukes til å vurdere om mekanismen gir naturlige brukerresultater før terskler, deduplisering og framtidige terreng-/barrieresignaler vurderes. Ingen automatisk produksjonspolicy er besluttet.
