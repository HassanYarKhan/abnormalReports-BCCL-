async function getReportsByVehicleNumber(req, res) {
  const { vehicleNumber, from, to } = req.body;

  if (!vehicleNumber || !from || !to) {
    return res.status(500).json({ message: "Missing search parameters" });
  }

  // Format dates for SQL Server datetime comparison
  const fromFormatted = moment(from, moment.ISO_8601).format(
    "YYYY-MM-DD HH:mm:ss"
  );
  const toFormatted = moment(to, moment.ISO_8601).format("YYYY-MM-DD HH:mm:ss");

  console.log(
    `getting data for vehicle number: ${vehicleNumber}, from: ${fromFormatted}, to: ${toFormatted}`
  );

  try {
    const dbResponse = await sequelize.query(
      `SELECT 
    s.V_NO,
    s.AREA_CODE,
    s.UNIT,
    s.WB_CODE,
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
        replacements: {
          vehicleNumber,
          fromFormatted,
          toFormatted,
        },
        type: sequelize.QueryTypes.SELECT,
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
          ? moment(entry.TIME_IN, "HH:mm:ss").format("h:mm:ss A")
          : null,
        dateOut: entry.DATE_OUT
          ? moment(entry.DATE_OUT).format("DD-MM-YYYY")
          : null,
        timeOut: entry.TIME_OUT
          ? moment(entry.TIME_OUT, "HH:mm:ss").format("h:mm:ss A")
          : null,
        tareDeviation: entry.TARE_DEVIATION_PERCENT,
        grossDeviation: entry.GROSS_DEVIATION_PERCENT,
        weightType: getWBType(entry.W_TYPE),
      });
    });

    // Convert grouped data to array
    const structuredData = Object.values(groupedData);

    // Define the abnormal threshold (default to 5% if not defined)
    const abnormalThreshold = standardDeviation || 5.0;

    // Filter to only include weighbridge groups that have at least one abnormal weighment
    const filteredData = structuredData.filter((wbGroup) => {
      return wbGroup.historicData.some((record) => {
        const tareDeviationAbs = Math.abs(record.tareDeviation || 0);
        const grossDeviationAbs = Math.abs(record.grossDeviation || 0);

        return (
          tareDeviationAbs > abnormalThreshold ||
          grossDeviationAbs > abnormalThreshold
        );
      });
    });

    if (filteredData.length === 0) {
      res.status(200).json({
        message: `No abnormal weighments found for vehicle ${vehicleNumber} in the specified date range`,
        standardDeviation: abnormalThreshold,
        vehicleNumber: vehicleNumber,
        fromDate: from,
        toDate: to,
        data: [],
      });
      return;
    }

    res.status(200).json({
      message: `Fetched Data for vehicle number: ${vehicleNumber} - Weighbridge Groups with Abnormal Weighments`,
      standardDeviation: abnormalThreshold,
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
