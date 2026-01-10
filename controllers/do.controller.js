import dbInstanceRFID from "../config/dbconfigRFID.js";

async function getDONumberFromUnitCode(req, res) {
   
  const { unitCode, fromDate, toDate } = req.query;

  //console.log(`request received for unitCode: ${unitCode}, fromDate: ${fromDate}, toDate: ${toDate}`);

  if (!unitCode || !fromDate || !toDate) {
    return res.status(400).json({ 
      message: "unit code, from and to dates are mandatory" 
    });
  }

  // Format dates for SQL Server (YYYY-MM-DD)
  const fromFormatted = new Date(fromDate).toISOString().split('T')[0];
  const toFormatted = new Date(toDate).toISOString().split('T')[0];

  //console.log(`Fetching DO numbers for Unit: ${unitCode}, From: ${fromFormatted}, To: ${toFormatted}`);

  try {
    const dbResponse = await dbInstanceRFID.query(
      `
      SELECT DISTINCT DO_NO
      FROM special25
      WHERE UNIT = :unitCode
        AND W_TYPE = 'I'
        AND DATE_IN >= :fromDate
        AND DATE_OUT <= :toDate
        AND DO_NO IS NOT NULL
      ORDER BY DO_NO
      `,
      {
        replacements: { 
          unitCode: unitCode,
          fromDate: fromFormatted,
          toDate: toFormatted
        },
        type: dbInstanceRFID.QueryTypes.SELECT,
      }
    );

    if (dbResponse.length === 0) {
      return res.status(200).json({
        message: 'No available Delivery Orders under this unit code',
        doData: []
      });
    }

    return res.status(200).json({
      message: `Fetched DO numbers for unit code ${unitCode}`,
      count: dbResponse.length,
      doData: dbResponse
    });

  } catch (error) {
    console.error('Error fetching DO Numbers:', error);
    return res.status(500).json({
      message: 'Could not fetch DO Numbers', 
      error: error.message
    });
  }
}

export { getDONumberFromUnitCode };



