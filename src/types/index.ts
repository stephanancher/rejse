export interface Coordinates {
    lat: number;
    lon: number;
}

export interface SearchResult {
    display_name: string;
    lat: string;
    lon: string;
}

export interface RouteData {
    distance: number; // meters
    duration: number; // seconds
    geometry: string; // encoded polyline
}

export interface RouteDisplay {
    geometry: string;
    color: string;
    opacity?: number;
    dashArray?: string;
}
