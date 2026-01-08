import dbInstanceVTS from "../config/dbconfigVTS.js";
import { blobToGeoJSON } from "../utils/blobToGeoJSON.js";

async function getGeofencesByVehicleNumber(req, res) {
  const { vehicleNumber } = req.query;
  const geofences = [];
  try {
    // get deviceID from vehicle number
    const vehicleIdResponse = await dbInstanceVTS.query(
      `SELECT id FROM dwivts.tc_devices where name = :vehicleNumber`,
      {
        type: dbInstanceVTS.QueryTypes.SELECT,
        replacements: { vehicleNumber },
      }
    );
    if (vehicleIdResponse == 0) {
      res.status(404).json({ message: "Invalid Vehicle Id" });
      return;
    }

    const vehicleId = vehicleIdResponse[0].id;

    //get geofenceIds corresponding to the deviceID
    const geofenceIdResponse = await dbInstanceVTS.query(
      `SELECT * FROM dwivts.tc_device_geofence where deviceid=:vehicleId;`,
      {
        replacements: { vehicleId },
        type: dbInstanceVTS.QueryTypes.SELECT,
      }
    );

    if (geofenceIdResponse.length === 0) {
      res.status(404).json({
        message: "No assigned geofences for this vehicle",
      });
      return;
    }

    // get geofence blobs from geofence ids
    for (const data of geofenceIdResponse) {
      const geofenceId = data.geofenceid;

      const geofenceData = await dbInstanceVTS.query(
        "SELECT geotype, area, attributes FROM dwivts.tc_geofences WHERE id = :geofenceId;",
        {
          replacements: { geofenceId },
          type: dbInstanceVTS.QueryTypes.SELECT,
        }
      );

      if (geofenceData.length > 0) {
        geofences.push(geofenceData[0]);
      }
    }

    // convert all geofences to a combined GeoJSON FeatureCollection
    const geoJSON = await blobToGeoJSON(geofences);

    console.log(`Fetched ${geofences.length} geofences for the vehicle ${vehicleNumber}`);
    res.status(200).json({
      message: `Successfully fetched ${geofences.length} geofences for the vehicle number ${vehicleNumber}`,
      data: geoJSON,
    });
  } catch (error) {
    res.status(500).json({
      message: `Failed to fetch geofences for the vehicle ${vehicleNumber}`,
      error: error,
    });
    console.error(
      `Could not fetch geofences for the vehicle ${vehicleNumber}`,
      error
    );
  }
}

export { getGeofencesByVehicleNumber };