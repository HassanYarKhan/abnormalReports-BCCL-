import dbInstanceRFID from "../config/dbconfigRFID.js";

async function getUnitFromAreaCode(req, res) {
  const { areaCode } = req.query;

  try {
    const dbResponse = await dbInstanceRFID.query(
      `select unitcode, unitname from units
            where areacode = '${areaCode}'
            order by areacode asc;`,
      {
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      res
        .status(200)
        .json({ message: "Could not find any unit codes for this area code" });
      console.log("Could not find unit code for the area code provided");
      return;
    }

    res
      .status(200)
      .json({
        message: `Fetched units data for area code ${areaCode}`,
        units: dbResponse,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch unit codes", error: error });
  }
}

async function getWBfromUnitCode(req, res) {
  const {unitCode} = req.query;

  if (!unitCode) {
    res.status(404).json({ message: "Provide a valid code not found" });
    return;
  }

  try {
    const dbResponse = await dbInstanceRFID.query(
      `SELECT wbcode, wbname FROM wbs WHERE unitCode like '%${unitCode}%' AND loctype = 'W'`,
      {
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if(dbResponse.length === 0){
        res.status(200).json({message: 'No registered weighbridges in this unit code'});
    }

    res.status(200).json({message: `Fetched weigbridges for unit code ${unitCode}`, weighbridges: dbResponse});

  } catch (error) {
    res.status(500).json({message: 'Could not fetch weighbridges', error: error})
  }
}

export { getUnitFromAreaCode, getWBfromUnitCode };
