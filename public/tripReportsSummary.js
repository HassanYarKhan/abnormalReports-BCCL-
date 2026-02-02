// Trip Reports Summary Module with IQR-based Outlier Detection
const tripReportsSummary = {
  // Cache DOM elements
  elements: {
    dailySection: null,
    weeklySection: null,
    monthlySection: null,
    customSection: null,
  },

  // API base URL
  apiBaseUrl: `${serverURL}/api/summary`,

  // Store current date range for use in detail views
  currentDateRange: { from: null, to: null },

  // Cache for storing loaded data
  cache: {
    daily: null,
    weekly: null,
    monthly: null,
    custom: {},
  },

  // Track if initialized
  initialized: false,

  // Initialize the summary module
  init() {
    if (this.initialized) {
      console.log("Summary module already initialized");
      return;
    }

    console.log("Initializing summary module...");
    this.cacheDOMElements();
    this.setupEventListeners();

    // Load initial data immediately
    setTimeout(() => {
      this.loadInitialData();
    }, 100);

    this.initialized = true;
  },

  // Cache commonly used DOM elements
  cacheDOMElements() {
    this.elements.dailySection = document.getElementById("dailySummary");
    this.elements.weeklySection = document.getElementById("weeklySummary");
    this.elements.monthlySection = document.getElementById("monthlySummary");
    this.elements.customSection = document.getElementById("customSummary");

    console.log("DOM elements cached:", {
      daily: !!this.elements.dailySection,
      weekly: !!this.elements.weeklySection,
      monthly: !!this.elements.monthlySection,
      custom: !!this.elements.customSection,
    });
  },

  // Set up event listeners
  setupEventListeners() {
    // Add tab switching functionality
    document.querySelectorAll(".summary-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        // Remove active class from all tabs
        document.querySelectorAll(".summary-tab").forEach((t) => {
          t.classList.remove("active");
        });

        // Add active class to clicked tab
        tab.classList.add("active");

        // Hide all sections
        document.querySelectorAll(".summary-section").forEach((section) => {
          section.classList.remove("active");
        });

        // Show selected section
        const targetId = tab.getAttribute("data-target");
        document.getElementById(targetId).classList.add("active");

        // Load data for the selected tab if needed
        this.loadSectionData(targetId);
      });
    });
  },

  // Load data for specific section
  loadSectionData(sectionId) {
    switch (sectionId) {
      case "dailySummary":
        this.loadDailySummary();
        break;
      case "weeklySummary":
        this.loadWeeklySummary();
        break;
      case "monthlySummary":
        this.loadMonthlySummary();
        break;
      case "customSummary":
        // Custom summary is loaded via button click
        break;
    }
  },

  // Load initial summary data
  loadInitialData() {
    console.log("Loading initial daily summary...");
    this.loadDailySummary();
  },

  // Get date range for daily summary (today)
  getDailyDateRange() {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    return { from: dateStr, to: dateStr };
  },

  // Get date range for weekly summary (last 7 days)
  getWeeklyDateRange() {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return {
      from: weekAgo.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    };
  },

  // Get date range for monthly summary (last 30 days)
  getMonthlyDateRange() {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    return {
      from: monthAgo.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    };
  },

  // Load daily summary data
  async loadDailySummary() {
    const section = this.elements.dailySection;
    if (!section) {
      console.error("Daily section not found");
      return;
    }

    console.log("Loading daily summary...");

    // Check if data is already cached
    if (this.cache.daily) {
      console.log("Loading daily summary from cache");
      this.renderDailySummary(section, this.cache.daily);
      return;
    }

    this.showLoading(section);

    try {
      const { from, to } = this.getDailyDateRange();
      console.log("Date range:", from, "to", to);

      // Load all summary data in parallel
      const [totalSummary, vehicleSummary, doSummary] = await Promise.all([
        this.fetchTotalSummaryLatest(),
        this.fetchVehicleSummaryLatest(),
        this.fetchDOSummaryLatest(),
      ]);

      const data = {
        total: totalSummary,
        vehicles: vehicleSummary,
        dos: doSummary,
        dateRange: { from, to },
      };

      // Cache the data
      this.cache.daily = data;

      this.renderDailySummary(section, data);
      console.log("Daily summary loaded successfully");
    } catch (error) {
      console.error("Error loading daily summary:", error);
      this.showError(section, "Failed to load daily summary");
    }
  },

  // Load weekly summary data
  async loadWeeklySummary() {
    const section = this.elements.weeklySection;
    if (!section) return;

    // Check if data is already cached
    if (this.cache.weekly) {
      console.log("Loading weekly summary from cache");
      this.renderWeeklySummary(section, this.cache.weekly);
      return;
    }

    this.showLoading(section);

    try {
      const { from, to } = this.getWeeklyDateRange();

      const [totalSummary, vehicleSummary, doSummary] = await Promise.all([
        this.fetchTotalSummary(from, to),
        this.fetchVehicleSummary(from, to),
        this.fetchDOSummary(from, to),
      ]);

      const data = {
        total: totalSummary,
        vehicles: vehicleSummary,
        dos: doSummary,
        dateRange: { from, to },
      };

      // Cache the data
      this.cache.weekly = data;

      this.renderWeeklySummary(section, data);
    } catch (error) {
      console.error("Error loading weekly summary:", error);
      this.showError(section, "Failed to load weekly summary");
    }
  },

  // Load monthly summary data
  async loadMonthlySummary() {
    const section = this.elements.monthlySection;
    if (!section) return;

    // Check if data is already cached
    if (this.cache.monthly) {
      console.log("Loading monthly summary from cache");
      this.renderMonthlySummary(section, this.cache.monthly);
      return;
    }

    this.showLoading(section);

    try {
      const { from, to } = this.getMonthlyDateRange();

      const [totalSummary, vehicleSummary, doSummary] = await Promise.all([
        this.fetchTotalSummary(from, to),
        this.fetchVehicleSummary(from, to),
        this.fetchDOSummary(from, to),
      ]);

      const data = {
        total: totalSummary,
        vehicles: vehicleSummary,
        dos: doSummary,
        dateRange: { from, to },
      };

      // Cache the data
      this.cache.monthly = data;

      this.renderMonthlySummary(section, data);
    } catch (error) {
      console.error("Error loading monthly summary:", error);
      this.showError(section, "Failed to load monthly summary");
    }
  },

  // Fetch Latest Trips Summary
  async fetchTotalSummaryLatest() {
    const response = await fetch(
      `${this.apiBaseUrl}/trips/latest/totalViolations`,
    );
    if (!response.ok) throw new Error("Failed to fetch total summary");
    const result = await response.json();
    return result.data;
  },

  // Fetch vehicle-wise summary
  async fetchVehicleSummaryLatest() {
    const response = await fetch(`${this.apiBaseUrl}/trips/latest/vehicleWise`);
    if (!response.ok) throw new Error("Failed to fetch vehicle summary");
    const result = await response.json();
    return result.data;
  },

  // Fetch DO-wise summary
  async fetchDOSummaryLatest() {
    const response = await fetch(`${this.apiBaseUrl}/trips/latest/doWise`);
    if (!response.ok) throw new Error("Failed to fetch DO summary");
    const result = await response.json();
    console.log("DO Summary fetched:", result);
    return result.data;
  },

  // Fetch total trip violation summary
  async fetchTotalSummary(from, to) {
    const response = await fetch(
      `${this.apiBaseUrl}/totalTripViolationSummary?from=${from}&to=${to}`,
    );
    if (!response.ok) throw new Error("Failed to fetch total summary");
    const result = await response.json();
    return result.data;
  },

  // Fetch vehicle-wise summary
  async fetchVehicleSummary(from, to) {
    const response = await fetch(
      `${this.apiBaseUrl}/vehicleWiseTripSummary?from=${from}&to=${to}`,
    );
    if (!response.ok) throw new Error("Failed to fetch vehicle summary");
    const result = await response.json();
    return result.data;
  },

  // Fetch DO-wise summary
  async fetchDOSummary(from, to) {
    const response = await fetch(
      `${this.apiBaseUrl}/doWiseTripSummary?from=${from}&to=${to}`,
    );
    if (!response.ok) throw new Error("Failed to fetch DO summary");
    const result = await response.json();
    console.log("DO Summary fetched:", result);
    return result.data;
  },

  // Render daily summary section
  renderDailySummary(section, data) {
    this.currentDateRange = data.dateRange;
    this.renderSummarySection(section, data, "Recent Trips Summary");
  },

  // Render weekly summary section
  renderWeeklySummary(section, data) {
    this.currentDateRange = data.dateRange;
    this.renderSummarySection(section, data, "Weekly Summary (Last 7 Days)");
  },

  // Render monthly summary section
  renderMonthlySummary(section, data) {
    this.currentDateRange = data.dateRange;
    this.renderSummarySection(section, data, "Monthly Summary (Last 30 Days)");
  },

  // Generic render function for summary sections
  renderSummarySection(section, data, title, isCustomRange = false) {
    const content = section.querySelector(".summary-content");
    if (!content) return;

    // For custom range, preserve the search controls
    let customControls = "";
    if (isCustomRange) {
      customControls = `
        <div class="custom-range-controls" style="margin-bottom: 24px; padding: 20px; background: #35363a; border-radius: 8px;">
          <div style="display: flex; gap: 16px; align-items: end; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <label style="display: block; margin-bottom: 8px; color: #e3e3e3; font-weight: 500;">From Date</label>
              <input type="datetime-local" id="custom-from-date" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #444444; border-radius: 4px; background: #2b2c29; color: #e3e3e3;">
            </div>
            <div style="flex: 1; min-width: 200px;">
              <label style="display: block; margin-bottom: 8px; color: #e3e3e3; font-weight: 500;">To Date</label>
              <input type="datetime-local" id="custom-to-date" class="form-control" style="width: 100%; padding: 8px; border: 1px solid #444444; border-radius: 4px; background: #2b2c29; color: #e3e3e3;">
            </div>
            <div>
              <button onclick="loadCustomRangeSummary()" class="search-btn" style="padding: 10px 24px;">
                Search
              </button>
            </div>
          </div>
        </div>
      `;
    }

    const dateStr =
      section.id === "dailySummary"
        ? "Most Recent 1000 trips"
        : `${this.formatDate(data.dateRange.from)} - ${this.formatDate(
            data.dateRange.to,
          )}`;

    content.innerHTML = `
      ${customControls}
      <div class="summary-header" style="margin-bottom: 24px;">
        <h2 style="font-size: 24px; color: #7ec8ff; margin-bottom: 8px;">${title}</h2>
        <p style="color: #d8d8d8; font-size: 14px;">
            ${dateStr}
        </p>
      </div>

      ${this.renderOverallStats(data.total)}
      ${this.renderTopVehicles(data.vehicles)}
      ${this.renderTopDOs(data.dos)}
    `;
  },

  // Render overall statistics (Updated for IQR terminology)
  renderOverallStats(totalData) {
    if (!totalData) return "<p>No data available</p>";

    // Changed from Violation to Outlier terminology
    const outlierRate = totalData.Violation_Percentage || 0;
    const vehicleOutlierRate =
      totalData.Total_Unique_Vehicles > 0
        ? (
            (totalData.Vehicles_With_Violations /
              totalData.Total_Unique_Vehicles) *
            100
          ).toFixed(1)
        : 0;
    const doOutlierRate =
      totalData.Total_Unique_DOs > 0
        ? (
            (totalData.DOs_With_Violations / totalData.Total_Unique_DOs) *
            100
          ).toFixed(1)
        : 0;
    const unitOutlierRate =
      totalData.Total_Unique_Units > 0
        ? (
            (totalData.Units_With_Violations / totalData.Total_Unique_Units) *
            100
          ).toFixed(1)
        : 0;

    return `
  <div class="summary-stats">
    <!-- Card 1: Total Outliers (Full Width, Horizontal Layout) -->
    <div class="stat-card total-violations-card full-width">
      <div class="stat-card-header" style="display: flex; align-items: center; gap: 8px; justify-content: center;">
      <span>Trip Time Reports Overview (IQR-Based)</span>
      <div class="info-icon-wrapper">
        <svg class="info-icon" width="24px" height="24px" viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g id="SVGRepo_iconCarrier">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM12 17.75C12.4142 17.75 12.75 17.4142 12.75 17V11C12.75 10.5858 12.4142 10.25 12 10.25C11.5858 10.25 11.25 10.5858 11.25 11V17C11.25 17.4142 11.5858 17.75 12 17.75ZM12 7C12.5523 7 13 7.44772 13 8C13 8.55228 12.5523 9 12 9C11.4477 9 11 8.55228 11 8C11 7.44772 11.4477 7 12 7Z" fill="#2996f4"></path>
          </g>
        </svg>
        <div class="tooltip">
  <div class="tooltip-header">IQR-Based Irregular Trip Time Detection</div>
  <div class="tooltip-content">
    <p>We use a standard statistical method to automatically flag trips that took unusually short or long times compared to typical trips.</p>
    <div style="margin: 12px 0; padding: 10px; background: #f0f7ff; border-left: 3px solid #1976d2;">
      <strong>The Process:</strong>
    </div>
    
    <ul>
      <li>We analyze all trip times and find the typical range</li>
      <li>Trips that fall significantly outside this range are flagged as unusual</li>
    </ul>
    
    <div style="margin: 12px 0; padding: 10px; background: #fff3e0; border-left: 3px solid #ff9800;">
      <strong>What the Labels Mean:</strong>
    </div>
    
    <ul>
      <li><strong>↓ Below Range:</strong> Trip was much faster than usual (may indicate shortcuts or safety concerns)</li>
      <li><strong> Normal:</strong> Trip time matches typical patterns</li>
      <li><strong>↑ Above Range:</strong> Trip took much longer than usual (may indicate delays or issues)</li>
    </ul>
    
  </div>
</div>
      </div>
    </div>
      <div class="stat-card-body total-violation-stat-card horizontal-layout">
        <div class="stat-section">
          <span class="stat-label">Irregular Trips</span>
          <span class="stat-number large error">${totalData.Total_Violations || 0}</span>
        </div>
        <div class="stat-section">
          <span class="stat-label">Total Trips</span>
          <span class="stat-number primary">${totalData.Total_Trips || 0}</span>
        </div>
        <div class="stat-section">
          <span class="stat-label">Normal Trips</span>
          <span class="stat-number success">${totalData.Normal_Trips || 0}</span>
        </div>
        <div class="stat-section">
          <span class="stat-label">Trip Time Deviation Rate</span>
          <span class="stat-number error">${outlierRate}%</span>
        </div>
      </div>
    </div>
    <!-- Row 2: 3 Cards Below -->
    <div class="stat-card">
      <div class="stat-card-header">Vehicles</div>
      <div class="stat-card-body">
        <div class="stat-row">
          <span class="stat-label">Vehicles with Irregular Trips</span>
          <span class="stat-number large error">${
            totalData.Vehicles_With_Violations || 0
          }</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Unique Vehicles</span>
          <span class="stat-number primary">${
            totalData.Total_Unique_Vehicles || 0
          }</span>
        </div>
        <!--div class="stat-row">
          <span class="stat-label">Outlier Rate</span>
          <span class="stat-number error">${vehicleOutlierRate}%</span>
        </div -->
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-card-header">Delivery Orders</div>
      <div class="stat-card-body">
        <div class="stat-row">
          <span class="stat-label">DOs with Irregular Trips</span>
          <span class="stat-number large error">${
            totalData.DOs_With_Violations || 0
          }</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Total Unique DOs</span>
          <span class="stat-number primary">${
            totalData.Total_Unique_DOs || 0
          }</span>
        </div>
        <!--div class="stat-row">
          <span class="stat-label">Outlier Rate</span>
          <span class="stat-number error">${doOutlierRate}%</span>
        </div -->
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-card-header">Units</div>
      <div class="stat-card-body">
        <div class="stat-row">
          <span class="stat-label">Units with Irregular Trips</span>
          <span class="stat-number large error">${
            totalData.Units_With_Violations || 0
          }</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Total Unique Units</span>
          <span class="stat-number primary">${
            totalData.Total_Unique_Units || 0
          }</span>
        </div>
        <!--div class="stat-row">
          <span class="stat-label">Outlier Rate</span>
          <span class="stat-number error">${unitOutlierRate}%</span>
        </div -->
      </div>
    </div>

  </div>
`;
  },

  // Render top vehicles table (Updated terminology)
  renderTopVehicles(vehicleData) {
    if (!vehicleData || vehicleData.length === 0) {
      return `
        <div class="summary-table" style="margin-top: 24px;">
          <h3 style="font-size: 18px; color: #e3e3e3; margin-bottom: 12px; padding: 12px;">Top Vehicles by Irregular Trips</h3>
          <p style="color: #d8d8d8; padding: 20px; text-align: center;">No trip deviations found</p>
        </div>
      `;
    }

    return `
      <div class="summary-table" style="margin-top: 24px;">
        <h3 style="font-size: 18px; color: #e3e3e3; margin-bottom: 12px; padding: 12px;">Top Vehicles by Irregular Trips</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: left; color: #e3e3e3;">Vehicle Number</th>
              <th style="text-align: center; color: #e3e3e3;">Unit</th>
              <th style="text-align: center; color: #e3e3e3;">DO Number</th>
              <th style="text-align: center; color: #e3e3e3;">Irregular Trips</th>
              <th style="text-align: left; color: #e3e3e3;">Source</th>
              <th style="text-align: left; color: #e3e3e3;">Destination</th>
              <th style="text-align: center; color: #e3e3e3;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${vehicleData
              .map(
                (vehicle) => `
              <tr>
                <td style="text-align: left; font-weight: 500; color: #e3e3e3;">${
                  vehicle.Vehicle_Number || "N/A"
                }</td>
                <td style="text-align: center; color: #e3e3e3;">${vehicle.Unit || "N/A"}</td>
                <td style="text-align: center; color: #e3e3e3;">${
                  vehicle.DO_Number || "N/A"
                }</td>
                <td style="text-align: center; color: #d32f2f; font-weight: 500;">${
                  vehicle.Total_Violations || 0
                }</td>
                <td style="text-align: left; font-size: 12px; color: #e3e3e3;">
                  <div>${vehicle.Source_Area || "N/A"}</div>
                  <div style="color: #d8d8d8;">WB: ${
                    vehicle.Source_Weighbridge || "N/A"
                  }</div>
                </td>
                <td style="text-align: left; font-size: 12px; color: #e3e3e3;">
                  <div>${vehicle.Destination_Area || "N/A"}</div>
                  <div style="color: #d8d8d8;">WB: ${
                    vehicle.Destination_Weighbridge || "N/A"
                  }</div>
                </td>
                <td style="text-align: center;">
                  <div 
                    onclick="tripReportsSummary.viewVehicleDODetails(
                      '${vehicle.DO_Number}', 
                      '${vehicle.Vehicle_Number}', 
                      '${vehicle.Unit}',
                      '${vehicle.Source_Area}',
                      tripReportsSummary.currentDateRange
                    )"
                    style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer;"
                    title="View Records"
                  >
                    <svg 
                      fill="#7ec8ff" 
                      width="20px" 
                      height="20px" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g id="View_Table" data-name="View Table">
                        <path d="M18.44,3.06H5.56a2.507,2.507,0,0,0-2.5,2.5V18.44a2.507,2.507,0,0,0,2.5,2.5H18.44a2.514,2.514,0,0,0,2.5-2.5V5.56A2.514,2.514,0,0,0,18.44,3.06ZM8.71,19.94H5.56a1.5,1.5,0,0,1-1.5-1.5V15.33H8.71Zm0-5.61H4.06V9.67H8.71Zm0-5.66H4.06V5.56a1.5,1.5,0,0,1,1.5-1.5H8.71Zm11.23,9.77a1.511,1.511,0,0,1-1.5,1.5H9.71V15.33H19.94Zm0-4.11H9.71V9.67H19.94Zm0-5.66H9.71V4.06h8.73a1.511,1.511,0,0,1,1.5,1.5Z"></path>
                      </g>
                    </svg>
                    <span style="font-weight: 300; font-style: italic; font-size: 12px; color: #7ec8ff;">
                      View records
                    </span>
                  </div>
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  },

  // Render top DOs table (Updated for IQR - removed Avg_Deviation_Percent, added IQR ranges)
  renderTopDOs(doData) {
    if (!doData || doData.length === 0) {
      return `
        <div class="summary-table" style="margin-top: 24px;">
          <h3 style="font-size: 18px; color: #e3e3e3; margin-bottom: 12px; padding: 12px;">Top Delivery Orders by Irregular Trip Times</h3>
          <p style="color: #d8d8d8; padding: 20px; text-align: center;">No trip time deviations found</p>
        </div>
      `;
    }

    return `
      <div class="summary-table" style="margin-top: 24px;">
        <h3 style="font-size: 18px; color: #e3e3e3; margin-bottom: 12px; padding: 12px;">Top Delivery Orders by Irregular Trip Times</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: left; color: #e3e3e3;">DO Number</th>
              <th style="text-align: center; color: #e3e3e3;">Unit</th>
              <th style="text-align: center; color: #e3e3e3;">Irregular Trips</th>
              <th style="text-align: center; color: #e3e3e3;"># Vehicles</th>
              <th style="text-align: left; color: #e3e3e3;">Source</th>
              <th style="text-align: left; color: #e3e3e3;">Destination</th>
              <th style="text-align: center; color: #e3e3e3;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${doData
              .map(
                (doItem) => `
              <tr>
                <td style="text-align: left; font-weight: 500; color: #e3e3e3;">${
                  doItem.DO_Number || "N/A"
                }</td>
                <td style="text-align: center; color: #e3e3e3;">${
                  doItem.Source_Unit || "N/A"
                }</td>
                <td style="text-align: center; color: #d32f2f; font-weight: 500;">${
                  doItem.Total_Violations || 0
                }</td>
                <td style="text-align: center; color: #e3e3e3;">${
                  doItem.Unique_Vehicle_Count || 0
                }</td>
                <td style="text-align: left; font-size: 12px; color: #e3e3e3;">
                  <div>${doItem.Source_Area || "N/A"}</div>
                  <div style="color: #d8d8d8;">WB: ${
                    doItem.Source_Weighbridge || "N/A"
                  }</div>
                </td>
                <td style="text-align: left; font-size: 12px; color: #e3e3e3;">
                  <div>${doItem.Destination_Area || "N/A"}</div>
                  <div style="color: #d8d8d8;">WB: ${
                    doItem.Destination_Weighbridge || "N/A"
                  }</div>
                </td>
                <td style="text-align: center;">
                  <div 
                    onclick="tripReportsSummary.viewDODetails(
                      '${doItem.DO_Number}', 
                      '${doItem.Source_Unit}',
                      '${doItem.Source_Area}',
                      tripReportsSummary.currentDateRange
                    )"
                    style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer;"
                    title="View Records"
                  >
                    <svg 
                      fill="#7ec8ff" 
                      width="20px" 
                      height="20px" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g id="View_Table" data-name="View Table">
                        <path d="M18.44,3.06H5.56a2.507,2.507,0,0,0-2.5,2.5V18.44a2.507,2.507,0,0,0,2.5,2.5H18.44a2.514,2.514,0,0,0,2.5-2.5V5.56A2.514,2.514,0,0,0,18.44,3.06ZM8.71,19.94H5.56a1.5,1.5,0,0,1-1.5-1.5V15.33H8.71Zm0-5.61H4.06V9.67H8.71Zm0-5.66H4.06V5.56a1.5,1.5,0,0,1,1.5-1.5H8.71Zm11.23,9.77a1.511,1.511,0,0,1-1.5,1.5H9.71V15.33H19.94Zm0-4.11H9.71V9.67H19.94Zm0-5.66H9.71V4.06h8.73a1.511,1.511,0,0,1,1.5,1.5Z"></path>
                      </g>
                    </svg>
                    <span style="font-weight: 300; font-style: italic; font-size: 12px; color: #7ec8ff;">
                      View records
                    </span>
                  </div>
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  },

  // Show loading state
  showLoading(section) {
    const content = section.querySelector(".summary-content");
    if (content) {
      content.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div class="spinner" style="margin: 0 auto 16px;"></div>
          <p style="color: #757575;">Loading summary data...</p>
        </div>
      `;
    }
  },

  // Show error state
  showError(section, message) {
    const content = section.querySelector(".summary-content");
    if (content) {
      content.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <p style="color: #d32f2f; font-size: 16px; margin-bottom: 8px;">Error</p>
          <p style="color: #757575;">${message}</p>
        </div>
      `;
    }
  },

  // Helper function to format dates
  formatDate(date) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  },

  // Clear cache (can be called to refresh data)
  clearCache() {
    this.cache = {
      daily: null,
      weekly: null,
      monthly: null,
      custom: {},
    };
    console.log("Cache cleared");
  },

  // Refresh current tab data
  async refreshCurrentTab() {
    const activeTab = document.querySelector(".summary-tab.active");
    if (!activeTab) return;

    const targetId = activeTab.getAttribute("data-target");

    // Clear cache for the current tab
    switch (targetId) {
      case "dailySummary":
        this.cache.daily = null;
        break;
      case "weeklySummary":
        this.cache.weekly = null;
        break;
      case "monthlySummary":
        this.cache.monthly = null;
        break;
    }

    // Reload the data
    this.loadSectionData(targetId);
  },

  // Function to view DO details (for DO-wise violations)
  async viewDODetails(doNumber, unitCode, sourceArea, dateRange) {
    console.log("=== VIEW DO DETAILS CALLED ===");
    console.log("Input DO Number:", doNumber, "Type:", typeof doNumber);
    console.log("Input Unit Code:", unitCode, "Type:", typeof unitCode);
    console.log("Input Source Area:", sourceArea, "Type:", typeof sourceArea);
    console.log("Input Date Range:", dateRange);

    if (!doNumber || doNumber === "N/A") {
      alert("Invalid DO Number");
      return;
    }

    try {
      // Switch to Unit-Wise Reports tab
      switchTab("do-wise");

      // Show loading state
      const tableBody = document.getElementById("trip-data");
      const reportHeader = document.getElementById("trip-report-header");

      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="10" class="no-data">Loading DO-wise trip details...</td></tr>';
      }
      if (reportHeader) {
        reportHeader.style.display = "none";
      }

      // Extract unit code number
      const cleanUnitCode = unitCode.split(" - ")[0].trim();
      console.log("Clean Unit Code:", cleanUnitCode);

      // Extract area code from source area (e.g., "CO13" from "CO13 - Piparwar")
      const areaCode = this.extractAreaCode(sourceArea);
      console.log("Extracted Area Code:", areaCode);

      // Set the search filters in the UI
      await this.setSearchFilters(cleanUnitCode, areaCode, dateRange);

      // Fetch data from backend using correct endpoint
      const requestBody = {
        unitCode: cleanUnitCode,
        from: dateRange.from,
        to: dateRange.to,
      };
      console.log("API Request Body:", requestBody);

      const response = await fetch(
        `${serverURL}/api/reports/getTripTimeReportsByUnitCode`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("=== API RESPONSE ===");
      console.log("Full Response:", result);

      if (result.data && result.data.length > 0) {
        console.log("First DO Group:", result.data[0]);
        console.log("DO_Number:", result.data[0].DO_Number);
      }

      // Filter for the specific DO
      const cleanDONumber = String(doNumber).trim();
      const filteredDOGroups = result.data.filter(
        (doGroup) => String(doGroup.DO_Number).trim() === cleanDONumber,
      );

      console.log("Filtered DO Groups Count:", filteredDOGroups.length);

      if (filteredDOGroups.length > 0) {
        // Create the data structure expected by populateTable
        const filteredData = {
          data: filteredDOGroups,
          summary: {
            totalTrips: filteredDOGroups.reduce(
              (sum, dg) => sum + dg.statistics.total_trips,
              0,
            ),
            uniqueDOCount: filteredDOGroups.length,
            uniqueVehicleCount: new Set(
              filteredDOGroups.flatMap((dg) =>
                dg.vehiclesData.map((v) => v.Vehicle_Number),
              ),
            ).size,
            totalOutliers: filteredDOGroups.reduce(
              (sum, dg) => sum + dg.statistics.outlier_count,
              0,
            ),
            totalNormalTrips: filteredDOGroups.reduce(
              (sum, dg) =>
                sum + (dg.statistics.total_trips - dg.statistics.outlier_count),
              0,
            ),
            outlierPercentage: (
              (filteredDOGroups.reduce(
                (sum, dg) => sum + dg.statistics.outlier_count,
                0,
              ) /
                filteredDOGroups.reduce(
                  (sum, dg) => sum + dg.statistics.total_trips,
                  0,
                )) *
              100
            ).toFixed(2),
          },
        };

        console.log("=== CALLING populateTable ===");
        console.log("Data Structure:", filteredData);

        // Render the data using the existing function
        if (typeof populateTable === "function") {
          populateTable(filteredData);
          console.log("populateTable called successfully");
        } else {
          console.error("populateTable function not found");
          if (tableBody) {
            tableBody.innerHTML =
              '<tr><td colspan="10" class="no-data">Error: populateTable function not available</td></tr>';
          }
        }
      } else {
        console.log("=== NO TRIPS FOUND ===");
        console.log("DO Number searched:", doNumber);
        if (tableBody) {
          tableBody.innerHTML =
            '<tr><td colspan="10" class="no-data">No trips found for this DO</td></tr>';
        }
      }
    } catch (error) {
      console.error("=== ERROR ===");
      console.error("Error loading DO details:", error);
      const tableBody = document.getElementById("trip-data");
      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="10" class="no-data">Error loading DO details. Please try again.</td></tr>';
      }
    }
  },

  // Function to view vehicle + DO details (for vehicle-wise violations)
  async viewVehicleDODetails(
    doNumber,
    vehicleNumber,
    unitCode,
    sourceArea,
    dateRange,
  ) {
    if (
      !doNumber ||
      doNumber === "N/A" ||
      !vehicleNumber ||
      vehicleNumber === "N/A"
    ) {
      alert("Invalid DO Number or Vehicle Number");
      return;
    }

    try {
      // Switch to Unit-Wise Reports tab
      switchTab("do-wise");

      // Show loading state
      const tableBody = document.getElementById("trip-data");
      const reportHeader = document.getElementById("trip-report-header");

      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="10" class="no-data">Loading vehicle-wise trip details...</td></tr>';
      }
      if (reportHeader) {
        reportHeader.style.display = "none";
      }

      // Extract only the unit code number
      const cleanUnitCode = unitCode.split(" ")[0];

      // Extract area code from source area
      const areaCode = this.extractAreaCode(sourceArea);
      console.log("Extracted Area Code:", areaCode);

      // Set the search filters in the UI
      await this.setSearchFilters(cleanUnitCode, areaCode, dateRange);

      // Fetch data from backend
      const response = await fetch(
        `${serverURL}/api/reports/getTripTimeReportsByUnitCode`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            unitCode: cleanUnitCode,
            from: dateRange.from,
            to: dateRange.to,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Vehicle DO Details Response:", result);

      // Filter for specific DO and vehicle
      const cleanDONumber = String(doNumber).trim();
      const filteredDOGroups = result.data.filter((doGroup) => {
        if (String(doGroup.DO_Number).trim() !== cleanDONumber) return false;

        // Filter vehicle data within this DO group
        doGroup.vehiclesData = doGroup.vehiclesData.filter(
          (v) => v.Vehicle_Number === vehicleNumber,
        );

        return doGroup.vehiclesData.length > 0;
      });

      console.log("Filtered DO groups:", filteredDOGroups);

      if (filteredDOGroups.length > 0) {
        // Recalculate statistics for filtered data
        filteredDOGroups.forEach((doGroup) => {
          const outliers = doGroup.vehiclesData.filter(
            (v) => v.Is_Outlier,
          ).length;
          doGroup.statistics.total_trips = doGroup.vehiclesData.length;
          doGroup.statistics.outlier_count = outliers;
        });

        // Create the data structure expected by populateTable
        const filteredData = {
          data: filteredDOGroups,
          summary: {
            totalTrips: filteredDOGroups.reduce(
              (sum, dg) => sum + dg.statistics.total_trips,
              0,
            ),
            uniqueDOCount: filteredDOGroups.length,
            uniqueVehicleCount: 1, // Only one vehicle
            totalOutliers: filteredDOGroups.reduce(
              (sum, dg) => sum + dg.statistics.outlier_count,
              0,
            ),
            totalNormalTrips: filteredDOGroups.reduce(
              (sum, dg) =>
                sum + (dg.statistics.total_trips - dg.statistics.outlier_count),
              0,
            ),
            outlierPercentage: (
              (filteredDOGroups.reduce(
                (sum, dg) => sum + dg.statistics.outlier_count,
                0,
              ) /
                filteredDOGroups.reduce(
                  (sum, dg) => sum + dg.statistics.total_trips,
                  0,
                )) *
              100
            ).toFixed(2),
          },
        };

        console.log("Data structure for populateTable:", filteredData);

        // Render the data using the existing function
        if (typeof populateTable === "function") {
          populateTable(filteredData);
        } else {
          console.error("populateTable function not found");
          if (tableBody) {
            tableBody.innerHTML =
              '<tr><td colspan="10" class="no-data">Error: populateTable function not available</td></tr>';
          }
        }
      } else {
        if (tableBody) {
          tableBody.innerHTML =
            '<tr><td colspan="10" class="no-data">No trips found for this vehicle and DO combination</td></tr>';
        }
      }
    } catch (error) {
      console.error("Error loading vehicle DO details:", error);
      const tableBody = document.getElementById("trip-data");
      if (tableBody) {
        tableBody.innerHTML =
          '<tr><td colspan="10" class="no-data">Error loading details. Please try again.</td></tr>';
      }
    }
  },

  // Helper function to extract area code from source/destination area string
  extractAreaCode(areaString) {
    if (!areaString || areaString === "N/A") {
      return null;
    }
    // Extract area code before " - " (e.g., "CO13" from "CO13 - Piparwar")
    const parts = areaString.split(" - ");
    return parts[0].trim();
  },

  // Helper function to set search filters in the DO-wise reports tab
  async setSearchFilters(unitCode, areaCode, dateRange) {
    try {
      console.log("Setting search filters...", {
        unitCode,
        areaCode,
        dateRange,
      });

      const areaSelect = document.getElementById("do-area-select");
      const unitSelect = document.getElementById("do-unit-select");
      const fromDateInput = document.getElementById("from-date");
      const toDateInput = document.getElementById("to-date");

      if (!areaSelect || !unitSelect || !fromDateInput || !toDateInput) {
        console.error("Search filter elements not found");
        return;
      }

      // Set the area code directly if available
      if (areaCode) {
        areaSelect.value = areaCode;
        console.log("Area set to:", areaCode);

        // Fetch and populate units for this area
        const response = await fetch(
          `${serverURL}/api/weighbridges/getUnitFromAreaCode?areaCode=${areaCode}`,
        );
        const data = await response.json();

        if (data.units && Array.isArray(data.units)) {
          // Clear and populate unit select
          unitSelect.innerHTML = '<option value="">Select Unit</option>';
          data.units.forEach((unit) => {
            const option = document.createElement("option");
            option.value = unit.unitcode;
            option.textContent = unit.unitname;
            unitSelect.appendChild(option);
          });

          // Set the unit
          unitSelect.value = unitCode;
          console.log("Unit set to:", unitCode);
        }
      } else {
        console.warn("Area code not available, will need to search for it");
        // Fallback: Find the area by iterating
        let foundAreaCode = null;
        const areaOptions = Array.from(areaSelect.options);

        for (const option of areaOptions) {
          if (option.value === "default") continue;

          try {
            const response = await fetch(
              `${serverURL}/api/weighbridges/getUnitFromAreaCode?areaCode=${option.value}`,
            );
            const data = await response.json();

            if (data.units && Array.isArray(data.units)) {
              const unitExists = data.units.some(
                (unit) => unit.unitcode === unitCode,
              );
              if (unitExists) {
                foundAreaCode = option.value;
                break;
              }
            }
          } catch (error) {
            console.error(`Error checking area ${option.value}:`, error);
          }
        }

        if (foundAreaCode) {
          areaSelect.value = foundAreaCode;
          console.log("Area found and set to:", foundAreaCode);

          const response = await fetch(
            `${serverURL}/api/weighbridges/getUnitFromAreaCode?areaCode=${foundAreaCode}`,
          );
          const data = await response.json();

          if (data.units && Array.isArray(data.units)) {
            unitSelect.innerHTML = '<option value="">Select Unit</option>';
            data.units.forEach((unit) => {
              const option = document.createElement("option");
              option.value = unit.unitcode;
              option.textContent = unit.unitname;
              unitSelect.appendChild(option);
            });

            unitSelect.value = unitCode;
            console.log("Unit set to:", unitCode);
          }
        }
      }

      // Set the date range
      if (dateRange.from) {
        fromDateInput.value = `${dateRange.from}T00:00`;
        console.log("From date set to:", fromDateInput.value);
      }
      if (dateRange.to) {
        toDateInput.value = `${dateRange.to}T23:59`;
        console.log("To date set to:", toDateInput.value);
      }

      console.log("Search filters set successfully");
    } catch (error) {
      console.error("Error setting search filters:", error);
    }
  },
};

// Load custom range summary (global function for button)
async function loadCustomRangeSummary() {
  const fromDate = document.getElementById("custom-from-date").value;
  const toDate = document.getElementById("custom-to-date").value;

  if (!fromDate || !toDate) {
    alert("Please select both from and to dates");
    return;
  }

  let from = fromDate.split("T")[0];
  let to = toDate.split("T")[0];

  // Check if from and to dates are the same
  if (from === to) {
    alert(
      "From and To dates cannot be the same. Please select a range of at least 2 days.",
    );
    return;
  }

  // Ensure at least 2 days of data
  const fromDateObj = new Date(from);
  const toDateObj = new Date(to);
  const daysDifference = Math.floor(
    (toDateObj - fromDateObj) / (1000 * 60 * 60 * 24),
  );

  if (daysDifference < 1) {
    // If less than 2 days, adjust 'from' to be 1 day before 'to'
    fromDateObj.setTime(toDateObj.getTime() - 24 * 60 * 60 * 1000);
    from = fromDateObj.toISOString().split("T")[0];
  }

  // Create cache key for custom range
  const cacheKey = `${from}_${to}`;

  const section = document.getElementById("customSummary");

  // Check if this custom range is already cached
  if (tripReportsSummary.cache.custom[cacheKey]) {
    console.log("Loading custom summary from cache");
    tripReportsSummary.currentDateRange = { from, to };
    tripReportsSummary.renderSummarySection(
      section,
      tripReportsSummary.cache.custom[cacheKey],
      "Custom Range Summary",
      true,
    );
    return;
  }

  tripReportsSummary.showLoading(section);

  try {
    const [totalSummary, vehicleSummary, doSummary] = await Promise.all([
      tripReportsSummary.fetchTotalSummary(from, to),
      tripReportsSummary.fetchVehicleSummary(from, to),
      tripReportsSummary.fetchDOSummary(from, to),
    ]);

    const data = {
      total: totalSummary,
      vehicles: vehicleSummary,
      dos: doSummary,
      dateRange: { from, to },
    };

    // Cache the custom range data
    tripReportsSummary.cache.custom[cacheKey] = data;

    // Store the custom date range
    tripReportsSummary.currentDateRange = { from, to };

    tripReportsSummary.renderSummarySection(
      section,
      data,
      "Custom Range Summary",
      true,
    );
  } catch (error) {
    console.error("Error loading custom range summary:", error);
    tripReportsSummary.showError(
      section,
      "Failed to load custom range summary",
    );
  }
}

// Initialize the module when the document is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded - Initializing tripReportsSummary");
  tripReportsSummary.init();
});

// Expose to window for debugging
window.tripReportsSummary = tripReportsSummary;
