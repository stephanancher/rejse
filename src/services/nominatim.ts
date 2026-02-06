import type { SearchResult } from '../types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

// Global cache for aliases
let ALIASES: Record<string, string> = {};
let aliasesLoaded = false;

async function loadAliases() {
    if (aliasesLoaded) return;
    try {
        const response = await fetch('/locations.ini');
        if (response.ok) {
            const text = await response.text();

            // Manual parsing to ensure full control over spaces and keys
            // Format: key = value
            const lines = text.split(/\r?\n/);
            const newAliases: Record<string, string> = {};

            for (const line of lines) {
                // Skip comments or empty lines
                if (!line.trim() || line.trim().startsWith(';') || line.trim().startsWith('#')) continue;

                const separatorIndex = line.indexOf('=');
                if (separatorIndex !== -1) {
                    // Key is everything before the first '='
                    const key = line.substring(0, separatorIndex).trim().toLowerCase();
                    // Value is everything after
                    const value = line.substring(separatorIndex + 1).trim();

                    if (key && value) {
                        newAliases[key] = value;
                    }
                }
            }
            ALIASES = newAliases;
        } else {
            console.warn(`HTTP error loading locations.ini: ${response.status}`);
            throw new Error(`HTTP error ${response.status}`);
        }
    } catch (e) {
        console.error("Failed to load locations.ini", e);
        // Fallback to defaults
        ALIASES = {
            'gigtforeningen': 'Company House Gladsaxe',
            'sano middelfart': 'Adlerhusvej 82, 5500 Middelfart',
            'sano aarhus': 'Egernvej 5, 8270 Højbjerg',
            'dansk gigthospital': 'Engelshøjgade 9A, 6400 Sønderborg',
        };
    } finally {
        aliasesLoaded = true;
        console.log("Final Aliases Loaded:", ALIASES);
    }
}

export async function searchAddress(query: string): Promise<SearchResult[]> {
    if (!query) return [];

    await loadAliases();

    const lowerQuery = query.toLowerCase().trim();
    let searchQuery = ALIASES[lowerQuery];

    console.log(`Searching for: "${query}" (Normalized: "${lowerQuery}")`);

    if (searchQuery) {
        console.log(`-> Found alias! Replacing with: "${searchQuery}"`);
    } else {
        searchQuery = query;
        console.log("-> No alias found, using original query.");
    }

    const params = new URLSearchParams({
        q: searchQuery,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'dk' // Limit to Denmark for relevance
    });

    try {
        console.log(`Fetching: ${NOMINATIM_BASE_URL}?${params.toString()}`);
        const response = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        console.log(`Results for "${searchQuery}":`, data);
        return data;
    } catch (error) {
        console.error("Geocoding error:", error);
        return [];
    }
}
