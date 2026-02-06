import type { Coordinates, RouteData } from '../types';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

export async function getRoute(waypoints: Coordinates[]): Promise<RouteData | null> {
    if (waypoints.length < 2) return null;

    // OSRM expects: lon,lat;lon,lat;...
    const coordinatesString = waypoints.map(p => `${p.lon},${p.lat}`).join(';');
    const url = `${OSRM_BASE_URL}/${coordinatesString}?overview=full&geometries=polyline`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            return {
                distance: data.routes[0].distance,
                duration: data.routes[0].duration,
                geometry: data.routes[0].geometry
            };
        }
        return null;
    } catch (error) {
        console.error("Routing error:", error);
        return null;
    }
}
