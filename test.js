function renderPresentDayTable(data, standardDeviation) {
  console.log(`rendering present day table - stdDev = ${standardDeviation}`);
  const tableBody = document.getElementById("present-day-data");

  if (!data || data.length === 0) {
    tableBody.innerHTML =
      '<tr><td class="no-data" colspan="12">No data found</td></tr>';
    return;
  }

  const stdDev = parseFloat(standardDeviation);
  let html = "";
  let hasViolations = false;

  data.forEach((row, index) => {
    // Safety check for historic data
    if (!row.historicData || row.historicData.length === 0) {
      return; // Skip this row if no historic data
    }

    const historyCount = row.historicData.length;
    const hasMultipleRecords = historyCount > 1;

    // Calculate violations for the vehicle using helper function
    const tareViolations = countViolations(row.historicData, stdDev, false);
    const grossViolations = countViolations(row.historicData, stdDev, true);

    // Helper function to format tare deviation with remark
    const formatTareDeviation = (record, avgTare) => {
      const deviation = Math.round(record.tareWeight - avgTare);
      const isViolation = Math.abs(record.tareDeviation) > stdDev;
      const remark = isViolation ? (record.tareDeviation > 0 ? "↑" : "↓") : "↔";

      return `${deviation >= 0 ? "+" : ""}${deviation} kg ${remark}`;
    };

    // Helper function to format gross deviation with remark
    const formatGrossDeviation = (record, avgGross) => {
      const deviation = Math.round(record.grossWeight - avgGross);
      const isEmptyOut =
        Math.abs(record.tareWeight - record.grossWeight) < EMPTY_OUT_TOLERANCE;
      const isViolation = Math.abs(record.grossDeviation) > stdDev;

      let remark;
      if (isEmptyOut) {
        remark = "↔";
      } else if (isViolation) {
        remark = record.grossDeviation > 0 ? "↑" : "↓";
      } else {
        remark = "↔";
      }

      return `${deviation >= 0 ? "+" : ""}${deviation} kg ${remark}`;
    };

    // Helper function to get tare deviation class
    const getTareDeviationClass = (record) => {
      return Math.abs(record.tareDeviation) > stdDev
        ? "deviation-high"
        : "deviation-normal";
    };

    // Helper function to get gross deviation class
    const getGrossDeviationClass = (record) => {
      return Math.abs(record.tareWeight - record.grossWeight) >
        EMPTY_OUT_TOLERANCE && Math.abs(record.grossDeviation) > stdDev
        ? "deviation-high"
        : "deviation-normal";
    };

    if (tareViolations > 0 || grossViolations > 0) {
      hasViolations = true;
    // Main row with fixed cells
    html += `
    <tr class="accordion-header" ${
      hasMultipleRecords
        ? `onclick="togglePresentDayAccordion(${index})" style="cursor: pointer;"`
        : ""
    }>
    <td class="area-cell" id="area-cell-${index}" rowspan="1">
    ${
      hasMultipleRecords
        ? `<span class="accordion-icon" id="present-day-icon-${index}" style="margin-right: 8px;">▶</span>`
        : ""
    }
    ${row.areaCode}
    </td>
    <td class="unit-cell" id="unit-cell-${index}" rowspan="1">${
        row.unitCode
      }</td>
    <td class="wb-cell" id="wb-cell-${index}" rowspan="1">${row.wbCode}</td>
    <td class="vehicle-cell" id="vehicle-cell-${index}" rowspan="1">${
        row.vehicleNumber
      }</td>
    <td class="numeric-cell" id="avg-tare-${index}" rowspan="1">${Math.round(
        row.avgTare
      )} kg</td>
    <td class="numeric-cell" id="avg-gross-${index}" rowspan="1">${Math.round(
        row.avgGross
      )} kg</td>
    ${
      hasMultipleRecords
        ? `
      <!-- Statistics cells for when accordion is closed -->
      <td class="statistics-cell" id="stats-cell-${index}" colspan="7">
      <div class="stats-container">
      <div class="stat-item-report">
      <span class="stat-label-report">Tare Violations:</span>
      <span class="${
        tareViolations > 0 ? "violation-value" : "stat-value-report"
      }">${tareViolations} of ${historyCount}</span>
      </div>
      <div class="stat-item-report">
      <span class="stat-label">Gross Violations:</span>
      <span class="${
        grossViolations > 0 ? "violation-value" : "stat-value-report"
      }">${grossViolations} of ${historyCount}</span>
      </div>
      </div>
      </td>
      `
        : `
      <!-- Single record - show historic data directly -->
      <td class="numeric-cell">${Math.round(
        row.historicData[0].tareWeight
      )} kg</td>
      <td class="numeric-cell">${Math.round(
        row.historicData[0].grossWeight
      )} kg</td>
      <td class="tare-deviation-cell ${getTareDeviationClass(
        row.historicData[0]
      )}">
      ${formatTareDeviation(row.historicData[0], row.avgTare)}
      </td>
      <td class="gross-deviation-cell ${getGrossDeviationClass(
        row.historicData[0]
      )}">
      ${formatGrossDeviation(row.historicData[0], row.avgGross)}
      </td>
      <td class="date-cell">${row.historicData[0].dateIn} ${
            row.historicData[0].timeIn || ""
          }</td>
      <td class="date-cell">${row.historicData[0].dateOut} ${
            row.historicData[0].timeOut || ""
          }</td>
    `
    }
    </tr>
    `;
    }

    // Additional historic records (initially hidden)
    if (hasMultipleRecords) {
      for (let i = 0; i < historyCount; i++) {
        const record = row.historicData[i];
        html += `
        <tr class="accordion-detail present-day-accordion-detail-${index}" style="display: none;">
        <td class="numeric-cell">${Math.round(record.tareWeight)} kg</td>
        <td class="numeric-cell">${Math.round(record.grossWeight)} kg</td>
        <td class="tare-deviation-cell ${getTareDeviationClass(record)}">
        ${formatTareDeviation(record, row.avgTare)}
        </td>
        <td class="gross-deviation-cell ${getGrossDeviationClass(record)}">
        ${formatGrossDeviation(record, row.avgGross)}
        </td>
        <td class="date-cell">${record.dateIn} ${record.timeIn || ""}</td>
        <td class="date-cell">${record.dateOut} ${record.timeOut || ""}</td>
        <td class="image-icon" onclick="loadWeighmentImages('${
          record.slNo
        }', '${
          record.weightType
        }')" style="cursor: pointer;" title="View Weighment Images">
          <svg fill="#000000" width="24px" height="24px" viewBox="0 0 256 256" id="Flat" xmlns="http://www.w3.org/2000/svg">
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
            <path d="M243.65527,126.37561c-.33886-.7627-8.51172-18.8916-26.82715-37.208-16.957-16.96-46.13281-37.17578-88.82812-37.17578S56.12891,72.20764,39.17188,89.1676c-18.31543,18.31641-26.48829,36.44531-26.82715,37.208a3.9975,3.9975,0,0,0,0,3.249c.33886.7627,8.51269,18.88672,26.82715,37.19922,16.957,16.95606,46.13378,37.168,88.82812,37.168s71.87109-20.21191,88.82812-37.168c18.31446-18.3125,26.48829-36.43652,26.82715-37.19922A3.9975,3.9975,0,0,0,243.65527,126.37561Zm-32.6914,34.999C187.88965,184.34534,159.97656,195.99182,128,195.99182s-59.88965-11.64648-82.96387-34.61719a135.65932,135.65932,0,0,1-24.59277-33.375A135.63241,135.63241,0,0,1,45.03711,94.61584C68.11133,71.64123,96.02344,59.99182,128,59.99182s59.88867,11.64941,82.96289,34.624a135.65273,135.65273,0,0,1,24.59375,33.38379A135.62168,135.62168,0,0,1,210.96387,161.37463ZM128,84.00061a44,44,0,1,0,44,44A44.04978,44.04978,0,0,0,128,84.00061Zm0,80a36,36,0,1,1,36-36A36.04061,36.04061,0,0,1,128,164.00061Z"></path>
            </g>
          </svg>
        </td>
        </tr>
        `;
      }
    }
  });
  
  if (!hasViolations) {
    html = '<tr><td class="no-data" colspan="12">No violations found for the selected criteria</td></tr>';
  }

  tableBody.innerHTML = html;
}