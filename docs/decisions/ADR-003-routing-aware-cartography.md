# ADR-003: Routing-aware cartography

**Status:** Accepted  
**Dato:** 2026-08-10

## Kontekst

RuteApp bruker et visuelt kartgrunnlag for orientering og et separat, normalisert datagrunnlag for routing. Kartverkets rasterkart kan vise en sti som ikke finnes i det normaliserte routingnettet. Brukeren kan da forvente å kunne plassere A eller B på stien, selv om RuteApp verken kan snappe til den eller bruke den i ruteberegning.

Et slikt avvik kan være akseptabelt i et generelt topografisk kart. I RuteApp er kartet først og fremst et arbeidsverktøy for ruteplanlegging, og avviket skaper derfor en feil produktforventning.

En gjennomført spike i Nerskogen viser at RuteApp kan avlede et fysisk kartnett fra samme normaliserte grunnlag som brukes av `RoutingGraph`, snapping og A*. Spiken beholder samtidig et tydelig skille mellom routingmodell og kartpresentasjonsmodell.

## Beslutning

RuteApp skal følge prinsippet **routing-aware cartography**:

> Rutbare lineære objekter som presenteres som RuteApps eget sti-/veinett, skal avledes fra samme normaliserte datagrunnlag som brukes til snapping og ruteberegning.

Den prinsipielle dataflyten er:

```text
kildedata
    ↓
normalisering
    ↓
RuteApps normaliserte rutbare nett
    ├──→ RoutingGraph og A*
    ├──→ snapping
    └──→ kartpresentasjon av RuteApps eget rutbare nett
```

MapLibre skal ikke tegne `RoutingGraph` direkte. Routingmodell og kartpresentasjonsmodell skal fortsatt være separate modeller, men de skal avledes fra det samme normaliserte funksjonelle nettet.

### Produktprinsipp

> Ser brukeren en linje som presenteres som en del av RuteApps eget rutbare sti-/veinett, skal den normalt være mulig å snappe til og bruke i ruteberegning.

Prinsippet gjelder RuteApps eget rutbare nett. Det innebærer ikke at all synlig lineær informasjon i et bakgrunnskart eller tematisk lag er rutbar.

### Tre semantiske kategorier

1. **Routable network** er ordinære linjer RuteApp faktisk kan bruke, som `path`, `track`, `road` og eventuelle framtidige normaliserte rutbare typer. De avledes fra samme normaliserte grunnlag som routing.
2. **Terrain/context** er kartinformasjon som gir orientering og terrengforståelse, blant annet høydekurver, fjelltopper, topphøyder, vann, elver, myr, bygg, stedsnavn og terrengformer. Slik informasjon trenger ikke inngå i routinggrafen.
3. **Virtual connection** er en RuteApp-generert mulig forbindelse mellom deler av nettet. Den er en eksplisitt routing-edge, men ikke en registrert sti, og skal derfor ha et eget visuelt språk.

### Separate routing- og presentasjonsmodeller

Routingmodellen kan inneholde rettede edges, tekniske node-ID-er, kostnader og virtuelle edges. Kartpresentasjonen trenger fysisk geometri, kartografisk edge-type, stabil segmentidentitet og deduplisering av teknisk motsatt rettede edges.

Et vanlig toveissegment kan være representert slik i routinggrafen:

```text
A → B
B → A
```

Kartpresentasjonen skal normalt vise dette som ett fysisk segment. Den interne directed-strukturen skal ikke eksponeres visuelt uten et særskilt behov.

Dagens implementasjon følger flyten:

```text
RoutingGraph / ordinaryGraph
    ↓
RoutableMapSegment[]
    ↓
GeoJSON
    ↓
MapLibre
```

Denne flyten er én implementasjon av beslutningen. ADR-en krever ikke permanent bruk av GeoJSON, en bestemt MapLibre source-type eller dagens segment-ID-format. Regional, tiled eller vector-tiled distribusjon kan senere erstatte dagens transportformat uten å endre prinsippet.

### Datakilder og normalisering

Dagens normaliserte nett bruker primært OpenStreetMap. ADR-en beslutter ikke at OSM alltid skal være eneste kilde.

Arkitekturen skal kunne støtte at OSM, en eventuell framtidig godkjent bruk av FKB-TraktorvegSti og andre godkjente kilder normaliseres til ett RuteApp-nett. Det avgjørende er at kartpresentasjon, snapping og routing bruker dette samme normaliserte funksjonelle nettet.

FKB er ikke besluttet som produksjons- eller runtime-kilde. Tilgang, lisensiering, datakvalitet, konflasjon og teknisk distribusjon må avklares separat. Beslutningen i denne ADR-en gjelder uavhengig av om FKB senere tas i bruk.

### Virtuelle forbindelser

Virtuelle edges skal ikke inngå i det permanente ordinære sti-/veinettet eller automatisk tegnes som registrerte stier. De kan vises når de brukes i en valgt rute, i development/debug eller gjennom et framtidig eget kartografisk språk.

Skillet mellom ordinært rutbart nett og virtuell forbindelse skal bevares både i domenemodellen og presentasjonen.

### Bakgrunnskart og tematiske lag

Kartverkets nåværende rasterbakgrunner inneholder stier og andre transportlinjer. Bakgrunnskartet kan derfor fortsatt vise en sti som ikke finnes i RuteApps normaliserte nett. Dette bryter ikke beslutningen, fordi rasterlinjen tilhører kartografisk kontekst og ikke presenteres som del av RuteApps eget rutbare nett. Det er likevel en UX-begrensning som bør reduseres.

Ønsket framtidig retning er en bakgrunn som primært gir terreng, vann, myr, høyde, fjelltopper, navn, bygg og annen orienteringskontekst, mens RuteApp kontrollerer presentasjonen av det rutbare sti-/veinettet. ADR-en beslutter ikke konkret bakgrunnsteknologi eller kartleverandør.

Tematiske lag som Kartverkets Turrutebase – Fotrute er heller ikke automatisk synonymt med RuteApps rutbare nett. Slike lag kan gi supplerende informasjon, men må presenteres uten å love at alle synlige linjer kan snappes til eller brukes av rutemotoren.

## Begrunnelse

Beslutningen etablerer én funksjonell sannhet for nettet RuteApp selv presenterer som rutbart. Det reduserer situasjoner der kartet lover en sti som produktets sentrale funksjon ikke kan bruke, samtidig som bakgrunnskart, tematiske lag og routing fortsatt har tydelige ansvarsgrenser.

Felles normalisert grunnlag gjør også datakvalitetsfeil lettere å diagnostisere og gir en naturlig vei til framtidig berikelse fra flere godkjente kilder.

## Konsekvenser

### Positive konsekvenser

- Bedre samsvar mellom brukerens forventning og faktisk snapping og routing.
- Færre situasjoner der kartet ser rutbart ut, men applikasjonen ikke kan bruke forbindelsen.
- Én funksjonell sannhet for RuteApps eget rutbare nett.
- Enklere feilsøking fordi kart, snapping og A* kan spores tilbake til samme normaliserte grunnlag.
- Et bedre grunnlag for eventuell framtidig normalisering av OSM, FKB og andre godkjente kilder.
- Tydeligere semantisk skille mellom rutbart nett, terrengkontekst og virtuelle forbindelser.
- Bedre kontroll over hvordan ulike rutbare edge-typer presenteres.

### Kostnader og ulemper

- RuteApp må produsere eller avlede et eget presentasjonsnett fra normaliserte routingdata.
- Klienten må håndtere mer data enn ved bruk av bare et rendret rasterbakgrunnskart.
- Dagens regionale GeoJSON-modell skalerer ikke direkte til hele Norge; regional eller tile-basert distribusjon blir sannsynligvis nødvendig.
- Bakgrunnskart med ferdig renderte transportlinjer kan fortsatt skape et visuelt avvik.
- Normaliserings- og datakvalitetspipelinen blir mer sentral og må forvaltes som en del av produktet.
- Mangler og feil i routingkildene blir direkte synlige for brukeren i RuteApps kartnett.

## Alternativer som ble vurdert

### Standard topografisk kart som visuell sannhet og separat routinggraf

Forkastet som hovedprinsipp. Synlig sti og rutbart nett kan avvike på en måte som skaper feil produktforventning.

### Tegne routingnettet oppå et vanlig topografisk kart

Nyttig som overgang og arkitekturspike. Det beviser eget routbart kartnett, men løser ikke fullt ut at rasterbakgrunnen fortsatt kan vise konkurrerende transportlinjer.

### Routing-aware cartography

Valgt. RuteApps egne rutbare linjer avledes fra samme normaliserte funksjonelle nett som snapping og ruteberegning, mens terreng og annen kontekst kan komme fra separate presentasjonskilder.

## Forhold til ADR-001

ADR-001 gjelder fortsatt: visuelt kartgrunnlag og routingdata har separate ansvar, og MapLibre skal ikke eie routinglogikk.

ADR-003 presiserer at når RuteApp presenterer sitt eget rutbare nett, skal presentasjonsmodellen avledes fra samme normaliserte datagrunnlag som routing. Beslutningene motsier ikke hverandre: modellene og ansvarsområdene er separate, mens den funksjonelle kilden til RuteApps eget rutbare nett er felles.

## Forhold til ADR-002

ADR-002 beholder beslutningene om en nettleserbasert TypeScript-kjerne, `RoutingGraph`, A* og virtuelle forbindelser som eksplisitte first-class edges.

ADR-003 endrer ikke routingalgoritmen, snappingreglene eller kostnadsmodellen. Den beskriver hvordan det samme normaliserte rutbare nettet også skal være grunnlag for RuteApps kartpresentasjon.

## Teknologisk avgrensning

ADR-en låser ikke permanent:

- GeoJSON eller en bestemt MapLibre source-type
- Nerskogen som geografisk område
- Kartverket Topo som bakgrunn
- dagens farger, linjebredder eller kartstil
- dagens implementasjon av segment-ID-er

Dette er egenskaper ved dagens validerte implementasjon, ikke selve arkitekturbeslutningen.
