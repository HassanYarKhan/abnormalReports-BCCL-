// exportTripReport.js - PDF Export Utility for Irregular Trip Duration Reports
(function initTripExportModule() {
    function attach() {
        const jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDFLib) {
            console.error('jsPDF library not found; retrying...');
            setTimeout(attach, 200);
            return;
        }
        const jsPDF = jsPDFLib;

        // ===== HELPER FUNCTIONS =====

        // Format datetime for display (DD-MM-YYYY HH:MM)
        function formatDateTime(dateStr) {
            if (!dateStr) return '';
            
            // Handle date-only inputs (YYYY-MM-DD)
            if (dateStr.length === 10 && !dateStr.includes('T')) {
                const [y, m, d] = dateStr.split('-');
                return `${d}-${m}-${y}`;
            }
            
            // Handle datetime inputs
            const [datePart, timePart] = dateStr.split('T');
            if (!datePart) return dateStr;
            
            const [y, m, d] = datePart.split('-');
            const timeDisplay = timePart ? timePart.substring(0, 5) : '00:00';
            return `${d}-${m}-${y} ${timeDisplay}`;
        }

        // Sanitize text (remove special characters, extra spaces)
        function sanitizeText(text) {
            let cleaned = (text || '')
                .replace(/^[▶▸►▼▽⯆⯈▾›❯➤➢➣⏵⏷]\s*/g, '') // Remove accordion icons
                .replace(/\u200B/g, '') // Remove zero-width spaces
                .replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '') // Remove unicode spaces
                .replace(/\s+/g, ' ')
                .trim();
            
            // Replace Unicode arrows with ASCII symbols
            cleaned = cleaned
                .replace(/↑/g, '^')
                .replace(/↓/g, 'v')
                .replace(/↔/g, '~');
            
            return cleaned;
        }

        // Helper function to convert time string to minutes
        function timeToMinutes(timeStr) {
            if (!timeStr) return 0;
            const parts = timeStr.split(':');
            const hours = parseInt(parts[0], 10) || 0;
            const minutes = parseInt(parts[1], 10) || 0;
            const seconds = parseInt(parts[2], 10) || 0;
            return hours * 60 + minutes + seconds / 60;
        }

        // Create base document with header
        function createBaseDoc(title, subtitle) {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'pt',
                format: 'a3'
            });
            const pageWidth = doc.internal.pageSize.getWidth();

            // Draw decorative top bar
            doc.setFillColor(25, 118, 210);
            doc.rect(0, 0, pageWidth, 8, 'F');

            // Title with better spacing
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.setTextColor(25, 118, 210);
            doc.text(title, 40, 35);

            // Subtitle
            if (subtitle) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
                doc.setTextColor(90, 90, 90);
                doc.text(subtitle, 40, 52);
            }

            // Generated timestamp
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(130, 130, 130);
            doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 40, 64);

            return doc;
        }

        // Show/hide loading state on button
        function setLoading(btn, loading) {
            if (!btn) return;
            if (loading) {
                btn.dataset.originalText = btn.textContent;
                btn.textContent = 'Exporting...';
                btn.disabled = true;
                btn.classList.add('export-loading');
            } else {
                btn.textContent = btn.dataset.originalText || 'Export PDF';
                btn.disabled = false;
                btn.classList.remove('export-loading');
            }
        }

        // ===== UNIT-WISE TRIP REPORT EXPORT =====

        function exportTripReportPDF() {
            const btn = event?.target;
            setLoading(btn, true);

            try {
                // Check if we have data loaded
                if (!window.currentReportData || !window.currentReportData.data) {
                    alert('No data available. Please search for trip reports first.');
                    setLoading(btn, false);
                    return;
                }

                const reportData = window.currentReportData;

                // Define table headers - consolidated source and destination
                const headers = [
                    'Vehicle Number',
                    'Source',
                    'Destination',
                    'Trip Start',
                    'Trip End',
                    'Trip Duration',
                    'Allowed Range',
                    'Status'
                ];

                console.log('Headers:', headers);

                // Extract all rows from the data
                const allRows = [];
                reportData.data.forEach((doGroup) => {
                    const { iqr_low, iqr_high, vehiclesData } = doGroup;

                    if (!vehiclesData || vehiclesData.length === 0) {
                        return;
                    }

                    vehiclesData.forEach((trip) => {
                        const tripMinutes = trip.Trip_Time_Minutes || timeToMinutes(trip.Trip_Time);
                        const iqrLowMinutes = timeToMinutes(iqr_low);
                        const iqrHighMinutes = timeToMinutes(iqr_high);

                        let status = 'Normal';
                        if (trip.Is_Outlier) {
                            if (tripMinutes < iqrLowMinutes) {
                                status = 'Below Range v';
                            } else if (tripMinutes > iqrHighMinutes) {
                                status = 'Above Range ^';
                            }
                        }

                        // Consolidate source information with WB prefix
                        const sourceInfo = [
                            trip.Src_WB_Code ? `WB ${trip.Src_WB_Code}` : '-',
                            trip.Src_Unit || '-',
                            trip.Src_Area || '-'
                        ].filter(x => x !== '-').join('\n');

                        // Consolidate destination information with WB prefix
                        const destInfo = [
                            trip.Dest_WB_Code ? `WB ${trip.Dest_WB_Code}` : '-',
                            trip.Dest_Unit || '-',
                            trip.Dest_Area || '-'
                        ].filter(x => x !== '-').join('\n');

                        const row = [
                            trip.Vehicle_Number || '-',
                            sourceInfo || '-',
                            destInfo || '-',
                            formatDateTime(trip.Trip_Start_Time) || '-',
                            formatDateTime(trip.Trip_End_Time) || '-',
                            trip.Trip_Time || '-',
                            `${iqr_low} - ${iqr_high}`,
                            status
                        ];

                        allRows.push(row);
                    });
                });

                console.log('Total extracted rows:', allRows.length);
                console.log('Sample rows:', allRows.slice(0, 3));

                // Get report metadata
                const areaSelect = document.getElementById('do-area-select');
                const unitSelect = document.getElementById('do-unit-select');
                const areaLabel = areaSelect ? areaSelect.options[areaSelect.selectedIndex].text : 'Unknown Area';
                const unitLabel = unitSelect ? unitSelect.options[unitSelect.selectedIndex].text : 'Unknown Unit';
                const fromDate = document.getElementById('from-date')?.value;
                const toDate = document.getElementById('to-date')?.value;
                const fromFormatted = formatDateTime(fromDate);
                const toFormatted = formatDateTime(toDate);

                // Get summary statistics
                const totalTrips = document.getElementById('totalTrips')?.textContent || '0';
                const uniqueDOs = document.getElementById('uniqueDOs')?.textContent || '0';
                const uniqueVehicles = document.getElementById('uniqueVehicles')?.textContent || '0';
                const totalOutliers = document.getElementById('totalOutliers')?.textContent || '0';
                const outlierPercentage = document.getElementById('outlierPercentage')?.textContent || '0%';

                // Create document
                const title = 'Irregular Trip Duration Reports - Unit-Wise';
                const subtitle = `${areaLabel} - ${unitLabel} | ${fromFormatted} to ${toFormatted}`;
                const doc = createBaseDoc(title, subtitle);

                // Add summary statistics with improved layout
                const pageWidth = doc.internal.pageSize.getWidth();
                const statBoxHeight = 20;
                const statBoxWidth = (pageWidth - 80) / 5;
                const startY = 95;
                const statBoxStartX = 40;

                // Stats data
                const stats = [
                    { label: 'Total Trips', value: totalTrips },
                    { label: 'Unique DOs', value: uniqueDOs },
                    { label: 'Unique Vehicles', value: uniqueVehicles },
                    { label: 'Total Outliers', value: totalOutliers },
                    { label: 'Outlier Rate', value: outlierPercentage }
                ];

                // Draw stat boxes with horizontal label-value layout
                stats.forEach((stat, index) => {
                    const xPos = statBoxStartX + index * statBoxWidth;

                    // Draw white background box with subtle border
                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(220, 220, 220);
                    doc.setLineWidth(0.5);
                    doc.rect(xPos, startY, statBoxWidth - 8, statBoxHeight, 'FD');

                    // Draw label on the left
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9.5);
                    doc.setTextColor(100, 100, 100);
                    doc.text(stat.label, xPos + 6, startY + 12, { maxWidth: statBoxWidth - 50 });

                    // Draw value on the right (aligned to right side of box)
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(13);
                    doc.setTextColor(40, 40, 40);
                    const valueWidth = doc.getTextWidth(String(stat.value));
                    doc.text(String(stat.value), xPos + statBoxWidth - 14 - valueWidth, startY + 13);
                });

                // Column styles - auto-calculate widths to fit page
                const margins = 60;
                const availableWidth = pageWidth - margins;
                const columnStyles = {};
                const columnWidths = [];

                // Assign relative widths based on content type
                headers.forEach((header, i) => {
                    let width;
                    if (/vehicle/i.test(header)) {
                        width = 1.0; // Vehicle number
                    } else if (/source|destination/i.test(header)) {
                        width = 1.5; // Wider for consolidated source/destination
                    } else if (/trip start|trip end/i.test(header)) {
                        width = 1.1; // Datetime columns
                    } else if (/trip duration/i.test(header)) {
                        width = 0.8;
                    } else if (/allowed range/i.test(header)) {
                        width = 0.9;
                    } else if (/status/i.test(header)) {
                        width = 1.0;
                    } else {
                        width = 1.0;
                    }
                    columnWidths.push(width);
                });

                // Calculate actual widths proportionally
                const totalWeight = columnWidths.reduce((sum, w) => sum + w, 0);
                headers.forEach((header, i) => {
                    const cellWidth = (columnWidths[i] / totalWeight) * availableWidth;

                    if (/vehicle/i.test(header)) {
                        columnStyles[i] = { cellWidth, halign: 'left', valign: 'middle' };
                    } else if (/source|destination/i.test(header)) {
                        columnStyles[i] = { cellWidth, halign: 'left', valign: 'middle' };
                    } else if (/trip duration|allowed range/i.test(header)) {
                        columnStyles[i] = { cellWidth, halign: 'center', valign: 'middle' };
                    } else if (/status/i.test(header)) {
                        columnStyles[i] = { cellWidth, halign: 'center', valign: 'middle' };
                    } else {
                        columnStyles[i] = { cellWidth, halign: 'center', valign: 'middle' };
                    }
                });

                // Generate table
                if (allRows.length === 0) {
                    doc.setFontSize(12);
                    doc.text('No data available for export', 40, 140);
                } else {
                    doc.autoTable({
                        startY: 125,
                        head: [headers],
                        body: allRows,
                        margin: { left: 30, right: 30 },
                        styles: {
                            fontSize: 8,
                            cellPadding: 4,
                            overflow: 'linebreak',
                            lineWidth: 0.2,
                            lineColor: [200, 200, 200]
                        },
                        headStyles: {
                            fillColor: [25, 118, 210],
                            textColor: [255, 255, 255],
                            fontStyle: 'bold',
                            fontSize: 9,
                            halign: 'center',
                            valign: 'middle',
                            lineWidth: 0.3,
                            lineColor: [20, 100, 190]
                        },
                        bodyStyles: {
                            textColor: [50, 50, 50],
                            lineWidth: 0.1
                        },
                        alternateRowStyles: {
                            fillColor: [245, 245, 245]
                        },
                        columnStyles: columnStyles,
                        theme: 'grid',
                        didParseCell: function(data) {
                            if (data.section === 'body') {
                                const cellText = Array.isArray(data.cell.text) 
                                    ? data.cell.text.join(' ') 
                                    : String(data.cell.text);
                                const header = headers[data.column.index];

                                // Highlight outlier status with font color only
                                if (/status/i.test(header)) {
                                    if (/above range|\^/i.test(cellText)) {
                                        data.cell.styles.textColor = [220, 38, 38]; // Red
                                        data.cell.styles.fontStyle = 'bold';
                                    } else if (/below range|\v/i.test(cellText)) {
                                        data.cell.styles.textColor = [234, 88, 12]; // Orange
                                        data.cell.styles.fontStyle = 'bold';
                                    }
                                }
                            }
                        },
                        didDrawPage: function(data) {
                            const pageCount = doc.internal.getNumberOfPages();
                            doc.setFontSize(9);
                            doc.setTextColor(120, 120, 120);
                            doc.text(
                                `Page ${data.pageNumber} of ${pageCount}`,
                                doc.internal.pageSize.getWidth() - 80,
                                doc.internal.pageSize.getHeight() - 20
                            );
                        }
                    });
                }

                const filename = `trip_report_${unitLabel.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
                doc.save(filename);

            } catch (error) {
                console.error('Error exporting trip report:', error);
                alert('Error generating PDF. Please try again.');
            } finally {
                setLoading(btn, false);
            }
        }

        // ===== SUMMARY REPORT EXPORTS =====

        function exportSummaryPDF(summaryType) {
            const btn = event?.target;
            setLoading(btn, true);

            try {
                let sectionId, titleSuffix;
                switch(summaryType) {
                    case 'daily':
                        sectionId = 'dailySummary';
                        titleSuffix = 'Daily Summary';
                        break;
                    case 'weekly':
                        sectionId = 'weeklySummary';
                        titleSuffix = 'Weekly Summary';
                        break;
                    case 'monthly':
                        sectionId = 'monthlySummary';
                        titleSuffix = 'Monthly Summary';
                        break;
                    case 'custom':
                        sectionId = 'customSummary';
                        titleSuffix = 'Custom Range Summary';
                        break;
                    default:
                        throw new Error('Invalid summary type');
                }

                const section = document.getElementById(sectionId);
                if (!section) {
                    alert('Summary section not found');
                    setLoading(btn, false);
                    return;
                }

                // Get summary table
                const table = section.querySelector('.summary-table table');
                if (!table) {
                    alert('No summary data available for export');
                    setLoading(btn, false);
                    return;
                }

                // Extract headers
                const headers = Array.from(table.querySelectorAll('thead tr th'))
                    .map(th => sanitizeText(th.innerText));

                // Extract rows
                const rows = Array.from(table.querySelectorAll('tbody tr'))
                    .map(tr => Array.from(tr.querySelectorAll('td'))
                        .map(td => sanitizeText(td.innerText))
                    );

                // Get summary statistics
                const statsContainer = section.querySelector('.summary-stats');
                const stats = {};
                if (statsContainer) {
                    statsContainer.querySelectorAll('.stat-item').forEach(item => {
                        const label = item.querySelector('.stat-label')?.textContent || '';
                        const value = item.querySelector('.stat-value')?.textContent || '';
                        stats[label.trim()] = value.trim();
                    });
                }

                // Get date range for custom summary
                let subtitle = titleSuffix;
                if (summaryType === 'custom') {
                    const fromDate = document.getElementById('custom-from-date')?.value;
                    const toDate = document.getElementById('custom-to-date')?.value;
                    if (fromDate && toDate) {
                        subtitle += ` | ${formatDateTime(fromDate)} to ${formatDateTime(toDate)}`;
                    }
                }

                // Create document
                const title = 'Irregular Trip Duration Reports';
                const doc = createBaseDoc(title, subtitle);

                // Add summary statistics
                if (Object.keys(stats).length > 0) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    doc.setTextColor(50, 50, 50);
                    doc.text('Summary Statistics:', 40, 95);

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    let yPos = 110;
                    let xPos = 40;
                    const columnWidth = 180;
                    let column = 0;

                    Object.entries(stats).forEach(([label, value]) => {
                        doc.text(`${label}: ${value}`, xPos, yPos);
                        column++;
                        if (column >= 4) {
                            column = 0;
                            xPos = 40;
                            yPos += 15;
                        } else {
                            xPos += columnWidth;
                        }
                    });
                }

                // Generate table
                if (rows.length === 0) {
                    doc.setFontSize(12);
                    doc.text('No data available for export', 40, 130);
                } else {
                    doc.autoTable({
                        startY: Object.keys(stats).length > 0 ? 140 : 95,
                        head: [headers],
                        body: rows,
                        margin: { left: 30, right: 30 },
                        styles: {
                            fontSize: 9,
                            cellPadding: 4,
                            overflow: 'linebreak',
                            lineWidth: 0.1,
                            lineColor: [200, 200, 200]
                        },
                        headStyles: {
                            fillColor: [25, 118, 210],
                            textColor: 255,
                            fontStyle: 'bold',
                            fontSize: 10
                        },
                        alternateRowStyles: {
                            fillColor: [245, 245, 245]
                        },
                        theme: 'grid',
                        didDrawPage: function(data) {
                            const pageCount = doc.internal.getNumberOfPages();
                            doc.setFontSize(9);
                            doc.setTextColor(120, 120, 120);
                            doc.text(
                                `Page ${data.pageNumber} of ${pageCount}`,
                                doc.internal.pageSize.getWidth() - 80,
                                doc.internal.pageSize.getHeight() - 20
                            );
                        }
                    });
                }

                const filename = `trip_summary_${summaryType}_${new Date().getTime()}.pdf`;
                doc.save(filename);

            } catch (error) {
                console.error('Error exporting summary:', error);
                alert('Error generating PDF. Please try again.');
            } finally {
                setLoading(btn, false);
            }
        }

        // ===== EXPOSE FUNCTIONS GLOBALLY =====

        window.exportTripReportPDF = exportTripReportPDF;
        window.exportDailySummaryPDF = () => exportSummaryPDF('daily');
        window.exportWeeklySummaryPDF = () => exportSummaryPDF('weekly');
        window.exportMonthlySummaryPDF = () => exportSummaryPDF('monthly');
        window.exportCustomSummaryPDF = () => exportSummaryPDF('custom');

        console.log('Trip Report PDF Export Module initialized successfully');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'complete') {
        attach();
    } else {
        window.addEventListener('load', attach);
    }
})();