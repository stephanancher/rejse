# Software Design Document (SDD) - Kørselsregnskab & Rutevisualisering

## 1. Introduktion
Dette dokument beskriver designet for en applikation til kørselsregnskab. Applikationen har til formål at automatisere beregningen af kørte kilometer ved hjælp af Google Maps integration, med specifik funktionalitet til at modregne den daglige pendling og visualisere ruten grafisk.

## 2. Formål og Scope
Systemet skal hjælpe brugeren med at dokumentere erhvervsmæssig kørsel.
**Primære funktioner:**
*   Beregning af afstand mellem destinationer via Google Maps.
*   Automatisk valg af den korteste rute.
*   Modregning af afstand mellem hjem og arbejdsplads (pendling).
*   Grafisk visning af den kørte rute på et kort.

## 3. Funktionelle Krav
1.  **Input:**
    *   Brugeren skal kunne indtaste start- og slutadresse.
    *   Mulighed for at gemme "Hjem" og "Arbejde" adresser til automatisk modregning.
2.  **Beregning:**
    *   Systemet skal kalde Google Maps API (Directions API) for at finde ruten.
    *   Systemet skal identificere og vælge den korteste rute blandt mulige alternativer.
    *   Systemet skal fratrække afstanden for pendling (Hjem <-> Arbejde) fra den totale tur, hvis relevant.
3.  **Visualisering:**
    *   Ruten skal vises på et interaktivt kort (Google Maps).
    *   Start, slut og evt. via-punkter skal markeres.
4.  **Output:**
    *   Visning af total distance, fradrag, og netto distance til godtgørelse.
    *   (Optionelt) Eksport af data til Excel/CSV.

## 4. Valgt Teknologistack
For at opfylde kravet om en selvstændig applikation (.exe) benyttes **Electron** med **OpenStreetMap**.

*   **Rammeværk:** Electron.
*   **Frontend:** React (TypeScript).
*   **Kort-data:** OpenStreetMap (Gratis).
*   **Kort-visning:** Leaflet (via `react-leaflet`).
*   **Routing Service:** OSRM (Open Source Routing Machine) API (Gratis offentlig server).
*   **Distribution:** Electron Builder.

## 5. API Setup (Ingen nøgle påkrævet)
Vi bruger OpenStreetMap og OSRM's offentlige API'er.
*   **Krav:** Ingen betalingskort eller API nøgler kræves til normalt brug.
*   **Begrænsning:** OSRM's demo-server må ikke overbelastes, men til privat kørsel er det fint.

## 6. Datamodel (Udkast)
*   **Trip:**
    *   `id`: string
    *   `date`: Date
    *   `startAddress`: string
    *   `endAddress`: string
    *   `distanceRaw`: number (meter)
    *   `commuteDeduction`: number (meter)
    *   `distanceNet`: number (meter)
    *   `purpose`: string

## 7. Sikkerhed og API
*   Ingen sensitive API-nøgler gemmes i applikationen.
*   Applikationen kommunikerer direkte med OSRM's servere.
