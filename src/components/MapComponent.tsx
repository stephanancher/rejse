import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { decodePolyline } from '../utils/polyline';
import type { RouteDisplay } from '../types';

// Fix for default marker icon
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const center: L.LatLngExpression = [56.2639, 9.5018]; // DK center

interface MapComponentProps {
    routes?: RouteDisplay[];
}

function ChangeView({ bounds }: { bounds: L.LatLngBoundsExpression }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
    }, [bounds, map]);
    return null;
}

const MapComponent: React.FC<MapComponentProps> = ({ routes }) => {
    const [polylines, setPolylines] = useState<{ positions: [number, number][], color: string, style?: any }[]>([]);

    useEffect(() => {
        if (routes && routes.length > 0) {
            const newPolylines = routes.map(route => ({
                positions: decodePolyline(route.geometry),
                color: route.color,
                style: { opacity: route.opacity, dashArray: route.dashArray }
            }));
            setPolylines(newPolylines);
        } else {
            setPolylines([]);
        }
    }, [routes]);

    // Calculate bounds to encompass all routes
    const allPositions = polylines.flatMap(p => p.positions);
    const bounds = allPositions.length > 0 ? L.latLngBounds(allPositions) : undefined;

    return (
        <div style={{ height: '400px', width: '100%' }}>
            <MapContainer
                center={center}
                zoom={7}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {polylines.map((poly, idx) => (
                    <Polyline
                        key={idx}
                        positions={poly.positions}
                        color={poly.color}
                        opacity={poly.style.opacity}
                        dashArray={poly.style.dashArray}
                    />
                ))}

                {bounds && <ChangeView bounds={bounds} />}

                <Marker position={center}>
                    <Popup>DK</Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}

export default React.memo(MapComponent);
