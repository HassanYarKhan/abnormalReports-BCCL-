// ============================================
// GRAPH VIEW MODULE - FIXED & ENHANCED
// ============================================

const chartInstances = {};
const selectedTripInfo = {};
const doDataCache = {}; // Store DO data for each DO number

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

  return `${HH}:${minutes}:${seconds} ${ampm} ${DD}-${MM}-${YYYY} `;
}


// ============================================
// GRAPH RENDERING WITH COLORED ZONES
// ============================================

function renderGraphView(doNumber, doData) {
  const container = document.getElementById(`graph-view-${doNumber}`);
  if (!container) return;

  // Cache the doData for this DO number
  doDataCache[doNumber] = doData;
  console.log('Cached data for DO:', doNumber);

  container.innerHTML = `
    <div class="graph-view-layout">
      <div class="graph-container-section">
        <div class="graph-controls">
          <div class="graph-stats" id="graph-stats-${doNumber}"></div>
          <div class="graph-legend" id="graph-legend-${doNumber}"></div>
          <div class="graph-toggle-container">
            <label class="graph-toggle-label">
              <input type="checkbox" id="outliers-toggle-${doNumber}" data-do="${doNumber}">
              <span class="graph-toggle-switch"></span>
              <span class="graph-toggle-text">Show Irregular Trips Only</span>
            </label>
          </div>
        </div>
        <div class="graph-scroll-wrapper">
          <button class="graph-scroll-btn left" id="scroll-left-${doNumber}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="graph-canvas-wrapper" id="graph-wrapper-${doNumber}">
            <canvas id="chart-${doNumber}"></canvas>
          </div>
          <button class="graph-scroll-btn right" id="scroll-right-${doNumber}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="trip-info-panel" id="trip-info-${doNumber}">
        <div class="trip-info-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path d="M12 16v-4M12 8h.01" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>Click on a data point in the graph to view trip details</p>
        </div>
      </div>
    </div>
  `;

  // Add event listener for toggle
  const toggleCheckbox = document.getElementById(`outliers-toggle-${doNumber}`);
  if (toggleCheckbox) {
    toggleCheckbox.addEventListener('change', function() {
      toggleOutliersForDO(this.dataset.do);
    });
  }

  // Add event listeners for scroll buttons
  const scrollLeftBtn = document.getElementById(`scroll-left-${doNumber}`);
  const scrollRightBtn = document.getElementById(`scroll-right-${doNumber}`);
  
  if (scrollLeftBtn) {
    scrollLeftBtn.addEventListener('click', () => scrollGraphLeft(doNumber));
  }
  
  if (scrollRightBtn) {
    scrollRightBtn.addEventListener('click', () => scrollGraphRight(doNumber));
  }

  renderGraph(doNumber, doData);
  initScrollButtons(doNumber);
}

function renderGraph(doNumber, doData, outliersOnly = false) {
  if (chartInstances[doNumber]) {
    chartInstances[doNumber].destroy();
    delete chartInstances[doNumber];
  }

  const canvas = document.getElementById(`chart-${doNumber}`);
  if (!canvas) return;

  const graphData = prepareGraphData(doData, outliersOnly);
  const dataPoints = graphData.dataPoints;
  const boundaries = graphData.boundaries;

  // Get the wrapper width to use as minimum
  const wrapper = document.getElementById(`graph-wrapper-${doNumber}`);
  const wrapperWidth = wrapper ? wrapper.clientWidth - 40 : 760; // Subtract padding

  const tripCount = dataPoints.length;
  const pixelsPerTrip = 8; // Increased for better spacing
  const calculatedWidth = tripCount * pixelsPerTrip;
  const maxWidth = 15000;
  
  // Use wrapper width as minimum, calculated width for more data
  const finalWidth = Math.min(maxWidth, Math.max(wrapperWidth, calculatedWidth));

  // Calculate dynamic height based on data range
  const allYValues = dataPoints.map(p => p.y);
  const minY = Math.min(...allYValues);
  const maxY = Math.max(...allYValues);
  const dataRange = maxY - minY;
  
  // Calculate appropriate height: base 440px, add more if range is large
  let dynamicHeight = 440;
  if (dataRange > 500) {
    dynamicHeight = 600;
  } else if (dataRange > 300) {
    dynamicHeight = 520;
  } else if (dataRange > 150) {
    dynamicHeight = 480;
  }

  // Calculate Y-axis range with padding
  const yPaddingPercent = 0.2; // 20% padding on each side
  const yPadding = Math.max(dataRange * yPaddingPercent, 5); // At least 5 minutes padding
  const yMin = Math.max(0.1, minY - yPadding); // Logarithmic scale needs positive values
  const yMax = maxY + yPadding;

  canvas.width = finalWidth;
  canvas.height = dynamicHeight;
  canvas.style.width = finalWidth + 'px';
  canvas.style.height = dynamicHeight + 'px';

  // Update wrapper height to accommodate the canvas
  const scrollWrapper = document.getElementById(`graph-wrapper-${doNumber}`).parentElement;
  if (scrollWrapper) {
    scrollWrapper.style.height = (dynamicHeight + 60) + 'px'; // Add space for scrollbar and padding
  }

  const medianMinutes = (boundaries.q1 + boundaries.q3) / 2;
  const pointColors = getPointColors(dataPoints);

  const ctx = canvas.getContext("2d");
  const chart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Trip Times",
          data: dataPoints,
          backgroundColor: pointColors,
          borderColor: pointColors,
          borderWidth: 1.5,
          pointRadius: 6,
          pointHoverRadius: 9,
          pointHoverBorderWidth: 2,
          showLine: true, // This connects the points with a line
          borderColor: 'rgba(25, 118, 210, 0.3)', // Line color
          borderWidth: 2, // Line width
          tension: 0.1, // Slight curve to the line (0 = straight, 1 = very curved)
          fill: false, // Don't fill the area under the line
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        }
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const element = elements[0];
          const dataIndex = element.index;
          const tripData = dataPoints[dataIndex];
          updateTripInfoPanel(doNumber, tripData, doData);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (context) {
              const point = context[0].raw;
              return `Vehicle: ${point.vehicle}`;
            },
            label: function (context) {
              const point = context.raw;
              return [
                `Trip Time: ${point.tripTime}`,
                `Route: ${point.srcWB} → ${point.destWB}`,
                `Status: ${
                  point.outlierType === "normal"
                    ? "Normal"
                    : point.outlierType === "below"
                    ? "Below Range"
                    : "Above Range"
                }`,
              ];
            },
          },
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          titleFont: { size: 14, weight: "bold" },
          bodyFont: { size: 13 },
          displayColors: false,
        },
        annotation: {
          annotations: {
            // Above range zone (red)
            aboveRangeZone: {
              type: 'box',
              yMin: boundaries.iqrHigh,
              yMax: 'max',
              backgroundColor: 'rgba(244, 67, 54, 0.08)',
              borderWidth: 0,
              drawTime: 'beforeDatasetsDraw'
            },
            // Normal range zone (green)
            normalRangeZone: {
              type: 'box',
              yMin: boundaries.iqrLow,
              yMax: boundaries.iqrHigh,
              backgroundColor: 'rgba(76, 175, 80, 0.08)',
              borderWidth: 0,
              drawTime: 'beforeDatasetsDraw'
            },
            // Below range zone (orange)
            belowRangeZone: {
              type: 'box',
              yMin: 'min',
              yMax: boundaries.iqrLow,
              backgroundColor: 'rgba(255, 152, 0, 0.08)',
              borderWidth: 0,
              drawTime: 'beforeDatasetsDraw'
            },
            // IQR Low Line
            iqrLowLine: {
              type: "line",
              yMin: boundaries.iqrLow,
              yMax: boundaries.iqrLow,
              borderColor: "#FF9800",
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                content: `Min: ${doData.iqr_low}`,
                enabled: true,
                position: "start",
                backgroundColor: "rgba(255, 152, 0, 0.9)",
                color: "white",
                font: { size: 11, weight: "bold" },
                padding: 6
              },
            },
            // IQR High Line
            iqrHighLine: {
              type: "line",
              yMin: boundaries.iqrHigh,
              yMax: boundaries.iqrHigh,
              borderColor: "#F44336",
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                content: `Max: ${doData.iqr_high}`,
                enabled: true,
                position: "start",
                backgroundColor: "rgba(244, 67, 54, 0.9)",
                color: "white",
                font: { size: 11, weight: "bold" },
                padding: 6
              },
            },
            // Median Line
            medianLine: {
              type: "line",
              yMin: medianMinutes,
              yMax: medianMinutes,
              borderColor: "rgba(76, 175, 80, 0.8)",
              borderWidth: 2,
              label: {
                content: "Median",
                enabled: true,
                position: "center",
                backgroundColor: "rgba(76, 175, 80, 0.9)",
                color: "white",
                font: { size: 11, weight: "bold" },
                padding: 6
              },
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Trip Sequence",
            font: { size: 14, weight: "bold" },
            color: "#d8d8d8",
            padding: { top: 10 }
          },
          grid: {
            display: true,
            color: "rgba(255, 255, 255, 0.05)",
            drawBorder: true,
          },
          ticks: {
            color: "#b8b8b8",
            font: { size: 11 },
            padding: 8,
            maxRotation: 0,
            autoSkip: true,
            autoSkipPadding: 20
          }
        },
        y: {
          type: "logarithmic",
          min: yMin,
          max: yMax,
          title: {
            display: true,
            text: "Trip Time (minutes)",
            font: { size: 14, weight: "bold" },
            color: "#d8d8d8",
            padding: { bottom: 10 }
          },
          grid: {
            display: true,
            color: "rgba(255, 255, 255, 0.1)",
            drawBorder: true,
          },
          ticks: {
            color: "#b8b8b8",
            font: { size: 11 },
            padding: 8,
            callback: function(value, index, values) {
              // Format tick labels nicely
              if (value < 1) return value.toFixed(2);
              if (value < 10) return value.toFixed(1);
              return Math.round(value);
            }
          }
        },
      },
    },
  });

  chartInstances[doNumber] = chart;
  updateGraphStats(graphData, doNumber);
}

// ============================================
// TRIP INFO PANEL
// ============================================

function updateTripInfoPanel(doNumber, tripData, doData) {
  const panel = document.getElementById(`trip-info-${doNumber}`);
  if (!panel) return;

  const iqrLowMinutes = timeToMinutes(doData.iqr_low);
  const iqrHighMinutes = timeToMinutes(doData.iqr_high);

  let statusClass = "status-normal";
  let statusText = "Normal";
  let statusIcon = "✓";

  if (tripData.isOutlier) {
    if (tripData.y < iqrLowMinutes) {
      statusClass = "status-below";
      statusText = "Below Range (Fast)";
      statusIcon = "↓";
    } else if (tripData.y > iqrHighMinutes) {
      statusClass = "status-above";
      statusText = "Above Range (Slow)";
      statusIcon = "↑";
    }
  }

  panel.innerHTML = `
    <div class="trip-info-header">
      <h3>Trip Details</h3>
      <span class="trip-status-badge ${statusClass}">
        ${statusIcon} ${statusText}
      </span>
    </div>
    <div class="trip-info-content">
      
      <!-- Vehicle & Trip Time Card -->
      <div class="trip-info-card">
        <div class="trip-info-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
          Vehicle Information
        </div>
        <table class="trip-info-table">
          <tr>
            <td class="trip-info-table-label">Vehicle Number</td>
            <td class="trip-info-table-value">${tripData.vehicle}</td>
          </tr>
          <tr>
            <td class="trip-info-table-label">Trip Time</td>
            <td class="trip-info-table-value trip-time-highlight">${tripData.tripTime}</td>
          </tr>
          <tr>
            <td class="trip-info-table-label">Trip Start Time</td>
            <td class="trip-info-table-value">${formatDateTime(tripData.tripStartTime)}</td>
          </tr>
          <tr>
            <td class="trip-info-table-label">Trip End Time</td>
            <td class="trip-info-table-value">${formatDateTime(tripData.tripEndTime)}</td>
          </tr>
        </table>
      </div>

      <!-- Route Information Card -->
      <div class="trip-info-card">
        <div class="trip-info-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="10" r="3"/>
            <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
          </svg>
          Route Information
        </div>
        <table class="trip-info-table">
          <tr>
            <td colspan="2" class="trip-info-table-section">Source</td>
          </tr>
          <tr>
            <td class="trip-info-table-label">Area / Unit</td>
            <td class="trip-info-table-value">${tripData.srcArea}</td>
          </tr>
          <tr>
            <td class="trip-info-table-label">Weighbridge</td>
            <td class="trip-info-table-value">${tripData.srcWB}</td>
          </tr>
          <tr>
            <td colspan="2" class="trip-info-table-divider"></td>
          </tr>
          <tr>
            <td colspan="2" class="trip-info-table-section">Destination</td>
          </tr>
          <tr>
            <td class="trip-info-table-label">Area / Unit</td>
            <td class="trip-info-table-value">${tripData.destArea}</td>
          </tr>
          <tr>
            <td class="trip-info-table-label">Weighbridge</td>
            <td class="trip-info-table-value">${tripData.destWB}</td>
          </tr>
        </table>
      </div>

      <!-- Time Range Card -->
      <div class="trip-info-card">
        <div class="trip-info-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Allowed Time Range
        </div>
        <table class="trip-info-table">
          <tr>
            <td class="trip-info-table-label">Minimum Time</td>
            <td class="trip-info-table-value">
              <span class="range-badge range-min-badge">${doData.iqr_low}</span>
            </td>
          </tr>
          <tr>
            <td class="trip-info-table-label">Maximum Time</td>
            <td class="trip-info-table-value">
              <span class="range-badge range-max-badge">${doData.iqr_high}</span>
            </td>
          </tr>
          <tr>
            <td class="trip-info-table-label">Actual Trip Time</td>
            <td class="trip-info-table-value">
              <span class="range-badge ${statusClass === 'status-normal' ? 'range-normal-badge' : statusClass === 'status-below' ? 'range-below-badge' : 'range-above-badge'}">${tripData.tripTime}</span>
            </td>
          </tr>
        </table>
      </div>

    </div>
  `;
}

// ============================================
// DATA PREPARATION
// ============================================

function prepareGraphData(doGroup, outliersOnly = false) {
  console.log(doGroup);
  const vehiclesData = doGroup.vehiclesData;
  const iqrLowMinutes = timeToMinutes(doGroup.iqr_low);
  const iqrHighMinutes = timeToMinutes(doGroup.iqr_high);
  const q1Minutes = timeToMinutes(doGroup.statistics.q1);
  const q3Minutes = timeToMinutes(doGroup.statistics.q3);


  console.log('Preparing graph data:', {
    totalTrips: vehiclesData.length,
    outliersOnly: outliersOnly,
    iqrLow: iqrLowMinutes,
    iqrHigh: iqrHighMinutes
  });

  // Filter data based on toggle
  const filteredData = outliersOnly
    ? vehiclesData.filter((trip) => {
        console.log('Checking trip:', trip.Vehicle_Number, 'Is_Outlier:', trip.Is_Outlier);
        return trip.Is_Outlier === true || trip.Is_Outlier === 1;
      })
    : vehiclesData;

  console.log('Filtered data length:', filteredData.length);

  const dataPoints = filteredData.map((trip, index) => {
    const tripMinutes = trip.Trip_Time_Minutes;

    let outlierType = "normal";
    let isOutlier = trip.Is_Outlier === true || trip.Is_Outlier === 1;
    
    if (isOutlier) {
      if (tripMinutes < iqrLowMinutes) {
        outlierType = "below";
      } else if (tripMinutes > iqrHighMinutes) {
        outlierType = "above";
      }
    }

    return {
      x: index,
      y: tripMinutes,
      vehicle: trip.Vehicle_Number,
      tripTime: trip.Trip_Time,
      srcWB: trip.Src_WB_Code,
      destWB: trip.Dest_WB_Code,
      srcArea: trip.Src_Area,
      destArea: trip.Dest_Area,
      isOutlier: isOutlier,
      outlierType: outlierType,
      tripStartTime: trip.Trip_Start_Time,
      tripEndTime: trip.Trip_End_Time,
      tripIndex: index,
      originalIndex: vehiclesData.indexOf(trip),
    };
  });

  console.log('Data points created:', dataPoints.length);

  return {
    dataPoints: dataPoints,
    boundaries: {
      iqrLow: iqrLowMinutes,
      iqrHigh: iqrHighMinutes,
      q1: q1Minutes,
      q3: q3Minutes,
    },
    doNumber: doGroup.DO_Number,
    totalTrips: doGroup.statistics.total_trips,
    outlierCount: doGroup.statistics.outlier_count,
    displayedTrips: filteredData.length,
    outliersOnly: outliersOnly,
  };
}

function getPointColor(outlierType) {
  const colors = {
    normal: "#4CAF50",
    below: "#FF9800",
    above: "#F44336",
  };
  return colors[outlierType] || colors.normal;
}

function getPointColors(dataPoints) {
  return dataPoints.map((point) => getPointColor(point.outlierType));
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  return hours * 60 + minutes + seconds / 60;
}

// ============================================
// GRAPH CONTROLS - FIXED
// ============================================

function updateGraphStats(graphData, doNumber) {
  const statsDiv = document.getElementById(`graph-stats-${doNumber}`);
  const legendDiv = document.getElementById(`graph-legend-${doNumber}`);

  if (statsDiv) {
    const displayInfo = graphData.outliersOnly
      ? `<span style="color: #ef4444; font-weight: 700;">Showing ${graphData.displayedTrips} irregular trips</span> of <strong>${graphData.totalTrips}</strong> total trips`
      : `Total Trips: <strong>${graphData.totalTrips}</strong>`;

    const outlierPercentage = ((graphData.outlierCount / graphData.totalTrips) * 100).toFixed(1);

    statsDiv.innerHTML = `
      <span>${displayInfo}</span>
      <span>•</span>
      <span>Irregular Trips: <strong style="color: #ef4444;">${graphData.outlierCount}</strong> (<strong>${outlierPercentage}%</strong>)</span>
      <span>•</span>
      <span>Min Range: <strong>${graphData.boundaries.iqrLow.toFixed(1)} min</strong></span>
      <span>•</span>
      <span>Max Range: <strong>${graphData.boundaries.iqrHigh.toFixed(1)} min</strong></span>
    `;
  }

  if (legendDiv) {
    legendDiv.innerHTML = `
      <div class="legend-item">
        <span class="legend-color" style="background: #4CAF50;"></span>
        <span>Normal Trip</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #FF9800;"></span>
        <span>Below Range (Fast)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: #F44336;"></span>
        <span>Above Range (Slow)</span>
      </div>
    `;
  }
}

function toggleOutliersForDO(doNumber) {
  console.log('Toggle called for DO:', doNumber);
  
  const checkbox = document.getElementById(`outliers-toggle-${doNumber}`);
  if (!checkbox) {
    console.error('Checkbox not found for DO:', doNumber);
    return;
  }
  
  const outliersOnly = checkbox.checked;
  console.log('Outliers only:', outliersOnly);

  // First try to get data from cache
  let doData = doDataCache[doNumber];
  
  // If not in cache, try to get from global currentReportData
  if (!doData) {
    console.log('Data not in cache, checking window.currentReportData');
    
    const currentReportData = window.currentReportData || window.parent.currentReportData;
    
    if (!currentReportData) {
      console.error('currentReportData not available');
      console.log('Available window properties:', Object.keys(window));
      return;
    }
    
    doData = currentReportData.data.find(
      (group) => group.DO_Number === doNumber
    );
    
    if (doData) {
      // Cache it for future use
      doDataCache[doNumber] = doData;
    }
  }

  if (doData) {
    console.log('Found DO data, rendering graph');
    renderGraph(doNumber, doData, outliersOnly);
    
    // Re-initialize scroll buttons after re-render
    setTimeout(() => {
      initScrollButtons(doNumber);
    }, 100);
  } else {
    console.error('DO data not found for:', doNumber);
  }
}

// ============================================
// SCROLL CONTROLS - ENHANCED
// ============================================

function initScrollButtons(doNumber) {
  const wrapper = document.getElementById(`graph-wrapper-${doNumber}`);
  const leftBtn = document.getElementById(`scroll-left-${doNumber}`);
  const rightBtn = document.getElementById(`scroll-right-${doNumber}`);

  if (!wrapper || !leftBtn || !rightBtn) return;

  const updateButtons = () => {
    const scrollLeft = wrapper.scrollLeft;
    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;

    leftBtn.disabled = scrollLeft <= 0;
    rightBtn.disabled = scrollLeft >= maxScroll - 1;
  };

  wrapper.addEventListener('scroll', updateButtons);
  
  // Initial button state update
  setTimeout(updateButtons, 100);
}

function scrollGraphLeft(doNumber) {
  const wrapper = document.getElementById(`graph-wrapper-${doNumber}`);
  if (wrapper) {
    const scrollAmount = wrapper.clientWidth * 0.75;
    wrapper.scrollBy({
      left: -scrollAmount,
      behavior: 'smooth'
    });
  }
}

function scrollGraphRight(doNumber) {
  const wrapper = document.getElementById(`graph-wrapper-${doNumber}`);
  if (wrapper) {
    const scrollAmount = wrapper.clientWidth * 0.75;
    wrapper.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  }
}

// ============================================
// CLEANUP
// ============================================

window.cleanupGraphView = function(doNumber) {
  if (chartInstances[doNumber]) {
    chartInstances[doNumber].destroy();
    delete chartInstances[doNumber];
  }
  
  if (selectedTripInfo[doNumber]) {
    delete selectedTripInfo[doNumber];
  }
  
  if (doDataCache[doNumber]) {
    delete doDataCache[doNumber];
  }
};