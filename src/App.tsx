import { useState } from 'react';
import './App.css';
import MapComponent from './components/MapComponent';
import { searchAddress } from './services/nominatim';
import { getRoute } from './services/osrm';
import type { RouteData, Coordinates, RouteDisplay } from './types';

const ODDEN_COORDS: Coordinates = { lat: 55.9725, lon: 11.4280 }; // Oddenvej
const AARHUS_COORDS: Coordinates = { lat: 56.1495, lon: 10.2190 }; // Østhavnsvej/Færgevej

function App() {
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');

  const [routeInfo, setRouteInfo] = useState<{
    trip?: RouteData;
    returnTrip?: RouteData;
    commute?: RouteData;
    returnCommute?: RouteData; // New: Work -> Home
    ferrySegments?: RouteData[];
    returnFerrySegments?: RouteData[];
  }>({});

  const [resolvedAddresses, setResolvedAddresses] = useState<{
    home?: string;
    work?: string;
    dest?: string;
  }>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Excel State
  const [excelPath, setExcelPath] = useState<string | null>(localStorage.getItem('excelPath'));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [savedMessage, setSavedMessage] = useState('');

  const handleSelectExcel = async () => {
    try {
      const path = await window.electron.selectExcelFile();
      if (path) {
        setExcelPath(path);
        localStorage.setItem('excelPath', path); // Remember key
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveToExcel = async () => {
    if (!excelPath || !routeInfo.trip) return;

    try {
      setLoading(true);

      // --- 0. Gem Kort som Billeder (Async før Excel for at sikre UI er klar) ---
      try {
        // Find mappen hvor Excel-filen ligger
        const lastSlash = Math.max(excelPath.lastIndexOf('/'), excelPath.lastIndexOf('\\'));
        const baseDir = excelPath.substring(0, lastSlash);

        // Helper function for capturing
        const captureElement = async (elementId: string, filename: string) => {
          const el = document.getElementById(elementId);
          if (!el) return;

          // Scroll into view to ensure it's in the viewport for capturePage
          el.scrollIntoView({ behavior: 'instant', block: 'center' });

          // Small delay to let renderer catch up (100ms)
          await new Promise(r => setTimeout(r, 100));

          const rect = el.getBoundingClientRect();
          // Recalculate rect after scroll
          await window.electron.captureMap({
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            filePath: `${baseDir}\\${filename}`
          });
        };

        // Map 1: Kørsel (Udrejse)
        await captureElement('map-trip', `${date}_kørsel_ud.jpg`);

        // Map 1b: Kørsel (Hjemrejse)
        if (routeInfo.returnTrip) {
          await captureElement('map-return', `${date}_kørsel_hjem.jpg`);
        }

        // Map 2: Fradrag (Udrejse)
        if (routeInfo.commute) {
          await captureElement('map-commute', `${date}_fradrag_ud.jpg`);
        }

        // Map 2b: Fradrag (Hjemrejse)
        if (routeInfo.returnCommute) {
          await captureElement('map-return-commute', `${date}_fradrag_hjem.jpg`);
        }

      } catch (imgErr) {
        console.error("Kunne ikke gemme billeder:", imgErr);
      }

      // --- Slut på Billede Gemning ---

      // --- 1. UDREJSE ---
      const tripKm = routeInfo.trip.distance / 1000;
      const descriptionTrip = `Fra ${homeAddress} til ${destinationAddress}`;
      const resTrip = await window.electron.saveToExcel({
        filePath: excelPath,
        date: date,
        description: descriptionTrip,
        km: tripKm
      });

      if (!resTrip.success) throw new Error('Kunne ikke gemme tur (ud): ' + resTrip.error);
      let rowsAdded = `række ${resTrip.row}`;

      // Fradrag Ud
      if (routeInfo.commute) {
        const commuteKm = routeInfo.commute.distance / 1000;
        const descriptionCommute = `Fra ${homeAddress} til ${workAddress} (Fradrag)`;

        const resCommute = await window.electron.saveToExcel({
          filePath: excelPath,
          date: date,
          description: descriptionCommute,
          km: -commuteKm
        });

        if (!resCommute.success) throw new Error('Kunne ikke gemme fradrag (ud): ' + resCommute.error);
        rowsAdded += ` & ${resCommute.row}`;
      }

      // --- 2. HJEMREJSE ---
      if (routeInfo.returnTrip) {
        const returnKm = routeInfo.returnTrip.distance / 1000;
        const descriptionReturn = `Fra ${destinationAddress} til ${homeAddress}`;

        const resReturn = await window.electron.saveToExcel({
          filePath: excelPath,
          date: date,
          description: descriptionReturn,
          km: returnKm
        });

        if (!resReturn.success) throw new Error('Kunne ikke gemme tur (hjem): ' + resReturn.error);
        rowsAdded += `, ${resReturn.row}`;

        // Fradrag Hjem (use returnCommute if available, else fallback closely or skip?)
        // Logic: Calculate Work -> Home
        if (routeInfo.returnCommute) {
          const commuteReturnKm = routeInfo.returnCommute.distance / 1000;
          const descriptionCommuteReturn = `Fra ${workAddress} til ${homeAddress} (Fradrag)`;

          const resCommuteReturn = await window.electron.saveToExcel({
            filePath: excelPath,
            date: date,
            description: descriptionCommuteReturn,
            km: -commuteReturnKm // Negative
          });

          if (!resCommuteReturn.success) throw new Error('Kunne ikke gemme fradrag (hjem): ' + resCommuteReturn.error);
          rowsAdded += ` & ${resCommuteReturn.row}`;
        }
      }

      setSavedMessage(`Gemt! (${rowsAdded})`);
      setTimeout(() => setSavedMessage(''), 3000);

    } catch (e: any) {
      setError('Kunne ikke gemme: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!homeAddress || !destinationAddress) {
      setError('Udfyld venligst Hjem og Destination');
      return;
    }
    setLoading(true);
    setError('');
    setRouteInfo({});

    try {
      const homeRes = await searchAddress(homeAddress);
      if (homeRes.length === 0) throw new Error(`Kunne ikke finde hjem: ${homeAddress}`);
      const homeCoords: Coordinates = { lat: parseFloat(homeRes[0].lat), lon: parseFloat(homeRes[0].lon) };

      const destRes = await searchAddress(destinationAddress);
      if (destRes.length === 0) throw new Error(`Kunne ikke finde destination: ${destinationAddress}`);
      const destCoords: Coordinates = { lat: parseFloat(destRes[0].lat), lon: parseFloat(destRes[0].lon) };

      // 1. Trips
      const tripRoute = await getRoute([homeCoords, destCoords]);
      if (!tripRoute) throw new Error('Kunne ikke finde rute til destination');

      const returnRoute = await getRoute([destCoords, homeCoords]);

      // 2. Commutes
      let commuteRoute: RouteData | null = null;
      let returnCommuteRoute: RouteData | null = null;
      let resolvedWork = undefined;

      if (workAddress.trim()) {
        const workRes = await searchAddress(workAddress);
        if (workRes.length === 0) throw new Error(`Kunne ikke finde arbejdsadresse: ${workAddress}`);

        const workCoords: Coordinates = { lat: parseFloat(workRes[0].lat), lon: parseFloat(workRes[0].lon) };

        // Home -> Work
        commuteRoute = await getRoute([homeCoords, workCoords]);
        // Work -> Home
        returnCommuteRoute = await getRoute([workCoords, homeCoords]);

        resolvedWork = workRes[0].display_name;
      }

      setResolvedAddresses({
        home: homeRes[0].display_name,
        dest: destRes[0].display_name,
        work: resolvedWork
      });

      setRouteInfo({
        trip: tripRoute,
        returnTrip: returnRoute || undefined,
        commute: commuteRoute || undefined,
        returnCommute: returnCommuteRoute || undefined
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Der opstod en fejl');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchViaFerry = async () => {
    // ... (Ferry logic similar check)
    // For brevity, assuming ferry logic is mostly same structure but just applies commutes same way:
    if (!homeAddress || !destinationAddress) {
      setError('Udfyld venligst Hjem og Destination');
      return;
    }
    setLoading(true);
    setError('');
    setRouteInfo({});

    try {
      const homeRes = await searchAddress(homeAddress);
      if (homeRes.length === 0) throw new Error(`Kunne ikke finde hjem: ${homeAddress}`);
      const homeCoords: Coordinates = { lat: parseFloat(homeRes[0].lat), lon: parseFloat(homeRes[0].lon) };

      const destRes = await searchAddress(destinationAddress);
      if (destRes.length === 0) throw new Error(`Kunne ikke finde destination: ${destinationAddress}`);
      const destCoords: Coordinates = { lat: parseFloat(destRes[0].lat), lon: parseFloat(destRes[0].lon) };

      // ... (Ferry calculation logic omitted for brevity, keeping existing structure) ...
      // Just re-implementing the commute part inside here

      const distToOdden = Math.pow(homeCoords.lat - ODDEN_COORDS.lat, 2) + Math.pow(homeCoords.lon - ODDEN_COORDS.lon, 2);
      const distToAarhus = Math.pow(homeCoords.lat - AARHUS_COORDS.lat, 2) + Math.pow(homeCoords.lon - AARHUS_COORDS.lon, 2);

      let part1: RouteData | null = null;
      let part2: RouteData | null = null;
      let retPart1: RouteData | null = null;
      let retPart2: RouteData | null = null;

      if (distToOdden < distToAarhus) {
        part1 = await getRoute([homeCoords, ODDEN_COORDS]);
        part2 = await getRoute([AARHUS_COORDS, destCoords]);
        retPart1 = await getRoute([destCoords, AARHUS_COORDS]);
        retPart2 = await getRoute([ODDEN_COORDS, homeCoords]);
      } else {
        part1 = await getRoute([homeCoords, AARHUS_COORDS]);
        part2 = await getRoute([ODDEN_COORDS, destCoords]);
        retPart1 = await getRoute([destCoords, ODDEN_COORDS]);
        retPart2 = await getRoute([AARHUS_COORDS, homeCoords]);
      }

      if (!part1 || !part2 || !retPart1 || !retPart2) throw new Error('Kunne ikke beregne rute via færgehavnene');

      // Combined Trip Data (Sum of driving)
      const combinedTrip: RouteData = {
        distance: (part1?.distance || 0) + (part2?.distance || 0),
        duration: (part1?.duration || 0) + (part2?.duration || 0) + 5400,
        geometry: part1!.geometry
      };

      const combinedReturn: RouteData = {
        distance: (retPart1?.distance || 0) + (retPart2?.distance || 0),
        duration: (retPart1?.duration || 0) + (retPart2?.duration || 0) + 5400,
        geometry: retPart1!.geometry
      };

      // Commute logic
      let commuteRoute: RouteData | null = null;
      let returnCommuteRoute: RouteData | null = null;
      let resolvedWork = undefined;

      if (workAddress.trim()) {
        const workRes = await searchAddress(workAddress);
        if (workRes.length > 0) {
          const workCoords: Coordinates = { lat: parseFloat(workRes[0].lat), lon: parseFloat(workRes[0].lon) };
          commuteRoute = await getRoute([homeCoords, workCoords]);
          returnCommuteRoute = await getRoute([workCoords, homeCoords]);
          resolvedWork = workRes[0].display_name;
        }
      }

      setResolvedAddresses({
        home: homeRes[0].display_name,
        dest: destRes[0].display_name,
        work: resolvedWork
      });

      setRouteInfo({
        trip: combinedTrip,
        returnTrip: combinedReturn,
        commute: commuteRoute || undefined,
        returnCommute: returnCommuteRoute || undefined,
        ferrySegments: [part1!, part2!],
        returnFerrySegments: [retPart1!, retPart2!]
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setHomeAddress('');
    setWorkAddress('');
    setDestinationAddress('');
    setRouteInfo({});
    setResolvedAddresses({});
    setError('');
  };

  // Prepare routes for Main Map (Trip only)
  const tripMapRoutes: RouteDisplay[] = [];
  if (routeInfo.ferrySegments) {
    // Draw both segments for ferry trip
    routeInfo.ferrySegments.forEach(seg => {
      tripMapRoutes.push({
        geometry: seg.geometry,
        color: '#4444ff',
        opacity: 0.8
      });
    });
  } else if (routeInfo.trip) {
    tripMapRoutes.push({
      geometry: routeInfo.trip.geometry,
      color: '#4444ff', // Blue for trip
      opacity: 0.8
    });
  }

  // Prepare routes for Return Map
  const returnMapRoutes: RouteDisplay[] = [];
  if (routeInfo.returnFerrySegments) {
    routeInfo.returnFerrySegments.forEach(seg => returnMapRoutes.push({ geometry: seg.geometry, color: '#4444ff', opacity: 0.8 }));
  } else if (routeInfo.returnTrip) {
    returnMapRoutes.push({ geometry: routeInfo.returnTrip.geometry, color: '#4444ff', opacity: 0.8 });
  }

  // Commute Out
  const commuteMapRoutes: RouteDisplay[] = [];
  if (routeInfo.commute) {
    commuteMapRoutes.push({
      geometry: routeInfo.commute.geometry,
      color: '#4444ff', // Blue for deduction (requested by user)
      opacity: 0.8,
      dashArray: '10, 10'
    });
  }

  // Commute Return
  const returnCommuteMapRoutes: RouteDisplay[] = [];
  if (routeInfo.returnCommute) {
    returnCommuteMapRoutes.push({ geometry: routeInfo.returnCommute.geometry, color: '#4444ff', opacity: 0.8, dashArray: '10, 10' });
  }

  // Calculate Net
  const totalKm = routeInfo.trip ? routeInfo.trip.distance / 1000 : 0;
  const returnTotalKm = routeInfo.returnTrip ? routeInfo.returnTrip.distance / 1000 : 0;
  const commuteKm = routeInfo.commute ? routeInfo.commute.distance / 1000 : 0;
  const returnCommuteKm = routeInfo.returnCommute ? routeInfo.returnCommute.distance / 1000 : 0;

  const netKm = Math.max(0, totalKm - commuteKm) + Math.max(0, returnTotalKm - returnCommuteKm);

  return (
    <div className="app-container">
      <h1>Kørselsregnskab</h1>

      <div className="control-panel">
        <div className="section">
          <div className="input-group">
            <input type="text" placeholder="Hjemmeadresse (Start)" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} />
          </div>
          {resolvedAddresses.home && <p className="resolved-address">Fundet: {resolvedAddresses.home}</p>}

          <div className="input-group">
            <input type="text" placeholder="Arbejdsadresse (Fradrag)" value={workAddress} onChange={(e) => setWorkAddress(e.target.value)} />
          </div>
          {resolvedAddresses.work && <p className="resolved-address">Fundet: {resolvedAddresses.work}</p>}

          <div className="input-group">
            <input type="text" placeholder="Destination (Kunde/Møde)" value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} />
          </div>
          {resolvedAddresses.dest && <p className="resolved-address">Fundet: {resolvedAddresses.dest}</p>}

          <hr className="divider" style={{ margin: '1rem 0', borderColor: '#444' }} />

          <div className="input-group" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Dato</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              {/* Spacer label to align button with input field */}
              <label style={{ fontSize: '0.8rem', color: 'transparent', display: 'block', marginBottom: '0.2rem' }}>Skabelon</label>
              <button onClick={handleSelectExcel} style={{ fontSize: '0.8rem', padding: '10px', backgroundColor: '#444', height: '42px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 0 }} title={excelPath || "Vælg Skabelon fil"}>
                {excelPath ? "📄 Skabelon valgt" : "📂 Vælg Skabelon"}
              </button>
            </div>
          </div>
          {excelPath && <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '-0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{excelPath}</p>}
        </div>

        <div className="button-group">
          <button onClick={handleSearch} disabled={loading} className="primary-btn">
            Beregn Kørsel & Retur
          </button>
          <button onClick={handleSearchViaFerry} disabled={loading} style={{ backgroundColor: '#0277BD', marginTop: '0.5rem' }}>
            ⛴️ Via Molslinjen (Tur/Retur)
          </button>

          {routeInfo.trip && (
            <button
              onClick={handleSaveToExcel}
              disabled={loading || !excelPath}
              style={{ backgroundColor: savedMessage ? '#4CAF50' : '#E65100', marginTop: '1.5rem', fontWeight: 'bold' }}
            >
              {savedMessage ? savedMessage : "💾 Gem i Skema (Tur + Retur)"}
            </button>
          )}

          <button onClick={handleReset} style={{ backgroundColor: '#555', marginTop: '0.5rem' }}>
            Nulstil
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {routeInfo.trip && (
          <div className="result-panel">
            <div className="result-row">
              <span>Udrejse (Tur):</span>
              <span>{totalKm.toFixed(2)} km</span>
            </div>
            {routeInfo.commute && (
              <div className="result-row deduction">
                <span>- Fradrag (Udrejse):</span>
                <span>{commuteKm.toFixed(2)} km</span>
              </div>
            )}

            <hr style={{ borderColor: '#555', margin: '0.5rem 0' }} />

            {routeInfo.returnTrip && (
              <div className="result-row">
                <span>Hjemrejse (Tur):</span>
                <span>{returnTotalKm.toFixed(2)} km</span>
              </div>
            )}
            {routeInfo.returnCommute && (
              <div className="result-row deduction">
                <span>- Fradrag (Hjemrejse):</span>
                <span>{returnCommuteKm.toFixed(2)} km</span>
              </div>
            )}

            <div className="result-row net-result" style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #666' }}>
              <span>Total Udbetaling:</span>
              <span>{netKm.toFixed(2)} km</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* 1. Udrejse */}
        <div className="map-container" id="map-trip">
          <div style={{ padding: '0.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', background: '#333', borderBottom: '1px solid #444' }}>
            <span style={{ color: '#4444ff', fontWeight: 'bold' }}>&#9473; Udrejse</span>
          </div>
          <MapComponent routes={tripMapRoutes} />
        </div>

        {/* 2. Fradrag Ud */}
        {routeInfo.commute && (
          <div className="map-container secondary-map" id="map-commute">
            <div style={{ padding: '0.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', background: '#333', borderBottom: '1px solid #444' }}>
              <span style={{ color: '#4444ff', fontWeight: 'bold' }}>- - - Fradrag (Udrejse)</span>
            </div>
            <MapComponent routes={commuteMapRoutes} />
          </div>
        )}

        {/* 3. Hjemrejse */}
        {routeInfo.returnTrip && (
          <div className="map-container secondary-map" id="map-return" style={{ marginTop: '1rem' }}>
            <div style={{ padding: '0.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', background: '#333', borderBottom: '1px solid #444' }}>
              <span style={{ color: '#4444ff', fontWeight: 'bold' }}>&#9473; Hjemrejse</span>
            </div>
            <MapComponent routes={returnMapRoutes} />
          </div>
        )}

        {/* 4. Fradrag Hjem */}
        {routeInfo.returnCommute && (
          <div className="map-container secondary-map" id="map-return-commute">
            <div style={{ padding: '0.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', background: '#333', borderBottom: '1px solid #444' }}>
              <span style={{ color: '#4444ff', fontWeight: 'bold' }}>- - - Fradrag (Hjemrejse)</span>
            </div>
            <MapComponent routes={returnCommuteMapRoutes} />
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
