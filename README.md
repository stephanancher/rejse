# Kørselsregnskab

En Electron-baseret applikation til at beregne kørselsgodtgørelse, inklusiv fradrag og tur/retur beregninger.

## Funktioner

- **Adresseopslag:** Find adresser nemt via Nominatim (OpenStreetMap).
- **Ruteberegning:** Beregner afstand og tid via OSRM.
- **Tur/Retur:** Beregner automatisk både udrejse (`Hjem -> Destination`) og hjemrejse (`Destination -> Hjem`).
- **Fradrag (Pendling):** Beregner og trækker automatisk pendlerfradrag fra (`Hjem <-> Arbejde`) for både ud- og hjemrejse.
- **Mols-Linjen:** Mulighed for at beregne rute via Odden-Aarhus færgen.
- **Excel Eksport:**
    - Gemmer data i en Excel-fil (`Koerplan.xlsx`).
    - Opretter automatisk nye rækker for hver tur (Udrejse, Fradrag, Hjemrejse, Fradrag).
    - Understøtter brug af skabelonfil.
- **Kort Dokumentation:** Genererer billeder af ruten (JPG) for dokumentation:
    - `[Dato]_kørsel_ud.jpg`
    - `[Dato]_kørsel_hjem.jpg`
    - `[Dato]_fradrag_ud.jpg`
    - `[Dato]_fradrag_hjem.jpg`

## Installation

1.  Klon repository:
    ```bash
    git clone https://github.com/stephanancher/rejse.git
    cd rejse
    ```
2.  Installer afhængigheder:
    ```bash
    npm install
    ```

## Kørsel (Udvikling)

For at starte applikationen i udviklingstilstand (med Hot-Reload):

```bash
npm run dev:electron
```

## Byg (Produktion)

For at bygge applikationen til en eksekverbar fil (.exe):

```bash
npm run electron:build
```

## Teknologier

- [Electron](https://www.electronjs.org/)
- [React](https://reactjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Leaflet](https://leafletjs.com/) (Kort)
- [ExcelJS](https://github.com/exceljs/exceljs) (Excel håndtering)
