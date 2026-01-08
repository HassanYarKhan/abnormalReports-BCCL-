import { Blob } from "buffer";

function formatRawCoordinates(dataArray){
    const result = [];
    let arr = dataArray.split(/[,\s()]+/);
    arr.shift(); 
    arr.pop(); 
    let len = arr.length;
    for(let i = 0; i < len; i+=2){
        const coordinatePair = [parseFloat(arr[i+1]), parseFloat(arr[i])];
        result.push(coordinatePair);
    }
    return result;
}

async function blobToGeoJSON(geofencesData) {
    const features = [];
    
    for(let geofence of geofencesData) {
        // geometry
        const geoType = geofence.geotype;
        const geometryType = (geoType === "P" ? "LineString" : "Polygon");

        // get coordinates
        const blob = new Blob([geofence.area]);
        const coordinatesData = await blob.text();
        const geoJSONCoordinates = formatRawCoordinates(coordinatesData.trim());

        // properties
        const attributes = JSON.parse(geofence.attributes);
        const color = attributes.color;
        const polyLineDistance = attributes.polylineDistance;

        // Feature Object
        const feature = {
            type: "Feature",
            geometry: {
                type: geometryType,
                coordinates: geometryType === "Polygon" 
                    ? [geoJSONCoordinates]  // Extra nesting for polygon
                    : geoJSONCoordinates    
            },
            properties: {
                geoType: geoType === "P" ? "P" : "E",
                color: color,
                polylineDistance: polyLineDistance
            }
        };

        features.push(feature);
    }

    // Return combined GeoJSON FeatureCollection
    return {
        type: "FeatureCollection",
        features: features
    };
}

export { blobToGeoJSON };