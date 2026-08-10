# Høydeprofil og estimert gangtid

## Formål og ansvarsgrense

Høydeprofilen er etterprosessering av en allerede beregnet rute. RuteApp sender den ordnede rutegeometrien, inkludert via-punkter og virtuelle segmenter, gjennom en separat høydedatagrense etter at A* er ferdig. Høydetjenesten påvirker ikke grafen, edge-kostnadene eller valgt rute, og MapLibre kontakter ikke høydetjenesten.

Flyten er:

```text
rutepunkter
→ rutemotor
→ faktisk ordnet rutegeometri
→ sampling
→ høydetjeneste
→ høydeprofil og stigning/fall
→ estimert gangtid
→ UI
```

## Datakilde og klientadapter

Første adapter bruker Kartverkets åpne [Høydedata-API](https://ws.geonorge.no/hoydedata/v1/) og endepunktet `https://ws.geonorge.no/hoydedata/v1/punkt`. RuteApp sender WGS84-koordinater med `koordsys=4326` og `punkter=[[longitude,latitude], ...]`. API-et tillater maksimalt 50 punkt per kall, så adapteren deler større profiler i deterministiske batcher. Kartverkets offisielle OpenAPI-kontrakt oppgir at tjenesten ikke krever innlogging.

Adapteren validerer HTTP-status, responsstruktur, antall punkt, koordinatrekkefølge og at hver høyde er et endelig tall. Ferdig hentede koordinater caches i minnet for nettlesersesjonen. Feil eller manglende høyde gir egen feilstatus for høydeprofilen og gjør ikke den beregnede ruten ugyldig.

En kontroll fra lokal utviklingsopprinnelse viste HTTP 200, `application/json` og `Access-Control-Allow-Origin: *`. Dersom tjenestens CORS- eller driftsforutsetninger endres, kan adapteren senere flyttes bak en RuteApp-tjeneste uten å endre høyde- eller routingdomenet.

## Sampling og profilberegning

Samplingintervallet er konfigurert til 25 meter. Hver routing-edge samples separat, slik at rutens start, slutt og naturlige knekkpunkter bevares også når de ikke treffer 25-metersintervallet. Akkumulert distanse bruker edgenes fysiske `distanceMeters`; både ordinære og virtuelle edges behandles likt. Interne samplepunkt interpoleres langs den aktuelle edge-geometrien.

Profilen inneholder for hvert sample koordinat, akkumulert distanse og høyde, samt total distanse, samlet stigning, samlet fall og minimums-/maksimumshøyde. En enkel deadband på 1 meter brukes ved summering av stigning og fall: endringer under terskelen ignoreres mot siste aksepterte referansehøyde, mens flere små endringer fortsatt fanges når den samlede differansen passerer terskelen. Dette reduserer små lokale høydevariasjoner uten å innføre terrengfiltrering.

## Asynkron oppdatering

Når rutegeometrien endres, vises høydeprofilen som lastende og et nytt kall starter etter 300 millisekunders debounce. Foregående kall avbrytes med `AbortController`, og et gammelt svar får ikke overskrive en nyere rute. Routingstatus og høydestatus holdes separate.

## Estimert gangtid

Gangtid beregnes i en ren funksjon etter at profilen er klar. Første modell følger en enkel Naismith-variant:

- 5 km/t for horisontal distanse
- 600 høydemeter stigning per time
- fall gir foreløpig ikke et eget tillegg
- virtuelle meter har en eksplisitt faktor, men faktoren er `1` i første versjon

Estimatet er planleggingsinformasjon, ikke routingkostnad, personlig hastighet eller live ETA. Senere kan parametrene, underlag og virtuelle segmenter behandles annerledes uten at A* eller høydeprofilen må endres.

## Begrensninger

- Profilen avhenger av tilgjengelighet og dekning i Kartverkets eksterne tjeneste.
- Første versjon har bare minnecache og ingen offline-høydedata.
- Lineær interpolasjon mellom korte edge-endepunkter brukes for interne samplepunkt.
- Gangtiden tar ikke hensyn til fall, pauser, underlag, vær, individuell form eller sikkerheten i virtuelle forbindelser.
- Høydedata brukes ikke til å validere virtuelle forbindelser eller velge rute i denne versjonen.
