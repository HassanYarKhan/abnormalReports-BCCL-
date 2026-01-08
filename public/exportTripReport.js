// exportTripReport.js - PDF Export Utility for Irregular Trip Duration Reports
// Uses jsPDF + autoTable for professional report generation

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

    // Create base document with header
    function createBaseDoc(title, subtitle) {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
      
      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(25, 118, 210);
      doc.text(title, 40, 40);
      
      // Subtitle
      if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(70, 70, 70);
        doc.text(subtitle, 40, 60);
      }
      
      // Generated timestamp
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 40, 75);
      
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
        const table = document.querySelector('#do-wise .data-table');
        if (!table) {
          alert('No table found for export');
          setLoading(btn, false);
          return;
        }

        // Extract headers
        const headers = Array.from(table.querySelectorAll('thead tr th'))
          .map(th => sanitizeText(th.innerText));

        console.log('Headers:', headers);

        // Extract all rows
        const allRows = [];
        const tableRows = Array.from(table.querySelectorAll('tbody tr'));
        let currentVehicleNumber = null;

        console.log('Total rows found:', tableRows.length);

        tableRows.forEach((tr, index) => {
          const isDOHeader = tr.classList.contains('do-header');
          const isVehicleDetails = tr.classList.contains('vehicle-details');
          
          console.log(`Row ${index}:`, {
            isDOHeader,
            isVehicleDetails,
            classes: tr.className
          });

          // Skip DO header rows (they contain summary info only)
          if (isDOHeader) {
            currentVehicleNumber = null; // Reset vehicle number for new DO group
            return;
          }

          // Process vehicle detail rows
          if (isVehicleDetails) {
            const tds = Array.from(tr.querySelectorAll('td'));
            
            // Check if first cell has rowspan (new vehicle number)
            const firstCell = tds[0];
            const rowspan = firstCell ? firstCell.getAttribute('rowspan') : null;
            
            if (rowspan && parseInt(rowspan) > 1) {
              // This is the first row for this vehicle - extract vehicle number
              currentVehicleNumber = sanitizeText(firstCell.innerText);
              
              // Extract remaining cells (skip first cell as it's vehicle number)
              const cells = [currentVehicleNumber];
              for (let i = 1; i < tds.length; i++) {
                const td = tds[i];
                const statusSpan = td.querySelector('span[class*="deviation"]');
                if (statusSpan) {
                  cells.push(sanitizeText(statusSpan.innerText));
                } else {
                  cells.push(sanitizeText(td.innerText));
                }
              }
              
              console.log(`First vehicle row ${index}:`, cells);
              if (cells.length >= headers.length) {
                allRows.push(cells.slice(0, headers.length));
              }
            } else {
              // This is a continuation row - prepend the current vehicle number
              const cells = [currentVehicleNumber || ''];
              for (let i = 0; i < tds.length; i++) {
                const td = tds[i];
                const statusSpan = td.querySelector('span[class*="deviation"]');
                if (statusSpan) {
                  cells.push(sanitizeText(statusSpan.innerText));
                } else {
                  cells.push(sanitizeText(td.innerText));
                }
              }
              
              console.log(`Continuation row ${index}:`, cells);
              if (cells.length >= headers.length) {
                allRows.push(cells.slice(0, headers.length));
              }
            }
          }
        });

        console.log('Total extracted rows:', allRows.length);
        console.log('Sample rows:', allRows.slice(0, 3));

        // Get report metadata
        const areaSelect = document.getElementById('do-area-select');
        const unitSelect = document.getElementById('do-unit-select');
        const areaLabel = areaSelect ? 
          areaSelect.options[areaSelect.selectedIndex].text : 'Unknown Area';
        const unitLabel = unitSelect ? 
          unitSelect.options[unitSelect.selectedIndex].text : 'Unknown Unit';
        
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

        // Add summary statistics
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text('Summary Statistics:', 40, 95);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const summaryY = 110;
        const columnWidth = 200;
        
        doc.text(`Total Trips: ${totalTrips}`, 40, summaryY);
        doc.text(`Unique DOs: ${uniqueDOs}`, 40 + columnWidth, summaryY);
        doc.text(`Unique Vehicles: ${uniqueVehicles}`, 40 + columnWidth * 2, summaryY);
        doc.text(`Total Outliers: ${totalOutliers}`, 40 + columnWidth * 3, summaryY);
        doc.text(`Outlier Rate: ${outlierPercentage}`, 40 + columnWidth * 4, summaryY);

        // Column styles - auto-calculate widths to fit page
        const pageWidth = doc.internal.pageSize.getWidth();
        const margins = 60;
        const availableWidth = pageWidth - margins;
        
        const columnStyles = {};
        const columnWidths = [];
        
        // Assign relative widths based on content type
        headers.forEach((header, i) => {
          let width;
          if (/vehicle/i.test(header)) {
            width = 1.3; // Wider for vehicle numbers
          } else if (/area|unit|source|destination/i.test(header)) {
            width = 1.1;
          } else if (/wb|weighbridge/i.test(header)) {
            width = 0.9;
          } else if (/trip time/i.test(header) && !/minutes/i.test(header)) {
            width = 1.2;
          } else if (/minutes|iqr/i.test(header)) {
            width = 0.8;
          } else if (/status|remark/i.test(header)) {
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
            columnStyles[i] = { cellWidth, halign: 'left' };
          } else if (/minutes|iqr/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'right' };
          } else if (/area|unit|wb|source|destination/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'center' };
          } else {
            columnStyles[i] = { cellWidth, halign: 'center' };
          }
        });

        // Generate table
        if (allRows.length === 0) {
          doc.setFontSize(12);
          doc.text('No data available for export', 40, 140);
        } else {
          doc.autoTable({
            startY: 130,
            head: [headers],
            body: allRows,
            margin: { left: 30, right: 30 },
            styles: { 
              fontSize: 8, 
              cellPadding: 3,
              overflow: 'linebreak',
              lineWidth: 0.1,
              lineColor: [200, 200, 200]
            },
            headStyles: { 
              fillColor: [25, 118, 210], 
              textColor: 255, 
              fontStyle: 'bold',
              fontSize: 9
            },
            bodyStyles: {
              textColor: [50, 50, 50]
            },
            alternateRowStyles: { 
              fillColor: [245, 245, 245] 
            },
            columnStyles: columnStyles,
            theme: 'grid',
            didParseCell: function(data) {
              if (data.section === 'body') {
                const cellText = Array.isArray(data.cell.text) ? 
                  data.cell.text.join(' ') : String(data.cell.text);
                const header = headers[data.column.index];

                // Highlight status/outliers
                if (/status|remark/i.test(header)) {
                  if (/above range|\^/i.test(cellText)) {
                    data.cell.styles.textColor = [211, 47, 47];
                    data.cell.styles.fontStyle = 'bold';
                  } else if (/below range|v/i.test(cellText)) {
                    data.cell.styles.textColor = [255, 152, 0];
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