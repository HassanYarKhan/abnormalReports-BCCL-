const serverURL = "http://localhost:8500";
// const serverURL = "https://abnrpt.cclai.in/";
const EMPTY_OUT_TOLERANCE = 1000; // in kgs
const areaCodeMap = {
    2002: "Barora",
    2005: "Block II",
    2007: "Govindpur",
    2014: "Katras",
    2018: "Sijua",
    2025: "Kusunda",
    2033: "PB",
    2036: "Bastacolla",
    2043: "Lodna",
    2045: "EJ",
    2048: "CV",
    2051: "WJ",
    2060: "Washery Division"
};;

// ========================================
// Chart Instances
// =======================================
const vehicleCharts = {};

// ========================================
// GLOBAL SETTINGS MANAGEMENT SYSTEM
// ========================================


// Global settings - Manages standard deviation and weight unit preferences
window.weighmentSettings = {
  // Default values
  stdDev: 10.0,
  weightUnit: 'MT',
  
  // Listener management
  listeners: [],
  
  // Initialize settings from localStorage or use defaults

  init() {
    const stored = localStorage.getItem('weighmentSettings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.stdDev = parseFloat(parsed.stdDev) || 10.0;
        this.weightUnit = parsed.weightUnit || 'MT';
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
    
    // Set global weight unit
    window.weightUnit = this.weightUnit;

    // Update std deviation search filters
    this.updateAllStdDevInputs();
    
    console.log('Settings initialized:', {
      stdDev: this.stdDev,
      weightUnit: this.weightUnit
    });
  },

  // update all std dev input fields
  updateAllStdDevInputs() {
    const stdDevInputs = [
      'std-deviation-areawise',
      'std-deviation-vehiclewise',
      'std-deviation-wbwise'
    ];
    
    stdDevInputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.value = this.stdDev;
      }
    });
  },
  
  // Subscribe to settings changes
  subscribe(callback) {
    this.listeners.push(callback);
  },
  
  // Update settings and notify all listeners
  update(newSettings) {
    if (newSettings.stdDev !== undefined) {
      this.stdDev = parseFloat(newSettings.stdDev);
    }
    if (newSettings.weightUnit !== undefined) {
      this.weightUnit = newSettings.weightUnit;
      window.weightUnit = newSettings.weightUnit;
    }
    
    // Save to localStorage
    localStorage.setItem('weighmentSettings', JSON.stringify({
      stdDev: this.stdDev,
      weightUnit: this.weightUnit
    }));
    
    console.log('Settings updated:', {
      stdDev: this.stdDev,
      weightUnit: this.weightUnit
    });

    this.updateAllStdDevInputs();
    
    // clear cache to refresh present-day reports with udpated std dev.
    clearCache();
    
    // Notify all listeners
    this.listeners.forEach(callback => {
      try {
        callback({
          stdDev: this.stdDev,
          weightUnit: this.weightUnit
        });
      } catch (error) {
        console.error('Error in settings listener:', error);
      }
    });
  },
  
  // Get current standard deviation
  getStdDev() {
    return this.stdDev;
  },
  
  // Get current weight unit
  getWeightUnit() {
    return this.weightUnit;
  }
};

// ========================================
// SETTINGS UI FUNCTIONS
// ========================================

// Show the standard deviation editor modal
function showStdDevEditor() {
  const currentValue = window.weighmentSettings.getStdDev();
  
  const modal = document.createElement('div');
  modal.className = 'stddev-modal-overlay';
  modal.innerHTML = `
    <div class="stddev-modal-content">
      <div class="stddev-modal-header">
        <h3>Configure Standard Deviation</h3>
        <button class="stddev-modal-close" onclick="closeStdDevEditor()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="stddev-modal-body">
        <p class="stddev-description">
          Set the standard deviation threshold (%) used to identify abnormal weighments across all reports.
        </p>
        <div class="stddev-input-group">
          <label for="stddev-input">Standard Deviation (%)</label>
          <input 
            type="number" 
            id="stddev-input" 
            class="stddev-input"
            min="0" 
            max="30" 
            step="0.1" 
            value="${currentValue}"
            placeholder="Enter value between 0 and 30"
          />
          <span class="stddev-hint">Standard Devaition Threshold Range: 5% - 30%</span>
        </div>
      </div>
      <div class="stddev-modal-footer">
        <button class="stddev-btn stddev-btn-cancel" onclick="closeStdDevEditor()">
          Cancel
        </button>
        <button class="stddev-btn stddev-btn-apply" onclick="applyStdDevChange()">
          Apply & Refresh
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus the input
  setTimeout(() => {
    const input = document.getElementById('stddev-input');
    if (input) {
      input.focus();
      input.select();
    }
  }, 100);
  
  // Close on ESC key
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeStdDevEditor();
    } else if (e.key === 'Enter') {
      applyStdDevChange();
    }
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeStdDevEditor();
    }
  });
  
  // Animate in
  setTimeout(() => modal.classList.add('active'), 10);
}

// Close the standard deviation editor modal
function closeStdDevEditor() {
  const modal = document.querySelector('.stddev-modal-overlay');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }
}

// Apply the standard deviation change from the modal
function applyStdDevChange() {
  const input = document.getElementById('stddev-input');
  const newValue = parseFloat(input.value);
  
  // Validate
  if (isNaN(newValue) || newValue < 0 || newValue > 30) {
    alert('Please enter a valid standard deviation between 0 and 30');
    input.focus();
    return;
  }
  
  // Update settings
  window.weighmentSettings.update({ stdDev: newValue });
  
  // Close modal
  closeStdDevEditor();
  
  // Show loading state
  showLoadingOverlay('Refreshing summary data...');
  
  // Reload the current active summary section
  setTimeout(() => {
    reloadActiveSummarySection();
    hideLoadingOverlay();
  }, 500);
}


// Update the standard deviation display in the UI
function updateStdDevDisplay() {
  const displays = document.querySelectorAll('.stddev-display-value');
  const currentValue = window.weighmentSettings.getStdDev();
  
  displays.forEach(display => {
    display.textContent = `${currentValue.toFixed(1)}%`;
  });
}

// Reload the currently active summary section with new stdDev

function reloadActiveSummarySection() {
  // Find active tab
  const activeTab = document.querySelector('.summary-tab-btn.active');
  if (!activeTab) return;
  
  const tabName = activeTab.getAttribute('data-tab');
  
  // Reload based on active tab
  switch(tabName) {
    case 'daily':
      loadDailySummary();
      loadViolationSummary('daily');
      break;
    case 'weekly':
      loadWeeklySummary();
      loadViolationSummary('weekly');
      break;
    case 'monthly':
      loadMonthlySummary();
      loadViolationSummary('monthly');
      break;
    case 'custom':
      searchCustomRange();
      loadViolationSummary('custom');
      break;
  }
}

// Show a loading overlay
function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    document.body.appendChild(overlay);
  }
  
  overlay.innerHTML = `
    <div class="loading-spinner">
      <svg class="circular" viewBox="22 22 44 44">
        <circle class="path" cx="44" cy="44" r="20.2" fill="none" stroke-width="3.6"></circle>
      </svg>
      <p class="loading-message">${message}</p>
    </div>
  `;
  
  overlay.classList.add('active');
}

// Hide the loading overlay
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', function() {
  // Initialize settings
  window.weighmentSettings.init();
  
  // Update displays
  updateStdDevDisplay();
  
  // Subscribe to settings changes to update displays
  window.weighmentSettings.subscribe((settings) => {
    updateStdDevDisplay();
  });
});


// Cache for present day data
let presentDayCache = {
  data: null,
  timestamp: null,
  filteredData: null,
  stdDev: null,
  CACHE_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds
};

// Function to format datetime for input
function formatDateTimeForInput(date) {
  // Create a local format without timezone adjustment
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Function to set time range based on period
function getTimeRangeForPeriod(period) {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const toDateTime = formatDateTimeForInput(endOfDay); // Use end of day (23:59) instead of current time
  let fromDateTime;

  switch (period) {
    case "daily":
      // Set from time to today at 00:00
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      fromDateTime = formatDateTimeForInput(startOfDay);
      break;
    case "weekly":
      // Set from time to 7 days ago at 00:00
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      fromDateTime = formatDateTimeForInput(weekAgo);
      break;
    case "monthly":
      // Set from time to 30 days ago at 00:00
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      monthAgo.setHours(0, 0, 0, 0);
      fromDateTime = formatDateTimeForInput(monthAgo);
      break;
    case "custom":
      // For custom, convert date-only to datetime
      const fromDate = document.getElementById("fromDate").value;
      const toDate = document.getElementById("toDate").value;
      // Check if the date already has a time component
      fromDateTime = fromDate.includes("T") ? fromDate : fromDate + "T00:00";
      const toDateTime = toDate.includes("T") ? toDate : toDate + "T23:59";
      return { fromDateTime, toDateTime };
  }

  return { fromDateTime, toDateTime };
}

// Function to navigate to WB-wise table from card
async function navigateToWBFromCard(wbCode, period) {
  // Get global stdDev
  const stdDev = window.weighmentSettings.getStdDev();
  
  // Switch to WB-wise tab
  switchTab("weighbridge-wise");

  // Get time range
  const { fromDateTime, toDateTime } = getTimeRangeForPeriod(period);

  // Set date range
  document.getElementById("wb-from-date").value = fromDateTime;
  document.getElementById("wb-to-date").value = toDateTime;
  
  // Set stdDev in the filter
  const stdDevInput = document.getElementById("std-deviation-wbwise");
  if (stdDevInput) {
    stdDevInput.value = stdDev;
  }

  // Load reports directly
  await loadWBReportsDirectly(wbCode, fromDateTime, toDateTime);
}


// Function to load WB reports directly without going through the dropdown selection process
async function loadWBReportsDirectly(wbCode, fromDateTime, toDateTime) {
  const tableBody = document.getElementById("weighbridge-wise-data");
  const reportHeader = document.getElementById("weighbridge-report-header");
  
  // Get stdDev from global settings
  const stdDev = window.weighmentSettings.getStdDev();
  console.log('Loading WB reports with stdDev:', stdDev);
  
  // Update the stdDev input field to show the global value
  const stdDevInput = document.getElementById("std-deviation-wbwise");
  if (stdDevInput) {
    stdDevInput.value = stdDev;
  }
  
  // Show loading state
  tableBody.innerHTML =
    '<tr><td class="no-data" colspan="9">Loading weighbridge reports...</td></tr>';
  if (reportHeader) reportHeader.style.display = "none";

  try {
    const response = await fetch(
      `${serverURL}/api/reports/getReportsByWBCode`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wbCode: wbCode,
          from: fromDateTime,
          to: toDateTime,
          stdDev: stdDev,  // Use global stdDev
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const wbName = data.wbName || wbCode;

    // Store WB info globally
    window.currentWBReport = {
      wbCode: wbCode,
      wbName: wbName,
      fromDateTime: fromDateTime,
      toDateTime: toDateTime,
      stdDev: stdDev,  // Store the stdDev used
    };

    // Update the report header
    if (reportHeader) {
      const fromFormatted = formatDateToDDMMYYYY(fromDateTime);
      const toFormatted = formatDateToDDMMYYYY(toDateTime);
      reportHeader.querySelector(
        "h3"
      ).textContent = `Weighbridge ${wbName} | ${fromFormatted} to ${toFormatted}`;
      reportHeader.style.display = "block";
    }

    updateWBDropdowns(wbCode);

    if (!data.data || data.data.length === 0) {
      tableBody.innerHTML =
        '<tr><td class="no-data" colspan="9">No reports found for selected criteria</td></tr>';
      if (reportHeader) reportHeader.style.display = "none";
      return;
    }

    // Helper function to format tare deviation with remark - stores base kg value
    const formatTareDeviation = (record, avgTare) => {
      const deviationKg = Math.round(record.tareWeight - avgTare);
      const isViolation = Math.abs(record.tareDeviation) > stdDev;

      let remark;
      if (isViolation) {
        remark = record.tareDeviation > 0 ? "↑" : "↓";
      } else {
        remark = "↔";
      }

      // Format the deviation based on current unit
      const sign = deviationKg >= 0 ? "+" : "";
      
      if (window.weightUnit === "MT") {
        const mtValue = (deviationKg / 1000).toFixed(3);
        return `${sign}${mtValue} MT ${remark}`;
      } else {
        return `${sign}${deviationKg} kg ${remark}`;
      }
    };

    // Helper function to format gross deviation with remark - stores base kg value
    const formatGrossDeviation = (record, avgGross) => {
      const deviationKg = Math.round(record.grossWeight - avgGross);
      const isEmptyOut = Math.abs(record.tareWeight - record.grossWeight) < EMPTY_OUT_TOLERANCE;
      const isViolation = Math.abs(record.grossDeviation) > stdDev;

      let remark;
      if (isEmptyOut) {
        remark = "↔";
      } else if (isViolation) {
        remark = record.grossDeviation > 0 ? "↑" : "↓";
      } else {
        remark = "↔";
      }

      // Format the deviation based on current unit
      const sign = deviationKg >= 0 ? "+" : "";
      
      if (window.weightUnit === "MT") {
        const mtValue = (deviationKg / 1000).toFixed(3);
        return `${sign}${mtValue} MT ${remark}`;
      } else {
        return `${sign}${deviationKg} kg ${remark}`;
      }
    };

    // Helper function to get deviation class
    const getDeviationClass = (deviation) => {
      return Math.abs(deviation) > stdDev
        ? "deviation-high"
        : "deviation-normal";
    };

    let html = "";

    data.data.forEach((row, vehicleIndex) => {
      const historyCount = row.historicData.length;

      // Calculate violations using the global stdDev
      const tareViolations = row.historicData.filter(
        (record) => Math.abs(record.tareDeviation) > stdDev
      ).length;
      const grossViolations = row.historicData.filter(
        (record) => Math.abs(record.tareWeight - record.grossWeight) > EMPTY_OUT_TOLERANCE && 
                    Math.abs(record.grossDeviation) > stdDev
      ).length;

      html += `
      <tr class="accordion-header" onclick="toggleAccordion(${vehicleIndex})" style="cursor: pointer;">
        <td class="vehicle-cell" id="wb-vehicle-cell-${vehicleIndex}" rowspan="1">
          <span class="accordion-icon" id="wb-icon-${vehicleIndex}" style="margin-right: 8px;">▶</span>
          ${row.vehicleNumber}
        </td>
        <td class="numeric-cell" id="wb-avg-tare-${vehicleIndex}" rowspan="1" data-weight-value="${Math.round(row.avgTare)}">${
          window.weightUnit === "MT" 
            ? `${(row.avgTare / 1000).toFixed(3)} MT`
            : `${Math.round(row.avgTare)} kg`
        }</td>
        <td class="numeric-cell" id="wb-avg-gross-${vehicleIndex}" rowspan="1" data-weight-value="${Math.round(row.avgGross)}">${
          window.weightUnit === "MT"
            ? `${(row.avgGross / 1000).toFixed(3)} MT`
            : `${Math.round(row.avgGross)} kg`
        }</td>
        <td class="statistics-cell" id="wb-stats-cell-${vehicleIndex}" colspan="7">
          <div class="stats-container">
            <div class="stat-item-report">
              <span class="stat-label-report">Tare Violations:</span>
              <span class="${tareViolations > 0 ? "violation-value" : "stat-value-report"}">${tareViolations} of ${historyCount}</span>
            </div>
            <div class="stat-item-report">
              <span class="stat-label-report">Gross Violations:</span>
              <span class="${grossViolations > 0 ? "violation-value" : "stat-value-report"}">${grossViolations} of ${historyCount}</span>
            </div>
          </div>
        </td>
      </tr>`;

      for (let i = 0; i < historyCount; i++) {
        const record = row.historicData[i];
        const recordTareWeightDiff = Math.round(record.tareWeight - row.avgTare);
        const recordGrossWeightDiff = Math.round(record.grossWeight - row.avgGross);

        html += `
        <tr class="accordion-detail wb-accordion-detail-${vehicleIndex}" style="display: none;">
          <td class="numeric-cell" data-weight-value="${Math.round(record.tareWeight)}">${
            window.weightUnit === "MT"
              ? `${(record.tareWeight / 1000).toFixed(3)} MT`
              : `${Math.round(record.tareWeight)} kg`
          }</td>
          <td class="numeric-cell" data-weight-value="${Math.round(record.grossWeight)}">${
            window.weightUnit === "MT"
              ? `${(record.grossWeight / 1000).toFixed(3)} MT`
              : `${Math.round(record.grossWeight)} kg`
          }</td>
          <td class="deviation-cell ${getDeviationClass(record.tareDeviation)}" data-deviation-kg="${recordTareWeightDiff}">
            ${formatTareDeviation(record, row.avgTare)}
          </td>
          <td class="deviation-cell ${getDeviationClass(record.grossDeviation)}" data-deviation-kg="${recordGrossWeightDiff}">
            ${formatGrossDeviation(record, row.avgGross)}
          </td>
          <td class="dateTime-cell">${record.dateIn} ${record.timeIn || ""}</td>
          <td class="dateTime-cell">${record.dateOut} ${record.timeOut || ""}</td>
          <td class="image-icon" onclick="loadWeighmentImages('${record.slNo}', '${record.weightType}')" style="cursor: pointer;" title="View Weighment Images">
            <svg fill="#e1e1e1" width="24px" height="24px" viewBox="0 0 256 256" id="Flat" xmlns="http://www.w3.org/2000/svg">
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                <path d="M243.65527,126.37561c-.33886-.7627-8.51172-18.8916-26.82715-37.208-16.957-16.96-46.13281-37.17578-88.82812-37.17578S56.12891,72.20764,39.17188,89.1676c-18.31543,18.31641-26.48829,36.44531-26.82715,37.208a3.9975,3.9975,0,0,0,0,3.249c.33886.7627,8.51269,18.88672,26.82715,37.19922,16.957,16.95606,46.13378,37.168,88.82812,37.168s71.87109-20.21191,88.82812-37.168c18.31446-18.3125,26.48829-36.43652,26.82715-37.19922A3.9975,3.9975,0,0,0,243.65527,126.37561Zm-32.6914,34.999C187.88965,184.34534,159.97656,195.99182,128,195.99182s-59.88965-11.64648-82.96387-34.61719a135.65932,135.65932,0,0,1-24.59277-33.375A135.63241,135.63241,0,0,1,45.03711,94.61584C68.11133,71.64123,96.02344,59.99182,128,59.99182s59.88867,11.64941,82.96289,34.624a135.65273,135.65273,0,0,1,24.59375,33.38379A135.62168,135.62168,0,0,1,210.96387,161.37463ZM128,84.00061a44,44,0,1,0,44,44A44.04978,44.04978,0,0,0,128,84.00061Zm0,80a36,36,0,1,1,36-36A36.04061,36.04061,0,0,1,128,164.00061Z"></path>
              </g>
            </svg>
          </td>
        </tr>`;
      }
    });

    tableBody.innerHTML = html;

    // Don't call updateAllWeightDisplays here since we already formatted with correct unit
  } catch (error) {
    console.error("Error loading WB reports:", error);
    tableBody.innerHTML =
      '<tr><td class="no-data" colspan="9">Error loading reports. Please try again.</td></tr>';
  }
}

// Function to update the dropdowns for user context without affecting data loading
async function updateWBDropdowns(wbCode) {
  try {
    if (wbCode) {
      const wbParts = wbCode.split("-");
      if (wbParts.length >= 2) {
        const areaCode = wbParts[0];
        const unitCode = wbParts[1];

        // Set area dropdown
        const areaSelect = document.getElementById("area-select");
        if (areaSelect) {
          areaSelect.value = areaCode;
          // Trigger change event to load units
          const event = new Event("change");
          areaSelect.dispatchEvent(event);

          // Wait for units to load
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Set unit dropdown
          const unitSelect = document.getElementById("unit-select");
          if (unitSelect) {
            unitSelect.value = unitCode;
            // Trigger change event to load WBs
            unitSelect.dispatchEvent(event);

            // Wait for WBs to load
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Set WB dropdown
            const wbSelect = document.getElementById("wb-select");
            if (wbSelect) {
              wbSelect.value = wbCode;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error updating dropdowns:", error);
    // Don't throw the error as this is not critical for data display
  }
}

// Function to navigate to vehicle-wise table from card
async function navigateToVehicleFromCard(vehicleNo, period) {
  // Get global stdDev
  const stdDev = window.weighmentSettings.getStdDev();
  
  // Switch to vehicle-wise tab
  switchTab("vehicle-wise");

  // Get time range
  const { fromDateTime, toDateTime } = getTimeRangeForPeriod(period);

  // Set the vehicle search
  const vehicleSearch = document.getElementById("vehicle-search");
  if (vehicleSearch) {
    vehicleSearch.value = vehicleNo;
  }

  // Set date range
  document.getElementById("from-date").value = fromDateTime;
  document.getElementById("to-date").value = toDateTime;
  
  // Set stdDev in the filter
  const stdDevInput = document.getElementById("std-deviation-vehiclewise");
  if (stdDevInput) {
    stdDevInput.value = stdDev;
  }

  // Trigger search after a short delay
  setTimeout(() => filterVehicleData(), 100);
}

// Function to navigate to area-wise reports from card
async function navigateToAreaFromCard(areaId, period) {
  // Get global stdDev
  const stdDev = window.weighmentSettings.getStdDev();
  
  // Switch to present-day tab
  switchTab("present-day", true);

  // Get time range
  const { fromDateTime, toDateTime } = getTimeRangeForPeriod(period);

  // Set the area select
  const areaSelect = document.getElementById("present-day-area-select");
  if (areaSelect) {
    areaSelect.value = areaId;
  }

  // Set date range
  const fromDate = document.getElementById("present-day-from-date");
  const toDate = document.getElementById("present-day-to-date");

  if (fromDate && toDate) {
    fromDate.value = fromDateTime.split("T")[0];
    toDate.value = toDateTime.split("T")[0];
  }
  
  // Set stdDev in the filter
  const stdDevInput = document.getElementById("std-deviation-areawise");
  if (stdDevInput) {
    stdDevInput.value = stdDev;
  }

  // Trigger area search to load the data
  await getReportsByAreaId();
}

// Function to navigate to present day from card
function navigateToPresentDayFromCard(filter, fromDateTime, toDateTime) {
  // Switch to present day tab
  switchTab("present-day");

  // Set the search filter
  const searchInput = document.getElementById("present-day-search");
  if (searchInput && filter) {
    searchInput.value = filter;
  }

  // Set date range if provided
  const fromDateInput = document.getElementById("present-day-from-date");
  const toDateInput = document.getElementById("present-day-to-date");

  if (fromDateInput && fromDateTime) {
    // For date inputs, we only need the date part (YYYY-MM-DD)
    fromDateInput.value = fromDateTime.split("T")[0];
  }

  if (toDateInput && toDateTime) {
    // For date inputs, we only need the date part (YYYY-MM-DD)
    toDateInput.value = toDateTime.split("T")[0];
  }

  // Clear the cache to force a fresh load with the new time range
  presentDayCache.data = null;
  presentDayCache.timestamp = null;
  presentDayCache.filteredData = null;

  // Load fresh data for the specified time range
  loadPresentDayReports();
}

//Available vehicles list (will be populated from API)
let availableVehicles = [];

//Vehicle search functionality
function setupVehicleSearch() {
  const searchInput = document.getElementById("vehicle-search");
  const dropdown = document.getElementById("vehicle-dropdown");

  if (!searchInput || !dropdown) {
    console.error("Vehicle search elements not found!");
    return;
  }

  // Show all vehicles when input is focused and empty
  searchInput.addEventListener("focus", function () {
    const query = this.value.toLowerCase().trim();
    if (query.length === 0) {
      showAllVehicles();
    } else {
      filterAndShowVehicles(query);
    }
  });

  searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase().trim();

    if (query.length === 0) {
      showAllVehicles();
    } else {
      filterAndShowVehicles(query);
    }
  });

  searchInput.addEventListener("blur", function () {
    // Delay hiding to allow clicking on dropdown options
    setTimeout(() => {
      dropdown.style.display = "none";
    }, 200);
  });

  // Function to show all vehicles
  function showAllVehicles() {
    if (availableVehicles.length > 0) {
      dropdown.innerHTML = availableVehicles
        .map(
          (vehicle) =>
            `<div class="dropdown-option" onmousedown="selectVehicle('${vehicle}')">${vehicle}</div>`
        )
        .join("");
      dropdown.style.display = "block";
    }
  }

  // Function to filter and show vehicles
  function filterAndShowVehicles(query) {
    const filtered = availableVehicles.filter((vehicle) =>
      vehicle.toLowerCase().includes(query)
    );

    if (filtered.length > 0) {
      dropdown.innerHTML = filtered
        .map(
          (vehicle) =>
            `<div class="dropdown-option" onmousedown="selectVehicle('${vehicle}')">${vehicle}</div>`
        )
        .join("");
      dropdown.style.display = "block";
    }
    // else {
    //   dropdown.innerHTML =
    //     '<div class="dropdown-option" style="color: #999; cursor: default;">No vehicles found</div>';
    //   dropdown.style.display = "block";
    // }
  }
}

//selectVehicle function
function selectVehicle(vehicle) {
  const searchInput = document.getElementById("vehicle-search");
  const dropdown = document.getElementById("vehicle-dropdown");

  if (searchInput) {
    searchInput.value = vehicle;
  }
  if (dropdown) {
    dropdown.style.display = "none";
  }
}

//Load available vehicles from API
async function loadAvailableVehicles() {
  const searchInput = document.getElementById("vehicle-search");
  if (searchInput) {
    searchInput.placeholder = "Loading vehicles...";
    searchInput.disabled = true;
  }

  try {
    const response = await fetch(`${serverURL}/api/vehicles/getAllVehicles`);
    const data = await response.json();

    if (Array.isArray(data)) {
      availableVehicles = data
        .map((vehicle) =>
          typeof vehicle === "object" && vehicle.V_NO
            ? vehicle.V_NO
            : typeof vehicle === "string"
            ? vehicle
            : null
        )
        .filter(Boolean);
    } else if (data.vehicles && Array.isArray(data.vehicles)) {
      availableVehicles = data.vehicles
        .map((vehicle) =>
          typeof vehicle === "object" && vehicle.V_NO
            ? vehicle.V_NO
            : typeof vehicle === "string"
            ? vehicle
            : null
        )
        .filter(Boolean);
    } else {
      console.warn("Unexpected vehicle data format:", data);
      availableVehicles = [];
    }
  } catch (error) {
    console.error("Error loading vehicles:", error);
    availableVehicles = [];
  } finally {
    if (searchInput) {
      searchInput.placeholder = "Search vehicle...";
      searchInput.disabled = false;
    }
  }
}

function switchTab(tabId, skipAutoLoad = false) {
  // Hide all tab contents
  const tabContents = document.querySelectorAll(".tab-content");
  tabContents.forEach((content) => content.classList.remove("active"));

  // Remove active class from all nav items
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => item.classList.remove("active"));

  // Show selected tab content
  document.getElementById(tabId).classList.add("active");

  // Add active class to clicked nav item
  const selectedNavItem = document.querySelector(
    `.nav-item[onclick*="'${tabId}'"]`
  );
  if (selectedNavItem) {
    selectedNavItem.classList.add("active");
  }

  // Load present day data when that tab is clicked
  if (tabId === "present-day" && !skipAutoLoad) {
    loadPresentDayReports();
  }
}

function getDeviationClass(deviation) {
  // First handle if deviation is a number already
  let value;
  if (typeof deviation === "number") {
    value = Math.abs(deviation);
  } else {
    // Handle string format with various characters
    const cleanValue = String(deviation).replace("%", "").replace(/^\+/, "");
    value = Math.abs(parseFloat(cleanValue));
  }

  if (isNaN(value)) return "deviation-normal";
  if (value >= 3.0) return "deviation-high";
  if (value >= 1.5) return "deviation-medium";
  return "deviation-normal";
}

// Function to generate properly formatted deviation HTML
function formatDeviationValue(
  deviationValue,
  actualValue,
  stdDev,
  unit = "kg"
) {
  const isHigh = Math.abs(deviationValue) > stdDev;
  const sign = actualValue >= 0 ? "+" : "";

  // Convert the actual value if needed
  let displayValue = actualValue;
  if (unit === "MT" || (window.weightUnit === "MT" && !unit)) {
    displayValue = (actualValue / 1000).toFixed(3);
  }

  if (isHigh) {
    return `<span style="color: #d32f2f; font-weight: bold;">${sign}${displayValue} ${unit}</span>`;
  } else {
    return `${sign}${displayValue} ${unit}`;
  }
}

// FilterVehicleData function
async function filterVehicleData() {
  const vehicleSelect = document.getElementById("vehicle-search");
  const fromDate = document.getElementById("from-date");
  const toDate = document.getElementById("to-date");
  const stdDev = parseFloat(document.getElementById("std-deviation-vehiclewise").value);
  const stdDevMin = parseFloat(document.getElementById("std-deviation-vehiclewise").min);
  const stdDevMax = parseFloat(document.getElementById("std-deviation-vehiclewise").max);
  const selectedVehicle = vehicleSelect.value;
  const tableBody = document.getElementById("vehicle-wise-data");
  const reportHeader = document.getElementById("vehicle-report-header");

  if (!selectedVehicle || !fromDate.value || !toDate.value || !stdDev) {
    tableBody.innerHTML =
      '<tr><td class="no-data" colspan="13">Please select a vehicle, date range and standard deviation to view reports</td></tr>';
    if (reportHeader) {
      reportHeader.querySelector("h3").textContent = "";
      reportHeader.style.display = "none";
    }
    return;
  } 

  if(stdDev > stdDevMax || stdDev < stdDevMin){
    alert(`Allowed range of standard deviation is ${stdDevMin}5 to ${stdDevMax}%`);
    return;
  }
  
  // Show loading state
  tableBody.innerHTML =
    '<tr><td class="no-data" colspan="13">Loading vehicle reports...</td></tr>';
  if (reportHeader) reportHeader.style.display = "none";

  try {
    const response = await fetch(
      `${serverURL}/api/reports/getReportsByVehicleNumber`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleNumber: selectedVehicle,
          from: fromDate.value,
          to: toDate.value,
          stdDev: stdDev,
        }),
      }
    );

    const data = await response.json();

    // Show report header
    if (reportHeader) {
      const fromFormatted = formatDateToDDMMYYYY(fromDate.value);
      const toFormatted = formatDateToDDMMYYYY(toDate.value);
      reportHeader.querySelector(
        "h3"
      ).textContent = `Vehicle ${selectedVehicle} | ${fromFormatted} to ${toFormatted}`;
      reportHeader.style.display = "block";
    }
    if (data.data && data.data.length > 0) {
      renderVehicleWiseTable(data.data,  stdDev || 10.0);
      // Apply weight unit conversion after rendering
      if (typeof updateAllWeightDisplays === "function") {
        updateAllWeightDisplays();
      }
    } else {
      tableBody.innerHTML =
        '<tr><td class="no-data" colspan="13">No data found for selected criteria</td></tr>';
    }
  } catch (error) {
    console.error("Error fetching vehicle reports:", error);
    tableBody.innerHTML =
      '<tr><td class="no-data" colspan="13">Error loading vehicle reports. Please try again.</td></tr>';
    if (reportHeader) reportHeader.style.display = "none";
  }
}

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

    if(tareViolations > 0 || grossViolations > 0){
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
      <!-- Statistics cells for when accordion is closed -->
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
    `
    }
    </tr>
    `;

    // Additional historic records (initially hidden) - FIXED: Added missing columns
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
          <svg fill="#e1e1e1" width="24px" height="24px" viewBox="0 0 256 256" id="Flat" xmlns="http://www.w3.org/2000/svg">
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

  if(!hasViolations){
      html='<tr><td class="no-data" colspan="12">No data found</td></tr>';
    }

  tableBody.innerHTML = html;
}
// Function to toggle accordion visibility for vehicle reports
function toggleVehicleAccordion(index) {
  const detailRows = document.querySelectorAll(
    `.vehicle-accordion-detail-${index}`
  );
  const statsCell = document.getElementById(`vehicle-stats-cell-${index}`);
  const historicCells = document.querySelectorAll(
    `.vehicle-historic-cell-${index}`
  );
  const icon = document.getElementById(`vehicle-icon-${index}`);
  const areaCell = document.getElementById(`vehicle-area-cell-${index}`);
  const unitCell = document.getElementById(`vehicle-unit-cell-${index}`);
  const wbCell = document.getElementById(`vehicle-wb-cell-${index}`);
  const avgTareCell = document.getElementById(`vehicle-avg-tare-${index}`);
  const avgGrossCell = document.getElementById(`vehicle-avg-gross-${index}`);

  const isCurrentlyExpanded =
    detailRows.length > 0 && detailRows[0].style.display !== "none";

  if (isCurrentlyExpanded) {
    // Collapse: Hide detail rows, show stats cell, hide historic cells, and reset rowspan to 1
    detailRows.forEach((row) => {
      row.style.display = "none";
    });
    if (statsCell) {
      statsCell.style.display = "table-cell";
    }
    historicCells.forEach((cell) => {
      cell.style.display = "none";
    });
    areaCell.setAttribute("rowspan", "1");
    unitCell.setAttribute("rowspan", "1");
    wbCell.setAttribute("rowspan", "1");
    avgTareCell.setAttribute("rowspan", "1");
    avgGrossCell.setAttribute("rowspan", "1");
    icon.textContent = "▶";
  } else {
    // Expand: Show detail rows, hide stats cell, show historic cells, and set rowspan to total count
    const totalRows = detailRows.length + 1; // +1 for the main row
    detailRows.forEach((row) => {
      row.style.display = "table-row";
    });
    if (statsCell) {
      statsCell.style.display = "none";
    }
    historicCells.forEach((cell) => {
      cell.style.display = "table-cell";
    });

    // Set rowspan for fixed columns to span all rows
    areaCell.setAttribute("rowspan", totalRows.toString());
    unitCell.setAttribute("rowspan", totalRows.toString());
    wbCell.setAttribute("rowspan", totalRows.toString());
    avgTareCell.setAttribute("rowspan", totalRows.toString());
    avgGrossCell.setAttribute("rowspan", totalRows.toString());

    // CRITICAL: Hide the empty cells in detail rows since main row cells are spanning
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
  }
}

function filterWeighbridgeData() {
  const wbSelect = document.getElementById("wb-select");
  const selectedWB = wbSelect.value;
  const tableBody = document.getElementById("weighbridge-wise-data");

  if (!selectedWB) {
    tableBody.innerHTML =
      '<tr><td class="no-data" colspan="8">Please select a weighbridge and date range to view reports</td></tr>';
    return;
  }

  // Redirect to getReportsByWBCode function
  getReportsByWBCode();
}

// Function to check if cache is valid
function isCacheValid() {
  if (!presentDayCache.data || !presentDayCache.timestamp) {
    return false;
  }

  const now = Date.now();
  const currentStdDev = window.weighmentSettings.getStdDev();
  const isStdDevValid = presentDayCache.stdDev === currentStdDev;
  return isTimeValid && isStdDevValid;
}

// Function to clear cache
function clearCache() {
  presentDayCache.data = null;
  presentDayCache.timestamp = null;
  presentDayCache.filteredData = null;
  presentDayCache.stdDev = null;
}

// Function to set up automatic cache refresh
function setupCacheRefresh() {
  // Clear cache every 15 minutes
  setInterval(() => {
    clearCache();

    // If present day tab is active, refresh data
    const presentDayTab = document.getElementById("present-day");
    if (presentDayTab && presentDayTab.classList.contains("active")) {
      loadPresentDayReports(true); // Force refresh
    }
  }, presentDayCache.CACHE_DURATION);
}

// Function to filter present day data as you type
function filterPresentDayDataAsYouType() {
  const searchTerm = document
    .getElementById("present-day-search")
    .value.toLowerCase();

  if (!presentDayCache.data || !Array.isArray(presentDayCache.data.data)) {
    // If no cache data, load fresh data first
    loadPresentDayReports(true);
    return;
  }

  // Filter data based on search term
  const filteredData = presentDayCache.data.data.filter((row) => {
    return (
      row.areaCode.toLowerCase().includes(searchTerm) ||
      row.unitCode.toLowerCase().includes(searchTerm) ||
      row.wbCode.toLowerCase().includes(searchTerm) ||
      row.vehicleNumber.toLowerCase().includes(searchTerm)
    );
  });

  renderPresentDayTable(filteredData, presentDayCache.data.standardDeviation);
}

// Function to filter present day data (legacy function kept for compatibility)
function filterPresentDayData() {
  filterPresentDayDataAsYouType();
}

// Function to render present day table using actual deviation data from API
function renderPresentDayTable(data, standardDeviation) {
  console.log(`rendering present day table - stdDev = ${standardDeviation}`);
  console.log(data);
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
          <svg fill="#e1e1e1" width="24px" height="24px" viewBox="0 0 256 256" id="Flat" xmlns="http://www.w3.org/2000/svg">
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


// Function to refresh present day data
function refreshPresentDayData() {
  clearCache();
  loadPresentDayReports(true);
}

// Function to get reports by Area ID
async function getReportsByAreaId() {
  const areaId = document.getElementById("present-day-area-select").value;
  const fromDateOnly = document.getElementById("present-day-from-date").value;
  const toDateOnly = document.getElementById("present-day-to-date").value;
  const stdDev = parseFloat(document.getElementById("std-deviation-areawise").value);
  const stdDevMin = parseFloat(document.getElementById("std-deviation-areawise").min);
  const stdDevMax = parseFloat(document.getElementById("std-deviation-areawise").max);

  // Add explicit time to date-only values
  const fromDate = fromDateOnly;
  const toDate = toDateOnly;

  const tableBody = document.getElementById("present-day-data");
  const reportHeader = document.getElementById("present-day-report-header");

  // Validate inputs
  if (areaId === "default" || !fromDate || !toDate || !stdDev) {
    alert("Please select area,date range and enter a valid value for Standard Deviation");
    if (reportHeader) reportHeader.style.display = "none";
  }

  if(stdDev < stdDevMin || stdDev > stdDevMax) {
      alert(`Allowed Range for Standard Deviation is ${stdDevMin}% to ${stdDevMax}%`);
      return;
  }

  // Show loading state
  tableBody.innerHTML =
    '<tr><td class="no-data" colspan="14">Loading area reports...</td></tr>';

  try {
    // Construct the URL with query parameters
    const queryParams = new URLSearchParams({
      areaId: areaId,
      from: fromDate,
      to: toDate,
      stdDev: stdDev,
    });

    const response = await fetch(
      `${serverURL}/api/reports/getReportsByAreaId?${queryParams.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    // Update the cache with the new data
    presentDayCache.data = data;
    presentDayCache.timestamp = Date.now();

    // Show report header
    if (reportHeader) {
      // For date-only inputs, we need to add time manually
      const fromWithTime = fromDate + "T00:00";
      const toWithTime = toDate + "T23:59";

      const fromFormatted = formatDateToDDMMYYYY(fromWithTime);
      const toFormatted = formatDateToDDMMYYYY(toWithTime);
      const areaName = document.querySelector(
        `#present-day-area-select option[value="${areaId}"]`
      ).textContent;
      reportHeader.querySelector(
        "h3"
      ).textContent = `${areaName} | ${fromFormatted} to ${toFormatted}`;
      reportHeader.style.display = "block";
    }

    // Clear search input when fresh data is loaded
    const searchInput = document.getElementById("present-day-search");
    if (searchInput) {
      searchInput.value = "";
    }

    if (data.data && data.data.length > 0) {
      renderPresentDayTable(data.data, stdDev || 10.0);
      // Apply weight unit conversion after rendering
      if (typeof updateAllWeightDisplays === "function") {
        updateAllWeightDisplays();
      }
    } else {
      tableBody.innerHTML =
        '<tr><td class="no-data" colspan="14">No abnormal weighments found for the selected area and date range</td></tr>';
    }
  } catch (error) {
    console.error("Error fetching area reports:", error);
    tableBody.innerHTML =
      '<tr><td class="no-data" colspan="14">Error loading area reports</td></tr>';
  }
}

// Helper function to check if a record is Empty-Out
function isEmptyOut(tareWeight, grossWeight) {
  return Math.abs(tareWeight - grossWeight) < EMPTY_OUT_TOLERANCE;
}

// Helper function to get CSS class for deviation cells
function getDeviationClass(tareWeight, grossWeight, deviation, stdDev) {
  if (isEmptyOut(tareWeight, grossWeight)) {
    return "empty-out";
  }
  return Math.abs(deviation) > stdDev ? "deviation-high" : "deviation-normal";
}

// Helper function to format remarks text with appropriate styling
function formatRemarks(
  tareWeight,
  grossWeight,
  deviation,
  stdDev,
  isGross = false
) {
  if (isEmptyOut(tareWeight, grossWeight)) {
    return `<span style="color: #7bc1efff; font-weight: bold;">Empty Out</span>`;
  }

  if (Math.abs(deviation) > stdDev) {
    const type = isGross ? "Gross" : "Tare";
    return `<span style="color: #d32f2f; font-weight: bold;">Abnormally ${
      deviation > 0 ? "High" : "Low"
    } ${type} Weight</span>`;
  }

  return "Normal Weight";
}

// Helper function to format deviation values with appropriate styling
function formatDeviation(
  tareWeight,
  grossWeight,
  deviation,
  weightDiff,
  stdDev
) {
  // For Empty-Out cases, show normal formatting
  if (isEmptyOut(tareWeight, grossWeight)) {
    return `${deviation >= 0 ? "+" : ""}${Math.round(weightDiff)} kg`;
  }

  // For violations, show in red and bold
  if (Math.abs(deviation) > stdDev) {
    return `<span style="color: #d32f2f; font-weight: bold;">${
      deviation >= 0 ? "+" : ""
    }${Math.round(weightDiff)} kg</span>`;
  }

  // Normal case
  return `${deviation >= 0 ? "+" : ""}${Math.round(weightDiff)} kg`;
}

// Helper function to count violations properly handling Empty-Out cases
function countViolations(records, stdDev, isGross = false) {
  return records.filter((record) => {
    // For gross violations, skip Empty-Out cases
    if (isGross && isEmptyOut(record.tareWeight, record.grossWeight)) {
      return false;
    }

    // Check appropriate deviation
    const deviation = isGross ? record.grossDeviation : record.tareDeviation;
    return Math.abs(deviation) > stdDev;
  }).length;
}

// Helper function to count Empty-Out cases
function countEmptyOut(records) {
  return records.filter((record) =>
    isEmptyOut(record.tareWeight, record.grossWeight)
  ).length;
}

// Function to format date as DD-MM-YYYY HH:MM
function formatDateToDDMMYYYY(dateStr) {
  if (!dateStr) return "";

  // If it's a date-only string (no time part)
  if (
    dateStr.length === 10 &&
    dateStr.includes("-") &&
    !dateStr.includes("T")
  ) {
    // For date-only inputs, add default time: start of day (00:00) or end of day (23:59)
    // based on whether it's likely a "from" date or "to" date
    const isFromDate =
      dateStr.includes("from") || dateStr.endsWith("from-date");
    const timeStr = isFromDate ? "00:00" : "23:59";

    const [y, m, d] = dateStr.split("-");
    return `${d}-${m}-${y} ${timeStr}`;
  }

  // For datetime strings or other formats
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

// Function to get current time
function getCurrentTime() {
  return new Date();
}

// Function to get start of day (00:00:00) for the current date
function getStartOfDay() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// Function to get end of day (23:59:00) for the current date
function getEndOfDay() {
  const today = new Date();
  today.setHours(23, 59, 0, 0);
  return today;
}

// Function to format date in the YYYY-MM-DDThh:mm format needed for datetime-local inputs
function formatForDateTimeInput(date) {
  // Create a local ISO string format without timezone adjustment
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Initialize default date values
document.addEventListener("DOMContentLoaded", function () {

  // Get current time
  const now = getCurrentTime();

  // Get start of day (00:00)
  const startOfDay = getStartOfDay();

  // Get end of day (23:59)
  const endOfDay = getEndOfDay();

  // Format for date inputs (YYYY-MM-DD)
  const today = now.toISOString().split("T")[0];

  // Format for datetime-local inputs (YYYY-MM-DDThh:mm)
  const currentTimeFormatted = formatForDateTimeInput(now);
  const startOfDayFormatted = formatForDateTimeInput(startOfDay);
  const endOfDayFormatted = formatForDateTimeInput(endOfDay);

  // Initialize date fields for various sections
  const fromDate = document.getElementById("from-date");
  const toDate = document.getElementById("to-date");
  const wbFromDate = document.getElementById("wb-from-date");
  const wbToDate = document.getElementById("wb-to-date");
  const presentDayFromDate = document.getElementById("present-day-from-date");
  const presentDayToDate = document.getElementById("present-day-to-date");

  // Set values for Vehicle Wise section (datetime-local inputs)
  if (fromDate) fromDate.value = startOfDayFormatted;
  if (toDate) toDate.value = endOfDayFormatted;

  // Set values for WB Wise section (datetime-local inputs)
  if (wbFromDate) wbFromDate.value = startOfDayFormatted;
  if (wbToDate) wbToDate.value = endOfDayFormatted;

  // Set values for Present Day section (date inputs - no time)
  if (presentDayFromDate) presentDayFromDate.value = today;
  if (presentDayToDate) presentDayToDate.value = today;

  // Setup vehicle search functionality
  setupVehicleSearch();

  // Load available vehicles
  loadAvailableVehicles();

  // Setup automatic cache refresh
  setupCacheRefresh();

  // Clear cache on page refresh
  window.addEventListener("beforeunload", clearCache);

  // Add Enter key functionality to present day search
  const searchInput = document.getElementById("present-day-search");
  if (searchInput) {
    searchInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        filterPresentDayData();
      }
    });
  }

  // Add Enter key functionality to vehicle search
  const vehicleSearchInput = document.getElementById("vehicle-search");
  if (vehicleSearchInput) {
    vehicleSearchInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        filterVehicleData();
      }
    });
  }
});

//fetchUnitCodeFromAreaCode with proper dropdown clearing
async function fetchUnitCodeFromAreaCode() {
  const areaCode = document.getElementById("area-select").value;
  const unitsDropDown = document.getElementById("unit-select");
  const wbDropDown = document.getElementById("wb-select");

  // Clear dependent dropdowns first
  unitsDropDown.innerHTML = "";
  wbDropDown.innerHTML = "";

  const unitDefaultOption = document.createElement("option");
  unitDefaultOption.value = "";
  unitDefaultOption.textContent = "Select Unit";
  unitsDropDown.appendChild(unitDefaultOption);

  const wbDefaultOption = document.createElement("option");
  wbDefaultOption.value = "";
  wbDefaultOption.textContent = "Select Weighbridge";
  wbDropDown.appendChild(wbDefaultOption);

  // If no area selected, return early
  if (!areaCode) {
    return;
  }

  // Show loading placeholder for units
  const loadingOption = document.createElement("option");
  loadingOption.value = "";
  loadingOption.textContent = "Loading...";
  unitsDropDown.appendChild(loadingOption);

  try {
    const data = await fetch(
      `${serverURL}/api/weighbridges/getUnitFromAreaCode?areaCode=${encodeURIComponent(
        areaCode
      )}`
    );
    const response = await data.json();
    const unitCodes = response.units;

    // Clear loading text
    unitsDropDown.innerHTML = "";

    // Add default placeholder
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select Unit";
    unitsDropDown.appendChild(defaultOption);

    // Populate with fetched data
    unitCodes.forEach((unit) => {
      const option = document.createElement("option");
      option.innerText = `${unit.unitcode} - ${unit.unitname}`;
      option.value = unit.unitcode;
      unitsDropDown.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching unit codes:", error);
    // Show error state in dropdown
    unitsDropDown.innerHTML = "";
    const errorOption = document.createElement("option");
    errorOption.value = "";
    errorOption.textContent = "Error loading units";
    unitsDropDown.appendChild(errorOption);
  }
}

async function fetchWBCodeFromUnitCode() {
  const unitCode = document.getElementById("unit-select").value;
  const wbDropDown = document.getElementById("wb-select");

  // If no unit selected, reset dropdown to placeholder only
  if (!unitCode) {
    wbDropDown.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select Weighbridge";
    wbDropDown.appendChild(defaultOption);
    return;
  }

  // Show loading placeholder
  wbDropDown.innerHTML = "";
  const loadingOption = document.createElement("option");
  loadingOption.value = "";
  loadingOption.textContent = "Loading...";
  wbDropDown.appendChild(loadingOption);

  try {
    const data = await fetch(
      `${serverURL}/api/weighbridges/getWBFromUnitCode?unitCode=${encodeURIComponent(
        unitCode
      )}`
    );
    const response = await data.json();
    const wbCodes = response.weighbridges;

    // Clear loading text
    wbDropDown.innerHTML = "";

    // Add default placeholder
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select Weighbridge";
    wbDropDown.appendChild(defaultOption);

    // Populate with fetched data
    wbCodes.forEach((wb) => {
      const option = document.createElement("option");
      option.innerText = `${wb.wbcode} - ${wb.wbname}`;
      option.value = wb.wbcode;
      wbDropDown.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching weighbridge codes:", error);
    // Show error state in dropdown
    wbDropDown.innerHTML = "";
    const errorOption = document.createElement("option");
    errorOption.value = "";
    errorOption.textContent = "No weighbridges found";
    wbDropDown.appendChild(errorOption);
  }
}

async function getReportsByWBCode() {
  const wbCode = document.getElementById("wb-select").value;
  const fromDate = document.getElementById("wb-from-date").value;
  const toDate = document.getElementById("wb-to-date").value;
  const stdDevInput = document.getElementById("std-deviation-wbwise");
const stdDev = parseFloat(stdDevInput.value);   
  const stdDevMin = parseFloat(stdDevInput.min);
  const stdDevMax = parseFloat(stdDevInput.max);
  const reportHeader = document.getElementById("weighbridge-report-header");

  // Validate inputs
  if (!wbCode || !fromDate || !toDate) {
    alert("Please select weighbridge and date range");
    if (reportHeader) reportHeader.style.display = "none";
    return;
  }

  // Validate standard deviation
  if (isNaN(stdDev) || stdDev < stdDevMin || stdDev > stdDevMax) {
    alert(`Please enter a valid Standard Deviation between ${stdDevMin}% and ${stdDevMax}%`);
    return;
  }

  const tableBody = document.getElementById("weighbridge-wise-data");
  tableBody.innerHTML = '<tr><td class="no-data" colspan="10">Loading weighbridge reports...</td></tr>';

  try {
    const response = await fetch(
      `${serverURL}/api/reports/getReportsByWBCode`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wbCode,
          from: fromDate,
          to: toDate,
          stdDev: stdDev, 
        }),
      }
    );

    const data = await response.json();

    window.currentWBReport = {
      wbCode: wbCode,
      wbName: data.wbName || wbCode,
      fromDateTime: fromDate,
      toDateTime: toDate,
    };

    if (reportHeader) {
      const fromFormatted = formatDateToDDMMYYYY(fromDate);
      const toFormatted = formatDateToDDMMYYYY(toDate);
      reportHeader.querySelector(
        "h3"
      ).textContent = `Weighbridge ${window.currentWBReport.wbName} | ${fromFormatted} to ${toFormatted}`;
      reportHeader.style.display = "block";
    }

    if (data.data && data.data.length > 0) {
      // Helper function to format tare deviation with remark
      const formatTareDeviation = (record, avgTare) => {
        const deviationKg = Math.round(record.tareWeight - avgTare);
        const isViolation = Math.abs(record.tareDeviation) > stdDev;

        let remark;
        if (isViolation) {
          remark = record.tareDeviation > 0 ? "↑" : "↓";
        } else {
          remark = "↔";
        }

        const sign = deviationKg >= 0 ? "+" : "";
        
        if (window.weightUnit === "MT") {
          const mtValue = (deviationKg / 1000).toFixed(3);
          return `${sign}${mtValue} MT ${remark}`;
        } else {
          return `${sign}${deviationKg} kg ${remark}`;
        }
      };

      // Helper function to format gross deviation with remark
      const formatGrossDeviation = (record, avgGross) => {
        const deviationKg = Math.round(record.grossWeight - avgGross);
        const isEmptyOut = Math.abs(record.tareWeight - record.grossWeight) < EMPTY_OUT_TOLERANCE;
        const isViolation = Math.abs(record.grossDeviation) > stdDev;

        let remark;
        if (isEmptyOut) {
          remark = "↔";
        } else if (isViolation) {
          remark = record.grossDeviation > 0 ? "↑" : "↓";
        } else {
          remark = "↔";
        }

        const sign = deviationKg >= 0 ? "+" : "";
        
        if (window.weightUnit === "MT") {
          const mtValue = (deviationKg / 1000).toFixed(3);
          return `${sign}${mtValue} MT ${remark}`;
        } else {
          return `${sign}${deviationKg} kg ${remark}`;
        }
      };

      const getDeviationClass = (deviation) => {
        return Math.abs(deviation) > stdDev ? "deviation-high" : "deviation-normal";
      };

      let html = "";
      let hasViolations = false; 
      
      data.data.forEach((row, vehicleIndex) => {
        const historyCount = row.historicData.length;

        // Calculate violations using the user-provided stdDev
        const tareViolations = row.historicData.filter(
          (record) => Math.abs(record.tareDeviation) > stdDev
        ).length;
        const grossViolations = row.historicData.filter(
          (record) =>
            Math.abs(record.tareWeight - record.grossWeight) > EMPTY_OUT_TOLERANCE && 
            Math.abs(record.grossDeviation) > stdDev
        ).length;

        if (tareViolations > 0 || grossViolations > 0) {
          hasViolations = true; // Mark that we have at least one vehicle with violations

          html += `
          <tr class="accordion-header" onclick="toggleAccordion(${vehicleIndex})" style="cursor: pointer;">
            <td class="vehicle-cell" id="wb-vehicle-cell-${vehicleIndex}" rowspan="1">
              <span class="accordion-icon" id="wb-icon-${vehicleIndex}" style="margin-right: 8px;">▶</span>
              ${row.vehicleNumber}
            </td>
            <td class="numeric-cell" id="wb-avg-tare-${vehicleIndex}" rowspan="1" data-weight-value="${Math.round(row.avgTare)}">${
              window.weightUnit === "MT"
                ? `${(row.avgTare / 1000).toFixed(3)} MT`
                : `${Math.round(row.avgTare)} kg`
            }</td>
            <td class="numeric-cell" id="wb-avg-gross-${vehicleIndex}" rowspan="1" data-weight-value="${Math.round(row.avgGross)}">${
              window.weightUnit === "MT"
                ? `${(row.avgGross / 1000).toFixed(3)} MT`
                : `${Math.round(row.avgGross)} kg`
            }</td>
            <td class="statistics-cell" id="wb-stats-cell-${vehicleIndex}" colspan="7">
              <div class="stats-container">
                <div class="stat-item-report">
                  <span class="stat-label-report">Tare Violations:</span>
                  <span class="${tareViolations > 0 ? "violation-value" : "stat-value-report"}">${tareViolations} of ${historyCount}</span>
                </div>
                <div class="stat-item-report">
                  <span class="stat-label-report">Gross Violations:</span>
                  <span class="${grossViolations > 0 ? "violation-value" : "stat-value-report"}">${grossViolations} of ${historyCount}</span>
                </div>
                <span class="click-hint">Click to view detailed records</span>
              </div>
            </td>
          </tr>`;

          for (let i = 0; i < historyCount; i++) {
            const record = row.historicData[i];
            const recordTareWeightDiff = Math.round(record.tareWeight - row.avgTare);
            const recordGrossWeightDiff = Math.round(record.grossWeight - row.avgGross);

            html += `
            <tr class="accordion-detail wb-accordion-detail-${vehicleIndex}" style="display: none;">
              <td class="numeric-cell" data-weight-value="${Math.round(record.tareWeight)}">${
                window.weightUnit === "MT"
                  ? `${(record.tareWeight / 1000).toFixed(3)} MT`
                  : `${Math.round(record.tareWeight)} kg`
              }</td>
              <td class="numeric-cell" data-weight-value="${Math.round(record.grossWeight)}">${
                window.weightUnit === "MT"
                  ? `${(record.grossWeight / 1000).toFixed(3)} MT`
                  : `${Math.round(record.grossWeight)} kg`
              }</td>
              <td class="deviation-cell ${getDeviationClass(record.tareDeviation)}" data-deviation-kg="${recordTareWeightDiff}">
                ${formatTareDeviation(record, row.avgTare)}
              </td>
              <td class="deviation-cell ${getDeviationClass(record.grossDeviation)}" data-deviation-kg="${recordGrossWeightDiff}">
                ${formatGrossDeviation(record, row.avgGross)}
              </td>
              <td class="dateTime-cell">${record.dateIn} ${record.timeIn || ""}</td>
              <td class="dateTime-cell">${record.dateOut} ${record.timeOut || ""}</td>
              <td class="image-icon" onclick="loadWeighmentImages('${record.slNo}', '${record.weightType}')" style="cursor: pointer;" title="View Weighment Images">
                <svg fill="#e1e1e1" width="24px" height="24px" viewBox="0 0 256 256" id="Flat" xmlns="http://www.w3.org/2000/svg">
                  <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                  <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M243.65527,126.37561c-.33886-.7627-8.51172-18.8916-26.82715-37.208-16.957-16.96-46.13281-37.17578-88.82812-37.17578S56.12891,72.20764,39.17188,89.1676c-18.31543,18.31641-26.48829,36.44531-26.82715,37.208a3.9975,3.9975,0,0,0,0,3.249c.33886.7627,8.51269,18.88672,26.82715,37.19922,16.957,16.95606,46.13378,37.168,88.82812,37.168s71.87109-20.21191,88.82812-37.168c18.31446-18.3125,26.48829-36.43652,26.82715-37.19922A3.9975,3.9975,0,0,0,243.65527,126.37561Zm-32.6914,34.999C187.88965,184.34534,159.97656,195.99182,128,195.99182s-59.88965-11.64648-82.96387-34.61719a135.65932,135.65932,0,0,1-24.59277-33.375A135.63241,135.63241,0,0,1,45.03711,94.61584C68.11133,71.64123,96.02344,59.99182,128,59.99182s59.88867,11.64941,82.96289,34.624a135.65273,135.65273,0,0,1,24.59375,33.38379A135.62168,135.62168,0,0,1,210.96387,161.37463ZM128,84.00061a44,44,0,1,0,44,44A44.04978,44.04978,0,0,0,128,84.00061Zm0,80a36,36,0,1,1,36-36A36.04061,36.04061,0,0,1,128,164.00061Z"></path>
                  </g>
                </svg>
              </td>
            </tr>`;
          }
        }
      });

      if (!hasViolations) {
        tableBody.innerHTML = '<tr><td class="no-data" colspan="10">No violations found for the selected criteria and standard deviation</td></tr>';
      } else {
        tableBody.innerHTML = html;
      }
      
    } else {
      tableBody.innerHTML = '<tr><td class="no-data" colspan="10">No data found for selected criteria</td></tr>';
    }
  } catch (error) {
    console.error("Error fetching weighbridge reports:", error);
    tableBody.innerHTML = '<tr><td class="no-data" colspan="10">Error fetching reports. Please try again.</td></tr>';
    if (reportHeader) reportHeader.style.display = "none";
  }
}

// Function to load present day reports with caching
async function loadPresentDayReports(forceRefresh = false) {
  const tableBody = document.getElementById("present-day-data");
  const reportHeader = document.getElementById("present-day-report-header");
  const stdDev = window.weighmentSettings.getStdDev();

  // Check if we can use cached data
  if (!forceRefresh && isCacheValid()) {
    // Show all data without any filter when loading from cache
    renderPresentDayTable(
      presentDayCache.data.data,
      presentDayCache.data.standardDeviation
    );
    return;
  }


  // Show loading state
  tableBody.innerHTML =
    '<tr><td class="no-data" colspan="14">Loading present day reports...</td></tr>';
  if (reportHeader) reportHeader.style.display = "none";

  const params = new URLSearchParams({
    stdDev: stdDev,
  })
  try {
    const response = await fetch(
      `${serverURL}/api/reports/getReportsForPresentDay?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        
      }
    );

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      // Cache the data
      presentDayCache.data = data;
      presentDayCache.timestamp = Date.now();
      presentDayCache.stdDev = stdDev;

      // Clear search input when fresh data is loaded
      const searchInput = document.getElementById("present-day-search");
      if (searchInput) {
        searchInput.value = "";
      }

      // Set the date fields to today
      const today = new Date().toISOString().slice(0, 10);
      const presentDayFromDate = document.getElementById(
        "present-day-from-date"
      );
      const presentDayToDate = document.getElementById("present-day-to-date");
      if (presentDayFromDate) presentDayFromDate.value = today;
      if (presentDayToDate) presentDayToDate.value = today;

      // Set the area select to default
      const areaSelect = document.getElementById("present-day-area-select");
      if (areaSelect) areaSelect.value = "default";

      // Show today's date in the report header
      if (reportHeader) {
        const todayLocal = getCurrentTime();
        // Create today with explicit time range
        const todayStr = todayLocal.toISOString().split("T")[0];
        const todayStart = todayStr + "T00:00";
        const todayEnd = todayStr + "T23:59";
        const startFormatted = formatDateToDDMMYYYY(todayStart);
        const endFormatted = formatDateToDDMMYYYY(todayEnd);
        reportHeader.querySelector(
          "h3"
        ).textContent = `Present Day Reports | ${startFormatted} to ${endFormatted}`;
        reportHeader.style.display = "block";
      }

      // Render the table
      renderPresentDayTable(data.data, data.standardDeviation || 10.0);

      // Apply weight unit conversion after rendering
      if (typeof updateAllWeightDisplays === "function") {
        updateAllWeightDisplays();
      }
    } else {
      tableBody.innerHTML =
        '<tr><td class="no-data" colspan="14">No data found for present day</td></tr>';
      // Clear cache if no data
      clearCache();
      if (reportHeader) reportHeader.style.display = "none";
    }
  } catch (error) {
    console.error("Error fetching present day reports:", error);
    tableBody.innerHTML =
      '<tr><td class="no-data" colspan="14">Error loading present day reports</td></tr>';
    // Clear cache on error
    clearCache();
    if (reportHeader) reportHeader.style.display = "none";
  }
}

// Function to toggle accordion visibility for present day reports
function togglePresentDayAccordion(index) {
  const detailRows = document.querySelectorAll(
    `.present-day-accordion-detail-${index}`
  );
  const statsCell = document.getElementById(`stats-cell-${index}`);
  const historicCells = document.querySelectorAll(`.historic-cell-${index}`);
  const icon = document.getElementById(`present-day-icon-${index}`);
  const areaCell = document.getElementById(`area-cell-${index}`);
  const unitCell = document.getElementById(`unit-cell-${index}`);
  const wbCell = document.getElementById(`wb-cell-${index}`);
  const vehicleCell = document.getElementById(`vehicle-cell-${index}`);
  const avgTareCell = document.getElementById(`avg-tare-${index}`);
  const avgGrossCell = document.getElementById(`avg-gross-${index}`);

  const isCurrentlyExpanded =
    detailRows.length > 0 && detailRows[0].style.display !== "none";

  if (isCurrentlyExpanded) {
    // Collapse: Hide detail rows, show stats cell, hide historic cells, and reset rowspan to 1
    detailRows.forEach((row) => {
      row.style.display = "none";
    });
    if (statsCell) {
      statsCell.style.display = "table-cell";
    }
    historicCells.forEach((cell) => {
      cell.style.display = "none";
    });
    areaCell.setAttribute("rowspan", "1");
    unitCell.setAttribute("rowspan", "1");
    wbCell.setAttribute("rowspan", "1");
    vehicleCell.setAttribute("rowspan", "1");
    avgTareCell.setAttribute("rowspan", "1");
    avgGrossCell.setAttribute("rowspan", "1");
    icon.textContent = "▶";
  } else {
    // Expand: Show detail rows, hide stats cell, show historic cells, and set rowspan to total count
    const totalRows = detailRows.length + 1; // +1 for the main row
    detailRows.forEach((row) => {
      row.style.display = "table-row";
    });
    if (statsCell) {
      statsCell.style.display = "none";
    }
    historicCells.forEach((cell) => {
      cell.style.display = "table-cell";
    });
    areaCell.setAttribute("rowspan", totalRows.toString());
    unitCell.setAttribute("rowspan", totalRows.toString());
    wbCell.setAttribute("rowspan", totalRows.toString());
    vehicleCell.setAttribute("rowspan", totalRows.toString());
    avgTareCell.setAttribute("rowspan", totalRows.toString());
    avgGrossCell.setAttribute("rowspan", totalRows.toString());
    icon.textContent = "▼";
  }
}

// Function to toggle accordion visibility for weighbridge reports
function toggleAccordion(vehicleIndex) {
  const detailRows = document.querySelectorAll(
    `.wb-accordion-detail-${vehicleIndex}`
  );
  const statsCell = document.getElementById(`wb-stats-cell-${vehicleIndex}`);
  const historicCells = document.querySelectorAll(
    `.wb-historic-cell-${vehicleIndex}`
  );
  const icon = document.getElementById(`wb-icon-${vehicleIndex}`);
  const vehicleCell = document.getElementById(
    `wb-vehicle-cell-${vehicleIndex}`
  );
  const avgTareCell = document.getElementById(`wb-avg-tare-${vehicleIndex}`);
  const avgGrossCell = document.getElementById(`wb-avg-gross-${vehicleIndex}`);

  const isCurrentlyExpanded =
    detailRows.length > 0 && detailRows[0].style.display !== "none";

  if (isCurrentlyExpanded) {
    // Collapse: Hide detail rows, show stats cell, hide historic cells, and reset rowspan to 1
    detailRows.forEach((row) => {
      row.style.display = "none";
    });
    if (statsCell) {
      statsCell.style.display = "table-cell";
    }
    historicCells.forEach((cell) => {
      cell.style.display = "none";
    });
    vehicleCell.setAttribute("rowspan", "1");
    avgTareCell.setAttribute("rowspan", "1");
    avgGrossCell.setAttribute("rowspan", "1");
    icon.textContent = "▶";
  } else {
    // Expand: Show detail rows, hide stats cell, show historic cells, and set rowspan to total count
    const totalRows = detailRows.length + 1; // +1 for the main row
    detailRows.forEach((row) => {
      row.style.display = "table-row";
    });
    if (statsCell) {
      statsCell.style.display = "none";
    }
    historicCells.forEach((cell) => {
      cell.style.display = "table-cell";
    });
    vehicleCell.setAttribute("rowspan", totalRows.toString());
    avgTareCell.setAttribute("rowspan", totalRows.toString());
    avgGrossCell.setAttribute("rowspan", totalRows.toString());
    icon.textContent = "▼";
  }
}

async function getSummaryReports(from, to, route) {
  try {
    const response = await fetch(
      `/api/reports/summary/${route}?from=${from}&to=${to}`
    );
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching summary reports:", error);
    throw error;
  }
}

// summary tab section
function searchCustomRange() {
  const fromDate = document.getElementById("fromDate").value;
  const toDate = document.getElementById("toDate").value;

  if (!fromDate || !toDate) {
    alert("Please select both from and to dates");
    return;
  }

  if (new Date(fromDate) > new Date(toDate)) {
    alert("From date cannot be later than to date");
    return;
  }

  // Format dates for display
  const fromFormatted = new Date(fromDate).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const toFormatted = new Date(toDate).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Update display
  // document.getElementById(
  //   "dateRangeDisplay"
  // ).textContent = `${fromFormatted} - ${toFormatted}`;

  const button = document.querySelector(".search-button");
  const originalText = button.textContent;
  button.textContent = "Searching...";
  button.disabled = true;

  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
    // Here you would update the violation cards with new data
  }, 1000);
}

// summary tabs section
function initSummaryTabs() {
  // Scope queries inside the summary tab to avoid accidental matches elsewhere
  const summaryRoot = document.getElementById("summary");
  if (!summaryRoot) return;
  const tabButtons = summaryRoot.querySelectorAll(".summary-tab-btn");
  const tabContents = summaryRoot.querySelectorAll(".summary-tab-content");

  // Set initial state
  const initialActiveTab =
    document.querySelector(".summary-tab-btn.active") || tabButtons[0];
  if (initialActiveTab) {
    const initialTabName = initialActiveTab.getAttribute("data-tab");
    showTabContent(initialTabName);
    initialActiveTab.classList.add("active");
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab");

      // Update button states
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Show selected tab content
      showTabContent(tabName);
    });
  });
}

// Helper function to show the selected tab content
function showTabContent(tabName) {
  const summaryRoot = document.getElementById("summary");
  if (!summaryRoot) return;
  const allContent = summaryRoot.querySelectorAll(".summary-tab-content");

  allContent.forEach((content) => {
    const contentTabName = content.getAttribute("data-tab-content");
    if (contentTabName === tabName) {
      content.style.display = "block";
      content.classList.add("active");
    } else {
      content.style.display = "none";
      content.classList.remove("active");
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initSummaryTabs);

// Helper function to format date for API
function formatDateForAPI(date) {
  return date.split("T")[0]; // Returns YYYY-MM-DD format
}

// Initialize everything on page load
document.addEventListener("DOMContentLoaded", function () {
  // Other initialization code...
});

// Function to update a single stat card with data
function updateStatCard(data, cardPrefix) {
  const card = document.querySelector(`[data-${cardPrefix}-card]`);
  
  if (!card) {
    console.warn(`Card not found for prefix: ${cardPrefix}`);
    return;
  }
  
  // Remove loading state first
  removeStatCardLoading(card);
  
  if (!data || data.length === 0) {
    setStatCardError(card, 'No Violations');
    return;
  }
  
  const topViolator = data[0];
  
  // Get primary stat text (Area, WB, or Vehicle)
  let primaryStat = topViolator.WB_NAME || 
                    topViolator.WB || 
                    topViolator.WB_CODE || 
                    topViolator.V_NO || 
                    topViolator.AREA_CODE;
  
  // Format primary stat
  if (topViolator.AREA_CODE) {
    primaryStat = areaCodeMap[primaryStat] || primaryStat;
  } else if (topViolator.WB_CODE || topViolator.WB_NAME || topViolator.WB) {
    primaryStat = topViolator.WB_NAME || topViolator.WB || topViolator.WB_CODE;
  }
  
  // Update card content with animation
  const primaryStatEl = card.querySelector('.primary-stat');
  const statNumbers = card.querySelectorAll('.stat-number:not(.primary-stat)');
  
  if (primaryStatEl) {
    primaryStatEl.style.opacity = '0';
    setTimeout(() => {
      primaryStatEl.textContent = primaryStat;
      primaryStatEl.style.opacity = '1';
    }, 150);
  }
  
  // Animate stat numbers
  const stats = [
    topViolator.TOTAL_TRANSACTIONS || 0,
    topViolator.TARE_VIOLATIONS || 0,
    topViolator.GROSS_VIOLATIONS || 0
  ];
  
  statNumbers.forEach((statEl, index) => {
    if (index < stats.length) {
      statEl.style.opacity = '0';
      setTimeout(() => {
        animateNumber(statEl, 0, stats[index], 500);
        statEl.style.opacity = '1';
      }, 150 + (index * 50));
    }
  });
  
  // Remove old click listener
  if (card.clickHandler) {
    card.removeEventListener('click', card.clickHandler);
  }
  
  // Add new click listener with enhanced navigation
  card.clickHandler = () => {
    const period = cardPrefix.split('-')[0];
    
    if (topViolator.WB_CODE) {
      navigateToWBFromCard(topViolator.WB_CODE, period);
    } else if (topViolator.V_NO) {
      navigateToVehicleFromCard(topViolator.V_NO, period);
    } else if (topViolator.AREA_CODE) {
      navigateToAreaFromCard(topViolator.AREA_CODE, period);
    }
  };
  
  card.addEventListener('click', card.clickHandler);
  
  // Enable hover effects
  card.style.cursor = 'pointer';
  card.style.pointerEvents = 'auto';
}

// Function to load daily summary
async function loadDailySummary() {
  const today = new Date().toISOString().split('T')[0];
  
  // Set loading states
  ['daily-wb', 'daily-vehicle', 'daily-area'].forEach(prefix => {
    const card = document.querySelector(`[data-${prefix}-card]`);
    setStatCardLoading(card);
  });
  
  try {
    const [wbData, vehicleData, areaData] = await Promise.all([
      fetchWeighbridgeSummary(today, today),
      fetchVehicleSummary(today, today),
      fetchAreaSummary(today, today)
    ]);
    
    // Update cards with data
    updateStatCard(wbData, 'daily-wb');
    updateStatCard(vehicleData, 'daily-vehicle');
    updateStatCard(areaData, 'daily-area');
  } catch (error) {
    console.error('Error loading daily summary:', error);
    
    // Set error states
    ['daily-wb', 'daily-vehicle', 'daily-area'].forEach(prefix => {
      const card = document.querySelector(`[data-${prefix}-card]`);
      setStatCardError(card, 'Error Loading');
    });
  }
}

// Function to load weekly summary
async function loadWeeklySummary() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  
  const fromDate = weekAgo.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];
  
  // Set loading states
  ['weekly-wb', 'weekly-vehicle', 'weekly-area'].forEach(prefix => {
    const card = document.querySelector(`[data-${prefix}-card]`);
    setStatCardLoading(card);
  });
  
  try {
    const [wbData, vehicleData, areaData] = await Promise.all([
      fetchWeighbridgeSummary(fromDate, toDate),
      fetchVehicleSummary(fromDate, toDate),
      fetchAreaSummary(fromDate, toDate)
    ]);
    
    updateStatCard(wbData, 'weekly-wb');
    updateStatCard(vehicleData, 'weekly-vehicle');
    updateStatCard(areaData, 'weekly-area');
  } catch (error) {
    console.error('Error loading weekly summary:', error);
    
    ['weekly-wb', 'weekly-vehicle', 'weekly-area'].forEach(prefix => {
      const card = document.querySelector(`[data-${prefix}-card]`);
      setStatCardError(card, 'Error Loading');
    });
  }
}

// Function to load monthly summary
async function loadMonthlySummary() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setMonth(today.getMonth() - 1);
  
  const fromDate = monthAgo.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];
  
  // Set loading states
  ['monthly-wb', 'monthly-vehicle', 'monthly-area'].forEach(prefix => {
    const card = document.querySelector(`[data-${prefix}-card]`);
    setStatCardLoading(card);
  });
  
  try {
    const [wbData, vehicleData, areaData] = await Promise.all([
      fetchWeighbridgeSummary(fromDate, toDate),
      fetchVehicleSummary(fromDate, toDate),
      fetchAreaSummary(fromDate, toDate)
    ]);
    
    updateStatCard(wbData, 'monthly-wb');
    updateStatCard(vehicleData, 'monthly-vehicle');
    updateStatCard(areaData, 'monthly-area');
  } catch (error) {
    console.error('Error loading monthly summary:', error);
    
    ['monthly-wb', 'monthly-vehicle', 'monthly-area'].forEach(prefix => {
      const card = document.querySelector(`[data-${prefix}-card]`);
      setStatCardError(card, 'Error Loading');
    });
  }
}

// Function to load custom date range summary
async function searchCustomRange() {
  const fromDate = formatDateForAPI(document.getElementById('fromDate').value);
  const toDate = formatDateForAPI(document.getElementById('toDate').value);
  
  if (!fromDate || !toDate) {
    alert('Please select both From and To dates');
    return;
  }
  
  if (new Date(fromDate) > new Date(toDate)) {
    alert('From date must be before or equal to To date');
    return;
  }
  
  // Set loading states
  ['custom-wb', 'custom-vehicle', 'custom-area'].forEach(prefix => {
    const card = document.querySelector(`[data-${prefix}-card]`);
    setStatCardLoading(card);
  });
  
  // Update date range display with loading indicator
  document.getElementById('dateRangeDisplay').textContent = 'Loading...';
  
  try {
    const [wbData, vehicleData, areaData] = await Promise.all([
      fetchWeighbridgeSummary(fromDate, toDate),
      fetchVehicleSummary(fromDate, toDate),
      fetchAreaSummary(fromDate, toDate)
    ]);
    
    updateStatCard(wbData, 'custom-wb');
    updateStatCard(vehicleData, 'custom-vehicle');
    updateStatCard(areaData, 'custom-area');
    
    // Update date range display
    const formattedFrom = new Date(fromDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const formattedTo = new Date(toDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    document.getElementById('dateRangeDisplay').textContent = 
      `${formattedFrom} - ${formattedTo}`;
    
    if (!wbData?.length && !vehicleData?.length && !areaData?.length) {
      document.getElementById('dateRangeDisplay').textContent += ' (No Violations)';
    }
    
    // Load violation summary
    loadViolationSummary('custom');
  } catch (error) {
    console.error('Error loading custom summary:', error);
    
    ['custom-wb', 'custom-vehicle', 'custom-area'].forEach(prefix => {
      const card = document.querySelector(`[data-${prefix}-card]`);
      setStatCardError(card, 'Error Loading');
    });
    
    document.getElementById('dateRangeDisplay').textContent = 
      'Error loading data. Please try again.';
  }
}


// Function to fetch weighbridge summary
async function fetchWeighbridgeSummary(from, to) {
  const stdDev = window.weighmentSettings.getStdDev();
  const response = await fetch(
    `${serverURL}/api/summary/weighbridgeWiseSummary?from=${from}&to=${to}&standardDeviation=${stdDev}`
  );
  const data = await response.json();
  return data.data || [];
}

// Function to fetch vehicle summary
async function fetchVehicleSummary(from, to) {
  const stdDev = window.weighmentSettings.getStdDev();
  const response = await fetch(
    `${serverURL}/api/summary/vehicleWiseSummary?from=${from}&to=${to}&standardDeviation=${stdDev}`
  );
  const data = await response.json();
  return data.data || [];
}

// Function to fetch area summary
async function fetchAreaSummary(from, to) {
  const stdDev = window.weighmentSettings.getStdDev();
  const response = await fetch(
    `${serverURL}/api/summary/areaWiseSummary?from=${from}&to=${to}&standardDeviation=${stdDev}`
  );
  const data = await response.json();
  return data.data || [];
}

// Function to fetch violations summary
async function fetchViolationsSummary(from, to) {
  const stdDev = window.weighmentSettings.getStdDev();
  
  try {
    const url = `${serverURL}/api/summary/violationSummary?from=${from}&to=${to}&standardDeviation=${stdDev}`;
    console.log(`[fetchViolationsSummary] Fetching from URL:`, url);
    const response = await fetch(url);

    console.log(`[fetchViolationsSummary] Response status:`, response.status);
    
    if (!response.ok) {
      console.error(`[fetchViolationsSummary] Response not OK:`, response.status, response.statusText);
      throw new Error(`API returned status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`[fetchViolationsSummary] Raw response:`, JSON.stringify(data, null, 2));
    
    if (!data.summary) {
      console.warn(`[fetchViolationsSummary] No summary in response`);
      return null;
    }
    
    if (!data.summary.violations) {
      console.warn(`[fetchViolationsSummary] No violations in summary`);
      return null;
    }
    
    const result = data.summary.violations;
    console.log(`[fetchViolationsSummary] Extracted violations data:`, result);
    return result;
  } catch (error) {
    console.error("[fetchViolationsSummary] Error:", error.message);
    return null;
  }
}

// Function to update violation summary cards with loading state
function setViolationCardsLoading(timeframe) {
  console.log(`[setViolationCardsLoading] Setting loading state for ${timeframe}`);
  
  const cardTypes = [
    'total-violations',
    'areas-violations',
    'vehicles-violations',
    'wb-violations'
  ];
  
  cardTypes.forEach(type => {
    const selector = `[data-${timeframe}-${type}]`;
    const card = document.querySelector(selector);
    console.log(`[setViolationCardsLoading] Looking for selector: ${selector}, found:`, !!card);
    
    if (card) {
      card.classList.add('loading-state');
      const statNumber = card.querySelector('.stat-number');
      if (statNumber) {
        statNumber.textContent = '--';
        statNumber.style.opacity = '0.5';
        // Add loading state to the stat-number element as well
        statNumber.classList.add('loading-state');
      }
    } else {
      console.warn(`[setViolationCardsLoading] Card not found for ${selector}`);
    }
  });
}

// Function to update violation summary cards with data
function updateViolationCards(data, timeframe) {
  const cardTypes = [
    { selector: 'total-violations', property: 'total_violations' },
    { selector: 'areas-violations', property: 'unique_areas_with_violations' },
    { selector: 'vehicles-violations', property: 'unique_vehicles_with_violations' },
    { selector: 'wb-violations', property: 'unique_weighbridges_with_violations' }
  ];
  
  console.log(`[updateViolationCards] Updating ${timeframe} cards with data:`, data);
  
  if (data) {
    cardTypes.forEach(({ selector, property }, index) => {
      const card = document.querySelector(`[data-${timeframe}-${selector}]`);
      console.log(`[updateViolationCards] Looking for [data-${timeframe}-${selector}], found:`, !!card);
      if (card) {
        card.classList.remove('loading-state', 'error-state');
        const statNumber = card.querySelector('.stat-number');
        
        if (statNumber) {
          statNumber.style.opacity = '0';
          // Remove loading state from the stat-number element itself
          statNumber.classList.remove('loading-state');
          setTimeout(() => {
            console.log(`[updateViolationCards] Animating ${selector} from 0 to ${data[property]}`);
            animateNumber(statNumber, 0, data[property] || 0, 500);
            statNumber.style.opacity = '1';
          }, index * 100);
        }
      } else {
        console.warn(`[updateViolationCards] Card not found for selector [data-${timeframe}-${selector}]`);
      }
    });
  } else {
    // Handle no data case
    console.warn(`[updateViolationCards] No data provided for ${timeframe}, setting error state`);
    cardTypes.forEach(({ selector }) => {
      const card = document.querySelector(`[data-${timeframe}-${selector}]`);
      if (card) {
        card.classList.remove('loading-state');
        card.classList.add('error-state');
        const statNumber = card.querySelector('.stat-number');
        if (statNumber) {
          statNumber.textContent = '0';
          statNumber.style.opacity = '0.7';
          // Also remove loading state from stat-number
          statNumber.classList.remove('loading-state');
        }
      }
    });
  }
}


// Function to load violation summary for a specific timeframe
async function loadViolationSummary(timeframe) {
  let fromDate, toDate;
  const today = new Date();
  const formattedToday = today.toISOString().split('T')[0];
  
  // Set loading state
  setViolationCardsLoading(timeframe);
  
  switch (timeframe) {
    case 'daily':
      fromDate = formattedToday;
      toDate = formattedToday;
      break;
    case 'weekly':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 7);
      fromDate = weekStart.toISOString().split('T')[0];
      toDate = formattedToday;
      break;
    case 'monthly':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDate = monthStart.toISOString().split('T')[0];
      toDate = formattedToday;
      break;
    case 'custom':
      const customFromInput = document.getElementById('fromDate');
      const customToInput = document.getElementById('toDate');
      
      if (customFromInput && customToInput && customFromInput.value && customToInput.value) {
        fromDate = formatDateForAPI(customFromInput.value);
        toDate = formatDateForAPI(customToInput.value);
      } else {
        fromDate = formattedToday;
        toDate = formattedToday;
      }
      break;
    default:
      console.error('Invalid timeframe specified');
      return;
  }
  
  try {
    console.log(`[loadViolationSummary] Loading ${timeframe} from ${fromDate} to ${toDate}`);
    const violationsData = await fetchViolationsSummary(fromDate, toDate);
    console.log(`[loadViolationSummary] Received data for ${timeframe}:`, violationsData);
    updateViolationCards(violationsData, timeframe);
  } catch (error) {
    console.error(`Error loading ${timeframe} violation summary:`, error);
    updateViolationCards(null, timeframe);
  }
}

// Initialize all summaries when the page loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("[DOMContentLoaded] Page loaded, initializing...");
  
  // Initialize settings first (in case it hasn't been initialized yet)
  if (!window.weighmentSettings.stdDev) {
    console.log("[DOMContentLoaded] Initializing weighment settings...");
    window.weighmentSettings.init();
  } else {
    console.log("[DOMContentLoaded] Weighment settings already initialized");
  }
  
  // Check if violation cards exist in the DOM
  const testCard = document.querySelector('[data-daily-total-violations]');
  console.log("[DOMContentLoaded] Found daily total violations card:", !!testCard);
  
  // Load card statistics
  loadDailySummary();
  loadWeeklySummary();
  loadMonthlySummary();

  // Load violation summaries for all timeframes
  loadViolationSummary("daily");
  loadViolationSummary("weekly");
  loadViolationSummary("monthly");

  // Set default date range for custom section to last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  // Format dates for datetime-local input
  const formatDateForInput = (date) => {
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
  };

  document.getElementById("fromDate").value = formatDateForInput(sevenDaysAgo);
  document.getElementById("toDate").value = formatDateForInput(today);

  // Load custom data
  searchCustomRange();
  loadViolationSummary("custom");

  // Setup auto-refresh for daily summary
  setInterval(() => {
    loadDailySummary();
    loadViolationSummary("daily");
  }, 5 * 60 * 1000); // Refresh every 5 minutes
});

// Weight unit settings and conversion
window.weightUnit = "MT"; // Default unit is now MT
const conversionFactor = 1000; // 1 MT = 1000 kg

// Function to convert weight value based on selected unit
function convertWeight(value, unit = window.weightUnit) {
  if (!value && value !== 0) return "0";

  const numValue = parseFloat(value);
  if (isNaN(numValue)) return "0";

  if (unit === "MT") {
    // Convert from kg to MT
    return (numValue / conversionFactor).toFixed(3);
  }

  // Default is kg
  return Math.round(numValue);
}

// Function to format weight with appropriate unit
function formatWeight(value, unit = window.weightUnit) {
  return `${convertWeight(value, unit)} ${unit}`;
}

// Function to update all weight displays based on the selected unit
function updateAllWeightDisplays() {
  // Collect specific historic cell class patterns so even hidden rows get converted uniformly.
  const historicSelectors = [
    '[class*="historic-cell-"]',
    '[class*="vehicle-historic-cell-"]',
    '[class*="wb-historic-cell-"]',
  ];
  historicSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((cell) => {
      // Only process once; prefer data-weight-value for accuracy.
      if (cell.hasAttribute("data-weight-value")) {
        const raw = cell.getAttribute("data-weight-value");
        if (raw && !cell.textContent.includes(window.weightUnit)) {
          cell.textContent = formatWeight(raw);
        }
      } else {
        // Attempt to parse existing text (may already be converted previously)
        const match = cell.textContent.match(/(-?\d+(?:\.\d+)?)\s*(kg|MT)/i);
        if (match) {
          let baseKg = parseFloat(match[1]);
          if (match[2].toUpperCase() === "MT") baseKg *= conversionFactor; // normalize to kg
          cell.setAttribute("data-weight-value", baseKg);
          cell.textContent = formatWeight(baseKg);
        }
      }
    });
  });
  // Update elements with data-weight-value attribute first
  const weightValueElements = document.querySelectorAll("[data-weight-value]");
  weightValueElements.forEach((element) => {
    const weightValue = element.getAttribute("data-weight-value");
    if (weightValue) {
      // Only update if not already in the correct unit
      if (!element.textContent.includes(window.weightUnit)) {
        element.textContent = formatWeight(weightValue);
      }
    }
  });

  // Update numeric cells in tables
  const weightCells = document.querySelectorAll(".numeric-cell");

  weightCells.forEach((cell) => {
    const text = cell.textContent;
    if (text && (text.includes("kg") || text.includes("MT"))) {
      // Extract the numerical value - more comprehensive regex to match various formats
      const match = text.match(/(-?\d+(\.\d+)?)\s*(kg|MT)/i);
      if (match) {
        // Store the original value if not already stored
        if (!cell.hasAttribute("data-original-weight")) {
          // For cells with MT, convert back to kg for storage
          const originalValue =
            match[3].toUpperCase() === "MT"
              ? parseFloat(match[1]) * conversionFactor
              : parseFloat(match[1]);
          cell.setAttribute("data-original-weight", originalValue);
        }

        // Get the original value in kg
        const originalWeight = parseFloat(
          cell.getAttribute("data-original-weight")
        );

        // Replace with the converted value and unit
        cell.textContent = text.replace(match[0], formatWeight(originalWeight));
      }
    }
  });

  // Update deviation cells (they have different format)
  const deviationCells = document.querySelectorAll(".deviation-cell");
  deviationCells.forEach((cell) => {
    // Look for text nodes containing kg or MT
    const textNodes = [];
    function findTextNodes(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (/(kg|MT)/i.test(node.textContent)) {
          textNodes.push(node);
        }
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          findTextNodes(node.childNodes[i]);
        }
      }
    }

    findTextNodes(cell);

    textNodes.forEach((node) => {
      const match = node.textContent.match(/([+-]?\d+(\.\d+)?)\s*(kg|MT)/i);
      if (match) {
        // Store original value if not already stored
        if (!cell.hasAttribute("data-original-weight")) {
          const originalValue =
            match[3].toUpperCase() === "MT"
              ? parseFloat(match[1]) * conversionFactor
              : parseFloat(match[1]);
          cell.setAttribute("data-original-weight", originalValue);
        }

        const originalWeight = parseFloat(
          cell.getAttribute("data-original-weight")
        );
        node.textContent = node.textContent.replace(
          match[0],
          `${
            match[1].startsWith("+") || match[1].startsWith("-")
              ? ""
              : match[1].startsWith("0")
              ? ""
              : "+"
          }${convertWeight(originalWeight)} ${window.weightUnit}`
        );
      }
    });
  });

  // Special handling for summary tables
  const summaryTables = document.querySelectorAll(
    ".summary-table, .summary-card, .top-violators-table"
  );
  summaryTables.forEach((table) => {
    const cells = table.querySelectorAll("td, th");
    cells.forEach((cell) => {
      const text = cell.textContent;
      if (text && (text.includes("kg") || text.includes("MT"))) {
        // Use a more comprehensive regex to find weight values
        const match = text.match(/(-?\d+(\.\d+)?)\s*(kg|MT)/i);
        if (match) {
          // Store the original value as a data attribute if not already stored
          if (!cell.hasAttribute("data-original-weight")) {
            const originalValue =
              match[3].toUpperCase() === "MT"
                ? parseFloat(match[1]) * conversionFactor
                : parseFloat(match[1]);
            cell.setAttribute("data-original-weight", originalValue);
          }

          // Get the original value
          const originalWeight = parseFloat(
            cell.getAttribute("data-original-weight")
          );

          // Replace with the converted value and unit
          cell.textContent = text.replace(
            match[0],
            formatWeight(originalWeight)
          );
        }
      }
    });
  });

  // Additional selector for all table cells that might contain weight values
  const allCells = document.querySelectorAll("td, th");
  allCells.forEach((cell) => {
    if (
      !cell.classList.contains("numeric-cell") &&
      !cell.classList.contains("deviation-cell")
    ) {
      const text = cell.textContent;
      if (text && (text.includes("kg") || text.includes("MT"))) {
        // Use a more flexible regex to catch all weight formats
        const matches = [...text.matchAll(/(-?\d+(\.\d+)?)\s*(kg|MT)/gi)];

        if (matches.length > 0) {
          let newText = text;

          matches.forEach((match) => {
            // Store the original weight data as a property if not already stored
            const cellKey = `cell-${cell.textContent.length}-${match.index}`;
            if (!cell[cellKey]) {
              const originalValue =
                match[3].toUpperCase() === "MT"
                  ? parseFloat(match[1]) * conversionFactor
                  : parseFloat(match[1]);
              cell[cellKey] = originalValue;
            }

            // Get the original value
            const originalWeight = cell[cellKey];

            // Format and replace
            const formattedWeight = formatWeight(originalWeight);
            newText = newText.replace(match[0], formattedWeight);
          });

          cell.textContent = newText;
        }
      }
    }
  });

  // Handle any spans or other elements with weight values
  const allElements = document.querySelectorAll("*");
  allElements.forEach((el) => {
    if (
      el.childNodes.length === 1 &&
      el.childNodes[0].nodeType === Node.TEXT_NODE
    ) {
      const text = el.textContent;
      if (
        text &&
        (text.includes("kg") || text.includes("MT")) &&
        !el.classList.contains("numeric-cell") &&
        !el.classList.contains("deviation-cell") &&
        el.tagName !== "TD" &&
        el.tagName !== "TH"
      ) {
        const match = text.match(/(-?\d+(\.\d+)?)\s*(kg|MT)/i);
        if (match) {
          // Store the original value if not already stored
          const elKey = `element-${text}`;
          if (!el[elKey]) {
            const originalValue =
              match[3].toUpperCase() === "MT"
                ? parseFloat(match[1]) * conversionFactor
                : parseFloat(match[1]);
            el[elKey] = originalValue;
          }

          // Replace with the converted value and unit
          el.textContent = text.replace(match[0], formatWeight(el[elKey]));
        }
      }
    }
  });

}

// Function to synchronize all weight unit selectors
function syncWeightUnitSelectors() {
  const allSelectors = document.querySelectorAll(
    'select[id^="weight-unit-selector"]'
  );
  allSelectors.forEach((selector) => {
    selector.value = window.weightUnit;
  });
}

// Function to set up unit conversion on search buttons
function setupUnitConversionOnSearch() {
  // Present-day search button
  const presentDaySearchBtn = document.querySelector(
    '.search-btn[onclick*="getReportsByAreaId"]'
  );
  if (presentDaySearchBtn) {
    const originalOnClick = presentDaySearchBtn.getAttribute("onclick");
    presentDaySearchBtn.setAttribute(
      "onclick",
      `${originalOnClick}; updateAllWeightDisplays();`
    );
  }

  // Vehicle-wise search button
  const vehicleSearchBtn = document.querySelector(
    '.search-btn[onclick*="filterVehicleData"]'
  );
  if (vehicleSearchBtn) {
    const originalOnClick = vehicleSearchBtn.getAttribute("onclick");
    vehicleSearchBtn.setAttribute(
      "onclick",
      `${originalOnClick}; updateAllWeightDisplays();`
    );
  }

  // Weighbridge-wise search button
  const wbSearchBtn = document.querySelector(
    '.search-btn[onclick*="getReportsByWBCode"]'
  );
  if (wbSearchBtn) {
    const originalOnClick = wbSearchBtn.getAttribute("onclick");
    wbSearchBtn.setAttribute(
      "onclick",
      `${originalOnClick}; updateAllWeightDisplays();`
    );
  }

  // Add an update button to the summary tabs
  document.querySelectorAll(".tab-button").forEach((tab) => {
    const originalOnClick = tab.getAttribute("onclick");
    if (originalOnClick) {
      tab.setAttribute(
        "onclick",
        `${originalOnClick}; setTimeout(updateAllWeightDisplays, 500);`
      );
    }
  });

  // Add a global button to update all weights
  const navTabs = document.querySelector(".nav-tabs");
  if (navTabs && !document.querySelector("#global-weight-update")) {
    const updateBtn = document.createElement("button");
    updateBtn.id = "global-weight-update";
    updateBtn.className = "global-update-btn";
    updateBtn.innerHTML = "Update All Weight Units";
    updateBtn.style.marginLeft = "auto";
    updateBtn.style.padding = "5px 10px";
    updateBtn.style.fontSize = "0.9em";
    updateBtn.style.backgroundColor = "#4caf50";
    updateBtn.style.color = "white";
    updateBtn.style.border = "none";
    updateBtn.style.borderRadius = "4px";
    updateBtn.style.cursor = "pointer";
    updateBtn.onclick = function () {
      updateAllWeightDisplays();
      alert("All weight units updated to " + window.weightUnit);
    };
    navTabs.appendChild(updateBtn);
  }
}

// Event listener for the weight unit selectors
document.addEventListener("DOMContentLoaded", function () {
  // Set all selectors to MT by default
  const weightUnitSelectors = document.querySelectorAll(
    'select[id^="weight-unit-selector"]'
  );
  weightUnitSelectors.forEach((selector) => {
    selector.value = "MT";

    // Add change event listener that updates immediately as well
    selector.addEventListener("change", function () {
      window.weightUnit = this.value;
      syncWeightUnitSelectors();

      // Immediately update all weight displays for better user experience
      updateAllWeightDisplays();

      // The conversion will also happen when search is clicked
    });
  });

  // Setup the search buttons to trigger weight conversion
  setupUnitConversionOnSearch();

  // Add manual update button if it doesn't exist
  if (!document.querySelector("#manual-weight-update-btn")) {
    const filterSections = document.querySelectorAll(".filter-section");
    filterSections.forEach((section) => {
      const unitSelector = section.querySelector(
        'select[id^="weight-unit-selector"]'
      );
      if (unitSelector) {
        const unitContainer = unitSelector.closest(".filter-item");
        if (unitContainer) {
          const updateBtn = document.createElement("button");
          updateBtn.id = "manual-weight-update-btn";
          updateBtn.className = "update-btn";
          updateBtn.innerHTML = "Update Units";
          updateBtn.style.marginLeft = "5px";
          updateBtn.style.padding = "2px 5px";
          updateBtn.style.fontSize = "0.8em";
          updateBtn.onclick = function () {
            updateAllWeightDisplays();
          };
          unitContainer.appendChild(updateBtn);
        }
      }
    });
  }

  // Initial update
  updateAllWeightDisplays();
});

//======================================================
// Image modal related functions
//=====================================================
async function loadWeighmentImages(slNo, weightType) { 
  // Show modal with loading state
  showImageModal(slNo, weightType, null, true);
  
  try {
    const response = await fetch(
      `${serverURL}/api/images/abnormalWeighmentImg?slNo=${slNo}&weightType=${weightType}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Weighment images data:", data);
    
    // Validate images before showing
    if (data.imageUrls && data.imageUrls.length > 0) {
      await validateAndShowImages(slNo, weightType, data.imageUrls);
    } else {
      // No URLs returned from API
      showImageModal(slNo, weightType, [], false);
    }
  } catch (error) {
    console.error("Error fetching weighment images:", error);
    // Show error in modal
    showImageModal(slNo, weightType, null, false, error.message);
  }
}

async function validateAndShowImages(slNo, weightType, imageUrls) {
  // Test each image URL to see if it's accessible
  const validImageUrls = [];
  
  for (const url of imageUrls) {
    try {
      const isValid = await checkImageUrl(url);
      if (isValid) {
        validImageUrls.push(url);
      }
    } catch (error) {
      console.warn(`Image failed to load: ${url}`, error);
    }
  }
  
  // Show modal with only valid images
  showImageModal(slNo, weightType, validImageUrls, false);
}

function checkImageUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      img.src = ''; // Cancel loading
      resolve(false);
    }, 5000); // 5 second timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    
    img.src = url;
  });
}

function showImageModal(slNo, weightType, imageUrls, isLoading, errorMessage) {
  let modal = document.getElementById('image-modal');
  
  // Create modal 
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.className = 'image-modal-overlay';
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeImageModal();
      }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeImageModal();
      }
    });
  }
  
  // Modal content
  let content = `
    <div class="image-modal-content">
      <div class="image-modal-header">
        <h2 class="image-modal-title">Weighment Images</h2>
        <button class="image-modal-close" onclick="closeImageModal()" aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="image-modal-subtitle">SL No: ${slNo} | Type: ${weightType}</div>
  `;
  
  if (isLoading) {
    // Enhanced loading state with skeleton loaders
    content += `
      <div class="image-grid">
        ${[1, 2, 3, 4, 5, 6].map(i => `
          <div class="image-grid-item">
            <div class="image-skeleton">
              <div class="skeleton-shimmer"></div>
            </div>
            <div class="image-label-skeleton">
              <div class="skeleton-text"></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="loading-indicator">
        <div class="mui-spinner">
          <svg class="circular" viewBox="22 22 44 44">
            <circle class="path" cx="44" cy="44" r="20.2" fill="none" stroke-width="3.6"></circle>
          </svg>
        </div>
        <p class="loading-text">Validating images...</p>
      </div>
    `;
  } else if (errorMessage) {
    // Error state with icon
    content += `
      <div class="image-grid error-state">
        <div class="error-container">
          <svg class="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 class="error-title">Error Loading Images</h3>
          <p class="error-message">${errorMessage}</p>
          <button class="retry-button" onclick="loadWeighmentImages('${slNo}', '${weightType}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Retry
          </button>
        </div>
      </div>
    `;
  } else if (imageUrls && imageUrls.length > 0) {
    // Display only valid images
    content += '<div class="image-grid">';   
    imageUrls.forEach((url, index) => {
      const label = `Image - ${index+1}`;
      
      content += `
        <div class="image-grid-item" style="animation-delay: ${index * 0.1}s">
          <div class="image-wrapper">
            <img 
              src="${url}" 
              alt="${label}"
              loading="lazy"
              onerror="this.parentElement.innerHTML='<div class=\\'image-error-placeholder\\'><svg width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\' ry=\\'2\\'></rect><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'></circle><polyline points=\\'21 15 16 10 5 21\\'></polyline></svg><p>Failed to load</p></div>'"
            />
          </div>
          <div class="image-label">${label}</div>
        </div>
      `;
    });
    
    content += '</div>';
  } else {
    // No accessible images found
    content += `
      <div class="image-grid empty-state">
        <div class="empty-container">
          <svg class="empty-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <h3 class="empty-title">Images Not Found</h3>
          <p class="empty-message">No accessible images found for this weighment record.</p>
        </div>
      </div>
    `;
  }
  
  content += '</div>';
  
  modal.innerHTML = content;
  modal.classList.add('active');
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.innerHTML = '';
    }, 300);
  }
}


// ===================================
// SUMMARY PAGE LODING STATE FUNTIONS
// ===================================

function setStatCardLoading(cardElement) {
  if (!cardElement) return;
  
  cardElement.classList.add('loading-state');
  
  // Add skeleton loaders to the card
  const primaryStat = cardElement.querySelector('.primary-stat');
  const statNumbers = cardElement.querySelectorAll('.stat-number:not(.primary-stat)');
  
  if (primaryStat) {
    primaryStat.textContent = '---';
    primaryStat.style.opacity = '0.5';
  }
  
  statNumbers.forEach(stat => {
    stat.textContent = '--';
    stat.style.opacity = '0.5';
  });
  
  // Disable click
  cardElement.style.pointerEvents = 'none';
  cardElement.style.cursor = 'default';
}

// Remove loading state from a stat card
function removeStatCardLoading(cardElement) {
  if (!cardElement) return;
  
  cardElement.classList.remove('loading-state');
  
  const primaryStat = cardElement.querySelector('.primary-stat');
  const statNumbers = cardElement.querySelectorAll('.stat-number:not(.primary-stat)');
  
  if (primaryStat) {
    primaryStat.style.opacity = '1';
  }
  
  statNumbers.forEach(stat => {
    stat.style.opacity = '1';
  });
  
  // Re-enable click
  cardElement.style.pointerEvents = 'auto';
  cardElement.style.cursor = 'pointer';
}

// Set error state for a stat card
function setStatCardError(cardElement, errorMessage = 'No Data') {
  if (!cardElement) return;
  
  cardElement.classList.remove('loading-state');
  cardElement.classList.add('error-state');
  
  const primaryStat = cardElement.querySelector('.primary-stat');
  const statNumbers = cardElement.querySelectorAll('.stat-number:not(.primary-stat)');
  
  if (primaryStat) {
    primaryStat.textContent = errorMessage;
    primaryStat.style.opacity = '0.7';
  }
  
  statNumbers.forEach(stat => {
    stat.textContent = '0';
    stat.style.opacity = '0.7';
  });
  
  // Disable click
  cardElement.style.pointerEvents = 'none';
  cardElement.style.cursor = 'default';
}

// animate numbers
function animateNumber(element, start, end, duration) {
  const startTime = performance.now();
  const difference = end - start;
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation
    const easeOutQuad = progress * (2 - progress);
    const current = Math.floor(start + (difference * easeOutQuad));
    
    element.textContent = current;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = end; // Ensure final value is exact
    }
  }
  
  requestAnimationFrame(update);
}
