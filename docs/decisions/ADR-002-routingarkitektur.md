# ADR-002: Routingarkitektur for første MVP

**Status:** Accepted  
**Dato:** 2026-08-08

## Kontekst

RuteApp har interaktiv rutepunktplanlegging, men den viste linjen og avstanden er fortsatt direkte geometri mellom punktene. For å kunne finne en faktisk fotturrute trengs en routingkjerne som arbeider på et eksplisitt nettverk, uten å bli koblet til React, MapLibre eller formatet til en bestemt datakilde.

OpenStreetMap-rådata er planlagt som primært routinggrunnlag, men import og preprocessing er ikke besluttet. Samtidig må grafmodellen fra starten bevare RuteApps sentrale skille mellom ordinære forbindelser og eksplisitte virtuelle terrengforbindelser.

## Beslutning

- Routing for første MVP skal kjøre i nettleseren.
- Routingkjernen skal implementeres i TypeScript og være uavhengig av React og MapLibre.
- A* skal være den første routingalgoritmen.
- Routing skal skje på en intern, eksplisitt graf med noder og rettede edges.
- Grafen skal representere ordinære edges av typene `path`, `track` og `road`, samt eksplisitte virtuelle edges av typen `virtual`.
- Fysisk lengde i `distanceMeters` og optimaliseringsverdi i `cost` skal være separate egenskaper. `distanceMeters` skal representere faktisk ferdselslengde langs edgen og kan derfor ikke være kortere enn geografisk luftlinje mellom edge-endepunktene. Grafbyggere og framtidige importsteg har ansvar for å bevare denne invarianten. I den første modellen skal `cost` aldri være lavere enn `distanceMeters`.
- A* skal bare forholde seg til grafens topologi og edge-kostnad. Algoritmen skal ikke ha særlogikk for OSM eller virtuelle edges.
- OpenStreetMap-rådata skal senere importeres og transformeres til den interne grafmodellen i et separat steg.
- Via-routing skal senere kunne bygges ved å beregne delrutene `route(A, P1)`, `route(P1, P2)` og `route(P2, B)`, og deretter slå sammen ordnede edges, distanse og kostnad.
- Høydedata og høydeprofil skal senere behandles etter at rutegeometrien er funnet, gjennom en separat høydedatagrense.
- Kartverket/Norgeskart og andre synlige kartlag forblir presentasjonsdata og skal ikke brukes som routingtopologi.

Virtuelle forbindelser støttes i denne versjonen kun som eksplisitte grafobjekter. Automatisk opprettelse og validering av dem er ikke del av beslutningen.

## Begrunnelse

En liten TypeScript-kjerne i nettleseren er den enkleste måten å bevise routingmodellen i dagens webapplikasjon uten å innføre backend før behovet er kjent. En intern grafmodell isolerer rutemotoren fra framtidig OSM-import og gjør den deterministisk testbar med små datasett.

A* utnytter nodenes geografiske plassering og kan prioritere søket mot målet. Luftlinjeavstand brukes som heuristikk. Den er admissible i den første modellen fordi en fysisk edge-lengde ikke kan være kortere enn luftlinjen mellom endepunktene, og `cost` ikke kan være lavere enn `distanceMeters`. A* validerer ikke alle edge-geometrier ved hver ruteberegning; invarianten skal ivaretas når grafdata produseres.

Ved å representere virtuelle forbindelser som vanlige edges med egen type og kostnad kan senere regler endre hvilke edges som opprettes og hvilken kostnad de får, uten å endre A*-algoritmen.

## Konsekvenser

- Routingkjernen kan testes uten DOM, React, MapLibre eller nettverkstilgang.
- UI-et og kartet må senere integreres med routingkjernen gjennom en tydelig grense; denne integrasjonen er ikke implementert nå.
- OSM-data må transformeres til den interne grafmodellen før ruting.
- Retning må uttrykkes eksplisitt med edges; grafen oppretter ikke automatisk en motsatt edge.
- Virtuelle edges kan få høyere kostnad enn sin fysiske lengde, men den endelige kostnadsmodellen er ikke besluttet.
- Routing i nettleseren gjør datastørrelse, minnebruk, geografisk avgrensning og caching til viktige senere designspørsmål.
- En eventuell senere flytting av rutemotoren må bevare domenekontrakten eller tilby et tilsvarende grensesnitt.
- Høyde-, terreng- og barriereregler ligger utenfor A*-algoritmen og må anvendes når graf og edge-kostnader etableres eller berikes.

## Alternativer som foreløpig ikke er valgt

- Å kjøre rutemotoren i en egen backend eller bruke en ekstern rutingtjeneste i første MVP.
- Å bruke Dijkstra som første algoritme.
- Å knytte rutemotoren direkte til OSM-format eller en bestemt importmekanisme.
- Å behandle virtuelle forbindelser med hardkodet særlogikk inne i A*.
- Å inkludere høyde, terreng, underlag eller avanserte routingprofiler i den første grafmodellen.

Disse alternativene kan vurderes på nytt dersom datamengde, ytelse eller produktbehov gjør det nødvendig.

## Åpne spørsmål

- Konkret OSM-import- og preprocessingmekanisme.
- Geografisk avgrensning og datastrategi for større områder.
- Endelig kostnadsmodell for ulike edge-typer.
- Regler for automatisk opprettelse av virtuelle forbindelser.
- Hvordan barrierer og terreng senere påvirker virtuelle forbindelser.
- Caching og persistens av routingdata i nettleseren.
