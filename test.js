async function getLatestTotalTripViolationSummary(req, res) {
  const { limit = 1000 } = req.query;

  try {
    const dbResponse = await dbInstanceRFID.query(
      `
      WITH LatestTrips AS (
        SELECT TOP :limit
          r.V_NO AS Vehicle_Number,
          s.DO_NO AS DO_Number,
          s.UNIT AS Unit_Code,
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
          AND s.DATE_OUT IS NOT NULL 
          AND s.TIME_OUT IS NOT NULL
          AND r.DATE_IN IS NOT NULL 
          AND r.TIME_IN IS NOT NULL
        ORDER BY r.DATE_IN DESC, r.TIME_IN DESC
      ),
      TripDataFiltered AS (
        SELECT 
          Vehicle_Number,
          DO_Number,
          Unit_Code,
          Trip_Seconds
        FROM LatestTrips
        WHERE Trip_Seconds > 0
      ),
      TotalCounts AS (
        SELECT
          COUNT(*) AS Total_Trips,
          COUNT(DISTINCT Vehicle_Number) AS Total_Unique_Vehicles,
          COUNT(DISTINCT DO_Number) AS Total_Unique_DOs,
          COUNT(DISTINCT Unit_Code) AS Total_Unique_Units
        FROM TripDataFiltered
      ),
      DONumberedTrips AS (
        SELECT
          DO_Number,
          Vehicle_Number,
          Unit_Code,
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
          (Q1 - 1.5 * (Q3 - Q1)) AS Lower_Bound,
          (Q3 + 1.5 * (Q3 - Q1)) AS Upper_Bound
        FROM DOQuartiles
      ),
      ViolationCounts AS (
        SELECT
          COUNT(*) AS Total_Violations,
          COUNT(DISTINCT t.Vehicle_Number) AS Violation_Unique_Vehicles,
          COUNT(DISTINCT t.DO_Number) AS Violation_Unique_DOs,
          COUNT(DISTINCT t.Unit_Code) AS Violation_Unique_Units
        FROM TripDataFiltered t
        INNER JOIN DOIQRBounds b ON t.DO_Number = b.DO_Number
        WHERE t.Trip_Seconds < b.Lower_Bound 
           OR t.Trip_Seconds > b.Upper_Bound
      )
      SELECT 
        tc.Total_Trips,
        ISNULL(vc.Total_Violations, 0) AS Irregular_Trips,
        (tc.Total_Trips - ISNULL(vc.Total_Violations, 0)) AS Normal_Trips,
        CASE 
          WHEN tc.Total_Trips > 0 
          THEN CAST(ROUND((ISNULL(vc.Total_Violations, 0) * 100.0 / tc.Total_Trips), 2) AS DECIMAL(5,2))
          ELSE 0 
        END AS Deviation_Rate,
        ISNULL(vc.Violation_Unique_Vehicles, 0) AS Vehicles_With_Irregular_Trips,
        tc.Total_Unique_Vehicles AS Total_Unique_Vehicles,
        ISNULL(vc.Violation_Unique_DOs, 0) AS DOs_With_Irregular_Trips,
        tc.Total_Unique_DOs AS Total_Unique_DOs,
        ISNULL(vc.Violation_Unique_Units, 0) AS Units_With_Irregular_Trips,
        tc.Total_Unique_Units AS Total_Unique_Units
      FROM TotalCounts tc
      CROSS JOIN ViolationCounts vc
      OPTION (MAXDOP 4);
      `,
      {
        replacements: { limit: parseInt(limit) },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );
    
    const data = dbResponse[0];
    if (!dbResponse || dbResponse.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          Total_Trips: data.Total_Trips,
          Total_Violations: data.Irregular_Trips,
          Normal_Trips: data.Normal_Trips,
          Violation_Percentage: data.Deviation_Rate,
          Vehicles_With_Violations: data.Vehicles_With_Irregular_Trips,
          Total_Unique_Vehicles: data.Total_Unique_Vehicles,
          DOs_With_Violations: data.DOs_With_Irregular_Trips,
          Total_Unique_DOs: data.Total_Unique_DOs,
          Units_With_Violations: data.Units_With_Irregular_Trips,
          Total_Unique_Units: data.Total_Unique_Units
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: dbResponse[0]
    });
  } catch (error) {
    console.error("Error fetching total trip violation summary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}