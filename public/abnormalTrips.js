// ============================================
// SERVER URL & GLOBAL VARIABLES
// ============================================

// const serverURL = "https://abnrpt.cclai.in/";
const serverURL = "http://localhost:8500";

// Store the fetched report data globally
let currentReportData = null;
window.currentReportData = null; // Make accessible to export module

// Store current expanded DO
let currentExpandedDO = null;

// Date formatting utility
// Utlity to format date time
function formatDateTime(dateTimeString) {
  const date = new Date(dateTimeString);

  const DD = String(date.getDate()).padStart(2, "0");
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const YYYY = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;

  const HH = String(hours).padStart(2, "0");

  return `${HH}:${minutes}:${seconds} ${ampm} ${DD}-${MM}-${YYYY}`;
}


// ============================================
// INITIALIZATION FUNCTIONS
// ============================================

// Set default date and time values on page load
function setDefaultDateTime() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const fromDateTime = `${dateStr}T00:00`;
  const toDateTime = `${dateStr}T23:59`;

  // Set default datetime inputs (today's date range)
  const fromDateInput = document.getElementById("from-date");
  const toDateInput = document.getElementById("to-date");
  if (fromDateInput) fromDateInput.value = fromDateTime;
  if (toDateInput) toDateInput.value = toDateTime;

  // Set custom range inputs (yesterday midnight to today's current time)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const yesterdayYear = yesterday.getFullYear();
  const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, "0");
  const yesterdayDay = String(yesterday.getDate()).padStart(2, "0");
  const yesterdayDateStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
  
  const customFromDateTime = `${yesterdayDateStr}T00:00`;
  const customToDateTime = today.toISOString().slice(0, 16); // Current date and time
  
  const customFromDateInput = document.getElementById("custom-from-date");
  const customToDateInput = document.getElementById("custom-to-date");
  if (customFromDateInput) customFromDateInput.value = customFromDateTime;
  if (customToDateInput) customToDateInput.value = customToDateTime;
}

// Switch between tabs
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  document.getElementById(tabId).classList.add("active");

  document
    .querySelector(`.nav-item[onclick="switchTab('${tabId}')"]`)
    .classList.add("active");
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchUnitCodeFromAreaCode() {
  const areaSelect = document.getElementById("do-area-select");
  const unitSelect = document.getElementById("do-unit-select");

  unitSelect.innerHTML = '<option value="">Select Unit</option>';

  if (areaSelect.value === "default") return;

  try {
    const response = await fetch(
      `/api/weighbridges/getUnitFromAreaCode?areaCode=${areaSelect.value}`
    );
    const data = await response.json();

    if (data.units && Array.isArray(data.units)) {
      data.units.forEach((unit) => {
        const option = document.createElement("option");
        option.value = unit.unitcode;
        option.textContent = unit.unitname;
        unitSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error fetching units:", error);
  }
}

async function searchTripReports() {
  const tbody = document.getElementById("trip-data");
  const unitCode = document.getElementById("do-unit-select").value;
  const fromDate = document.getElementById("from-date").value;
  const toDate = document.getElementById("to-date").value;
  const header = document.getElementById("trip-report-header");

  closeAllAccordions();

  header.style.display = "none";
  document.getElementById("totalTrips").textContent = "-";
  document.getElementById("uniqueDOs").textContent = "-";
  document.getElementById("uniqueVehicles").textContent = "-";

  tbody.innerHTML = `
    <tr>
      <td colspan="10">
        <div class="loading-spinner">
          <div class="spinner"></div>
          Loading reports...
        </div>
      </td>
    </tr>
  `;

  if (!unitCode || !fromDate || !toDate) {
    alert("Please select unit and date range");
    return;
  }

  const fromDateTime = new Date(fromDate + "Z");
  const toDateTime = new Date(toDate + "Z");

  if (toDateTime < fromDateTime) {
    alert("To Date must be greater than From Date");
    return;
  }

  const fromFormatted = fromDateTime.toISOString().split("T")[0];
  const toFormatted = toDateTime.toISOString().split("T")[0];

  try {
    const response = await fetch(
      `${serverURL}/api/reports/getTripTimeReportsByUnitCode`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          unitCode,
          from: fromFormatted,
          to: toFormatted,
        }),
      }
    );

    const data = await response.json();
    console.log("API Response for Trip Reports in Graph View:", data);

    if (data && data.data) {
      populateTable(data);
    } else {
      alert("No trip reports found for the selected criteria");
    }
  } catch (error) {
    console.error("Error fetching trip reports:", error);
    alert("Error fetching trip reports");
  }
}

// ============================================
// SUMMARY TAB FUNCTIONS
// ============================================

async function fetchUnitCodeFromAreaCodeSummary() {
  const areaSelect = document.getElementById("summary-area-select");
  const unitSelect = document.getElementById("summary-unit-select");

  unitSelect.innerHTML = '<option value="">Select Unit</option>';

  if (areaSelect.value === "default") return;

  try {
    const response = await fetch(
      `/api/weighbridges/getUnitFromAreaCode?areaCode=${areaSelect.value}`
    );
    const data = await response.json();

    if (data.units && Array.isArray(data.units)) {
      data.units.forEach((unit) => {
        const option = document.createElement("option");
        option.value = unit.unitcode;
        option.textContent = unit.unitname;
        unitSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error fetching units:", error);
  }
}

async function fetchTripTimeSummary() {
  const unitCode = document.getElementById("summary-unit-select").value;
  const fromDate = document.getElementById("summary-from-date").value;
  const toDate = document.getElementById("summary-to-date").value;

  if (!unitCode || !fromDate || !toDate) {
    alert("Please select all required fields");
    return;
  }

  const fromDateTime = new Date(fromDate);
  const toDateTime = new Date(toDate);

  if (toDateTime < fromDateTime) {
    alert("To Date must be greater than From Date");
    return;
  }

  const fromFormatted = fromDateTime.toISOString().split("T")[0];
  const toFormatted = toDateTime.toISOString().split("T")[0];

  try {
    const response = await fetch("/api/reports/getTripTimeSummary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        unitCode,
        from: fromFormatted,
        to: toFormatted,
      }),
    });

    const data = await response.json();
    if (data && data.summary) {
      populateSummaryStats(data);
    } else {
      alert("No trip reports found for the selected criteria");
      resetSummaryStats();
    }
  } catch (error) {
    console.error("Error fetching trip summary:", error);
    alert("Error fetching trip summary");
    resetSummaryStats();
  }
}

function populateSummaryStats(data) {
  document.getElementById("total-trips").textContent = data.summary.totalTrips;
  document.getElementById(
    "avg-duration"
  ).textContent = `${data.summary.avgDuration} min`;
  document.getElementById("normal-trips").textContent =
    data.summary.tripAnalysis.normal;
  document.getElementById("high-trips").textContent =
    data.summary.tripAnalysis.abnormallyHigh;
  document.getElementById("low-trips").textContent =
    data.summary.tripAnalysis.abnormallyLow;
  document.getElementById("total-vehicles").textContent =
    data.summary.totalVehicles;
  document.getElementById("abnormal-vehicles").textContent =
    data.summary.vehiclesWithAbnormalTrips;

  const tbody = document.querySelector("#summary-table tbody");
  tbody.innerHTML = "";

  if (data.vehicleStats.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="no-data" colspan="7">
          No trip statistics found for the selected criteria
        </td>
      </tr>
    `;
    return;
  }

  data.vehicleStats.forEach((stat) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="vehicle-cell">${stat.vehicleNumber}</td>
      <td class="numeric-cell">${stat.totalTrips}</td>
      <td class="numeric-cell">${stat.avgDuration}</td>
      <td class="numeric-cell">${stat.normalTrips}</td>
      <td class="numeric-cell">${stat.highDurationTrips}</td>
      <td class="numeric-cell">${stat.lowDurationTrips}</td>
      <td class="numeric-cell">${stat.avgDeviation?.toFixed(2)}%</td>
    `;
    tbody.appendChild(row);
  });

  const header = document.getElementById("summary-header");
  const fromDate = new Date(
    document.getElementById("summary-from-date").value
  ).toLocaleDateString();
  const toDate = new Date(
    document.getElementById("summary-to-date").value
  ).toLocaleDateString();
  header.style.display = "block";
  header.querySelector(
    "h3"
  ).textContent = `Trip Time Summary (${fromDate} to ${toDate})`;
}

function resetSummaryStats() {
  document.getElementById("total-trips").textContent = "0";
  document.getElementById("avg-duration").textContent = "0 min";
  document.getElementById("normal-trips").textContent = "0";
  document.getElementById("high-trips").textContent = "0";
  document.getElementById("low-trips").textContent = "0";
  document.getElementById("total-vehicles").textContent = "0";
  document.getElementById("abnormal-vehicles").textContent = "0";

  const tbody = document.querySelector("#summary-table tbody");
  tbody.innerHTML = `
    <tr>
      <td class="no-data" colspan="7">
        Select area, unit and date range to view summary statistics
      </td>
    </tr>
  `;

  document.getElementById("summary-header").style.display = "none";
}

// function exportSummaryPDF() {
//   const totalTrips = document.getElementById("total-trips").textContent;
//   if (totalTrips === "0") {
//     alert("Please fetch summary data first");
//     return;
//   }

//   const { jsPDF } = window.jspdf;
//   const doc = new jsPDF();

//   const fromDate = new Date(document.getElementById("summary-from-date").value).toLocaleDateString();
//   const toDate = new Date(document.getElementById("summary-to-date").value).toLocaleDateString();

//   doc.setFontSize(16);
//   doc.text("Trip Time Summary Report", 14, 15);
//   doc.setFontSize(12);
//   doc.text(`Period: ${fromDate} to ${toDate}`, 14, 25);

//   doc.text("Overall Statistics:", 14, 35);
//   doc.setFontSize(10);
//   doc.text(
//     [
//       `Total Trips: ${document.getElementById("total-trips").textContent}`,
//       `Average Duration: ${document.getElementById("avg-duration").textContent}`,
//       `Normal Trips: ${document.getElementById("normal-trips").textContent}`,
//       `Abnormal (High): ${document.getElementById("high-trips").textContent}`,
//       `Abnormal (Low): ${document.getElementById("low-trips").textContent}`,
//       `Total Vehicles: ${document.getElementById("total-vehicles").textContent}`,
//       `Vehicles with Abnormal Trips: ${document.getElementById("abnormal-vehicles").textContent}`,
//     ],
//     20,
//     45
//   );

//   const table = document.getElementById("summary-table");

//   doc.autoTable({
//     html: table,
//     startY: 85,
//     styles: { fontSize: 8 },
//     columnStyles: {
//       0: { cellWidth: 25 },
//       1: { cellWidth: 20 },
//       2: { cellWidth: 25 },
//       3: { cellWidth: 20 },
//       4: { cellWidth: 20 },
//       5: { cellWidth: 20 },
//       6: { cellWidth: 25 },
//     },
//   });

//   doc.save(`Trip_Time_Summary_${fromDate}_${toDate}.pdf`);
// }

// ============================================
// ACCORDION FUNCTIONS
// ============================================

async function toggleDODetails(doRow) {
  const doNumber = doRow.getAttribute("data-do-number");
  const toggleBtn = doRow.querySelector(".toggle-btn");
  const isExpanded = doRow.classList.contains("expanded");

  if (isExpanded) {
    collapseDOAccordion(doRow, doNumber);
    return;
  }

  closeAllAccordions();

  doRow.classList.add("expanded");
  toggleBtn.textContent = "▲";

  const doData = currentReportData.data.find(
    (group) => group.DO_Number === doNumber
  );

  if (!doData) {
    console.error("DO group not found:", doNumber);
    return;
  }

  const accordionContent = document.createElement("tr");
  accordionContent.className = "accordion-content";
  accordionContent.innerHTML = `
    <td colspan="10">
      <div class="accordion-inner">
        <div class="accordion-tabs">
          <button class="accordion-tab active" data-tab="graph-${doNumber}" onclick="switchAccordionTab('${doNumber}', 'graph')">
            Graph View
          </button>
          <button class="accordion-tab" data-tab="table-${doNumber}" onclick="switchAccordionTab('${doNumber}', 'table')">
            Data Table
          </button>
        </div>
        <div class="accordion-tab-content">
          <div id="graph-view-${doNumber}" class="accordion-view active">
            <div class="loading-spinner">
              <div class="spinner"></div>
              Loading graph...
            </div>
          </div>
          <div id="table-view-${doNumber}" class="accordion-view">
            <div class="loading-spinner">
              <div class="spinner"></div>
              Loading table...
            </div>
          </div>
        </div>
      </div>
    </td>
  `;

  doRow.after(accordionContent);

  currentExpandedDO = doNumber;

  setTimeout(() => {
    renderGraphView(doNumber, doData);
    renderTableView(doNumber, doData);
  }, 100);
}

function switchAccordionTab(doNumber, tabType) {
  const tabs = document.querySelectorAll(
    `[data-tab^="${tabType}-${doNumber}"], [data-tab$="-${doNumber}"]`
  );
  tabs.forEach((tab) => tab.classList.remove("active"));

  const clickedTab = document.querySelector(
    `[data-tab="${tabType}-${doNumber}"]`
  );
  if (clickedTab) clickedTab.classList.add("active");

  const views = document.querySelectorAll(
    `#graph-view-${doNumber}, #table-view-${doNumber}`
  );
  views.forEach((view) => view.classList.remove("active"));

  const targetView = document.getElementById(`${tabType}-view-${doNumber}`);
  if (targetView) targetView.classList.add("active");
}

function renderTableView(doNumber, doData) {
  const container = document.getElementById(`table-view-${doNumber}`);
  if (!container) return;

  const vehiclesData = doData.vehiclesData;
  const iqrLowMinutes = timeToMinutes(doData.iqr_low);
  const iqrHighMinutes = timeToMinutes(doData.iqr_high);

  let tableHTML = `
    <div class="data-table-wrapper">
      <table class="trips-detail-table">
        <thead>
          <tr>
            <th>Vehicle Number</th>
            <th>Source Info.</th>
            <th>Destination Info.</th>
            <th>Trip Start</th>
            <th>Trip End</th>
            <th>Trip Durartion</th>
            <th>Allowed Range</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  vehiclesData.forEach((trip) => {
    const tripMinutes = trip.Trip_Time_Minutes || timeToMinutes(trip.Trip_Time);

    let status = "Normal";
    let statusClass = "normal-deviation";
    if (trip.Is_Outlier) {
      if (tripMinutes < iqrLowMinutes) {
        status = "↓ Below Range";
        statusClass = "negative-deviation";
      } else if (tripMinutes > iqrHighMinutes) {
        status = "↑ Above Range";
        statusClass = "positive-deviation";
      }
    }

    tableHTML += `
  <tr>
    <td>${trip.Vehicle_Number}</td>
    <td>
      <div style="line-height: 1.4;">
        <div style="font-weight: 600;">${trip.Src_WB_Code}</div>
        <div style="font-size: 0.9em;">${trip.Src_Unit}</div>
        <div style="font-size: 0.9em;">${trip.Src_Area}</div>
      </div>
    </td>
    <td>
      <div style="line-height: 1.4;">
        <div style="font-weight: 600;">${trip.Dest_WB_Code}</div>
        <div style="font-size: 0.9em;">${trip.Dest_Unit}</div>
        <div style="font-size: 0.9em;">${trip.Dest_Area}</div>
      </div>
    </td>
    <td>
      <div style="line-height: 1.4;">
        <div>${formatDateTime(trip.Trip_Start_Time)
          .split(" ")
          .slice(0, 2)
          .join(" ")}</div>
        <div style="font-size: 0.9em; color: #d8d8d8;">${
          formatDateTime(trip.Trip_Start_Time).split(" ")[2]
        }</div>
      </div>
    </td>
    <td>
      <div style="line-height: 1.4;">
        <div>${formatDateTime(trip.Trip_End_Time)
          .split(" ")
          .slice(0, 2)
          .join(" ")}</div>
        <div style="font-size: 0.9em; color: #d8d8d8;">${
          formatDateTime(trip.Trip_End_Time).split(" ")[2]
        }</div>
      </div>
    </td>
    <td>${trip.Trip_Time || "-"}</td>
    <td>${doData.iqr_low} - ${doData.iqr_high}</td>
    <td><span class="${statusClass}">${status}</span></td>
  </tr>
`;
  });

  tableHTML += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = tableHTML;
}

function collapseDOAccordion(doRow, doNumber) {
  const toggleBtn = doRow.querySelector(".toggle-btn");
  doRow.classList.remove("expanded");
  toggleBtn.textContent = "▼";

  let nextRow = doRow.nextElementSibling;
  if (nextRow && nextRow.classList.contains("accordion-content")) {
    nextRow.remove();
  }

  if (window.cleanupGraphView) {
    window.cleanupGraphView(doNumber);
  }

  currentExpandedDO = null;
}

function closeAllAccordions() {
  document.querySelectorAll(".do-header.expanded").forEach((doRow) => {
    const doNumber = doRow.getAttribute("data-do-number");
    collapseDOAccordion(doRow, doNumber);
  });
}

// ============================================
// TABLE POPULATION
// ============================================

function populateTable(data) {
  console.log("Populating table with data:", data);

  currentReportData = data;
  window.currentReportData = data; // Make accessible to export module

  closeAllAccordions();

  const tbody = document.getElementById("trip-data");
  tbody.innerHTML = "";

  if (!data.data || data.data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="no-data">
            No trip reports found for the selected criteria
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const header = document.getElementById("trip-report-header");
  header.style.display = "block";

  const fromDate = new Date(
    document.getElementById("from-date").value
  ).toLocaleDateString();
  const toDate = new Date(
    document.getElementById("to-date").value
  ).toLocaleDateString();
  header.querySelector(
    "h3"
  ).textContent = `Trip Reports (${fromDate} to ${toDate})`;

  document.getElementById("totalTrips").textContent =
    data.summary.totalTrips || "-";
  document.getElementById("uniqueDOs").textContent =
    data.summary.uniqueDOCount || "-";
  document.getElementById("uniqueVehicles").textContent =
    data.summary.uniqueVehicleCount || "-";

  if (document.getElementById("totalOutliers")) {
    document.getElementById("totalOutliers").textContent =
      data.summary.totalOutliers || "0";
  }
  if (document.getElementById("outlierPercentage")) {
    document.getElementById("outlierPercentage").textContent = `${
      data.summary.outlierPercentage || "0"
    }%`;
  }

  data.data.forEach((doGroup) => {
    const { DO_Number, iqr_low, iqr_high, statistics } = doGroup;

    const doHeaderRow = document.createElement("tr");
    doHeaderRow.className = "do-header";
    doHeaderRow.setAttribute("data-do-number", DO_Number);
    doHeaderRow.onclick = () => toggleDODetails(doHeaderRow);
    doHeaderRow.innerHTML = `
      <td colspan="10">
        <div class="do-header-content">
          <div class="do-left-section">
            <div class="do-number">DO Number: ${DO_Number}</div>
            
            <div class="do-metrics">
               Shortest Acceptable Trip Time: 
               <span class="iqr-info-inline"><strong>${iqr_low}</strong></span>
               Longest Acceptable Trip Time: <span class="iqr-info-inline"><strong>${iqr_high}</strong></span>
            </div>
            
            <div class="do-metrics">
              <div>
                <span class="label">Normal Trips:</span>
                <span class="value metric-box normal-trips">
                ${statistics.total_trips - statistics.outlier_count} of ${
      statistics.total_trips
    }</span>
              </div>
              
              <div class="do-metrics">
                <span class="label">Irregular Trips:</span>
                <span class="value metric-box outliers">${
                  statistics.outlier_count
                } of ${statistics.total_trips}</span>
              </div>
            </div>
          </div>
          
          <button class="toggle-btn">▼</button>
        </div>
      </td>
    `;
    tbody.appendChild(doHeaderRow);
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;

  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);

  return hours * 60 + minutes + seconds / 60;
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  setDefaultDateTime();
});
