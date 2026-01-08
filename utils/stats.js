//Converts time string (HH:MM:SS) to minutes
function timeToMinutes(timeStr) {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  return hours * 60 + minutes + seconds / 60;
}

//Converts minutes back to time string (HH:MM:SS)
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.round((minutes % 1) * 60);
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

//Calculates quartiles and IQR for an array of values
function calculateIQR(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  // Calculate Q1 (25th percentile)
  const q1Index = Math.floor(n * 0.25);
  const q1 = sorted[q1Index];
  
  // Calculate Q3 (75th percentile)
  const q3Index = Math.floor(n * 0.75);
  const q3 = sorted[q3Index];
  
  // Calculate IQR
  const iqr = q3 - q1;
  
  // Calculate outlier boundaries (1.5 * IQR)
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // calculate 5th percentile for lower bound
  const fifthPercentileIndex = Math.floor(n * 0.05);
  const fifthPercentile = sorted[fifthPercentileIndex];
  
  return {
    q1,
    q3,
    iqr,
    lowerBound: (lowerBound > 0) ? lowerBound : fifthPercentile, // Ensure non-negative non-zero value for lower bound
    upperBound
  };
}

// Main function to process data and detect outliers using IQR
function detectOutliersIQR(data) {
  // Group data by DO_Number
  const groupedByDO = {};
  
  data.forEach(record => {
    const doNumber = record.DO_Number;
    if (!groupedByDO[doNumber]) {
      groupedByDO[doNumber] = [];
    }
    groupedByDO[doNumber].push(record);
  });
  
  // Track overall statistics
  let totalOutliers = 0;
  
  // Process each DO_Number group
  const result = Object.keys(groupedByDO).map(doNumber => {
    const records = groupedByDO[doNumber];
    
    // Extract trip times in minutes
    const tripTimesInMinutes = records.map(r => timeToMinutes(r.Trip_Time));
    
    // Calculate IQR
    const iqrStats = calculateIQR(tripTimesInMinutes);
    
    // Prepare vehicle data
    const vehiclesData = records.map(record => ({
      Vehicle_Number: record.Vehicle_Number,
      Src_Area: record.Src_Area,
      Src_WB_Code: record.Src_WB_Code,
      Src_Unit: record.Src_Unit,
      Dest_Area: record.Dest_Area,
      Dest_WB_Code: record.Dest_WB_Code,
      Dest_Unit: record.Dest_Unit,
      Trip_Start_Time: record.Trip_Start_Time,
      Trip_End_Time: record.Trip_End_Time,
      Trip_Time: record.Trip_Time,
      Trip_Time_Minutes: timeToMinutes(record.Trip_Time),
      Is_Outlier: timeToMinutes(record.Trip_Time) < iqrStats.lowerBound || 
                  timeToMinutes(record.Trip_Time) > iqrStats.upperBound
    }));
    
    // Count outliers for this DO
    const outlierCount = vehiclesData.filter(v => v.Is_Outlier).length;
    totalOutliers += outlierCount;
    
    return {
      DO_Number: doNumber,
      iqr_low: minutesToTime(iqrStats.lowerBound),
      iqr_high: minutesToTime(iqrStats.upperBound),
      statistics: {
        q1: minutesToTime(iqrStats.q1),
        q3: minutesToTime(iqrStats.q3),
        iqr: minutesToTime(iqrStats.iqr),
        total_trips: records.length,
        outlier_count: outlierCount
      },
      vehiclesData
    };
  });
  
  return {
    data: result,
    summary: {
      totalOutliers,
      totalNormalTrips: data.length - totalOutliers,
      outlierPercentage: ((totalOutliers / data.length) * 100).toFixed(2)
    }
  };
}

export { detectOutliersIQR };