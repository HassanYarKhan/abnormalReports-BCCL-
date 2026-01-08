import dbInstanceRFID from "../config/dbconfigRFID.js";

async function getAllVehicles(req, res) {
  console.log(`Fetching all vehicles..................`);
  try {
    const vehicles = await dbInstanceRFID.query(
      `SELECT DISTINCT V_NO FROM dbo.tags WHERE VALID >= 1;`,
      {
        type: dbInstanceRFID.QueryTypes.SELECT,
      });
    console.log(`Fetched ${vehicles.length} vehicles.`);
    res.status(200).json(vehicles);

  } catch (error) {
    console.log("Error fetching vehicles:", error); 
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
}

export default getAllVehicles;