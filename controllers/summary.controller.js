import dbInstanceRFID from "../config/dbconfigRFID.js";
import getDateRanges from "../utils/getDateRanges.js";

async function getVehicleWiseSummary(req, res) {
  const { from, to, standardDeviation } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "From and To dates are required" });
  }

  try {
    const dbResponse = await dbInstanceRFID.query(
      `
      WITH ViolationData AS (
        SELECT 
          V_NO,
          AREA_CODE,
          UNIT,
          CASE WHEN ABS(
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
            END) > :standardDeviation THEN 1 ELSE 0 END AS TARE_VIOLATION,
          CASE 
            WHEN (CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) = 
                 (CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) THEN 0
            WHEN ABS(
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
              END) > :standardDeviation THEN 1 
            ELSE 0 
          END AS GROSS_VIOLATION
        FROM [special25] 
        WHERE DATE_OUT IS NOT NULL
          AND DATE_OUT >= CAST(:from AS DATE)
          AND DATE_OUT <= CAST(:to AS DATE)
      )
      SELECT TOP 5
        V_NO,
        AREA_CODE,
        UNIT,
        SUM(TARE_VIOLATION) AS TARE_VIOLATIONS,
        SUM(GROSS_VIOLATION) AS GROSS_VIOLATIONS,
        SUM(TARE_VIOLATION + GROSS_VIOLATION) AS TOTAL_VIOLATIONS,
        COUNT(*) AS TOTAL_TRANSACTIONS
      FROM ViolationData
      GROUP BY V_NO, AREA_CODE, UNIT
      HAVING SUM(TARE_VIOLATION + GROSS_VIOLATION) > 0
      ORDER BY TOTAL_VIOLATIONS DESC, V_NO
    `,
      {
        replacements: { from, to, standardDeviation },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      return res
        .status(200)
        .json({ message: "No records found for this time frame" });
    }

    return res.status(200).json({
      data: dbResponse,
      summary: {
        totalVehicles: dbResponse.length,
        period: { from, to },
      },
    });
  } catch (error) {
    console.log("Failed to fetch vehicle data:", error);
    return res.status(500).json({
      message: "Failed to fetch vehicle data",
      error: error.message,
    });
  }
}

async function getWeighbridgeWiseSummary(req, res) {
  const { from, to, standardDeviation } = req.query;
  //console.log(req.query);
  if (!from || !to) {
    return res.status(400).json({ message: "From and To dates are required" });
  }

  try {
    const dbResponse = await dbInstanceRFID.query(
      `
      WITH ViolationData AS (
        SELECT 
          WB_CODE,
          AREA_CODE,
          UNIT,
          V_NO,
          CASE WHEN ABS(
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
            END) > :standardDeviation THEN 1 ELSE 0 END AS TARE_VIOLATION,
          CASE 
            WHEN (CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) = 
                 (CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) THEN 0
            WHEN ABS(
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
              END) > :standardDeviation THEN 1 
            ELSE 0 
          END AS GROSS_VIOLATION
        FROM [special25] 
        WHERE DATE_OUT IS NOT NULL
          AND DATE_OUT >= CAST(:from AS DATE)
          AND DATE_OUT <= CAST(:to AS DATE)
      )
      SELECT TOP 5
        vd.WB_CODE,
        w.WBNAME AS WB_NAME,
        vd.AREA_CODE,
        vd.UNIT,
        SUM(vd.TARE_VIOLATION) AS TARE_VIOLATIONS,
        SUM(vd.GROSS_VIOLATION) AS GROSS_VIOLATIONS,
        SUM(vd.TARE_VIOLATION + vd.GROSS_VIOLATION) AS TOTAL_VIOLATIONS,
        COUNT(*) AS TOTAL_TRANSACTIONS,
        COUNT(DISTINCT vd.V_NO) AS UNIQUE_VEHICLES
      FROM ViolationData vd
      LEFT JOIN wbs w ON vd.WB_CODE = w.wbcode
      GROUP BY vd.WB_CODE, w.WBNAME, vd.AREA_CODE, vd.UNIT
      HAVING SUM(vd.TARE_VIOLATION + vd.GROSS_VIOLATION) > 0
      ORDER BY TOTAL_VIOLATIONS DESC, vd.WB_CODE
    `,
      {
        replacements: { from, to, standardDeviation },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      return res
        .status(200)
        .json({ message: "No records found for this time frame" });
    }

    return res.status(200).json({
      data: dbResponse,
      summary: {
        totalWeighbridges: dbResponse.length,
        period: { from, to },
      },
    });
  } catch (error) {
    console.log("Failed to fetch weighbridge data:", error);
    return res.status(500).json({
      message: "Failed to fetch weighbridge data",
      error: error.message,
    });
  }
}

async function getAreaWiseSummary(req, res) {
  const { from, to, standardDeviation } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "From and To dates are required" });
  }

  try {
    const dbResponse = await dbInstanceRFID.query(
      `
      WITH ViolationData AS (
        SELECT 
          AREA_CODE,
          V_NO,
          WB_CODE,
          CASE WHEN ABS(
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
            END) > :standardDeviation THEN 1 ELSE 0 END AS TARE_VIOLATION,
          CASE 
            WHEN (CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) = 
                 (CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) THEN 0
            WHEN ABS(
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
              END) > :standardDeviation THEN 1 
            ELSE 0 
          END AS GROSS_VIOLATION
        FROM [special25] 
        WHERE DATE_OUT IS NOT NULL
          AND DATE_OUT >= CAST(:from AS DATE)
          AND DATE_OUT <= CAST(:to AS DATE)
      )
      SELECT TOP 5
        AREA_CODE,
        SUM(TARE_VIOLATION) AS TARE_VIOLATIONS,
        SUM(GROSS_VIOLATION) AS GROSS_VIOLATIONS,
        SUM(TARE_VIOLATION + GROSS_VIOLATION) AS TOTAL_VIOLATIONS,
        COUNT(*) AS TOTAL_TRANSACTIONS,
        COUNT(DISTINCT V_NO) AS UNIQUE_VEHICLES,
        COUNT(DISTINCT WB_CODE) AS UNIQUE_WEIGHBRIDGES
      FROM ViolationData
      GROUP BY AREA_CODE
      HAVING SUM(TARE_VIOLATION + GROSS_VIOLATION) > 0
      ORDER BY TOTAL_VIOLATIONS DESC, AREA_CODE
    `,
      {
        replacements: { from, to, standardDeviation },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      return res
        .status(200)
        .json({ message: "No records found for this time frame" });
    }
    //console.log("Area-wise summary response:", dbResponse);
    return res.status(200).json({
      data: dbResponse,
    });
  } catch (error) {
    console.log("Failed to fetch area data:", error);
    return res.status(500).json({
      message: "Failed to fetch area data",
      error: error.message,
    });
  }
}

async function getViolationSummary(req, res) {
  const { from, to, type = "all", standardDeviation } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: "From and To dates are required" });
  }

  try {
    const summary = {};

    if (type === "all" || type === "vehicles") {
      const violationQuery = await dbInstanceRFID.query(
        `
        WITH ViolationData AS (
        SELECT 
          V_NO,
          WB_CODE,
          AREA_CODE,
          CASE WHEN ABS(
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
            END) > :standardDeviation THEN 1 ELSE 0 END AS TARE_VIOLATION,
          CASE 
            WHEN (CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(FIRST_WT AS DECIMAL(18,2)) ELSE CAST(SECOND_WT AS DECIMAL(18,2)) END) = 
                 (CASE WHEN W_TYPE IN ('S', 'I') THEN CAST(SECOND_WT AS DECIMAL(18,2)) ELSE CAST(FIRST_WT AS DECIMAL(18,2)) END) THEN 0
            WHEN ABS(
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
              END) > :standardDeviation THEN 1 
            ELSE 0 
          END AS GROSS_VIOLATION
        FROM [special25] 
        WHERE DATE_OUT IS NOT NULL
          AND DATE_OUT >= CAST(:from AS DATE)
          AND DATE_OUT <= CAST(:to AS DATE)
      ),
      ViolationRecords AS (
        SELECT 
          V_NO,
          WB_CODE,
          AREA_CODE,
          TARE_VIOLATION,
          GROSS_VIOLATION
        FROM ViolationData
        WHERE TARE_VIOLATION = 1 OR GROSS_VIOLATION = 1
      )
      SELECT 
        -- 1. Total violations (sum of all tare and gross violations)
        (SUM(TARE_VIOLATION) + SUM(GROSS_VIOLATION)) AS total_violations,
        
        -- 2. Unique number of vehicles with violations
        COUNT(DISTINCT V_NO) AS unique_vehicles_with_violations,
        
        -- 3. Unique number of weighbridges with violations
        COUNT(DISTINCT WB_CODE) AS unique_weighbridges_with_violations,
        
        -- 4. Unique number of areas with violations
        COUNT(DISTINCT AREA_CODE) AS unique_areas_with_violations
      FROM ViolationRecords
      `,
        {
          replacements: { from, to, standardDeviation },
          type: dbInstanceRFID.QueryTypes.SELECT,
        }
      );

      summary.violations = {
        total_violations: (violationQuery && violationQuery[0]) ? violationQuery[0].total_violations || 0 : 0,
        unique_vehicles_with_violations:
          (violationQuery && violationQuery[0]) ? violationQuery[0].unique_vehicles_with_violations || 0 : 0,
        unique_weighbridges_with_violations:
          (violationQuery && violationQuery[0]) ? violationQuery[0].unique_weighbridges_with_violations || 0 : 0,
        unique_areas_with_violations:
          (violationQuery && violationQuery[0]) ? violationQuery[0].unique_areas_with_violations || 0 : 0,
      };
    }

    return res.status(200).json({
      summary,
    });
  } catch (error) {
    console.log("Failed to fetch violation summary:", error);
    return res.status(500).json({
      message: "Failed to fetch violation summary",
      error: error.message,
    });
  }
}

/**************************************trip reports summary******************************************/
async function getTotalTripViolationSummary(req, res) {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ message: "From and To dates are required" });
  }

  try {
    // Execute the optimized query with IQR calculation in SQL
    const dbResponse = await dbInstanceRFID.query(
      `
      WITH TripData AS (
        SELECT 
          r.V_NO AS Vehicle_Number,
          s.DO_NO AS DO_Number,
          s.UNIT AS Unit,
          DATEDIFF(SECOND, 
            CAST(CONCAT(s.DATE_OUT,' ', s.TIME_OUT) AS datetime2),
            CAST(CONCAT(r.DATE_IN, ' ', r.TIME_IN) AS datetime2)
          ) AS Trip_Seconds
        FROM dbo.special25 r WITH (NOLOCK)
        INNER JOIN dbo.special25 s WITH (NOLOCK)
          ON LTRIM(RTRIM(CAST(s.SL_NO AS varchar(100))))
            = LTRIM(RTRIM(CAST(r.SRC_SLNO AS varchar(100))))
        WHERE
          r.W_TYPE = 'J'
          AND r.SRC_SLNO IS NOT NULL
          AND r.SRC_SLNO <> ''
          AND r.DATE_IN >= :fromDate
          AND r.DATE_IN < DATEADD(DAY, 1, :toDate)
          AND s.DATE_OUT >= DATEADD(DAY, -1, :fromDate)
          AND s.DATE_OUT IS NOT NULL 
          AND s.TIME_OUT IS NOT NULL
          AND r.DATE_IN IS NOT NULL 
          AND r.TIME_IN IS NOT NULL
      ),
      TripDataFiltered AS (
        SELECT 
          Vehicle_Number,
          DO_Number,
          Unit,
          Trip_Seconds
        FROM TripData
        WHERE Trip_Seconds IS NOT NULL
      ),
      NumberedTrips AS (
        SELECT
          Vehicle_Number,
          DO_Number,
          Unit,
          Trip_Seconds,
          ROW_NUMBER() OVER (ORDER BY Trip_Seconds) AS RowNum,
          COUNT(*) OVER () AS TotalCount
        FROM TripDataFiltered
      ),
      Quartiles AS (
        SELECT
          MAX(CASE WHEN RowNum = CEILING(TotalCount * 0.25) THEN Trip_Seconds END) AS Q1,
          MAX(CASE WHEN RowNum = CEILING(TotalCount * 0.75) THEN Trip_Seconds END) AS Q3,
          MAX(TotalCount) AS Total_Trips
        FROM NumberedTrips
      ),
      IQRBounds AS (
        SELECT
          Total_Trips,
          Q1,
          Q3,
          (Q3 - Q1) AS IQR,
          (Q1 - 1.5 * (Q3 - Q1)) AS Lower_Bound,
          (Q3 + 1.5 * (Q3 - Q1)) AS Upper_Bound
        FROM Quartiles
      ),
      ViolationFlags AS (
        SELECT
          t.Vehicle_Number,
          t.DO_Number,
          t.Unit,
          t.Trip_Seconds,
          CASE 
            WHEN t.Trip_Seconds < b.Lower_Bound OR t.Trip_Seconds > b.Upper_Bound
            THEN 1
            ELSE 0 
          END AS Is_Violation
        FROM TripDataFiltered t
        CROSS JOIN IQRBounds b
      )
      SELECT
        :fromDate AS From_Date,
        :toDate AS To_Date,
        (SELECT Total_Trips FROM IQRBounds) AS Total_Trips,
        SUM(Is_Violation) AS Total_Violations,
        SUM(CASE WHEN Is_Violation = 0 THEN 1 ELSE 0 END) AS Normal_Trips,
        CAST(SUM(Is_Violation) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(10,2)) AS Violation_Percentage,
        COUNT(DISTINCT Vehicle_Number) AS Total_Unique_Vehicles,
        COUNT(DISTINCT CASE WHEN Is_Violation = 1 THEN Vehicle_Number END) AS Vehicles_With_Violations,
        COUNT(DISTINCT DO_Number) AS Total_Unique_DOs,
        COUNT(DISTINCT CASE WHEN Is_Violation = 1 THEN DO_Number END) AS DOs_With_Violations,
        COUNT(DISTINCT Unit) AS Total_Unique_Units,
        COUNT(DISTINCT CASE WHEN Is_Violation = 1 THEN Unit END) AS Units_With_Violations
      FROM ViolationFlags
      OPTION (RECOMPILE, MAXDOP 4);
      `,
      {
        replacements: {
          fromDate: from,
          toDate: to,
        },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    // Check if query returned results
    if (!dbResponse || dbResponse.length === 0) {
      return res
        .status(404)
        .json({ message: "No data found for the specified date range" });
    }

    // Extract the single row result
    const result = dbResponse[0];

    // Return response in the exact same format as before
    return res.status(200).json({
      success: true,
      data: {
        From_Date: result.From_Date,
        To_Date: result.To_Date,
        Total_Trips: result.Total_Trips,
        Total_Violations: result.Total_Violations,
        Normal_Trips: result.Normal_Trips,
        Violation_Percentage: parseFloat(result.Violation_Percentage),
        Total_Unique_Vehicles: result.Total_Unique_Vehicles,
        Vehicles_With_Violations: result.Vehicles_With_Violations,
        Total_Unique_DOs: result.Total_Unique_DOs,
        DOs_With_Violations: result.DOs_With_Violations,
        Total_Unique_Units: result.Total_Unique_Units,
        Units_With_Violations: result.Units_With_Violations,
      },
    });
  } catch (error) {
    console.error("Error fetching trip violation summary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getVehicleWiseTripSummary(req, res) {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ message: "From and To dates are required" });
  }

  try {
    // Calculate if single day query
    const isSingleDay = from === to;
    
    // For single day, expand the date range to trick the optimizer
    // but filter to actual dates in the WHERE clause
    const optimizerFromDate = isSingleDay ? 
      new Date(new Date(from).setDate(new Date(from).getDate() - 3)).toISOString().split('T')[0] : 
      from;
    const optimizerToDate = isSingleDay ? 
      new Date(new Date(to).setDate(new Date(to).getDate() + 3)).toISOString().split('T')[0] : 
      to;

    const dbResponse = await dbInstanceRFID.query(
      `
      WITH TripData AS (
        SELECT 
          r.V_NO AS Vehicle_Number,
          s.DO_NO AS DO_Number,
          s.UNIT AS Unit_Code,
          s.AREA_CODE AS Src_Area_Code,
          s.SRC_WB AS Src_WB_Code,
          s.SRC_UNIT AS Src_Unit_Code,
          r.DEST_AREA AS Dest_Area_Code,
          r.DEST_WB AS Dest_WB_Code,
          r.DEST_UNIT AS Dest_Unit_Code,
          DATEDIFF(SECOND, 
            CAST(CONCAT(s.DATE_OUT,' ', s.TIME_OUT) AS datetime2),
            CAST(CONCAT(r.DATE_IN, ' ', r.TIME_IN) AS datetime2)
          ) AS Trip_Seconds
        FROM dbo.special25 r WITH (NOLOCK)
        INNER JOIN dbo.special25 s WITH (NOLOCK)
          ON s.SL_NO = r.SRC_SLNO
        WHERE
          r.W_TYPE = 'J'
          AND r.SRC_SLNO IS NOT NULL
          AND r.SRC_SLNO <> ''
          AND r.DATE_IN >= :optimizerFromDate
          AND r.DATE_IN < DATEADD(DAY, 1, :optimizerToDate)
          AND s.DATE_OUT >= DATEADD(DAY, -1, :optimizerFromDate)
          AND s.DATE_OUT < DATEADD(DAY, 2, :optimizerToDate)
          AND r.DATE_IN >= :actualFromDate
          AND r.DATE_IN < DATEADD(DAY, 1, :actualToDate)
          AND s.DATE_OUT IS NOT NULL 
          AND s.TIME_OUT IS NOT NULL
          AND r.DATE_IN IS NOT NULL 
          AND r.TIME_IN IS NOT NULL
      ),
      TripDataFiltered AS (
        SELECT 
          Vehicle_Number,
          DO_Number,
          Unit_Code,
          Src_Area_Code,
          Src_WB_Code,
          Src_Unit_Code,
          Dest_Area_Code,
          Dest_WB_Code,
          Dest_Unit_Code,
          Trip_Seconds
        FROM TripData
        WHERE Trip_Seconds IS NOT NULL
      ),
      DONumberedTrips AS (
        SELECT
          DO_Number,
          Vehicle_Number,
          Unit_Code,
          Src_Area_Code,
          Src_WB_Code,
          Src_Unit_Code,
          Dest_Area_Code,
          Dest_WB_Code,
          Dest_Unit_Code,
          Trip_Seconds,
          ROW_NUMBER() OVER (PARTITION BY DO_Number ORDER BY Trip_Seconds) AS RowNum,
          COUNT(*) OVER (PARTITION BY DO_Number) AS DOTotalCount
        FROM TripDataFiltered
      ),
      DOQuartiles AS (
        SELECT
          DO_Number,
          MAX(CASE WHEN RowNum = CEILING(DOTotalCount * 0.25) THEN Trip_Seconds END) AS Q1,
          MAX(CASE WHEN RowNum = CEILING(DOTotalCount * 0.75) THEN Trip_Seconds END) AS Q3
        FROM DONumberedTrips
        GROUP BY DO_Number
      ),
      DOIQRBounds AS (
        SELECT
          DO_Number,
          Q1,
          Q3,
          (Q3 - Q1) AS IQR,
          (Q1 - 1.5 * (Q3 - Q1)) AS Lower_Bound,
          (Q3 + 1.5 * (Q3 - Q1)) AS Upper_Bound
        FROM DOQuartiles
      ),
      ViolationFlags AS (
        SELECT
          t.Vehicle_Number,
          t.DO_Number,
          t.Unit_Code,
          t.Src_Area_Code,
          t.Src_WB_Code,
          t.Src_Unit_Code,
          t.Dest_Area_Code,
          t.Dest_WB_Code,
          t.Dest_Unit_Code,
          t.Trip_Seconds,
          CASE 
            WHEN t.Trip_Seconds < b.Lower_Bound OR t.Trip_Seconds > b.Upper_Bound
            THEN 1
            ELSE 0 
          END AS Is_Violation
        FROM TripDataFiltered t
        INNER JOIN DOIQRBounds b ON t.DO_Number = b.DO_Number
      ),
      VehicleAggregates AS (
        SELECT
          v.Vehicle_Number,
          MIN(v.DO_Number) AS DO_Number,
          MIN(v.Unit_Code) AS Unit_Code,
          MIN(v.Src_Area_Code) AS Src_Area_Code,
          MIN(v.Src_WB_Code) AS Src_WB_Code,
          MIN(v.Src_Unit_Code) AS Src_Unit_Code,
          MIN(v.Dest_Area_Code) AS Dest_Area_Code,
          MIN(v.Dest_WB_Code) AS Dest_WB_Code,
          MIN(v.Dest_Unit_Code) AS Dest_Unit_Code,
          SUM(Is_Violation) AS Total_Violations
        FROM ViolationFlags v
        WHERE Is_Violation = 1
        GROUP BY v.Vehicle_Number
      ),
      Top5Vehicles AS (
        SELECT TOP 5
          va.Vehicle_Number,
          va.DO_Number,
          CONCAT(va.Unit_Code, ' - ', ISNULL(u.unitname, 'Unknown')) AS Unit,
          CONCAT(va.Src_Area_Code, ' - ', ISNULL(sa.areaname, 'Unknown')) AS Source_Area,
          va.Src_WB_Code AS Source_Weighbridge,
          CONCAT(va.Src_Unit_Code, ' - ', ISNULL(su.unitname, 'Unknown')) AS Source_Unit,
          CONCAT(va.Dest_Area_Code, ' - ', ISNULL(da.areaname, 'Unknown')) AS Destination_Area,
          va.Dest_WB_Code AS Destination_Weighbridge,
          CONCAT(va.Dest_Unit_Code, ' - ', ISNULL(du.unitname, 'Unknown')) AS Destination_Unit,
          va.Total_Violations
        FROM VehicleAggregates va
        LEFT JOIN dbo.units u ON va.Unit_Code = u.unitcode
        LEFT JOIN dbo.areas sa ON va.Src_Area_Code = sa.areacode
        LEFT JOIN dbo.units su ON va.Src_Unit_Code = su.unitcode
        LEFT JOIN dbo.areas da ON va.Dest_Area_Code = da.areacode
        LEFT JOIN dbo.units du ON va.Dest_Unit_Code = du.unitcode
        ORDER BY va.Total_Violations DESC
      )
      SELECT * FROM Top5Vehicles
      OPTION (RECOMPILE, MAXDOP 4);
      `,
      {
        replacements: {
          optimizerFromDate: optimizerFromDate,
          optimizerToDate: optimizerToDate,
          actualFromDate: from,
          actualToDate: to,
        },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (!dbResponse || dbResponse.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No vehicle violations found for the specified date range",
      });
    }

    console.log(
      `Fetched ${dbResponse.length} vehicle-wise trip records from database`
    );

    return res.status(200).json({
      success: true,
      count: dbResponse.length,
      data: dbResponse,
    });
  } catch (error) {
    console.error("Error fetching vehicle-wise trip summary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getDOWiseTripSummary(req, res) {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ message: "From and To dates are required" });
  }

  try {
    const isSingleDay = from === to;
    
    const optimizerFromDate = isSingleDay ? 
      new Date(new Date(from).setDate(new Date(from).getDate() - 3)).toISOString().split('T')[0] : 
      from;
    const optimizerToDate = isSingleDay ? 
      new Date(new Date(to).setDate(new Date(to).getDate() + 3)).toISOString().split('T')[0] : 
      to;

    const dbResponse = await dbInstanceRFID.query(
      `
      WITH TripData AS (
        SELECT 
          r.V_NO AS Vehicle_Number,
          s.DO_NO AS DO_Number,
          s.UNIT AS Unit_Code,
          s.AREA_CODE AS Src_Area_Code,
          s.SRC_WB AS Src_WB_Code,
          s.SRC_UNIT AS Src_Unit_Code,
          r.DEST_AREA AS Dest_Area_Code,
          r.DEST_WB AS Dest_WB_Code,
          r.DEST_UNIT AS Dest_Unit_Code,
          DATEDIFF(SECOND, 
            CAST(CONCAT(s.DATE_OUT,' ', s.TIME_OUT) AS datetime2),
            CAST(CONCAT(r.DATE_IN, ' ', r.TIME_IN) AS datetime2)
          ) AS Trip_Seconds
        FROM dbo.special25 r WITH (NOLOCK)
        INNER JOIN dbo.special25 s WITH (NOLOCK)
          ON s.SL_NO = r.SRC_SLNO
        WHERE
          r.W_TYPE = 'J'
          AND r.SRC_SLNO IS NOT NULL
          AND r.SRC_SLNO <> ''
          AND r.DATE_IN >= :optimizerFromDate
          AND r.DATE_IN < DATEADD(DAY, 1, :optimizerToDate)
          AND s.DATE_OUT >= DATEADD(DAY, -1, :optimizerFromDate)
          AND s.DATE_OUT < DATEADD(DAY, 2, :optimizerToDate)
          AND r.DATE_IN >= :actualFromDate
          AND r.DATE_IN < DATEADD(DAY, 1, :actualToDate)
          AND s.DATE_OUT IS NOT NULL 
          AND s.TIME_OUT IS NOT NULL
          AND r.DATE_IN IS NOT NULL 
          AND r.TIME_IN IS NOT NULL
      ),
      TripDataFiltered AS (
        SELECT 
          Vehicle_Number,
          DO_Number,
          Unit_Code,
          Src_Area_Code,
          Src_WB_Code,
          Src_Unit_Code,
          Dest_Area_Code,
          Dest_WB_Code,
          Dest_Unit_Code,
          Trip_Seconds
        FROM TripData
        WHERE Trip_Seconds IS NOT NULL
      ),
      DONumberedTrips AS (
        SELECT
          DO_Number,
          Vehicle_Number,
          Unit_Code,
          Src_Area_Code,
          Src_WB_Code,
          Src_Unit_Code,
          Dest_Area_Code,
          Dest_WB_Code,
          Dest_Unit_Code,
          Trip_Seconds,
          ROW_NUMBER() OVER (PARTITION BY DO_Number ORDER BY Trip_Seconds) AS RowNum,
          COUNT(*) OVER (PARTITION BY DO_Number) AS DOTotalCount
        FROM TripDataFiltered
      ),
      DOQuartiles AS (
        SELECT
          DO_Number,
          MAX(CASE WHEN RowNum = CEILING(DOTotalCount * 0.25) THEN Trip_Seconds END) AS Q1,
          MAX(CASE WHEN RowNum = CEILING(DOTotalCount * 0.75) THEN Trip_Seconds END) AS Q3,
          MAX(DOTotalCount) AS DO_Total_Trips
        FROM DONumberedTrips
        GROUP BY DO_Number
      ),
      DOIQRBounds AS (
        SELECT
          DO_Number,
          DO_Total_Trips,
          Q1,
          Q3,
          (Q3 - Q1) AS IQR,
          (Q1 - 1.5 * (Q3 - Q1)) AS Lower_Bound,
          (Q3 + 1.5 * (Q3 - Q1)) AS Upper_Bound
        FROM DOQuartiles
      ),
      ViolationFlags AS (
        SELECT
          t.DO_Number,
          t.Vehicle_Number,
          t.Unit_Code,
          t.Src_Area_Code,
          t.Src_WB_Code,
          t.Src_Unit_Code,
          t.Dest_Area_Code,
          t.Dest_WB_Code,
          t.Dest_Unit_Code,
          t.Trip_Seconds,
          b.Lower_Bound,
          b.Upper_Bound,
          CASE 
            WHEN t.Trip_Seconds < b.Lower_Bound OR t.Trip_Seconds > b.Upper_Bound
            THEN 1
            ELSE 0 
          END AS Is_Violation
        FROM TripDataFiltered t
        INNER JOIN DOIQRBounds b ON t.DO_Number = b.DO_Number
      ),
      DOAggregates AS (
        SELECT
          v.DO_Number,
          MAX(CONCAT(v.Unit_Code, ' - ', ISNULL(u.unitname, 'Unknown'))) AS Unit,
          MAX(CONCAT(v.Src_Area_Code, ' - ', ISNULL(sa.areaname, 'Unknown'))) AS Source_Area,
          MAX(v.Src_WB_Code) AS Source_Weighbridge,
          MAX(CONCAT(v.Src_Unit_Code, ' - ', ISNULL(su.unitname, 'Unknown'))) AS Source_Unit,
          MAX(CONCAT(v.Dest_Area_Code, ' - ', ISNULL(da.areaname, 'Unknown'))) AS Destination_Area,
          MAX(v.Dest_WB_Code) AS Destination_Weighbridge,
          MAX(CONCAT(v.Dest_Unit_Code, ' - ', ISNULL(du.unitname, 'Unknown'))) AS Destination_Unit,
          SUM(Is_Violation) AS Total_Violations,
          COUNT(DISTINCT CASE WHEN Is_Violation = 1 THEN Vehicle_Number END) AS Unique_Vehicle_Count,
          MIN(CASE WHEN Is_Violation = 1 THEN Trip_Seconds END) AS Min_Violation_Seconds,
          MAX(CASE WHEN Is_Violation = 1 THEN Trip_Seconds END) AS Max_Violation_Seconds,
          AVG(CASE WHEN Is_Violation = 1 THEN CAST(Trip_Seconds AS FLOAT) END) AS Avg_Violation_Seconds,
          MAX(Lower_Bound) AS IQR_Lower_Bound,
          MAX(Upper_Bound) AS IQR_Upper_Bound
        FROM ViolationFlags v
        LEFT JOIN dbo.units u ON v.Unit_Code = u.unitcode
        LEFT JOIN dbo.areas sa ON v.Src_Area_Code = sa.areacode
        LEFT JOIN dbo.units su ON v.Src_Unit_Code = su.unitcode
        LEFT JOIN dbo.areas da ON v.Dest_Area_Code = da.areacode
        LEFT JOIN dbo.units du ON v.Dest_Unit_Code = du.unitcode
        GROUP BY v.DO_Number
        HAVING SUM(Is_Violation) > 0
      ),
      Top5DOs AS (
        SELECT TOP 5
          DO_Number,
          Unit,
          Source_Area,
          Source_Weighbridge,
          Source_Unit,
          Destination_Area,
          Destination_Weighbridge,
          Destination_Unit,
          Total_Violations,
          Unique_Vehicle_Count,
          CONCAT(
            Min_Violation_Seconds / 3600, ':',
            RIGHT('0' + CAST((Min_Violation_Seconds % 3600) / 60 AS VARCHAR), 2), ':',
            RIGHT('0' + CAST(Min_Violation_Seconds % 60 AS VARCHAR), 2)
          ) AS Min_Trip_Time,
          CONCAT(
            Max_Violation_Seconds / 3600, ':',
            RIGHT('0' + CAST((Max_Violation_Seconds % 3600) / 60 AS VARCHAR), 2), ':',
            RIGHT('0' + CAST(Max_Violation_Seconds % 60 AS VARCHAR), 2)
          ) AS Max_Trip_Time,
          CONCAT(
            CAST(Avg_Violation_Seconds AS INT) / 3600, ':',
            RIGHT('0' + CAST((CAST(Avg_Violation_Seconds AS INT) % 3600) / 60 AS VARCHAR), 2), ':',
            RIGHT('0' + CAST(CAST(Avg_Violation_Seconds AS INT) % 60 AS VARCHAR), 2)
          ) AS Avg_Violation_Trip_Time,
          CONCAT(
            IQR_Lower_Bound / 3600, ':',
            RIGHT('0' + CAST((IQR_Lower_Bound % 3600) / 60 AS VARCHAR), 2), ':',
            RIGHT('0' + CAST(IQR_Lower_Bound % 60 AS VARCHAR), 2)
          ) AS IQR_Low,
          CONCAT(
            IQR_Upper_Bound / 3600, ':',
            RIGHT('0' + CAST((IQR_Upper_Bound % 3600) / 60 AS VARCHAR), 2), ':',
            RIGHT('0' + CAST(IQR_Upper_Bound % 60 AS VARCHAR), 2)
          ) AS IQR_High
        FROM DOAggregates
        ORDER BY Total_Violations DESC
      )
      SELECT * FROM Top5DOs
      OPTION (RECOMPILE, MAXDOP 4);
      `,
      {
        replacements: {
          optimizerFromDate: optimizerFromDate,
          optimizerToDate: optimizerToDate,
          actualFromDate: from,
          actualToDate: to,
        },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (!dbResponse || dbResponse.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No DO violations found for the specified date range",
      });
    }

    console.log(
      `Fetched ${dbResponse.length} DO-wise trip records from database`
    );

    return res.status(200).json({
      success: true,
      count: dbResponse.length,
      data: dbResponse,
    });
  } catch (error) {
    console.error("Error fetching DO-wise trip summary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export {
  getVehicleWiseSummary,
  getWeighbridgeWiseSummary,
  getAreaWiseSummary,
  getViolationSummary,
  getTotalTripViolationSummary,
  getDateRanges,
  getVehicleWiseTripSummary,
  getDOWiseTripSummary,
};
