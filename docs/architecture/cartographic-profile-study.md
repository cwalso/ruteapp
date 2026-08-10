# Kartografisk profilstudie

## Formål og avgrensning

Studien sammenligner et lite antall visuelle kartprofiler for sommerbasert fotturplanlegging i RuteApp. Kartverket Turkart er referansen og fortsatt standard. Studien endrer ikke routinggrunnlaget, høydedata, virtuelle forbindelser eller MapLibre-arkitekturen.

Profilene er undersøkt i Nerskogen ved omtrent zoom 11–16, med særlig oppmerksomhet på Ørnkjellhaugan, Svartdalstjønna, Minnilldalen og Sørøyåsen. Desktop og smale mobilbredder inngår i kontrollen.

## Offisielle tjenester som ble undersøkt

Kartverkets [offisielle cachetjeneste](https://cache.kartverket.no/) tilbyr WMTS-lagene `topo`, `topograatone`, `toporaster` og `sjokartraster` i blant annet Web Mercator. Tjenestens capabilities oppgir PNG-fliser og zoomnivå 0–18 for Web Mercator.

Kartverkets beskrivelse av [ny cachetjenestestruktur](https://www.geonorge.no/aktuelt/Se-siste-nyheter/store-endringer-i-kartverkets-cachetjenester/ny-tjenestestuktur/) sier at `topo` er et fargekart tilpasset web og kombinerer N50–N2000, FKB, matrikkel- og høyde-/dybdedata. `topograatone` har samme innhold i gråtoner. `toporaster` kombinerer rasterkartseriene N50–N2000 og N5.

[Topografisk norgeskart WMS](https://data.norge.no/nb/data-services/68959b9b-1e1e-3ec3-b532-d2dbab6c1ced/topografisk-norgeskart-wms) ble undersøkt gjennom capabilities. Tjenesten eksponerer blant annet høydekurver, høydepunkt, fjellskygge, vann, bygninger, traktorveg/sti og stedsnavn som mulige separate lag. Slike lag ble ikke stablet oppå WMTS-kartene i denne spiken: de samme informasjonsklassene finnes allerede i de sammensatte bakgrunnene, og ekstra WMS-lag ville gitt mer nettverk, kompleksitet og risiko for dobbelttegning uten et klart behov.

Kartverkets [stedsnavndata](https://www.kartverket.no/til-lands/stadnamn) ble brukt til å verifisere lokale navn. Separate stedsnavn-, topp- eller høydepunktlag er derfor teknisk mulige senere, men er ikke nødvendige i de tre profilene som nå testes.

## Implementerte profiler

Alle profiler bruker MapLibre og samme transparente Fotrute-WMS. `© Kartverket` vises som kreditering. Kartkildene ligger i `mapLayers.ts`; profilene komponeres i `mapProfiles.ts`.

| Profil | Bakgrunn | Rolle |
| --- | --- | --- |
| Kartverket Turkart | `toporaster` WMTS | Standard og referanse |
| Kartverket Topo | `topo` WMTS | Kandidat A: roligere fargekart tilpasset skjerm |
| Kartverket Topo gråtone | `topograatone` WMTS | Kandidat B: kontraststudie |

Den tidligere profilen RuteApp Sommer med OpenFreeMap, Mapterhorn og egne vektorlag for sti og traktorveg er fjernet. Den reduserte noe visuell støy, men manglet viktig norsk topografisk kontekst og ga en ekstra ekstern leverandørstakk uten dokumentert samlet gevinst.

## Kartografisk sammenligning

| Kriterium | Turkart | Topo | Topo gråtone |
| --- | --- | --- | --- |
| Terrengforståelse | Svært god og velkjent turkartsemantikk; tett uttrykk | God; høydekurver, høydepunkt, vann og myr beholdes i et roligere uttrykk | Geometrien beholdes, men terrengklassene skilles mindre intuitivt |
| Sti/traktorveg/vei | Tydeligst ved første øyekast | God, men enkelte små ferdselslinjer er mer dempet | God linjekontrast, svakere kategorisk lesing |
| Topper og høyder | Tydelige høydepunkt og kraftige stedsnavn | Høydepunkt og navn finnes, men er roligere og mindre | Lesbare, men mister fargesignaler fra omgivelsene |
| Vann, elv og myr | Tydelig blått og myrsignatur | Tydelig og mindre dominerende | Svakeste alternativ; objektene kan leses, men krever mer oppmerksomhet |
| Bygninger og hytter | Detaljrikt, men tett | Detaljrikt og roligere på høy zoom | God formkontrast |
| Beregnet rute | Lesbar, men konkurrerer mer med kartet | Beste balanse mellom kartinnhold og rute | Sterkest ren kontrast mot ruten |
| Virtuell forbindelse | Tydelig lilla stipling | Tydelig lilla stipling | Svært tydelig, men uten tilsvarende sterk terrengkontekst |
| Mobil | Informasjonsrikt, men tett | Best samlet lesbarhet på liten flate | Rolig, men svakere situasjonsforståelse |

## Zoomnivå og lokale områder

- Zoom 11–12 gir regional sammenheng, stedsnavn, vann, myr, høydekurver og sentrale høydepunkt. Turkart er mest informasjonsrikt; Topo er roligere.
- Zoom 13–14 er det beste planleggingsområdet for alle tre profiler. Sti, traktorveg, vei, bygninger og terreng kan vurderes samtidig.
- Zoom 15–16 viser detaljert bebyggelse, småveier, bekker og høydekurver. Den bredere terrengsammenhengen blir naturlig mindre synlig.
- Ørnkjellhaugan og høydepunktet ved 917 meter er tydeligst i Turkart, men finnes også i Topo.
- Svartdalstjønna, Minnilldalen og Sørøyåsen er navngitt i fargeprofilene. Vann- og myrbildet rundt dem er raskere å tolke i farge enn i gråtone.

## Teknisk og operasjonell vurdering

De tre bakgrunnene bruker samme offisielle Kartverket-WMTS, samme projeksjon, flisstørrelse og zoomområde. Profilbytte krever derfor ingen endring i MapView eller app-genererte lag. Rutepunkt, planleggingslinje, beregnet rute, virtuelle segmenter og development-debug reetableres av eksisterende `style.load`-mekanisme.

Isolerte HTTP-kontroller av `topo` og `topograatone` svarte med status 200, `image/png`, CORS `*` og fem dagers cache-header. Et Fotrute GetMap-kall svarte med status 200, `image/png` og CORS `*`. Ved raske profilbytter kan nettleseren avbryte uferdige raster-/WMS-kall fra forrige style; dette er forventet kansellering og ble ikke observert som tap av app-state eller dupliserte lag. Studien gjør ingen generell ytelseskonklusjon fra enkeltmålinger over nett.

Kartverkets [vilkår for bruk](https://www.kartverket.no/api-og-data/vilkar-for-bruk) angir i hovedsak CC BY 4.0 og kreditering med `© Kartverket`. Detaljerte Geovekst-data som formidles gjennom enkelte WMS-/cachetjenester har egne bruksbegrensninger som må vurderes før produksjonssetting. Profilene bruker derfor krediteringen og bør ikke betraktes som ferdig produksjonsavklart bare fordi de er teknisk tilgjengelige.

## Anbefaling

Kartverket Turkart anbefales fortsatt som primær profil etter spiken. Det prioriterer stier, høydepunkt, topphøyder og stedsnavn tydeligere enn kandidatene, og RuteApps ruteoverlegg er fortsatt lesbart. Kartverket Topo er den sterkeste kandidaten for videre produktvalidering: den beholder avgjørende norsk topografisk innhold og gir samtidig bedre plass til RuteApps røde rutelinje, lilla virtuelle forbindelser og markører. Den bør ikke erstatte Turkart før den er validert i flere områder, skjermer og reelle planleggingsoppgaver.

Gråtoneprofilen anbefales ikke som primært turkart. Den er nyttig som kontrastreferanse, men fjerner fargesignaler som hjelper brukeren å tolke vann, myr og vegetasjon raskt. Neste kartografiske steg bør være manuell sammenligning av Turkart og Topo i flere testområder, ikke flere nye datakilder eller flere lag.
