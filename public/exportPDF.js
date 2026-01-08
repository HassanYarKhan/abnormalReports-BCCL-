(function initExportModule() {
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

    // Sanitize text (remove accordion icons, extra spaces, etc.)
    function sanitizeText(text) {
      let cleaned = (text || '')
        .replace(/^[▶▸►▼▽⯆⯈▾›❯➤➢➣⏵⏷]\s*/g, '') // Remove accordion icons
        .replace(/\u200B/g, '') // Remove zero-width spaces
        .replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '') // Remove unicode spaces
        .replace(/\s+/g, ' ')
        .trim();
      
      // Format deviation columns: replace arrows with ASCII-safe symbols
      // Match patterns like: "+2.706 MT ↑ Gross" or "↑ 2.706 MT Gross"
      const deviationMatch = cleaned.match(/([+-]?\s*\d+\.?\d*)\s*(MT|KG|T)?\s*([↑↓↔])\s*(.+)/i);
      if (deviationMatch) {
        const value = deviationMatch[1].trim();
        const unit = deviationMatch[2] || 'MT';
        const arrow = deviationMatch[3];
        const label = deviationMatch[4].trim();
        
        // Replace Unicode arrows with ASCII symbols
        let asciiArrow = arrow;
        if (arrow === '↑') asciiArrow = '^';
        else if (arrow === '↓') asciiArrow = 'v';
        else if (arrow === '↔') asciiArrow = '~';
        
        return `${value} ${unit} ${asciiArrow} ${label}`;
      }
      
      // Fallback: replace any remaining arrows
      cleaned = cleaned
        .replace(/↑/g, '^')
        .replace(/↓/g, 'v')
        .replace(/↔/g, '~');
      
      return cleaned;
    }

    // Check if column should be excluded from export
    function shouldExcludeColumn(headerText) {
      const excludePatterns = [/^views?$/i, /^view$/i];
      return excludePatterns.some(pattern => pattern.test(headerText.trim()));
    }

    // Check if deviation is high (for highlighting)
    function isHighDeviation(value, threshold = 3.0) {
      const num = parseFloat(String(value).replace(/[^0-9+\-\.]/g, ''));
      return !isNaN(num) && Math.abs(num) >= threshold;
    }

    // Check if text indicates a violation
    function isViolationText(text) {
      return /abnormally|overweight|underweight|↑|↓|\^|v/i.test(text);
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

    // ===== PRESENT DAY / AREA-WISE EXPORT =====
    function exportAreaReportPDF(btn) {
      setLoading(btn, true);
      try {
        // Update weight displays before export
        if (typeof window.updateAllWeightDisplays === 'function') {
          window.updateAllWeightDisplays();
        }

        const table = document.querySelector('#present-day .data-table');
        if (!table) {
          alert('No table found for export');
          setLoading(btn, false);
          return;
        }

        // Extract headers and track column indices to exclude
        const allHeaders = Array.from(table.querySelectorAll('thead tr th'));
        const excludeIndices = [];
        const headers = [];
        
        allHeaders.forEach((th, index) => {
          const headerText = sanitizeText(th.innerText);
          if (shouldExcludeColumn(headerText)) {
            excludeIndices.push(index);
          } else {
            headers.push(headerText);
          }
        });

        console.log('Headers:', headers);
        console.log('Excluded column indices:', excludeIndices);

        // Extract all rows (including hidden accordion details)
        const allRows = [];
        const tableRows = Array.from(table.querySelectorAll('tbody tr'));

        console.log('Total rows found:', tableRows.length);

        tableRows.forEach((tr, index) => {
          // Check if this is an accordion header with statistics cell
          const statsCell = tr.querySelector('.statistics-cell');
          const isAccordionHeader = tr.classList.contains('accordion-header');
          
          console.log(`Row ${index}:`, {
            isAccordionHeader,
            hasStatsCell: !!statsCell,
            display: tr.style.display,
            classes: tr.className
          });

          if (isAccordionHeader && statsCell) {
            // This is a collapsed accordion - get fixed cells + look for detail rows
            const allCells = Array.from(tr.querySelectorAll('td'));
            const fixedCells = [];
            
            allCells
              .filter(td => !td.classList.contains('statistics-cell'))
              .slice(0, 6) // Area, Unit, WB, Vehicle, Avg Tare, Avg Gross
              .forEach((td, idx) => {
                if (!excludeIndices.includes(idx)) {
                  fixedCells.push(sanitizeText(td.innerText));
                }
              });

            console.log('Fixed cells:', fixedCells);

            // Find the index from the row
            const idMatch = tr.id?.match(/\d+/) || 
                           statsCell.id?.match(/stats-cell-(\d+)/);
            const rowIndex = idMatch ? idMatch[1] || idMatch[0] : null;

            console.log('Row index:', rowIndex);

            if (rowIndex !== null) {
              // Look for detail rows
              const detailRows = document.querySelectorAll(
                `.present-day-accordion-detail-${rowIndex}`
              );
              
              console.log(`Found ${detailRows.length} detail rows for index ${rowIndex}`);

              if (detailRows.length > 0) {
                // Add each detail row
                detailRows.forEach((detailRow, detailIndex) => {
                  const allDetailCells = Array.from(detailRow.querySelectorAll('td'));
                  const detailCells = [];
                  
                  allDetailCells.forEach((td, idx) => {
                    // Adjust index for detail cells (they start after fixed cells)
                    const globalIdx = idx + 6;
                    if (!excludeIndices.includes(globalIdx)) {
                      detailCells.push(sanitizeText(td.innerText));
                    }
                  });
                  
                  // Combine fixed cells with detail cells
                  const fullRow = [...fixedCells, ...detailCells];
                  console.log(`Detail row ${detailIndex}:`, fullRow);
                  
                  if (fullRow.length >= headers.length) {
                    allRows.push(fullRow.slice(0, headers.length));
                  }
                });
              }
            }
          } else if (!statsCell && !tr.classList.contains('accordion-detail')) {
            // Single record row (no accordion)
            const allCells = Array.from(tr.querySelectorAll('td'));
            const cells = [];
            
            allCells.forEach((td, idx) => {
              if (!excludeIndices.includes(idx)) {
                cells.push(sanitizeText(td.innerText));
              }
            });
            
            console.log('Single row cells:', cells);
            
            if (cells.length >= headers.length) {
              allRows.push(cells.slice(0, headers.length));
            }
          }
        });

        console.log('Total extracted rows:', allRows.length);
        console.log('Sample rows:', allRows.slice(0, 3));

        // Get report metadata
        const areaSelect = document.getElementById('present-day-area-select');
        const areaLabel = areaSelect ? 
          areaSelect.options[areaSelect.selectedIndex].text : 'All Areas';
        
        const fromDate = document.getElementById('present-day-from-date')?.value;
        const toDate = document.getElementById('present-day-to-date')?.value;
        const fromFormatted = formatDateTime(fromDate + 'T00:00');
        const toFormatted = formatDateTime(toDate + 'T23:59');

        // Create document
        const title = 'Present Day / Area-wise Reports';
        const subtitle = `${areaLabel} | ${fromFormatted} to ${toFormatted}`;
        const doc = createBaseDoc(title, subtitle);

        // Column styles - auto-calculate widths to fit page
        const pageWidth = doc.internal.pageSize.getWidth();
        const margins = 60; // left + right margins
        const availableWidth = pageWidth - margins;
        const columnCount = headers.length;
        
        const columnStyles = {};
        const columnWidths = [];
        
        // Assign relative widths based on content type
        headers.forEach((header, i) => {
          let width;
          if (/vehicle/i.test(header)) {
            width = 1.3; // Wider for vehicle numbers
          } else if (/area|unit|wb/i.test(header)) {
            width = 0.9;
          } else if (/weight/i.test(header) && !/deviation/i.test(header)) {
            width = 1.0;
          } else if (/deviation|remark/i.test(header)) {
            width = 1.4; // Wider for deviation remarks
          } else if (/date|time/i.test(header)) {
            width = 1.2;
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
          } else if (/area|unit|wb/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'center' };
          } else if (/weight/i.test(header) && !/deviation/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'right' };
          } else if (/deviation|remark/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'right' };
          } else if (/date|time/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'center' };
          } else {
            columnStyles[i] = { cellWidth, halign: 'center' };
          }
        });

        // Generate table
        if (allRows.length === 0) {
          doc.setFontSize(12);
          doc.text('No data available for export', 40, 100);
        } else {
          doc.autoTable({
            startY: 90,
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

                // Highlight high deviations
                if (/deviation/i.test(header)) {
                  if (isHighDeviation(cellText)) {
                    data.cell.styles.textColor = [211, 47, 47];
                    data.cell.styles.fontStyle = 'bold';
                  }
                }

                // Highlight violation remarks
                if (isViolationText(cellText)) {
                  data.cell.styles.textColor = [211, 47, 47];
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            },
            didDrawPage: function(data) {
              // Page number
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

        doc.save(`area_report_${new Date().getTime()}.pdf`);
      } catch (error) {
        console.error('Error exporting area report:', error);
        alert('Error generating PDF. Please try again.');
      } finally {
        setLoading(btn, false);
      }
    }

    // ===== VEHICLE-WISE EXPORT =====
    function exportVehicleReportPDF(btn) {
      setLoading(btn, true);
      try {
        // Update weight displays before export
        if (typeof window.updateAllWeightDisplays === 'function') {
          window.updateAllWeightDisplays();
        }

        const table = document.querySelector('#vehicle-wise .data-table');
        if (!table) {
          alert('No table found for export');
          setLoading(btn, false);
          return;
        }

        // Extract headers and track column indices to exclude
        const allHeaders = Array.from(table.querySelectorAll('thead tr th'));
        const excludeIndices = [];
        const headers = [];
        
        allHeaders.forEach((th, index) => {
          const headerText = sanitizeText(th.innerText);
          if (shouldExcludeColumn(headerText)) {
            excludeIndices.push(index);
          } else {
            headers.push(headerText);
          }
        });

        console.log('Vehicle headers:', headers);
        console.log('Vehicle excluded column indices:', excludeIndices);

        // Extract all rows
        const allRows = [];
        const tableRows = Array.from(table.querySelectorAll('tbody tr'));

        console.log('Vehicle total rows found:', tableRows.length);

        tableRows.forEach((tr, index) => {
          const statsCell = tr.querySelector('.statistics-cell');
          const isAccordionHeader = tr.classList.contains('accordion-header');
          
          console.log(`Vehicle row ${index}:`, {
            isAccordionHeader,
            hasStatsCell: !!statsCell,
            display: tr.style.display,
            classes: tr.className,
            innerHTML: tr.innerHTML.substring(0, 200)
          });

          if (isAccordionHeader && statsCell) {
            // Get fixed cells: Area, Unit, WB, Avg Tare, Avg Gross
            const allCells = Array.from(tr.querySelectorAll('td'));
            const fixedCells = [];
            
            allCells
              .filter(td => !td.classList.contains('statistics-cell'))
              .slice(0, 5)
              .forEach((td, idx) => {
                if (!excludeIndices.includes(idx)) {
                  fixedCells.push(sanitizeText(td.innerText));
                }
              });

            console.log('Vehicle fixed cells:', fixedCells);

            // Find the index
            const idMatch = tr.id?.match(/\d+/) || 
                           statsCell.id?.match(/vehicle-stats-cell-(\d+)/);
            const rowIndex = idMatch ? idMatch[1] || idMatch[0] : null;

            console.log('Vehicle row index:', rowIndex);

            if (rowIndex !== null) {
              // Look for detail rows
              const detailRows = document.querySelectorAll(
                `.vehicle-accordion-detail-${rowIndex}`
              );
              
              console.log(`Found ${detailRows.length} vehicle detail rows for index ${rowIndex}`);

              if (detailRows.length > 0) {
                detailRows.forEach((detailRow, detailIndex) => {
                  // Skip the first 5 empty alignment cells and get only data cells
                  const allCells = Array.from(detailRow.querySelectorAll('td'));
                  const detailCells = [];
                  
                  allCells.slice(5).forEach((td, idx) => {
                    // Adjust index for detail cells (they start after fixed cells)
                    const globalIdx = idx + 5;
                    if (!excludeIndices.includes(globalIdx)) {
                      detailCells.push(sanitizeText(td.innerText));
                    }
                  });
                  
                  // Combine: fixed + detail cells
                  const fullRow = [...fixedCells, ...detailCells];
                  console.log(`Vehicle detail row ${detailIndex}:`, fullRow);
                  
                  if (fullRow.length >= headers.length) {
                    allRows.push(fullRow.slice(0, headers.length));
                  }
                });
              }
            }
          } else if (!statsCell && !tr.classList.contains('accordion-detail')) {
            // Single record row - extract all visible cells
            const allCells = Array.from(tr.querySelectorAll('td'));
            const cells = [];
            
            allCells
              .filter(td => {
                // Include cells that are visible or part of data
                const style = window.getComputedStyle(td);
                return style.display !== 'none' && !td.classList.contains('statistics-cell');
              })
              .forEach((td, idx) => {
                if (!excludeIndices.includes(idx)) {
                  cells.push(sanitizeText(td.innerText));
                }
              });
            
            console.log('Vehicle single row cells:', cells);
            
            if (cells.length >= headers.length) {
              allRows.push(cells.slice(0, headers.length));
            } else if (cells.length > 0) {
              // Pad with empty strings if needed
              while (cells.length < headers.length) {
                cells.push('');
              }
              allRows.push(cells);
            }
          }
        });

        console.log('Vehicle total extracted rows:', allRows.length);
        console.log('Vehicle sample rows:', allRows.slice(0, 3));

        // Get report metadata
        const vehicleNumber = document.getElementById('vehicle-search')?.value || 
          'Unknown Vehicle';
        const fromDate = document.getElementById('from-date')?.value;
        const toDate = document.getElementById('to-date')?.value;
        const fromFormatted = formatDateTime(fromDate);
        const toFormatted = formatDateTime(toDate);

        // Create document
        const title = 'Vehicle-wise Reports';
        const subtitle = `Vehicle: ${vehicleNumber} | ${fromFormatted} to ${toFormatted}`;
        const doc = createBaseDoc(title, subtitle);

        // Column styles - auto-calculate widths to fit page
        const pageWidth = doc.internal.pageSize.getWidth();
        const margins = 60; // left + right margins
        const availableWidth = pageWidth - margins;
        const columnCount = headers.length;
        
        const columnStyles = {};
        const columnWidths = [];
        
        // Assign relative widths based on content type
        headers.forEach((header, i) => {
          let width;
          if (/area|unit|wb/i.test(header)) {
            width = 0.9;
          } else if (/weight/i.test(header) && !/deviation/i.test(header)) {
            width = 1.0;
          } else if (/deviation|remark/i.test(header)) {
            width = 1.4; // Wider for deviation remarks
          } else if (/date|time/i.test(header)) {
            width = 1.2;
          } else {
            width = 1.0;
          }
          columnWidths.push(width);
        });
        
        // Calculate actual widths proportionally
        const totalWeight = columnWidths.reduce((sum, w) => sum + w, 0);
        headers.forEach((header, i) => {
          const cellWidth = (columnWidths[i] / totalWeight) * availableWidth;
          
          if (/area|unit|wb/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'center' };
          } else if (/weight/i.test(header) && !/deviation/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'right' };
          } else if (/deviation|remark/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'right' };
          } else if (/date|time/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'center' };
          } else {
            columnStyles[i] = { cellWidth, halign: 'center' };
          }
        });

        // Generate table
        if (allRows.length === 0) {
          doc.setFontSize(12);
          doc.text('No data available for export', 40, 100);
        } else {
          doc.autoTable({
            startY: 90,
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

                // Highlight high deviations
                if (/deviation/i.test(header)) {
                  if (isHighDeviation(cellText)) {
                    data.cell.styles.textColor = [211, 47, 47];
                    data.cell.styles.fontStyle = 'bold';
                  }
                }

                // Highlight violation remarks
                if (isViolationText(cellText)) {
                  data.cell.styles.textColor = [211, 47, 47];
                  data.cell.styles.fontStyle = 'bold';
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

        doc.save(`vehicle_report_${vehicleNumber}_${new Date().getTime()}.pdf`);
      } catch (error) {
        console.error('Error exporting vehicle report:', error);
        alert('Error generating PDF. Please try again.');
      } finally {
        setLoading(btn, false);
      }
    }

    // ===== WEIGHBRIDGE-WISE EXPORT =====
    function exportWeighbridgeReportPDF(btn) {
      setLoading(btn, true);
      try {
        // Update weight displays before export
        if (typeof window.updateAllWeightDisplays === 'function') {
          window.updateAllWeightDisplays();
        }

        const table = document.querySelector('#weighbridge-wise .data-table');
        if (!table) {
          alert('No table found for export');
          setLoading(btn, false);
          return;
        }

        // Extract headers and track column indices to exclude
        const allHeaders = Array.from(table.querySelectorAll('thead tr th'));
        const excludeIndices = [];
        const headers = [];
        
        allHeaders.forEach((th, index) => {
          const headerText = sanitizeText(th.innerText);
          if (shouldExcludeColumn(headerText)) {
            excludeIndices.push(index);
          } else {
            headers.push(headerText);
          }
        });

        console.log('Weighbridge headers:', headers);
        console.log('Weighbridge excluded column indices:', excludeIndices);

        // Extract all rows
        const allRows = [];
        const tableRows = Array.from(table.querySelectorAll('tbody tr'));

        console.log('Weighbridge total rows found:', tableRows.length);

        tableRows.forEach((tr, index) => {
          const statsCell = tr.querySelector('.statistics-cell');
          const isAccordionHeader = tr.classList.contains('accordion-header');
          
          console.log(`Weighbridge row ${index}:`, {
            isAccordionHeader,
            hasStatsCell: !!statsCell,
            display: tr.style.display,
            classes: tr.className
          });

          if (isAccordionHeader && statsCell) {
            // Get fixed cells
            const allCells = Array.from(tr.querySelectorAll('td'));
            const fixedCells = [];
            
            allCells
              .filter(td => !td.classList.contains('statistics-cell'))
              .slice(0, 4) // Adjust based on your structure
              .forEach((td, idx) => {
                if (!excludeIndices.includes(idx)) {
                  fixedCells.push(sanitizeText(td.innerText));
                }
              });

            console.log('Weighbridge fixed cells:', fixedCells);

            // Find the index
            const idMatch = tr.id?.match(/\d+/) || 
                           statsCell.id?.match(/wb-stats-cell-(\d+)/);
            const rowIndex = idMatch ? idMatch[1] || idMatch[0] : null;

            console.log('Weighbridge row index:', rowIndex);

            if (rowIndex !== null) {
              // Look for detail rows
              const detailRows = document.querySelectorAll(
                `.wb-accordion-detail-${rowIndex}`
              );
              
              console.log(`Found ${detailRows.length} weighbridge detail rows for index ${rowIndex}`);

              if (detailRows.length > 0) {
                detailRows.forEach((detailRow, detailIndex) => {
                  const allCells = Array.from(detailRow.querySelectorAll('td'));
                  const detailCells = [];
                  
                  allCells.forEach((td, idx) => {
                    if (!excludeIndices.includes(idx)) {
                      detailCells.push(sanitizeText(td.innerText));
                    }
                  });
                  
                  // Combine: fixed + detail cells
                  const fullRow = [...fixedCells, ...detailCells];
                  console.log(`Weighbridge detail row ${detailIndex}:`, fullRow);
                  
                  if (fullRow.length >= headers.length) {
                    allRows.push(fullRow.slice(0, headers.length));
                  }
                });
              }
            }
          } else if (!statsCell && !tr.classList.contains('accordion-detail')) {
            // Single record row - extract all visible cells
            const allCells = Array.from(tr.querySelectorAll('td'));
            const cells = [];
            
            allCells
              .filter(td => {
                const style = window.getComputedStyle(td);
                return style.display !== 'none' && !td.classList.contains('statistics-cell');
              })
              .forEach((td, idx) => {
                if (!excludeIndices.includes(idx)) {
                  cells.push(sanitizeText(td.innerText));
                }
              });
            
            console.log('Weighbridge single row cells:', cells);
            
            if (cells.length >= headers.length) {
              allRows.push(cells.slice(0, headers.length));
            } else if (cells.length > 0) {
              // Pad with empty strings if needed
              while (cells.length < headers.length) {
                cells.push('');
              }
              allRows.push(cells);
            }
          }
        });

        console.log('Weighbridge total extracted rows:', allRows.length);
        console.log('Weighbridge sample rows:', allRows.slice(0, 3));

        // Get report metadata
        let wbName = 'Unknown Weighbridge';
        let fromFormatted = '';
        let toFormatted = '';

        if (window.currentWBReport) {
          const wbData = window.currentWBReport;
          wbName = wbData.wbName || wbData.wbCode || wbName;
          fromFormatted = formatDateTime(wbData.fromDateTime);
          toFormatted = formatDateTime(wbData.toDateTime);
        } else {
          wbName = document.getElementById('wb-select')?.value || wbName;
          const fromDate = document.getElementById('wb-from-date')?.value;
          const toDate = document.getElementById('wb-to-date')?.value;
          fromFormatted = formatDateTime(fromDate);
          toFormatted = formatDateTime(toDate);
        }

        // Create document
        const title = 'Weighbridge-wise Reports';
        const subtitle = `${wbName} | ${fromFormatted} to ${toFormatted}`;
        const doc = createBaseDoc(title, subtitle);

        // Column styles - auto-calculate widths to fit page
        const pageWidth = doc.internal.pageSize.getWidth();
        const margins = 60; // left + right margins
        const availableWidth = pageWidth - margins;
        const columnCount = headers.length;
        
        const columnStyles = {};
        const columnWidths = [];
        
        // Assign relative widths based on content type
        headers.forEach((header, i) => {
          let width;
          if (/vehicle/i.test(header)) {
            width = 1.3; // Wider for vehicle numbers
          } else if (/weight/i.test(header) && !/deviation/i.test(header)) {
            width = 1.0;
          } else if (/deviation|remark/i.test(header)) {
            width = 1.4; // Wider for deviation remarks
          } else if (/date|time/i.test(header)) {
            width = 1.2;
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
          } else if (/weight/i.test(header) && !/deviation/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'right' };
          } else if (/deviation|remark/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'right' };
          } else if (/date|time/i.test(header)) {
            columnStyles[i] = { cellWidth, halign: 'center' };
          } else {
            columnStyles[i] = { cellWidth, halign: 'center' };
          }
        });

        // Generate table
        if (allRows.length === 0) {
          doc.setFontSize(12);
          doc.text('No data available for export', 40, 100);
        } else {
          doc.autoTable({
            startY: 90,
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

                // Highlight high deviations
                if (/deviation/i.test(header)) {
                  if (isHighDeviation(cellText)) {
                    data.cell.styles.textColor = [211, 47, 47];
                    data.cell.styles.fontStyle = 'bold';
                  }
                }

                // Highlight violation remarks
                if (isViolationText(cellText)) {
                  data.cell.styles.textColor = [211, 47, 47];
                  data.cell.styles.fontStyle = 'bold';
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

        doc.save(`weighbridge_report_${new Date().getTime()}.pdf`);
      } catch (error) {
        console.error('Error exporting weighbridge report:', error);
        alert('Error generating PDF. Please try again.');
      } finally {
        setLoading(btn, false);
      }
    }

    // ===== EXPOSE FUNCTIONS GLOBALLY =====
    window.exportAreaReportPDF = exportAreaReportPDF;
    window.exportVehicleReportPDF = exportVehicleReportPDF;
    window.exportWeighbridgeReportPDF = exportWeighbridgeReportPDF;

    console.log('PDF Export Module initialized successfully');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'complete') {
    attach();
  } else {
    window.addEventListener('load', attach);
  }
})();