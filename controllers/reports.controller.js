import dbInstanceRFID from "../config/dbconfigRFID.js";
import getWBType from "../utils/getWBType.js";
import { detectOutliersIQR } from "../utils/stats.js";
import { areaCodeMap, unitCodeMap } from "../config/codeMaps.js";
import moment from "moment";
import dotenv from "dotenv";

dotenv.config();

async function getReportsByVehicleNumber(req, res) {
  const { vehicleNumber, from, to, stdDev } = req.body;
  if (!vehicleNumber || !from || !to) {
    return res.status(500).json({ message: "Missing search parameters" });
  }

  // Format dates similar to getReportsByWBCode
  const fromFormatted = moment(from, moment.ISO_8601).format(
    "YYYY-MM-DD HH:mm:ss"
  );
  const toFormatted = moment(to, moment.ISO_8601).format("YYYY-MM-DD HH:mm:ss");

  console.log(
    `getting data for vehicle number: ${vehicleNumber}, from: ${fromFormatted}, to: ${toFormatted}`
  );

  try {
    const dbResponse = await dbInstanceRFID.query(
      `SELECT 
    s.V_NO,
    s.AREA_CODE,
    s.UNIT,
    s.WB_CODE,
    s.SL_NO,
    s.W_TYPE,
    w.WBNAME AS WB_NAME,
    CASE 
        WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2))
        WHEN s.W_TYPE = 'J' THEN CAST(s.SECOND_WT AS DECIMAL(18,2))
    END AS TARE_WT,
    CASE 
        WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2))
        WHEN s.W_TYPE = 'J' THEN CAST(s.FIRST_WT AS DECIMAL(18,2))
    END AS GROSS_WT,
    -- Group averages by Area, Unit, WB_CODE for this vehicle
    AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2)) ELSE CAST(s.SECOND_WT AS DECIMAL(18,2)) END) 
        OVER (PARTITION BY s.AREA_CODE, s.UNIT, s.WB_CODE) AS AVG_TARE_WT,
    AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2)) ELSE CAST(s.FIRST_WT AS DECIMAL(18,2)) END) 
        OVER (PARTITION BY s.AREA_CODE, s.UNIT, s.WB_CODE) AS AVG_GROSS_WT,
    -- Percentage deviation for TARE_WT
    CASE 
        WHEN AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2)) ELSE CAST(s.SECOND_WT AS DECIMAL(18,2)) END) 
             OVER (PARTITION BY s.AREA_CODE, s.UNIT, s.WB_CODE) > 0 THEN
            ((CASE 
                WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2))
                WHEN s.W_TYPE = 'J' THEN CAST(s.SECOND_WT AS DECIMAL(18,2))
            END)
            - AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2)) ELSE CAST(s.SECOND_WT AS DECIMAL(18,2)) END) 
              OVER (PARTITION BY s.AREA_CODE, s.UNIT, s.WB_CODE))
            / AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2)) ELSE CAST(s.SECOND_WT AS DECIMAL(18,2)) END) 
              OVER (PARTITION BY s.AREA_CODE, s.UNIT, s.WB_CODE) * 100
        ELSE 0
    END AS TARE_DEVIATION_PERCENT,
    -- Percentage deviation for GROSS_WT
    CASE 
        WHEN AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2)) ELSE CAST(s.FIRST_WT AS DECIMAL(18,2)) END) 
             OVER (PARTITION BY s.AREA_CODE, s.UNIT, s.WB_CODE) > 0 THEN
            ((CASE 
                WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2))
                WHEN s.W_TYPE = 'J' THEN CAST(s.FIRST_WT AS DECIMAL(18,2))
            END)
            - AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2)) ELSE CAST(s.FIRST_WT AS DECIMAL(18,2)) END) 
              OVER (PARTITION BY s.AREA_CODE, s.UNIT, s.WB_CODE))
            / AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2)) ELSE CAST(s.FIRST_WT AS DECIMAL(18,2)) END) 
              OVER (PARTITION BY s.AREA_CODE, s.UNIT, s.WB_CODE) * 100
        ELSE 0
    END AS GROSS_DEVIATION_PERCENT,
    s.W_TYPE,
    s.DATE_IN, 
    s.TIME_IN, 
    s.TIME_OUT, 
    s.DATE_OUT
FROM [special25] s
LEFT JOIN wbs w ON s.WB_CODE = w.wbcode
WHERE s.V_NO = :vehicleNumber 
    AND TRY_CAST(CAST(s.DATE_OUT AS varchar(10)) + ' ' + CAST(s.TIME_OUT AS varchar(8)) AS datetime) 
        BETWEEN TRY_CAST(:fromFormatted AS datetime) AND TRY_CAST(:toFormatted AS datetime)
    AND s.DATE_OUT IS NOT NULL 
    AND s.TIME_OUT IS NOT NULL
ORDER BY s.AREA_CODE, s.UNIT, s.WB_CODE, s.DATE_OUT, s.TIME_OUT`,
      {
        replacements: { vehicleNumber, fromFormatted, toFormatted },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      res.status(200).json({
        message: "No records found, Please Update the Search Parameters",
        data: [],
      });
      return;
    }

    // Group data by Area -> Unit -> WB
    const groupedData = {};

    dbResponse.forEach((entry) => {
      const groupKey = `${entry.AREA_CODE}_${entry.UNIT}_${entry.WB_CODE}`;

      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {
          areaCode: areaCodeMap[entry.AREA_CODE],
          unitCode: unitCodeMap[entry.UNIT],
          wbCode: entry.WB_CODE,
          wbName: entry.WB_NAME,
          vehicleNumber: entry.V_NO,
          avgTare: entry.AVG_TARE_WT,
          avgGross: entry.AVG_GROSS_WT,
          historicData: [],
        };
      }

      // Add historic data entry
      groupedData[groupKey].historicData.push({
        tareWeight: entry.TARE_WT,
        grossWeight: entry.GROSS_WT,
        dateIn: entry.DATE_IN
          ? moment(entry.DATE_IN).format("DD-MM-YYYY")
          : null,
        timeIn: entry.TIME_IN
          ? moment(entry.TIME_IN, "HH:mm:ss", "HH:mm:ss").format("h:mm:ss A")
          : null,
        dateOut: entry.DATE_OUT
          ? moment(entry.DATE_OUT).format("DD-MM-YYYY")
          : null,
        timeOut: entry.TIME_OUT
          ? moment(entry.TIME_OUT, "HH:mm:ss", "HH:mm:ss").format("h:mm:ss A")
          : null,
        tareDeviation: entry.TARE_DEVIATION_PERCENT,
        grossDeviation: entry.GROSS_DEVIATION_PERCENT,
        weightType: getWBType(entry.W_TYPE),
        slNo: entry.SL_NO,
      });
    });

    // Convert grouped data to array
    const structuredData = Object.values(groupedData);

    // Filter to only include weighbridge groups that have at least one abnormal weighment
    const filteredData = structuredData.filter((wbGroup) => {
      return wbGroup.historicData.some((record) => {
        const tareDeviationAbs = Math.abs(record.tareDeviation || 0);
        const grossDeviationAbs = Math.abs(record.grossDeviation || 0);

        return tareDeviationAbs > stdDev || grossDeviationAbs > stdDev;
      });
    });

    // Log filtering results for debugging
    console.log(
      `Total weighbridge groups before filtering: ${structuredData.length}`
    );
    console.log(
      `Weighbridge groups with abnormal weighments: ${filteredData.length}`
    );
    console.log(`Abnormal threshold used: ${stdDev}%`);

    if (filteredData.length === 0) {
      res.status(200).json({
        message: `No abnormal weighments found for vehicle ${vehicleNumber} in the specified date range`,
        standardDeviation: stdDev,
        vehicleNumber: vehicleNumber,
        fromDate: from,
        toDate: to,
        data: [],
      });
      return;
    }

    res.status(200).json({
      message: `Fetched Data for vehicle number: ${vehicleNumber} - Weighbridge Groups with Abnormal Weighments`,
      standardDeviation: stdDev,
      vehicleNumber: vehicleNumber,
      fromDate: from,
      toDate: to,
      totalWeighbridgeGroupsWithAbnormalWeighments: filteredData.length,
      data: filteredData,
    });
  } catch (error) {
    console.error("Error fetching vehicle reports:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function getReportsForPresentDay(req, res) {
  const { stdDev } = req.query;
  console.log("Getting Reports for the present day");
  try {
    const dbResponse = await dbInstanceRFID.query(
      `SELECT 
    AREA_CODE,
    UNIT,
    V_NO,
    SL_NO,
    DATE_OUT,
    CASE 
        WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2))
        WHEN W_TYPE = 'J' THEN CAST(SECOND_WT AS DECIMAL(18,2))
    END AS TARE_WT,
    CASE 
        WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2))
        WHEN W_TYPE = 'J' THEN CAST(FIRST_WT AS DECIMAL(18,2))
    END AS GROSS_WT,
    AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) 
        OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) AS AVG_TARE_WT,
    AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) 
        OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) AS AVG_GROSS_WT,
    -- Percentage deviation for TARE_WT
    CASE 
        WHEN AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) 
             OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) > 0 THEN
            ((CASE 
                WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2))
                WHEN W_TYPE = 'J' THEN CAST(SECOND_WT AS DECIMAL(18,2))
            END) 
            - AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) 
              OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO)) 
            / AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) 
              OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) * 100
        ELSE 0
    END AS TARE_DEVIATION_PERCENT,
    -- Percentage deviation for GROSS_WT
    CASE 
        WHEN AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) 
             OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) > 0 THEN
            ((CASE 
                WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2))
                WHEN W_TYPE = 'J' THEN CAST(FIRST_WT AS DECIMAL(18,2))
            END) 
            - AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) 
              OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO)) 
            / AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) 
              OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) * 100
        ELSE 0
    END AS GROSS_DEVIATION_PERCENT,
    W_TYPE, 
    DATE_IN, 
    TIME_IN, 
    TIME_OUT, 
    WB_CODE
FROM [special25] 
WHERE DATE_OUT IS NOT NULL
  AND DATE_OUT >= CAST(GETDATE() AS DATE)
ORDER BY 
    AREA_CODE,
    UNIT,  
    WB_CODE,
    V_NO,
    DATE_OUT,
    TIME_OUT`,
      {
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      res.status(200).json({
        message: "No records found for present day",
        data: [],
      });
      return;
    }
    // Group data by Area -> Unit -> WB -> Vehicle
    const groupedData = {};

    dbResponse.forEach((entry) => {
      const areaKey = areaCodeMap[entry.AREA_CODE];
      const unitKey = `${areaKey}_${unitCodeMap[entry.UNIT]}`;
      const wbKey = `${unitKey}_${entry.WB_CODE}`;
      const vehicleKey = `${wbKey}_${entry.V_NO}`;

      if (!groupedData[areaKey]) {
        groupedData[areaKey] = {
          areaCode: areaCodeMap[entry.AREA_CODE],
          units: {},
        };
      }

      if (!groupedData[areaKey].units[unitKey]) {
        groupedData[areaKey].units[unitKey] = {
          unitCode: unitCodeMap[entry.UNIT],
          weighbridges: {},
        };
      }

      if (!groupedData[areaKey].units[unitKey].weighbridges[wbKey]) {
        groupedData[areaKey].units[unitKey].weighbridges[wbKey] = {
          wbCode: entry.WB_CODE,
          vehicles: {},
        };
      }

      if (
        !groupedData[areaKey].units[unitKey].weighbridges[wbKey].vehicles[
          vehicleKey
        ]
      ) {
        groupedData[areaKey].units[unitKey].weighbridges[wbKey].vehicles[
          vehicleKey
        ] = {
          vehicleNumber: entry.V_NO,
          avgTare: entry.AVG_TARE_WT,
          avgGross: entry.AVG_GROSS_WT,
          historicData: [],
        };
      }

      // Add historic data entry
      groupedData[areaKey].units[unitKey].weighbridges[wbKey].vehicles[
        vehicleKey
      ].historicData.push({
        tareWeight: entry.TARE_WT,
        grossWeight: entry.GROSS_WT,
        dateIn: entry.DATE_IN
          ? moment(entry.DATE_IN).format("DD-MM-YYYY")
          : null,
        dateOut: entry.DATE_OUT
          ? moment(entry.DATE_OUT).format("DD-MM-YYYY")
          : null,
        timeIn: entry.TIME_IN
          ? moment(entry.TIME_IN, "HH:mm:ss").format("h:mm:ss A")
          : null,
        timeOut: entry.TIME_OUT
          ? moment(entry.TIME_OUT, "HH:mm:ss").format("h:mm:ss A")
          : null,
        tareDeviation: entry.TARE_DEVIATION_PERCENT,
        grossDeviation: entry.GROSS_DEVIATION_PERCENT,
        weightType: getWBType(entry.W_TYPE),
        slNo: entry.SL_NO,
      });
    });

    // Convert grouped data to flat structure for frontend
    const structuredData = [];

    Object.values(groupedData).forEach((area) => {
      Object.values(area.units).forEach((unit) => {
        Object.values(unit.weighbridges).forEach((wb) => {
          Object.values(wb.vehicles).forEach((vehicle) => {
            structuredData.push({
              areaCode: area.areaCode,
              unitCode: unit.unitCode,
              wbCode: wb.wbCode,
              vehicleNumber: vehicle.vehicleNumber,
              avgTare: vehicle.avgTare,
              avgGross: vehicle.avgGross,
              historicData: vehicle.historicData,
            });
          });
        });
      });
    });

    // Filter to only include vehicles that have at least one abnormal weighment
    const filteredData = structuredData.filter((vehicle) => {
      return vehicle.historicData.some((record) => {
        const tareDeviationAbs = Math.abs(record.tareDeviation || 0);
        const grossDeviationAbs = Math.abs(record.grossDeviation || 0);

        return tareDeviationAbs > stdDev || grossDeviationAbs > stdDev;
      });
    });

    if (filteredData.length === 0) {
      res.status(200).json({
        message: "No vehicles with abnormal weighments found for present day",
        standardDeviation: stdDev,
        data: [],
      });
      return;
    }

    res.status(200).json({
      message: `Fetched Data for Present Day - Vehicles with Abnormal Weighments`,
      standardDeviation: stdDev,
      totalVehiclesWithAbnormalWeighments: filteredData.length,
      data: filteredData,
    });
  } catch (error) {
    console.log(`Failed to fetch reports for present day`, error);
    res.status(500).json({
      error: "Failed to fetch present day reports",
      details: error.message,
    });
    return;
  }
}

async function getReportsByWBCode(req, res) {
  const { wbCode, from, to, stdDev } = req.body;
  if (!wbCode || !from || !to) {
    return res.status(500).json({ message: "Missing search parameters" });
  }

  if (!stdDev) {
    return res.status(400).json({ message: "Standard Deviation is Required" });
  }

  const fromFormatted = moment(from, moment.ISO_8601).format(
    "YYYY-MM-DD HH:mm:ss"
  );
  const toFormatted = moment(to, moment.ISO_8601).format("YYYY-MM-DD HH:mm:ss");

  try {
    const dbResponse = await dbInstanceRFID.query(
      `
  SELECT 
      s.V_NO,
      s.AREA_CODE,
      s.UNIT,
      s.WB_CODE,
      w.WBNAME AS WB_NAME,
      s.SL_NO,
      s.DATE_OUT,
      CASE 
          WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2))
          WHEN s.W_TYPE = 'J' THEN CAST(s.SECOND_WT AS DECIMAL(18,2))
      END AS TARE_WT,
      CASE 
          WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2))
          WHEN s.W_TYPE = 'J' THEN CAST(s.FIRST_WT AS DECIMAL(18,2))
      END AS GROSS_WT,
      -- Average TARE_WT for this specific vehicle at this WB_CODE
      AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2)) ELSE CAST(s.SECOND_WT AS DECIMAL(18,2)) END) 
          OVER (PARTITION BY s.V_NO, s.WB_CODE) AS AVG_TARE_WT,
      -- Average GROSS_WT for this specific vehicle at this WB_CODE
      AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2)) ELSE CAST(s.FIRST_WT AS DECIMAL(18,2)) END) 
          OVER (PARTITION BY s.V_NO, s.WB_CODE) AS AVG_GROSS_WT,
      -- Percentage deviation for TARE_WT
      CASE 
          WHEN AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2)) ELSE CAST(s.SECOND_WT AS DECIMAL(18,2)) END) 
               OVER (PARTITION BY s.V_NO, s.WB_CODE) > 0 THEN
              ((CASE 
                  WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2))
                  WHEN s.W_TYPE = 'J' THEN CAST(s.SECOND_WT AS DECIMAL(18,2))
              END) 
              - AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2)) ELSE CAST(s.SECOND_WT AS DECIMAL(18,2)) END) 
                OVER (PARTITION BY s.V_NO, s.WB_CODE)) 
              / AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.FIRST_WT AS DECIMAL(18,2)) ELSE CAST(s.SECOND_WT AS DECIMAL(18,2)) END) 
                OVER (PARTITION BY s.V_NO, s.WB_CODE) * 100
          ELSE 0
      END AS TARE_DEVIATION_PERCENT,
      -- Percentage deviation for GROSS_WT
      CASE 
          WHEN AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2)) ELSE CAST(s.FIRST_WT AS DECIMAL(18,2)) END) 
               OVER (PARTITION BY s.V_NO, s.WB_CODE) > 0 THEN
              ((CASE 
                  WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2))
                  WHEN s.W_TYPE = 'J' THEN CAST(s.FIRST_WT AS DECIMAL(18,2))
              END) 
              - AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2)) ELSE CAST(s.FIRST_WT AS DECIMAL(18,2)) END) 
                OVER (PARTITION BY s.V_NO, s.WB_CODE)) 
              / AVG(CASE WHEN s.W_TYPE IN ('S', 'I') THEN CAST(s.SECOND_WT AS DECIMAL(18,2)) ELSE CAST(s.FIRST_WT AS DECIMAL(18,2)) END) 
                OVER (PARTITION BY s.V_NO, s.WB_CODE) * 100
          ELSE 0
      END AS GROSS_DEVIATION_PERCENT,
      s.W_TYPE, 
      s.DATE_IN, 
      s.TIME_IN, 
      s.TIME_OUT
  FROM [special25] s
  LEFT JOIN wbs w ON s.WB_CODE = w.wbcode
  WHERE s.WB_CODE = :wbCode
      AND TRY_CAST(CAST(s.DATE_OUT AS varchar(10)) + ' ' + CAST(s.TIME_OUT AS varchar(8)) AS datetime) 
          BETWEEN TRY_CAST(:fromFormatted AS datetime) AND TRY_CAST(:toFormatted AS datetime)
      AND s.DATE_OUT IS NOT NULL 
      AND s.TIME_OUT IS NOT NULL
  ORDER BY s.V_NO, s.DATE_OUT, s.TIME_OUT;`,
      {
        replacements: { wbCode, fromFormatted, toFormatted },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      res.status(200).json({
        message: "No records found, Please Update the Search Parameters",
        data: [],
      });
      return;
    }

    const wbType = getWBType(dbResponse[0].W_TYPE);
    const wbName = dbResponse[0].WB_NAME;

    // Group data by Vehicle Number and apply mapping
    const groupedData = {};

    dbResponse.forEach((entry) => {
      if (!groupedData[entry.V_NO]) {
        groupedData[entry.V_NO] = {
          vehicleNumber: entry.V_NO,
          areaCode: areaCodeMap[entry.AREA_CODE],
          unitCode: unitCodeMap[entry.UNIT],
          avgTare: entry.AVG_TARE_WT,
          avgGross: entry.AVG_GROSS_WT,
          historicData: [],
        };
      }

      // Add historic data entry
      groupedData[entry.V_NO].historicData.push({
        tareWeight: entry.TARE_WT,
        grossWeight: entry.GROSS_WT,
        dateIn: entry.DATE_IN
          ? moment(entry.DATE_IN).format("DD-MM-YYYY")
          : null,
        timeIn: entry.TIME_IN
          ? moment(entry.TIME_IN, "HH:mm:ss", "HH:mm:ss").format("h:mm:ss A")
          : null,
        dateOut: entry.DATE_OUT
          ? moment(entry.DATE_OUT).format("DD-MM-YYYY")
          : null,
        timeOut: entry.TIME_OUT
          ? moment(entry.TIME_OUT, "HH:mm:ss", "HH:mm:ss").format("h:mm:ss A")
          : null,
        tareDeviation: entry.TARE_DEVIATION_PERCENT,
        grossDeviation: entry.GROSS_DEVIATION_PERCENT,
        weightType: getWBType(entry.W_TYPE),
        slNo: entry.SL_NO,
      });
    });

    // Convert grouped data to array
    const formattedData = Object.values(groupedData);

    // Filter to only include vehicles that have at least one abnormal weighment
    const filteredData = formattedData.filter((vehicle) => {
      return vehicle.historicData.some((record) => {
        const tareDeviationAbs = Math.abs(record.tareDeviation || 0);
        const grossDeviationAbs = Math.abs(record.grossDeviation || 0);

        return tareDeviationAbs > stdDev || grossDeviationAbs > stdDev;
      });
    });

    // Log filtering results for debugging
    console.log(`Total vehicles before filtering: ${formattedData.length}`);
    console.log(`Vehicles with abnormal weighments: ${filteredData.length}`);
    console.log(`Abnormal threshold used: ${stdDev}%`);

    if (filteredData.length === 0) {
      res.status(200).json({
        message: `No abnormal weighments found for WB Code ${wbCode} in the specified date range`,
        standardDeviation: stdDev,
        wbType: wbType,
        wbCode: wbCode,
        fromDate: from,
        toDate: to,
        data: [],
      });
      return;
    }

    res.status(200).json({
      message: `Fetched Data for WB Code: ${wbCode} - Vehicles with Abnormal Weighments`,
      standardDeviation: stdDev,
      wbType: wbType,
      wbCode: wbCode,
      wbName: wbName,
      fromDate: from,
      toDate: to,
      totalVehiclesWithAbnormalWeighments: filteredData.length,
      data: filteredData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch reports for the search parameters",
      error: error,
    });
    console.log("Error fetching data", error);
  }
}

async function getReportsByAreaId(req, res) {
  const { areaId, from, to, stdDev } = req.query;
  // Validate required parameters
  if (!areaId) {
    return res.status(400).json({ message: "Area ID is required" });
  }
  if (!from || !to) {
    return res.status(400).json({ message: "From and To dates are required" });
  }
  if (!stdDev) {
    return res.status(400).json({ message: "Standard Deviation is Required" });
  }

  console.log(
    `Getting Reports for Area: ${areaId} from ${from} to ${to}. Standard Deviation = ${stdDev}`
  );

  try {
    const dbResponse = await dbInstanceRFID.query(
      `SELECT 
      AREA_CODE,
      UNIT,
      V_NO,
      SL_NO,
      DATE_OUT,
      CASE 
          WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2))
          WHEN W_TYPE = 'J' THEN CAST(SECOND_WT AS DECIMAL(18,2))
      END AS TARE_WT,
      CASE 
          WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2))
          WHEN W_TYPE = 'J' THEN CAST(FIRST_WT AS DECIMAL(18,2))
      END AS GROSS_WT,
      AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) 
          OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) AS AVG_TARE_WT,
      AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) 
          OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) AS AVG_GROSS_WT,
      -- Percentage deviation for TARE_WT
      CASE 
          WHEN AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) 
               OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) > 0 THEN
              ((CASE 
                  WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2))
                  WHEN W_TYPE = 'J' THEN CAST(SECOND_WT AS DECIMAL(18,2))
              END) 
              - AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) 
                OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO)) 
              / AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) 
                OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) * 100
          ELSE 0
      END AS TARE_DEVIATION_PERCENT,
      -- Percentage deviation for GROSS_WT
      CASE 
          WHEN AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) 
               OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) > 0 THEN
              ((CASE 
                  WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2))
                  WHEN W_TYPE = 'J' THEN CAST(FIRST_WT AS DECIMAL(18,2))
              END) 
              - AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) 
                OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO)) 
              / AVG(CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) 
                OVER (PARTITION BY AREA_CODE, UNIT, WB_CODE, V_NO) * 100
          ELSE 0
      END AS GROSS_DEVIATION_PERCENT,
      W_TYPE, 
      DATE_IN, 
      TIME_IN, 
      TIME_OUT, 
      WB_CODE
      FROM [special25] 
      WHERE AREA_CODE = :areaId 
        AND DATE_OUT IS NOT NULL
        AND DATE_OUT >= CAST(:from AS DATE)
        AND DATE_OUT <= CAST(:to AS DATE)
      ORDER BY 
          AREA_CODE,           -- Area (first level)
          UNIT,                -- Unit (second level)  
          WB_CODE,             -- WB/Weighbridge (third level)
          V_NO,                -- Vehicle Number (fourth level)
          DATE_OUT,            -- Date_out within each vehicle (fifth level)
          TIME_OUT             -- Time_out for consistent ordering`,
      {
        replacements: { areaId, from, to },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      res.status(200).json({
        message: `No records found for Area ${areaId} between ${from} and ${to}`,
        areaId,
        period: { from, to },
        data: [],
      });
      return;
    }

    // Group data by Area -> Unit -> WB -> Vehicle
    const groupedData = {};

    dbResponse.forEach((entry) => {
      const areaKey = areaCodeMap[entry.AREA_CODE];
      const unitKey = `${areaKey}_${unitCodeMap[entry.UNIT]}`;
      const wbKey = `${unitKey}_${entry.WB_CODE}`;
      const vehicleKey = `${wbKey}_${entry.V_NO}`;

      if (!groupedData[areaKey]) {
        groupedData[areaKey] = {
          areaCode: areaCodeMap[entry.AREA_CODE],
          units: {},
        };
      }

      if (!groupedData[areaKey].units[unitKey]) {
        groupedData[areaKey].units[unitKey] = {
          unitCode: unitCodeMap[entry.UNIT],
          weighbridges: {},
        };
      }

      if (!groupedData[areaKey].units[unitKey].weighbridges[wbKey]) {
        groupedData[areaKey].units[unitKey].weighbridges[wbKey] = {
          wbCode: entry.WB_CODE,
          vehicles: {},
        };
      }

      if (
        !groupedData[areaKey].units[unitKey].weighbridges[wbKey].vehicles[
          vehicleKey
        ]
      ) {
        groupedData[areaKey].units[unitKey].weighbridges[wbKey].vehicles[
          vehicleKey
        ] = {
          vehicleNumber: entry.V_NO,
          avgTare: entry.AVG_TARE_WT,
          avgGross: entry.AVG_GROSS_WT,
          historicData: [],
        };
      }

      // Add historic data entry
      groupedData[areaKey].units[unitKey].weighbridges[wbKey].vehicles[
        vehicleKey
      ].historicData.push({
        tareWeight: entry.TARE_WT,
        grossWeight: entry.GROSS_WT,
        dateIn: entry.DATE_IN
          ? moment(entry.DATE_IN).format("DD-MM-YYYY")
          : null,
        dateOut: entry.DATE_OUT
          ? moment(entry.DATE_OUT).format("DD-MM-YYYY")
          : null,
        timeIn: entry.TIME_IN
          ? moment(entry.TIME_IN, "HH:mm:ss").format("h:mm:ss A")
          : null,
        timeOut: entry.TIME_OUT
          ? moment(entry.TIME_OUT, "HH:mm:ss").format("h:mm:ss A")
          : null,
        tareDeviation: entry.TARE_DEVIATION_PERCENT,
        grossDeviation: entry.GROSS_DEVIATION_PERCENT,
        weightType: getWBType(entry.W_TYPE),
        slNo: entry.SL_NO,
      });
    });

    // Convert grouped data to flat structure for frontend
    const structuredData = [];

    Object.values(groupedData).forEach((area) => {
      Object.values(area.units).forEach((unit) => {
        Object.values(unit.weighbridges).forEach((wb) => {
          Object.values(wb.vehicles).forEach((vehicle) => {
            structuredData.push({
              areaCode: area.areaCode,
              unitCode: unit.unitCode,
              wbCode: wb.wbCode,
              vehicleNumber: vehicle.vehicleNumber,
              avgTare: vehicle.avgTare,
              avgGross: vehicle.avgGross,
              historicData: vehicle.historicData,
            });
          });
        });
      });
    });

    // Filter to only include vehicles that have at least one abnormal weighment
    const filteredData = structuredData.filter((vehicle) => {
      return vehicle.historicData.some((record) => {
        const tareDeviationAbs = Math.abs(record.tareDeviation || 0);
        const grossDeviationAbs = Math.abs(record.grossDeviation || 0);
        return tareDeviationAbs > stdDev || grossDeviationAbs > stdDev;
      });
    });

    // Log filtering results for debugging
    console.log(`Total vehicles before filtering: ${structuredData.length}`);
    console.log(`Vehicles with abnormal weighments: ${filteredData.length}`);
    console.log(`Abnormal threshold used: ${stdDev}%`);

    if (filteredData.length === 0) {
      res.status(200).json({
        message: `No vehicles with abnormal weighments found for Area ${areaId} between ${from} and ${to}`,
        areaId,
        period: { from, to },
        standardDeviation: stdDev,
        data: [],
      });
      return;
    }

    res.status(200).json({
      message: `Fetched Data for Area ${areaId} - Vehicles with Abnormal Weighments`,
      areaId,
      period: { from, to },
      standardDeviation: stdDev,
      totalVehiclesWithAbnormalWeighments: filteredData.length,
      data: filteredData,
    });
  } catch (error) {
    console.log(`Failed to fetch reports for Area ${areaId}`, error);
    res.status(500).json({
      error: `Failed to fetch reports for Area ${areaId}`,
      details: error.message,
    });
    return;
  }
}

/******************************************TRIP TIME REPORTS**************************************/

async function getTripTimeReportsByUnitCode(req, res) {
  const { unitCode, from, to } = req.body;

  // Validate required parameters
  if (!unitCode || !from || !to) {
    return res.status(400).json({
      message:
        "Missing required parameters: unitCode, from and to dates are mandatory",
    });
  }

  // Format dates for SQL Server (YYYY-MM-DD)
  const fromFormatted = new Date(from).toISOString().split("T")[0];
  const toFormatted = new Date(to).toISOString().split("T")[0];

  console.log(
    `Getting trip time reports - Unit: ${unitCode}, From: ${fromFormatted}, To: ${toFormatted}`
  );

  try {
    const dbResponse = await dbInstanceRFID.query(
      `
      ;WITH TripData AS (
          SELECT
              Receiving.V_NO AS VehicleNumber,
              Receiving.SL_NO AS ReceivingSlipNo,
              Sending.SL_NO AS SendingSlipNo,
              Sending.DO_NO AS SourceDONumber,
              Sending.UNIT AS UnitCode,
              -- Source information (from Sending record)
              Sending.SRC_AREA AS SrcAreaCode,
              Sending.SRC_WB AS SrcWBCode,
              Sending.SRC_UNIT AS SrcUnitCode,
              -- Destination information (from Receiving record)
              Receiving.DEST_AREA AS DestAreaCode,
              Receiving.DEST_WB AS DestWBCode,
              Receiving.DEST_UNIT AS DestUnitCode,
              -- Combine date and time fields into proper datetime values
              TRY_CONVERT(datetime2, CONCAT(Receiving.DATE_IN, ' ', Receiving.TIME_IN)) AS ReceivingDateTime,
              TRY_CONVERT(datetime2, CONCAT(Sending.DATE_OUT, ' ', Sending.TIME_OUT)) AS SendingDateTime,
              -- Calculate trip duration in seconds
              DATEDIFF(SECOND, 
                  TRY_CONVERT(datetime2, CONCAT(Sending.DATE_OUT, ' ', Sending.TIME_OUT)),
                  TRY_CONVERT(datetime2, CONCAT(Receiving.DATE_IN, ' ', Receiving.TIME_IN))
              ) AS TripSeconds
          FROM dbo.special25 AS Receiving
          INNER JOIN dbo.special25 AS Sending
              ON LTRIM(RTRIM(TRY_CONVERT(varchar(100), Sending.SL_NO))) =
                 LTRIM(RTRIM(TRY_CONVERT(varchar(100), Receiving.SRC_SLNO)))
          WHERE
              Receiving.W_TYPE = 'J'
              AND Receiving.SRC_SLNO IS NOT NULL
              AND LTRIM(RTRIM(Receiving.SRC_SLNO)) <> ''
              AND TRY_CONVERT(datetime2, CONCAT(Receiving.DATE_IN, ' ', Receiving.TIME_IN)) IS NOT NULL
              AND TRY_CONVERT(datetime2, CONCAT(Sending.DATE_OUT, ' ', Sending.TIME_OUT)) IS NOT NULL
              AND CAST(TRY_CONVERT(datetime2, CONCAT(Receiving.DATE_IN, ' ', Receiving.TIME_IN)) AS date) BETWEEN :fromDate AND :toDate
              AND Sending.UNIT = :unitCode
      ),
      TripDataWithAvg AS (
          SELECT
              SourceDONumber,
              VehicleNumber,
              SrcAreaCode,
              SrcWBCode,
              SrcUnitCode,
              DestAreaCode,
              DestWBCode,
              DestUnitCode,
              ReceivingDateTime,
              SendingDateTime,
              TripSeconds,
              -- Calculate average trip time per DO_NO and Vehicle combination
              AVG(TripSeconds) OVER (PARTITION BY SourceDONumber, VehicleNumber) AS AvgTripSeconds
          FROM TripData
      )
      SELECT
          td.SourceDONumber AS DO_Number,
          td.VehicleNumber AS Vehicle_Number,
          -- Merged Source Area (Code - Name)
          CONCAT(td.SrcAreaCode, ' - ', ISNULL(sa.areaname, 'Unknown')) AS Src_Area,
          td.SrcWBCode AS Src_WB_Code,
          -- Merged Source Unit (Code - Name)
          CONCAT(td.SrcUnitCode, ' - ', ISNULL(su.unitname, 'Unknown')) AS Src_Unit,
          -- Merged Destination Area (Code - Name)
          CONCAT(td.DestAreaCode, ' - ', ISNULL(da.areaname, 'Unknown')) AS Dest_Area,
          td.DestWBCode AS Dest_WB_Code,
          -- Merged Destination Unit (Code - Name)
          CONCAT(td.DestUnitCode, ' - ', ISNULL(du.unitname, 'Unknown')) AS Dest_Unit,
          -- Trip start and end times
          td.SendingDateTime AS Trip_Start_Time,
          td.ReceivingDateTime AS Trip_End_Time,
          -- Average trip time for this DO and Vehicle
          CONCAT(
              (td.AvgTripSeconds / 3600), ':',
              RIGHT('00' + CAST((td.AvgTripSeconds % 3600) / 60 AS varchar(2)), 2), ':',
              RIGHT('00' + CAST(td.AvgTripSeconds % 60 AS varchar(2)), 2)
          ) AS Avg_Trip_Time,
          -- Individual trip time for this record
          CONCAT(
              (td.TripSeconds / 3600), ':',
              RIGHT('00' + CAST((td.TripSeconds % 3600) / 60 AS varchar(2)), 2), ':',
              RIGHT('00' + CAST(td.TripSeconds % 60 AS varchar(2)), 2)
          ) AS Trip_Time
      FROM TripDataWithAvg td
      -- Join for Source Area Name
      LEFT JOIN dbo.areas sa ON td.SrcAreaCode = sa.areacode
      -- Join for Source Unit Name
      LEFT JOIN dbo.units su ON td.SrcUnitCode = su.unitcode
      -- Join for Destination Area Name
      LEFT JOIN dbo.areas da ON td.DestAreaCode = da.areacode
      -- Join for Destination Unit Name
      LEFT JOIN dbo.units du ON td.DestUnitCode = du.unitcode
      ORDER BY 
          td.SourceDONumber, td.VehicleNumber;
      `,
      {
        replacements: {
          unitCode: unitCode,
          fromDate: fromFormatted,
          toDate: toFormatted,
        },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      return res.status(200).json({
        message: "No trip records found for the specified parameters.",
        data: [],
      });
    }

    // Calculate summary statistics
    const uniqueDOs = [...new Set(dbResponse.map((trip) => trip.DO_Number))];
    const uniqueVehicles = [
      ...new Set(dbResponse.map((trip) => trip.Vehicle_Number)),
    ];

    // calling stat utility
    const classifiedData = detectOutliersIQR(dbResponse);

    // Success response with data and summary
    return res.status(200).json({
      message: "Trip time reports fetched successfully",
      data: classifiedData.data,
      summary: {
        totalTrips: dbResponse.length,
        uniqueDOCount: uniqueDOs.length,
        uniqueVehicleCount: uniqueVehicles.length,
        totalOutliers: classifiedData.summary.totalOutliers,
        totalNormalTrips: classifiedData.summary.totalNormalTrips,
        outlierPercentage: classifiedData.summary.outlierPercentage,
        unitCode: unitCode,
        dateRange: { from: fromFormatted, to: toFormatted },
      },
    });
  } catch (error) {
    console.error("Error fetching trip time reports:", error);
    return res.status(500).json({
      message: "Could not fetch trip time reports",
      error: error.message,
    });
  }
}

export {
  getReportsByVehicleNumber,
  getReportsForPresentDay,
  getReportsByWBCode,
  getReportsByAreaId,
  getTripTimeReportsByUnitCode,
};
