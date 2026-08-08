# RuteApp – kodekontekst

## Formål

Dette dokumentet gir en kortfattet teknisk oversikt over kodebasen i RuteApp.

Dokumentet supplerer:

`docs/produkt-og-arkitekturgrunnlag.md`

Produkt- og arkitekturgrunnlaget er fortsatt den overordnede kilden for mål, omfang, arkitektur og sentrale prinsipper.

## Nåværende status

RuteApp er i etableringsfasen.

Frontend er opprettet med:

React
TypeScript
Vite
ESLint
npm

Det er foreløpig ikke implementert produksjonsklar routingfunksjonalitet.

MapLibre GL JS er installert og integrert. Applikasjonen viser et interaktivt kart med Kartverkets toporaster som visuelt bakgrunnskart.

Nerskogen brukes som standard utviklings- og testutsnitt med sentrum omtrent ved lengdegrad 9.6012 og breddegrad 62.7802.

Routing, OSM-integrasjon, rutegraf og rutemotor er foreløpig ikke implementert.

## Besluttet kart- og datagrunnlag

MapLibre GL JS brukes som presentasjonsmotor, og Kartverkets toporaster brukes som visuelt bakgrunnskart. OpenStreetMap-rådata er valgt som planlagt primært grunnlag for det routbare sti- og veinettet; renderte kartfliser skal ikke brukes som routingdata.

Kartverkets høyde-, terreng- og friluftsdata kan senere berike routinggrunnlaget og vurderingen av virtuelle terrengforbindelser. Kartintegrasjonen er implementert under `src/map/`, mens OSM-import, rutegraf og rutemotor fortsatt ikke er implementert. Skillet mellom visuelt kartgrunnlag og routinggrunnlag er dokumentert i [ADR-001](decisions/ADR-001-kart-og-geografisk-datagrunnlag.md).

Kartarkitekturen er lagbasert og kildeuavhengig. MapLibre er presentasjonsmotor, mens bakgrunnskart og tematiske kartlag skal kunne konfigureres, byttes og kombineres uten at `MapView` eller routingarkitekturen må bygges om. Kartverket toporaster er eneste aktive lag nå og er ikke en permanent binding til dette kartproduktet.

Arkitekturen skal senere kunne støtte sommerstier og fotturruter, vinter- og skiløyper, sykkelruter, høyde- og terrenglag og andre relevante temalag. Med unntak av Fotrute som første kandidat er konkrete datakilder for disse lagene ikke besluttet, og tekniske endepunkter er fortsatt åpne. Et synlig tematisk kartlag og dataene rutemotoren bruker er separate arkitekturbegreper.

Kartinnholdet deles konseptuelt i tre kategorier:

1. Bakgrunnslag gir visuell kontekst. Kartverket toporaster er første implementerte bakgrunnslag og er ikke routingdata.
2. Tematiske lag viser eksterne fagdata oppå bakgrunnskartet. Første konkrete kandidat er Kartverkets Turrutebase – Fotrute, som beskriver registrerte fotturruter og ikke alle ordinære stier. Fotrute kan senere vurderes som berikelse eller kvalitetssignal for routing, men denne rollen er separat fra visualisering og er ikke besluttet.
3. Applikasjonsgenererte kartobjekter, som punkt A og B, beregnede ruter, virtuelle forbindelser, markører og analyseresultater, kommer fra applikasjonens tilstand og beregninger. De trenger ikke ligge i det statiske kartlagregisteret for eksterne kilder.

Fotrute er ikke implementert. Konkret endepunkt og innlastingsmåte i MapLibre er åpne spørsmål for en senere oppgave.

## Repositorystruktur

### `/src`

Inneholder applikasjonens kildekode.

### `/src/components`

Generelle og gjenbrukbare UI-komponenter som ikke tilhører én bestemt domenefunksjon.

Eksempler kan senere være knapper, paneler, dialoger og felles layoutkomponenter.

### `/src/features`

Funksjonsorientert applikasjonskode.

Denne mappen brukes når en funksjon består av flere relaterte UI-elementer, tilstand og oppførsel.

### `/src/map`

Kartspesifikk funksjonalitet.

Forventede ansvarsområder:

MapLibre-oppsett
kartets livssyklus
kartlag
datakilder
markører
kartinteraksjon
visualisering av geografiske objekter

Ruteberegningsalgoritmer skal ikke ligge her.

`MapView.tsx` eier MapLibre-kartets livssyklus og presentasjon. `mapLayers.ts` beskriver aktive eksterne bakgrunnslag og tematiske lag og kildene deres; foreløpig inneholder registeret bare Kartverket toporaster. Applikasjonsgenererte kartobjekter kan senere håndteres dynamisk uten å inngå i dette statiske registeret. `mapConfig.ts` bygger MapLibre-stilen fra lagkonfigurasjonen og inneholder standardutsnittet for Nerskogen.

### `/src/routing`

Reservert for routingrelatert domenelogikk i den nåværende prosjektstrukturen.

Forventede ansvarsområder:

routinggraf
forbindelser mellom noder og stier
ruteberegning
kostnadsmodeller
virtuelle terrengforbindelser
routingrelaterte domeneregler

Routinglogikken skal så langt som mulig kunne brukes og testes uavhengig av React-komponentene.

Denne logiske ansvarsgrensen avgjør ikke hvor den endelige rutemotoren skal kjøre. Valget mellom nettleser, backend eller en annen kjøremekanisme er fortsatt åpent.

### `/src/services`

Kommunikasjon med eksterne datakilder, API-er og senere backend-tjenester.

### `/src/types`

Felles TypeScript-typer og interfaces for domeneobjekter og datastrukturer.

### `/src/utils`

Generelle hjelpefunksjoner.

Mappen skal ikke brukes som oppsamlingssted for domenelogikk som egentlig hører hjemme i andre moduler.

### `/docs`

Varig prosjektdokumentasjon.

### `/docs/architecture`

Detaljert teknisk dokumentasjon for bestemte deler av løsningen.

Aktuelle tema etter hvert kan være:

kartarkitektur
routingarkitektur
geografiske data
virtuelle terrengforbindelser
backendarkitektur

### `/docs/decisions`

Architecture Decision Records, ADR.

Brukes for viktige beslutninger der ulike alternativer er vurdert, og der det er nyttig at senere utviklere eller AI-agenter kan forstå hvorfor beslutningen ble tatt.

## Sentralt domenekonsept

Rutegrafen kan ikke forutsette at topologien i kartgrunnlaget gir en perfekt representasjon av hvor det faktisk er mulig å ferdes.

To stisegmenter kan ligge så nær hverandre at ferdsel mellom dem er mulig, selv om de ikke er koblet sammen i kildedataene.

RuteApp skiller derfor mellom:

1. Ordinære forbindelser i sti- og veinettet
2. Virtuelle terrengforbindelser

Virtuelle terrengforbindelser skal behandles som egne forbindelser i routinggrafen.

De skal senere kunne ha egne egenskaper og regler for blant annet:

maksimal avstand
rutekostnad
terrengforhold
sikkerhet
visualisering
brukerpreferanser

Den første arkitekturen må bevare dette skillet.

## Arkitekturgrenser

UI-komponenter skal vise informasjon og samle inn brukerhandlinger.

Kartmodulen skal vise og håndtere geografisk informasjon.

Routingmodulen skal håndtere forbindelser og beregne ruter.

Dette beskriver en logisk modulgrense, ikke en besluttet fysisk plassering av rutemotoren.

Tjenestelaget skal hente og eventuelt transformere eksterne data.

Disse ansvarsområdene skal ikke kobles tettere sammen enn nødvendig.

## Første vertikale MVP

Den første nyttige ende-til-ende-funksjonen er:

Brukeren velger punkt A

↓

Brukeren velger punkt B

↓

RuteApp oppretter eller bruker et rutbart nettverk

↓

Ruteberegningen vurderer ordinære forbindelser og tillatte virtuelle forbindelser

↓

Korteste egnede fotturrute beregnes

↓

Ruten vises i kartet

Denne kjeden skal styre prioriteringene i den tidlige utviklingen.

Den første routing-MVP-en gjelder fottur. Ski- og sykkelruting hører til mulig framtidig utvikling og skal ikke drive fram en generell fleraktivitetsmodell nå.

## Vedlikehold av dokumentet

Dokumentet skal oppdateres når:

viktige moduler legges til
ansvar mellom moduler endres
nye sentrale domenekonsepter introduseres
arkitekturen endres vesentlig

Dokumentet skal ikke oppdateres for hver mindre kodeendring.

Detaljert teknisk design hører hjemme i:

`docs/architecture/`

Viktige arkitekturbeslutninger og begrunnelsen for dem hører hjemme i:

`docs/decisions/`
