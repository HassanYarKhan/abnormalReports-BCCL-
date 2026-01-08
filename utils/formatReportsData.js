import moment from "moment";

function formatReportsData(data) {
    const vehiclesGroup = {};

    data.forEach(row => {
        const vehicleNumber = row.V_NO;

        if (!vehiclesGroup[vehicleNumber]) {
            vehiclesGroup[vehicleNumber] = {
                vehicleNumber: vehicleNumber,
                avgTare: row.AVG_TARE_WT,
                avgGross: row.AVG_GROSS_WT,
                historicData: []
            }
        }

        vehiclesGroup[vehicleNumber].historicData.push({
            dateOut: row.DATE_OUT ? moment(row.DATE_OUT).format("YYYY-MM-DD") : null,
            dateIn: row.DATE_IN ? moment(row.DATE_IN).format("YYYY-MM-DD") : null,
            timeIn: row.TIME_IN ? moment(row.TIME_IN, "HH:mm:ss").format("h:mm:ss A") : null,
            timeOut: row.TIME_OUT ? moment(row.TIME_OUT, "HH:mm:ss").format("h:mm:ss A") : null, // Fixed: was using TIME_IN instead of TIME_OUT
            tareWeight: row.TARE_WT,
            grossWeight: row.GROSS_WT,
            tareDeviation: parseFloat(row.TARE_DEVIATION_PERCENT),
            grossDeviation: parseFloat(row.GROSS_DEVIATION_PERCENT),
        })
    });

    return Object.values(vehiclesGroup);
}

export default formatReportsData;