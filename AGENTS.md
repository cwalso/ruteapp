# RuteApp – instruksjoner til Codex

## Formål

RuteApp er en nettleserbasert applikasjon for planlegging av fotturer og ruter i terreng.

Applikasjonen skal kunne beregne ruter mellom valgte punkter ved hjelp av tilgjengelige sti-, vei- og kartdata.

Et grunnleggende domeneprinsipp er at manglende topologisk forbindelse i kartdata ikke nødvendigvis betyr at det er umulig å bevege seg mellom to punkter i terrenget.

Virtuelle terrengforbindelser mellom nærliggende stier, veier eller andre egnede punkter er derfor en del av kjernen i rutemodellen, ikke en eventuell senere tilleggsfunksjon.

Første versjon utvikles som en webapplikasjon som kjører i nettleser. Arkitektur og brukergrensesnitt skal samtidig utformes slik at løsningen senere kan tilpasses mobiltelefon uten unødvendig ombygging.

## Styrende dokumentasjon

Før større endringer skal følgende dokumentasjon leses:

1. `docs/produkt-og-arkitekturgrunnlag.md`
2. `docs/code-context.md`
3. Relevant dokumentasjon under `docs/architecture/`
4. Relevante Architecture Decision Records under `docs/decisions/`

`docs/produkt-og-arkitekturgrunnlag.md` er hovedkilden for produktmål, omfang, arkitektur og domeneprinsipper.

Dersom kode og dokumentasjon er i konflikt, skal dette ikke løses gjennom antakelser. Konflikten skal identifiseres og beskrives.

## Teknologistack

Frontend:

React
TypeScript
Vite

Kart:

MapLibre GL JS

Implementasjonen skal følge arkitekturen beskrevet i prosjektets dokumentasjon.

Ikke introduser større rammeverk, tjenester, databaser eller annen infrastruktur uten et konkret behov.

## Utviklingsprinsipper

Velg enkle løsninger som passer til prosjektets nåværende modenhet og MVP.

Ikke implementer funksjonalitet som ikke er etterspurt.

Hold domenelogikk adskilt fra presentasjons- og UI-logikk.

Routinglogikk skal ikke implementeres direkte inne i React-komponenter.

Kartvisning og ruteberegning skal kunne utvikles og testes mest mulig uavhengig av hverandre.

Bruk TypeScript-typer for domeneobjekter og eksterne datastrukturer.

Foretrekk små og forståelige moduler fremfor store filer med mange ansvarsområder.

Unngå unødvendige abstraksjoner før det finnes et reelt behov.

Gjenbruk eksisterende mønstre i prosjektet før nye mønstre introduseres.

Ikke erstatt valgte biblioteker eller arkitektur bare fordi en annen løsning er mer kjent.

## Prinsipper for routing

Routing er en sentral domenefunksjon i RuteApp.

Rutemodellen skal kunne representere:

1. Ordinære forbindelser i sti- og veinettet
2. Stisegmenter som mangler topologisk forbindelse i kildedata
3. Virtuelle terrengforbindelser mellom egnede nærliggende punkter
4. Ulike kostnader for ferdsel på ordinær sti og virtuelle terrengforbindelser

Manglende topologi i kartdata skal ikke tolkes som bevis på at to punkter ikke kan forbindes.

Virtuelle forbindelser skal representeres eksplisitt i rutemodellen.

Dette gjør det senere mulig å gi dem egne regler for blant annet:

avstandsgrenser
rutekostnad
terrengtype
sikkerhet
visualisering
brukerpreferanser

## MVP

Første MVP fokuserer på:

1. Vise kart
2. Velge startpunkt
3. Velge sluttpunkt
4. Finne korteste egnede rute
5. Tillate virtuelle sti- eller terrengforbindelser der reglene tillater dette
6. Vise den beregnede ruten i kartet

Ikke legg til funksjonalitet som brukerkontoer, abonnement, sosiale funksjoner, gamification eller tilsvarende uten at dette eksplisitt er besluttet.

## Arbeidsmetode

Før en oppgave implementeres:

1. Undersøk relevante eksisterende filer.
2. Les relevant prosjektdokumentasjon.
3. Forstå dagens implementasjon før den endres.
4. Gjør den minste helhetlige endringen som løser oppgaven.

Etter implementasjon:

1. Kontroller TypeScript-feil.
2. Kjør lint.
3. Kjør build eller relevante tester.
4. Beskriv hva som er endret.
5. Beskriv eventuelle antakelser, åpne spørsmål eller arkitekturmessige konsekvenser.

For frontend skal følgende normalt kjøres:

`npm run lint`

og:

`npm run build`

## Git

Ikke commit, push, merge, rebase eller opprett branch med mindre dette eksplisitt er bedt om.

Ikke endre filer som ikke er relevante for oppgaven bare for å rydde opp.

Endringer skal begrenses til det som er nødvendig for den aktuelle oppgaven.

## Dokumentasjon

Dokumentasjonen skal oppdateres dersom en endring påvirker:

arkitekturen
sentrale domenebegreper
modulenes ansvarsområder
viktige tekniske valg
utviklingsoppsettet

Vesentlige arkitekturvalg skal dokumenteres som ADR under:

`docs/decisions/`

Ikke opprett omfattende dokumentasjon for trivielle implementasjonsdetaljer.

## Ved usikkerhet

Prosjektets produkt- og arkitekturdokumentasjon skal foretrekkes fremfor antakelser.

Dersom flere teknisk gode alternativer finnes og valget har vesentlige arkitekturmessige konsekvenser, skal alternativene beskrives før en større eller vanskelig reverserbar beslutning implementeres.

For mindre implementasjonsdetaljer kan Codex bruke normalt faglig skjønn og fortsette arbeidet.
