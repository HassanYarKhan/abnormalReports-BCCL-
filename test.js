// Store chart instances to destroy them when toggling
const vehicleCharts = {};

function renderVehicleWiseTable(data, standardDeviation) {
  const tableBody = document.getElementById("vehicle-wise-data");

  if (!data || data.length === 0) {
    tableBody.innerHTML =
      '<tr><td class="no-data" colspan="11">No data found</td></tr>';
    return;
  }

  const stdDev = parseFloat(standardDeviation);
  let html = "";
  let hasViolations = false;

  // Helper function to format tare deviation with remark
  const formatTareDeviation = (record, avgTare) => {
    const deviation = Math.round(record.tareWeight - avgTare);
    const isViolation = Math.abs(record.tareDeviation) > stdDev;

    let remark;
    if (isViolation) {
      remark = record.tareDeviation > 0 ? "↑" : "↓";
    } else {
      remark = "↔";
    }

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

  data.forEach((row, index) => {
    // Safety check for historic data
    if (!row.historicData || row.historicData.length === 0) {
      return; // Skip this row if no historic data
    }

    const historyCount = row.historicData.length;
    const hasMultipleRecords = historyCount > 1;

    // Calculate violations and Empty-Out cases
    const tareViolations = countViolations(row.historicData, stdDev, false);
    const grossViolations = countViolations(row.historicData, stdDev, true);

    if (tareViolations > 0 || grossViolations > 0) {
      hasViolations = true;
      
      // Main row with fixed cells
      html += `
      <tr class="accordion-header" ${
        hasMultipleRecords
          ? `onclick="toggleVehicleAccordion(${index})" style="cursor: pointer;"`
          : ""
      }>
      <td class="area-cell" id="vehicle-area-cell-${index}" rowspan="1">
      ${
        hasMultipleRecords
          ? `<span class="accordion-icon" id="vehicle-icon-${index}" style="margin-right: 8px;">▶</span>`
          : ""
      }
      ${row.areaCode}
      </td>
      <td class="unit-cell" id="vehicle-unit-cell-${index}" rowspan="1">${
        row.unitCode
      }</td>
      <td class="wb-cell" id="vehicle-wb-cell-${index}" rowspan="1">${
        row.wbCode
      }</td>
      <td class="numeric-cell" id="vehicle-avg-tare-${index}" rowspan="1">${Math.round(
        row.avgTare
      )} kg</td>
      <td class="numeric-cell" id="vehicle-avg-gross-${index}" rowspan="1">${Math.round(
        row.avgGross
      )} kg</td>
      ${
        hasMultipleRecords
          ? `
        <!-- Statistics cells - always visible -->
        <td class="statistics-cell" id="vehicle-stats-cell-${index}" colspan="7">
        <div class="stats-container">
        <div class="stat-item-report">
        <span class="stat-label-report">Tare Violations:</span>
        <span class="${
          tareViolations > 0 ? "violation-value" : "stat-value-report"
        }">${tareViolations} of ${historyCount}</span>
        </div>
        <div class="stat-item-report">
        <span class="stat-label-report">Gross Violations:</span>
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
        <td class="image-icon" onclick="loadWeighmentImages('${
          row.historicData[0].slNo
        }', '${
            row.historicData[0].weightType
          }')" style="cursor: pointer;" title="View Weighment Images">
          <svg fill="#000000" width="24px" height="24px" viewBox="0 0 256 256" id="Flat" xmlns="http://www.w3.org/2000/svg">
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
            <path d="M243.65527,126.37561c-.33886-.7627-8.51172-18.8916-26.82715-37.208-16.957-16.96-46.13281-37.17578-88.82812-37.17578S56.12891,72.20764,39.17188,89.1676c-18.31543,18.31641-26.48829,36.44531-26.82715,37.208a3.9975,3.9975,0,0,0,0,3.249c.33886.7627,8.51269,18.88672,26.82715,37.19922,16.957,16.95606,46.13378,37.168,88.82812,37.168s71.87109-20.21191,88.82812-37.168c18.31446-18.3125,26.48829-36.43652,26.82715-37.19922A3.9975,3.9975,0,0,0,243.65527,126.37561Zm-32.6914,34.999C187.88965,184.34534,159.97656,195.99182,128,195.99182s-59.88965-11.64648-82.96387-34.61719a135.65932,135.65932,0,0,1-24.59277-33.375A135.63241,135.63241,0,0,1,45.03711,94.61584C68.11133,71.64123,96.02344,59.99182,128,59.99182s59.88867,11.64941,82.96289,34.624a135.65273,135.65273,0,0,1,24.59375,33.38379A135.62168,135.62168,0,0,1,210.96387,161.37463ZM128,84.00061a44,44,0,1,0,44,44A44.04978,44.04978,0,0,0,128,84.00061Zm0,80a36,36,0,1,1,36-36A36.04061,36.04061,0,0,1,128,164.00061Z"></path>
            </g>
          </svg>
        </td>
      `
      }
      </tr>
      `;

      // Graph row (initially hidden) - NEW
      if (hasMultipleRecords) {
        html += `
        <tr class="vehicle-graph-row vehicle-graph-row-${index}" style="display: none;">
          <td colspan="12" class="graph-container-cell">
            <div class="chart-wrapper">
              <canvas id="vehicle-chart-${index}"></canvas>
            </div>
          </td>
        </tr>
        `;
      }

      // Additional historic records (initially hidden)
      if (hasMultipleRecords) {
        for (let i = 0; i < historyCount; i++) {
          const record = row.historicData[i];
          html += `
          <tr class="accordion-detail vehicle-accordion-detail-${index}" style="display: none;">
          <!-- Empty cells for Area, Unit Code, WB, Avg Tare, Avg Gross to maintain alignment -->
          <td class="area-cell"></td>
          <td class="unit-cell"></td>
          <td class="wb-cell"></td>
          <td class="numeric-cell"></td>
          <td class="numeric-cell"></td>
          <!-- Historic data cells -->
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
          <td class="image-icon" onclick="loadWeighmentImages('${record.slNo}', '${record.weightType}')" style="cursor: pointer;" title="View Weighment Images">
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
    }
  });

  if (!hasViolations) {
    html = '<tr><td class="no-data" colspan="12">No data found</td></tr>';
  }

  tableBody.innerHTML = html;
  
  // Store data for chart creation
  window.vehicleChartData = data;
  window.vehicleStdDev = stdDev;
}

// Function to create chart for a vehicle
function createVehicleChart(index, data, stdDev) {
  const canvasId = `vehicle-chart-${index}`;
  const canvas = document.getElementById(canvasId);
  
  if (!canvas) return;
  
  // Destroy existing chart if it exists
  if (vehicleCharts[index]) {
    vehicleCharts[index].destroy();
  }
  
  const ctx = canvas.getContext('2d');
  const historicData = data.historicData;
  
  // Prepare data - use date out for labels
  const labels = historicData.map(record => {
    const dateOut = record.dateOut || '';
    const timeOut = record.timeOut || '';
    // Format: DD-MM-YYYY HH:MM
    return `${dateOut}${timeOut ? '\n' + timeOut : ''}`;
  });
  const tareWeights = historicData.map(record => Math.round(record.tareWeight));
  const grossWeights = historicData.map(record => Math.round(record.grossWeight));
  const avgTare = Math.round(data.avgTare);
  const avgGross = Math.round(data.avgGross);
  
  // Calculate min and max for better scale
  const allWeights = [...tareWeights, ...grossWeights, avgTare, avgGross];
  const minWeight = Math.min(...allWeights);
  const maxWeight = Math.max(...allWeights);
  const padding = (maxWeight - minWeight) * 0.1;
  
  // Calculate bar width based on canvas width and number of data points
  const barThickness = Math.max(20, Math.min(60, canvas.parentElement.offsetWidth / (historicData.length * 3)));
  
  vehicleCharts[index] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Tare Weight',
          data: tareWeights,
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
          barThickness: barThickness
        },
        {
          label: 'Gross Weight',
          data: grossWeights,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
          barThickness: barThickness
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            padding: 15,
            font: {
              size: 12,
              weight: 'bold'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 13,
            weight: 'bold'
          },
          bodyFont: {
            size: 12
          },
          callbacks: {
            title: function(context) {
              return context[0].label.replace('\n', ' ');
            },
            label: function(context) {
              return context.dataset.label + ': ' + context.parsed.y + ' kg';
            }
          }
        },
        annotation: {
          annotations: {
            avgTareLine: {
              type: 'line',
              yMin: avgTare,
              yMax: avgTare,
              borderColor: 'rgb(239, 68, 68)',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                display: true,
                content: `Avg Tare: ${avgTare} kg`,
                position: 'start',
                backgroundColor: 'rgba(239, 68, 68, 0.9)',
                color: 'white',
                font: {
                  size: 11,
                  weight: 'bold'
                },
                padding: 4
              }
            },
            avgGrossLine: {
              type: 'line',
              yMin: avgGross,
              yMax: avgGross,
              borderColor: 'rgb(59, 130, 246)',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                display: true,
                content: `Avg Gross: ${avgGross} kg`,
                position: 'end',
                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                color: 'white',
                font: {
                  size: 11,
                  weight: 'bold'
                },
                padding: 4
              }
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: minWeight - padding,
          max: maxWeight + padding,
          ticks: {
            callback: function(value) {
              return value + ' kg';
            },
            font: {
              size: 11
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 10
            },
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });
}

// Function to toggle accordion visibility for vehicle reports
function toggleVehicleAccordion(index) {
  const detailRows = document.querySelectorAll(
    `.vehicle-accordion-detail-${index}`
  );
  const graphRow = document.querySelector(`.vehicle-graph-row-${index}`);
  const statsCell = document.getElementById(`vehicle-stats-cell-${index}`);
  const icon = document.getElementById(`vehicle-icon-${index}`);
  const areaCell = document.getElementById(`vehicle-area-cell-${index}`);
  const unitCell = document.getElementById(`vehicle-unit-cell-${index}`);
  const wbCell = document.getElementById(`vehicle-wb-cell-${index}`);
  const avgTareCell = document.getElementById(`vehicle-avg-tare-${index}`);
  const avgGrossCell = document.getElementById(`vehicle-avg-gross-${index}`);

  const isCurrentlyExpanded =
    detailRows.length > 0 && detailRows[0].style.display !== "none";

  if (isCurrentlyExpanded) {
    // Collapse: Hide detail rows, hide graph row, show stats, and reset rowspan to 1
    detailRows.forEach((row) => {
      row.style.display = "none";
    });
    if (graphRow) {
      graphRow.style.display = "none";
    }
    if (statsCell) {
      statsCell.style.display = "table-cell";
    }
    areaCell.setAttribute("rowspan", "1");
    unitCell.setAttribute("rowspan", "1");
    wbCell.setAttribute("rowspan", "1");
    avgTareCell.setAttribute("rowspan", "1");
    avgGrossCell.setAttribute("rowspan", "1");
    icon.textContent = "▶";
    
    // Destroy chart when collapsed
    if (vehicleCharts[index]) {
      vehicleCharts[index].destroy();
      delete vehicleCharts[index];
    }
  } else {
    // Expand: Hide stats, show graph row first, then detail rows
    // Count total rows: 1 (main) + 1 (graph) + detail rows
    const totalRows = 1 + 1 + detailRows.length;
    
    // Hide stats cell
    if (statsCell) {
      statsCell.style.display = "none";
    }
    
    // Show graph row
    if (graphRow) {
      graphRow.style.display = "table-row";
    }
    
    // Show detail rows
    detailRows.forEach((row) => {
      row.style.display = "table-row";
    });

    // Set rowspan ONLY for the data table section (main + details, NOT graph)
    // Graph row has colspan=12 so it doesn't need rowspan from fixed cells
    const dataTableRows = 1 + detailRows.length;
    areaCell.setAttribute("rowspan", dataTableRows.toString());
    unitCell.setAttribute("rowspan", dataTableRows.toString());
    wbCell.setAttribute("rowspan", dataTableRows.toString());
    avgTareCell.setAttribute("rowspan", dataTableRows.toString());
    avgGrossCell.setAttribute("rowspan", dataTableRows.toString());

    // Hide the empty cells in detail rows since main row cells are spanning
    detailRows.forEach((row) => {
      const cells = row.children;
      if (cells.length >= 5) {
        // Hide the first 5 cells (Area, Unit Code, WB, Avg Tare, Avg Gross)
        cells[0].style.display = "none"; // Area
        cells[1].style.display = "none"; // Unit Code
        cells[2].style.display = "none"; // WB
        cells[3].style.display = "none"; // Avg Tare
        cells[4].style.display = "none"; // Avg Gross
      }
    });

    icon.textContent = "▼";
    
    // Create chart when expanded
    if (window.vehicleChartData && window.vehicleChartData[index]) {
      // Use setTimeout to ensure the canvas is visible before creating chart
      setTimeout(() => {
        createVehicleChart(index, window.vehicleChartData[index], window.vehicleStdDev);
      }, 100);
    }
  }
}




/* ==========================================
   GRAPH STYLES
   ========================================== 

   Chart container styling
.vehicle-graph-row {
  background-color: #f9fafb;
}

.graph-container-cell {
  padding: 20px !important;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.chart-wrapper {
  width: 100%;
  height: 400px;
  min-height: 300px;
  position: relative;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Responsive chart height */
@media (max-width: 768px) {
  .chart-wrapper {
    height: 350px;
    padding: 10px;
  }
}

@media (max-width: 480px) {
  .chart-wrapper {
    height: 300px;
    padding: 8px;
  }
}

.statistics-cell {
  background-color: #f8fafc;
  border-left: 3px solid #3b82f6;
}

.stats-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 8px 12px;
  justify-content: flex-start;
  align-items: center;
}

.stat-item-report {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.stat-label-report {
  font-weight: 600;
  color: #4b5563;
}

.stat-value-report {
  font-weight: 500;
  color: #1f2937;
}

.violation-value {
  font-weight: 700;
  color: #dc2626;
  background-color: #fee2e2;
  padding: 2px 8px;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .stats-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .stat-item-report {
    width: 100%;
  }
}
*/