# ADR-001: Skille mellom visuelt kartgrunnlag og routinggrunnlag

**Status:** Accepted  
**Dato:** 2026-08-08

## Kontekst

RuteApp trenger både et topografisk kart som brukeren kan orientere seg i, og geografiske data som kan omformes til en graf for ruteberegning. Disse behovene stiller ulike krav til data, behandling og ansvar i løsningen.

Et rendret bakgrunnskart viser geografi, men er ikke i seg selv et egnet grunnlag for å etablere routingtopologi. Samtidig skal kartpresentasjonen ikke kobles til hvordan rutegrafen bygges eller hvor rutemotoren kjører.

## Beslutning

RuteApp skal skille tydelig mellom visuelt kartgrunnlag og routbart geografisk datagrunnlag.

### Visuelt kartgrunnlag

- MapLibre GL JS er valgt som kart- og presentasjonsmotor.
- Kartverkets toporaster/turkart skal være det primære visuelle bakgrunnskartet i første versjon.
- Bakgrunnskartet skal brukes til presentasjon og skal ikke behandles som routingdata eller kilde til routingtopologi.
- Første implementasjon bruker Kartverkets offisielle WMTS-cache i Web Mercator (EPSG:3857) med tile-mønsteret `https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png`.
- Kartarkitekturen skal være lagbasert og kildeuavhengig. MapLibre er presentasjonsmotor, mens bakgrunnskart og tematiske kartlag skal kunne konfigureres, byttes og kombineres uten at `MapView` eller routingarkitekturen må bygges om.
- Kartkilden er isolert i `src/map/mapLayers.ts`, mens `src/map/mapConfig.ts` bygger kartstilen fra aktive lag. Kartkilder kan dermed senere byttes uten å endre `MapView` eller routingarkitekturen.
- Nerskogen brukes som standard utviklings- og testutsnitt.
- Gjeldende krav til kreditering og bruksvilkår skal ivaretas. Vilkårene skal kontrolleres på nytt før produksjonssetting.

Kartverket har varslet at et nytt topografisk bakgrunnskart skal bli tilgjengelig som WMS/WMTS-tjeneste i løpet av august 2026. Eksisterende `toporaster` brukes inntil en ny tjeneste faktisk er publisert og vurdert; denne beslutningen antar ikke URL eller tjenestenavn for den varslede tjenesten.

Kartverket toporaster er første og foreløpig eneste aktive kartlag, men er ikke en permanent binding. Arkitekturen skal senere kunne støtte sommerstier og fotturruter, vinter- og skiløyper, sykkelruter, høyde- og terrenglag og andre relevante temalag. Konkrete datakilder for disse lagene er ikke besluttet.

### Routinggrunnlag

- OpenStreetMap-rådata skal være den primære datakilden for etablering av routbart sti- og veinett i MVP-en.
- RuteApp skal bruke underliggende geografiske OSM-data, ikke ferdig renderte OSM-kartfliser, som routinggrunnlag.
- Routinggrafen og rutemotoren skal være uavhengige av MapLibre og det visuelle bakgrunnskartet.
- MapLibre skal visualisere ruteresultatet, men skal ikke eie rutelogikk.

Den prinsipielle dataflyten er:

```text
Kartverket / visuelt kartgrunnlag
        ↓
     MapLibre
        ↓
presentasjon for bruker

OSM-rådata
        ↓
routinggraf
        ↓
rutemotor
        ↓
ruteresultat
        ↓
MapLibre visualiserer resultatet
```

### Senere berikelse

Routinggrunnlaget skal senere kunne suppleres med norske offentlige data, blant annet Kartverkets høydedata og nasjonale høydemodell, N50/topografiske data, tur- og friluftsruter og relevante terreng- og barrieredata. Disse kildene er ikke primært routinggrunnlag i første MVP.

Terreng-, høyde- og barrieredata skal senere kunne brukes til å berike eller vurdere eksplisitte virtuelle terrengforbindelser. Denne beslutningen fastsetter ikke reglene for slike vurderinger.

## Begrunnelse

Skillet gjør at kartpresentasjon og ruteberegning kan utvikles og testes uavhengig. Kartverket gir et egnet norsk topografisk kartuttrykk, mens OSM-rådata inneholder geografiske objekter og egenskaper som kan transformeres til et routbart sti- og veinett.

En separat routingmodell bevarer også muligheten til å supplere OSM med andre datakilder og til å representere virtuelle terrengforbindelser uten å gjøre bakgrunnskartet eller MapLibre til en del av rutemotoren.

## Konsekvenser

- Kartintegrasjonen og routingdataflyten må ha separate ansvar og grensesnitt.
- Bytte eller endring av visuelt bakgrunnskart skal ikke kreve endringer i rutemotoren.
- Endringer i grafbygging og rutelogikk skal ikke være avhengige av MapLibre.
- Ruteresultater må inneholde geometri og segmentinformasjon som kartlaget kan visualisere.
- Kartverkets bakgrunnskart kan ikke brukes til å utlede forbindelser i rutegrafen.
- OSM-data må importeres, valideres og transformeres før de kan brukes av rutemotoren.
- Kreditering, bruksvilkår og teknisk egnethet for valgt Kartverket-tjeneste må ivaretas i kartintegrasjonen.
- En eventuell overgang til Kartverkets varslede nye topografiske tjeneste skal kunne gjøres i kartkonfigurasjonen uten å påvirke routingmodellen.
- Synlige tematiske kartlag og routingdata skal behandles som separate arkitekturbegreper, selv når de beskriver de samme typene geografiske objekter.
- Virtuelle terrengforbindelser må forbli eksplisitte forbindelser i routingmodellen, også når de senere vurderes ved hjelp av supplerende data.

## Alternativer som foreløpig ikke er valgt

- Å bruke samme datakilde og datastruktur direkte til både bakgrunnskart og ruting.
- Å bruke renderte kartfliser fra Kartverket eller OpenStreetMap som routinggrunnlag.
- Å bruke norske offentlige terreng- eller rutedata som primært routinggrunnlag i første MVP.
- Å velge en konkret ferdig rutingtjeneste, importpipeline eller prosesseringsplattform nå.

Disse alternativene er ikke nødvendigvis permanent avvist, men de inngår ikke i den vedtatte MVP-retningen.

## Åpne spørsmål

- Hvor skal rutemotoren kjøre?
- Hvordan skal OSM-data importeres og prosesseres?
- Hvordan skal den interne grafmodellen utformes konkret?
- Hvordan skal virtuelle terrengforbindelser genereres?
- Hvilke terreng- og barriereregler skal senere gjelde?
