import React, { useRef, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Download as DownloadIcon, Close as CloseIcon } from "@mui/icons-material";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import PdfPreview from "./PdfPreview";

const formatCurrency = (value) => {
  if (value === undefined || value === null) return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  if (num === 0) return "₹0.00";
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (value) => {
  if (value === undefined || value === null) return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatLabel = (key) => {
  if (!key) return "";
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const flattenForReport = (obj, prefix = "") => {
  if (!obj || typeof obj !== "object") return [];
  const rows = [];
  Object.entries(obj).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flattenForReport(value, fullKey));
    } else if (value !== undefined) {
      const displayValue = typeof value === "number" ? formatNumber(value) : String(value ?? "-");
      rows.push({ key: formatLabel(fullKey), value: displayValue });
    }
  });
  return rows;
};

// A4 dimensions in mm
const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const MARGIN = 10;

// Max operations per page for detailed breakdown
const MAX_OPS_PER_PAGE = 5;

// Max operations per page for summary table
const SUMMARY_OPS_PER_PAGE = 10;

const PdfReportExport = ({
  open,
  onClose,
  projectData,
  part,
  operations = [],
  operationResults = [],
  drawingPath,
  getInlineFileUrl,
  isPdfPath,
  title = "HAL Cost Estimation Report",
  partMiscItems = [],
  partMiscTotal = 0,
}) => {
  const contentRef = useRef(null);
  const scaleRef = useRef(1);

  // Get all operation data with proper labels
  const getOperationSummary = useCallback(() => {
    const rawOps = Array.isArray(operationResults) ? operationResults : [];
    const ops = Array.isArray(operations) ? operations : [];

    return rawOps
      .map((opRes, idx) => {
        if (!opRes) return null;
        const opType = String(
          ops?.[idx]?.operation_type || opRes?.inputs?.operation_type || ""
        ).trim();
        const opLabel = opType
          ? formatLabel(opType)
          : `Operation ${idx + 1}`;
        const totalCost = opRes?.cost_breakdown?.total_unit_cost_with_misc;
        return {
          idx,
          label: `Operation ${idx + 1}${opType ? ` - ${opLabel}` : ""}`,
          shortLabel: `Op ${idx + 1}`,
          opLabel,
          value: Number.isFinite(Number(totalCost)) ? Number(totalCost) : 0,
        };
      })
      .filter(Boolean);
  }, [operations, operationResults]);

  const summaryRows = getOperationSummary();
  const totalAmount = summaryRows.reduce((sum, r) => sum + r.value, 0);
  const totalUnitCost = (Array.isArray(operationResults) ? operationResults : []).reduce((sum, r) => {
    const n = Number(r?.cost_breakdown?.unit_cost);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const getSummaryChunks = () => {
    const rows = Array.isArray(summaryRows) ? summaryRows : [];
    const chunks = [];
    for (let i = 0; i < rows.length; i += SUMMARY_OPS_PER_PAGE) {
      chunks.push(rows.slice(i, i + SUMMARY_OPS_PER_PAGE));
    }
    return chunks.length ? chunks : [[]];
  };

  const summaryChunks = getSummaryChunks();
  const summaryPages = summaryChunks.length;

  // Get metrics for all operations
  const getMetrics = useCallback(() => {
    const rawOps = Array.isArray(operationResults) ? operationResults : [];
    const ops = Array.isArray(operations) ? operations : [];

    return rawOps
      .map((opRes, idx) => {
        if (!opRes) return null;

        const opType = String(
          ops?.[idx]?.operation_type || opRes?.inputs?.operation_type || ""
        ).trim();
        const opLabel = opType
          ? formatLabel(opType)
          : `Operation ${idx + 1}`;

        const rows = [
          ...flattenForReport(opRes?.inputs),
          ...flattenForReport(opRes?.cost_breakdown),
        ];
        
        // Explicitly add Machine Setup Time and Cycle Time if they exist in response
        const setupTime = opRes?.machine_setup_time;
        const cycleTime = opRes?.cycle_time;
        
        // Note: These fields are no longer collected but kept for backward compatibility
        // with old reports that may have them
        
        const map = new Map();
        rows.forEach((r) => {
          if (!r?.key) return;
          map.set(String(r.key), r.value);
        });
        if (map.size === 0) return null;

        return {
          idx,
          label: `Op ${idx + 1}`,
          opLabel,
          map,
        };
      })
      .filter(Boolean);
  }, [operations, operationResults]);

  const metricsOps = getMetrics();
  
  // Split operations into chunks of MAX_OPS_PER_PAGE for detailed breakdown pages
  const getOperationChunks = () => {
    const chunks = [];
    for (let i = 0; i < metricsOps.length; i += MAX_OPS_PER_PAGE) {
      chunks.push(metricsOps.slice(i, i + MAX_OPS_PER_PAGE));
    }
    return chunks;
  };
  
  const operationChunks = getOperationChunks();
  const totalDetailPages = operationChunks.length;

  const totalPages = 1 + summaryPages + totalDetailPages;
  
  // Filter out miscellaneous_amount from per-operation metrics since we have global misc now
  const filteredMetricKeys =
    metricsOps.length > 0
      ? Array.from(
          metricsOps.reduce((acc, op) => {
            op.map.forEach((_, k) => {
              // Skip miscellaneous_amount and total_unit_cost_with_misc since we show them separately
              if (k !== "Miscellaneous Amount" && k !== "Total Unit Cost With Misc") {
                acc.add(k);
              }
            });
            return acc;
          }, new Set())
        ).sort((a, b) => String(a).localeCompare(String(b)))
      : [];
  
  const metricKeys = filteredMetricKeys;

  // Calculate scale for preview (fit to container)
  const calculateScale = useCallback(() => {
    const container = contentRef.current?.parentElement;
    if (!container) return 0.6;
    const containerWidth = container.clientWidth - 48;
    const targetWidth = 794; // A4 width in px at 96dpi
    return Math.min(containerWidth / targetWidth, 1);
  }, []);

  const handleDownload = async () => {
    if (!contentRef.current) return;

    const content = contentRef.current;
    const originalTransform = content.style.transform;

    // Reset transform for capture
    content.style.transform = "none";
    content.style.margin = "0";

    try {
      // Capture first page
      const page1Element = content.querySelector('[data-page="1"]') || content;
      const canvas1 = await html2canvas(page1Element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 794,
        windowHeight: 1123,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = A4_WIDTH - 2 * MARGIN;
      
      // Add first page
      const imgHeight1 = (canvas1.height * imgWidth) / canvas1.width;
      const imgData1 = canvas1.toDataURL("image/png", 1.0);
      pdf.addImage(imgData1, "PNG", MARGIN, MARGIN, imgWidth, Math.min(imgHeight1, A4_HEIGHT - 2 * MARGIN));

      // Capture all detail pages (pages 2, 3, 4, etc.)
      let pageNum = 2;
      while (true) {
        const pageContent = content.querySelector(`[data-page="${pageNum}"]`);
        if (!pageContent || pageContent.children.length === 0) break;
        
        pdf.addPage();
        const canvas = await html2canvas(pageContent, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 794,
          windowHeight: 1123,
        });
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/png", 1.0);
        pdf.addImage(imgData, "PNG", MARGIN, MARGIN, imgWidth, Math.min(imgHeight, A4_HEIGHT - 2 * MARGIN));
        
        pageNum++;
      }

      // Restore transform
      content.style.transform = originalTransform;

      const fileName = `${projectData?.project_name || "Cost"}_${part?.part_number || "Part"}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName.replace(/[^a-zA-Z0-9_-]/g, "_"));
    } catch (error) {
      console.error("PDF generation failed:", error);
      content.style.transform = originalTransform;
    }
  };

  // Calculate current scale for display
  const displayScale = calculateScale();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "#0a0f1a",
          maxWidth: "1200px",
          maxHeight: "95vh",
        },
      }}
    >
      <DialogContent
        sx={{
          p: 3,
          bgcolor: "#0a0f1a",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          overflow: "auto",
        }}
      >
        {/* A4 Content Container */}
        <Box
          ref={contentRef}
          sx={{
            width: "794px",
            minWidth: "794px",
            bgcolor: "#ffffff",
            color: "#1a1a2e",
            p: 0,
            transform: `scale(${displayScale})`,
            transformOrigin: "top center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "11pt",
            lineHeight: 1.4,
            boxSizing: "border-box",
          }}
        >
          {/* PAGE 1: Header + Full 2D Drawing only */}
          <Box data-page="1" sx={{ minHeight: "1123px", bgcolor: "#ffffff", display: "flex", flexDirection: "column" }}>
            {/* HEADER SECTION - Extended to fill more space */}
            <Box
              sx={{
                p: "20mm 15mm 15mm 15mm",
                bgcolor: "#1e3a5f",
                borderBottom: "4pt solid #d4af37",
                flex: "0 0 auto",
              }}
            >
              {/* Title Row */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  mb: 3,
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography
                    sx={{
                      fontSize: "28pt",
                      fontWeight: "bold",
                      color: "#ffffff",
                      letterSpacing: "0.5pt",
                      mb: 1,
                    }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "14pt",
                      color: "#94a3b8",
                      fontWeight: 500,
                    }}
                  >
                    Project: {projectData?.project_name || "Untitled Project"}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right", minWidth: "150px" }}>
                  <Box
                    sx={{
                      bgcolor: "#d4af37",
                      color: "#1e3a5f",
                      px: "16pt",
                      py: "8pt",
                      borderRadius: "4pt",
                      mb: 1,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "12pt",
                        fontWeight: "bold",
                      }}
                    >
                      Part No: {part?.part_number || "N/A"}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: "10pt",
                      color: "#94a3b8",
                    }}
                  >
                    Date: {new Date().toLocaleDateString("en-IN")}
                  </Typography>
                </Box>
              </Box>

              {/* Project Info Grid - Extended */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 3,
                  mt: 3,
                  p: "12pt",
                  bgcolor: "rgba(255,255,255,0.1)",
                  borderRadius: "4pt",
                  border: "1pt solid rgba(212,175,55,0.5)",
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontSize: "9pt",
                      color: "#d4af37",
                      textTransform: "uppercase",
                      letterSpacing: "0.5pt",
                      mb: 0.5,
                    }}
                  >
                    PO / Reference
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "11pt",
                      fontWeight: "bold",
                      color: "#ffffff",
                    }}
                  >
                    {projectData?.po_reference_number || "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: "9pt",
                      color: "#d4af37",
                      textTransform: "uppercase",
                      letterSpacing: "0.5pt",
                      mb: 0.5,
                    }}
                  >
                    Customer
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "11pt",
                      fontWeight: "bold",
                      color: "#ffffff",
                    }}
                  >
                    {projectData?.customer_name || "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: "9pt",
                      color: "#d4af37",
                      textTransform: "uppercase",
                      letterSpacing: "0.5pt",
                      mb: 0.5,
                    }}
                  >
                    Project Date
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "11pt",
                      fontWeight: "bold",
                      color: "#ffffff",
                    }}
                  >
                    {projectData?.project_date || "N/A"}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* 2D DRAWING SECTION - Full Page */}
            <Box sx={{ p: "8mm 15mm 15mm 15mm", flex: 1, display: "flex", flexDirection: "column" }}>
              <Box
                sx={{
                  mb: 2,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "13pt",
                    fontWeight: "bold",
                    color: "#1e3a5f",
                    textAlign: "center",
                    pb: 1,
                    borderBottom: "2pt solid #38bdf8",
                    display: "inline-block",
                    width: "100%",
                  }}
                >
                  2D TECHNICAL DRAWING
                </Typography>
              </Box>

              <Box
                sx={{
                  border: "1pt solid #e2e8f0",
                  borderRadius: "4pt",
                  overflow: "hidden",
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "#f8fafc",
                }}
              >
                {drawingPath ? (
                  isPdfPath(drawingPath) ? (
                    <Box
                      sx={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        p: 2,
                      }}
                    >
                      <PdfPreview
                        url={getInlineFileUrl(drawingPath)}
                        style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                      />
                    </Box>
                  ) : (
                    <img
                      src={getInlineFileUrl(drawingPath)}
                      alt="2D Drawing"
                      style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                    />
                  )
                ) : (
                  <Typography sx={{ color: "#94a3b8", fontSize: "11pt" }}>
                    No 2D drawing uploaded
                  </Typography>
                )}
              </Box>
            </Box>

            {/* PAGE 1 FOOTER - Thin */}
            <Box
              sx={{
                mt: "auto",
                p: "4mm 15mm",
                borderTop: "2pt solid #d4af37",
                bgcolor: "#1e3a5f",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: "8pt", color: "#94a3b8" }}>
                  HAL Cost Estimation System | Generated on {new Date().toLocaleString("en-IN")}
                </Typography>
                <Typography sx={{ fontSize: "8pt", color: "#d4af37", fontWeight: "bold" }}>
                  Page 1 of {totalPages}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* OPERATION COST SUMMARY PAGES (10 ops per page) */}
          {summaryChunks.map((pageRows, summaryIndex) => {
            const pageNumber = 2 + summaryIndex; // Page 2..(1+summaryPages)
            const isLastSummaryPage = summaryIndex === summaryChunks.length - 1;
            const startOp = summaryIndex * SUMMARY_OPS_PER_PAGE + 1;
            const endOp = startOp + Math.max(0, pageRows.length - 1);
            return (
              <Box key={`summary-page-${summaryIndex}`} data-page={pageNumber} sx={{ minHeight: "1123px", bgcolor: "#ffffff", display: "flex", flexDirection: "column" }}>
                {/* Header */}
                <Box
                  sx={{
                    p: "15mm",
                    pb: "10mm",
                    borderBottom: "4pt solid #d4af37",
                    bgcolor: "#1e3a5f",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: "18pt",
                          fontWeight: "bold",
                          color: "#ffffff",
                          letterSpacing: "0.5pt",
                        }}
                      >
                        {title}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "10pt",
                          color: "#d4af37",
                          fontWeight: 500,
                        }}
                      >
                        Operation Cost Summary{summaryRows.length > SUMMARY_OPS_PER_PAGE ? ` (${startOp}-${endOp})` : ""}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Box sx={{ bgcolor: "#d4af37", color: "#1e3a5f", px: "10pt", py: "4pt", borderRadius: "3pt", mb: 0.5 }}>
                        <Typography sx={{ fontSize: "10pt", fontWeight: "bold" }}>
                          Part: {part?.part_number || "N/A"}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: "8pt", color: "#94a3b8", mt: 0.5 }}>
                        Page {pageNumber}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* SUMMARY SECTION */}
                <Box sx={{ px: 0, py: "12mm", flex: 1 }}>
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      sx={{
                        fontSize: "14pt",
                        fontWeight: "bold",
                        color: "#1e3a5f",
                        textAlign: "center",
                        pb: 1,
                        borderBottom: "2pt solid #38bdf8",
                        display: "inline-block",
                        width: "100%",
                      }}
                    >
                      OPERATION COST SUMMARY
                    </Typography>
                  </Box>

                  {/* Summary Table - Larger */}
                  <Box
                    sx={{
                      border: "2pt solid #d4af37",
                      overflow: "hidden",
                      boxShadow: "0 3pt 6pt rgba(0,0,0,0.15)",
                      width: "100%",
                      minHeight: "60vh",
                    }}
                  >
                    {/* Table Header - 5 columns (removed Setup and Cycle) */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "80px 2fr 1.2fr 1fr 1.2fr",
                        bgcolor: "#1e3a5f",
                        color: "#d4af37",
                        alignItems: "center",
                        p: "6pt 0",
                      }}
                    >
                  <Box sx={{ p: "10pt", textAlign: "center" }}>
                    <Typography sx={{ fontSize: "10pt", fontWeight: "bold", color: "#d4af37" }}>
                      S.No
                    </Typography>
                  </Box>
                  <Box sx={{ p: "10pt" }}>
                    <Typography sx={{ fontSize: "10pt", fontWeight: "bold", color: "#d4af37" }}>
                      Operation
                    </Typography>
                  </Box>
                  <Box sx={{ p: "10pt", textAlign: "right" }}>
                    <Typography sx={{ fontSize: "10pt", fontWeight: "bold", color: "#d4af37" }}>
                      Base Cost
                    </Typography>
                  </Box>
                  <Box sx={{ p: "10pt", textAlign: "right" }}>
                    <Typography sx={{ fontSize: "10pt", fontWeight: "bold", color: "#d4af37" }}>
                      Misc Cost
                    </Typography>
                  </Box>
                  <Box sx={{ p: "10pt", textAlign: "right" }}>
                    <Typography sx={{ fontSize: "10pt", fontWeight: "bold", color: "#d4af37" }}>
                      Total Cost
                    </Typography>
                  </Box>
                </Box>
                    {/* Table Body - 5 columns - Larger */}
                    {pageRows.length === 0 ? (
                      <Box sx={{ p: "14pt", textAlign: "center", bgcolor: "#f8fafc" }}>
                        <Typography sx={{ color: "#64748b", fontSize: "11pt" }}>
                          No operations calculated yet
                        </Typography>
                      </Box>
                    ) : (
                      pageRows.map((row, idx) => {
                        const unitCost = Number(operationResults?.[row.idx]?.cost_breakdown?.unit_cost);
                        const baseCost = Number.isFinite(unitCost) ? unitCost : row.value;
                        const serialNo = summaryIndex * SUMMARY_OPS_PER_PAGE + idx + 1;
                        return (
                          <Box
                            key={row.idx}
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "80px 2fr 1.2fr 1fr 1.2fr",
                              bgcolor: serialNo % 2 === 1 ? "#ffffff" : "#f1f5f9",
                              borderTop: "1pt solid #e2e8f0",
                              alignItems: "center",
                              p: "6pt 0",
                            }}
                          >
                            <Box sx={{ p: "10pt", textAlign: "center" }}>
                              <Typography sx={{ fontSize: "11pt", color: "#475569", fontWeight: 600 }}>
                                {serialNo}
                              </Typography>
                            </Box>
                            <Box sx={{ p: "10pt", minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontSize: "11pt",
                                  color: "#1e293b",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {row.label}
                              </Typography>
                            </Box>
                            <Box sx={{ p: "10pt", textAlign: "right" }}>
                              <Typography sx={{ fontSize: "10pt", color: "#475569", fontFamily: "monospace" }}>
                                {formatCurrency(baseCost)}
                              </Typography>
                            </Box>
                            <Box sx={{ p: "10pt", textAlign: "right" }}>
                              <Typography sx={{ fontSize: "10pt", color: "#1e3a5f", fontWeight: 600 }}>—</Typography>
                            </Box>
                            <Box sx={{ p: "10pt", textAlign: "right" }}>
                              <Typography
                                sx={{
                                  fontSize: "10pt",
                                  color: "#1e3a5f",
                                  fontFamily: "monospace",
                                  fontWeight: "bold",
                                }}
                              >
                                {formatCurrency(baseCost)}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })
                    )}

                    {/* Misc + Grand total only on last summary page - 5 columns - Larger */}
                    {isLastSummaryPage && partMiscTotal > 0 && summaryRows.length > 0 && (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "80px 2fr 1.2fr 1fr 1.2fr",
                          bgcolor: "#fef3c7",
                          borderTop: "2pt solid #d4af37",
                          alignItems: "center",
                          p: "8pt 0",
                        }}
                      >
                        <Box sx={{ p: "10pt" }}></Box>
                        <Box sx={{ p: "10pt" }}>
                          <Typography sx={{ fontSize: "10pt", fontWeight: "bold", color: "#92400e" }}>
                            MISCELLANEOUS TOTAL
                          </Typography>
                        </Box>
                        <Box sx={{ p: "10pt", textAlign: "right" }}>
                          <Typography sx={{ fontSize: "10pt", color: "#92400e" }}>—</Typography>
                        </Box>
                        <Box sx={{ p: "10pt", textAlign: "right" }}>
                          <Typography sx={{ fontSize: "11pt", fontWeight: "bold", color: "#92400e", fontFamily: "monospace" }}>
                            {formatCurrency(partMiscTotal)}
                          </Typography>
                        </Box>
                        <Box sx={{ p: "10pt", textAlign: "right" }}>
                          <Typography sx={{ fontSize: "10pt", color: "#92400e" }}>—</Typography>
                        </Box>
                      </Box>
                    )}

                    {summaryRows.length > 0 && (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "80px 2fr 1.2fr 1fr 1.2fr",
                          bgcolor: "#1e3a5f",
                          color: "#ffffff",
                          borderTop: "3pt solid #d4af37",
                          alignItems: "center",
                          p: "8pt 0",
                        }}
                      >
                        <Box sx={{ p: "10pt" }}></Box>
                        <Box sx={{ p: "10pt" }}>
                          <Typography sx={{ fontSize: "12pt", fontWeight: "bold", color: "#d4af37" }}>
                            GRAND TOTAL
                          </Typography>
                        </Box>
                        <Box sx={{ p: "10pt", textAlign: "right" }}>
                          <Typography sx={{ fontSize: "10pt", color: "#94a3b8", fontFamily: "monospace" }}>
                            {formatCurrency(totalUnitCost)}
                          </Typography>
                        </Box>
                        <Box sx={{ p: "10pt", textAlign: "right" }}>
                          <Typography sx={{ fontSize: "11pt", fontWeight: "bold", color: "#d4af37", fontFamily: "monospace" }}>
                            {formatCurrency(partMiscTotal)}
                          </Typography>
                        </Box>
                        <Box sx={{ p: "10pt", textAlign: "right" }}>
                          <Typography sx={{ fontSize: "13pt", fontWeight: "bold", color: "#d4af37", fontFamily: "monospace" }}>
                            {formatCurrency(totalUnitCost + partMiscTotal)}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Footer - Thin */}
                <Box
                  sx={{
                    mt: "auto",
                    p: "4mm 15mm",
                    borderTop: "2pt solid #d4af37",
                    bgcolor: "#1e3a5f",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: "8pt", color: "#94a3b8" }}>
                      HAL Cost Estimation System | Generated on {new Date().toLocaleString("en-IN")}
                    </Typography>
                    <Typography sx={{ fontSize: "8pt", color: "#d4af37", fontWeight: "bold" }}>
                      Page {pageNumber} of {totalPages}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}

          {/* DETAILED BREAKDOWN PAGES: Split operations into chunks of 5 per page */}
          {operationChunks.map((chunkOps, chunkIndex) => {
            const pageNumber = 2 + summaryPages + chunkIndex; // starts immediately after summary pages
            const startOpNum = chunkIndex * MAX_OPS_PER_PAGE + 1;
            const endOpNum = startOpNum + chunkOps.length - 1;
            
            return (
              <Box key={`detail-page-${chunkIndex}`} data-page={pageNumber} sx={{ minHeight: "1123px", bgcolor: "#ffffff", display: "flex", flexDirection: "column" }}>
                {/* Header for Detail Page */}
                <Box
                  sx={{
                    p: "15mm",
                    pb: "10mm",
                    borderBottom: "4pt solid #d4af37",
                    bgcolor: "#1e3a5f",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: "18pt",
                          fontWeight: "bold",
                          color: "#ffffff",
                          letterSpacing: "0.5pt",
                        }}
                      >
                        {title}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "10pt",
                          color: "#d4af37",
                          fontWeight: 500,
                        }}
                      >
                        Detailed Cost Breakdown ({startOpNum}-{endOpNum})
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Box sx={{ bgcolor: "#d4af37", color: "#1e3a5f", px: "10pt", py: "4pt", borderRadius: "3pt", mb: 0.5 }}>
                        <Typography sx={{ fontSize: "10pt", fontWeight: "bold" }}>
                          Part: {part?.part_number || "N/A"}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: "8pt", color: "#94a3b8", mt: 0.5 }}>
                        Page {pageNumber}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* DETAILED METRICS SECTION */}
                <Box sx={{ px: 0, py: "8mm", flex: 1 }}>
                  {/* Section Header with Color */}
                  <Box 
                    sx={{ 
                      mb: 3, 
                      p: "10pt", 
                      bgcolor: "#f0f9ff", 
                      borderRadius: "4pt",
                      border: "1pt solid #38bdf8",
                      borderLeft: "4pt solid #38bdf8"
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "13pt",
                        fontWeight: "bold",
                        color: "#1e3a5f",
                        textAlign: "center",
                      }}
                    >
                      DETAILED COST BREAKDOWN
                    </Typography>
                  </Box>

                  {/* Metrics Table - Increased size to fill page */}
                  <Box 
                    sx={{ 
                      border: "2pt solid #d4af37",
                      overflow: "hidden",
                      boxShadow: "0 3pt 6pt rgba(0,0,0,0.15)",
                      width: "100%",
                      minHeight: "60vh",
                    }}
                  >
                    {/* Header - Larger */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: `minmax(250px, 2fr) repeat(${chunkOps.length}, 1fr)`,
                        bgcolor: "#1e3a5f",
                        color: "#d4af37",
                        p: "10pt 8pt",
                      }}
                    >
                      <Box sx={{ p: "8pt 12pt" }}>
                        <Typography sx={{ fontSize: "11pt", fontWeight: "bold", color: "#d4af37" }}>
                          COST COMPONENT
                        </Typography>
                      </Box>
                      {chunkOps.map((op) => (
                        <Box key={op.idx} sx={{ p: "8pt 6pt", textAlign: "center" }}>
                          <Typography sx={{ fontSize: "10pt", fontWeight: "bold", color: "#d4af37" }}>
                            {op.label}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Body with Alternating Colors */}
                    
                    {/* Setup Time Row - Larger */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: `minmax(250px, 2fr) repeat(${chunkOps.length}, 1fr)`,
                        bgcolor: "#ffffff",
                        borderTop: "1pt solid #e2e8f0",
                        p: "6pt 0",
                      }}
                    >
                      <Box sx={{ p: "8pt 12pt", bgcolor: "#f8fafc" }}>
                        <Typography
                          sx={{
                            fontSize: "10pt",
                            color: "#1e3a5f",
                            fontWeight: 600,
                          }}
                        >
                          Setup Time (hrs)
                        </Typography>
                      </Box>
                      {chunkOps.map((op) => {
                        const setupTime = operations?.[op.idx]?.setup_time;
                        return (
                          <Box
                            key={`setup-${op.idx}`}
                            sx={{ p: "8pt 6pt", textAlign: "right" }}
                          >
                            <Typography
                              sx={{
                                fontSize: "9pt",
                                color: "#475569",
                                fontFamily: "monospace",
                              }}
                            >
                              {setupTime ?? "-"}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>

                    {/* Cycle Time Row - Larger */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: `minmax(250px, 2fr) repeat(${chunkOps.length}, 1fr)`,
                        bgcolor: "#f1f5f9",
                        borderTop: "1pt solid #e2e8f0",
                        p: "6pt 0",
                      }}
                    >
                      <Box sx={{ p: "8pt 12pt", bgcolor: "#f8fafc" }}>
                        <Typography
                          sx={{
                            fontSize: "10pt",
                            color: "#1e3a5f",
                            fontWeight: 600,
                          }}
                        >
                          Cycle Time (hrs)
                        </Typography>
                      </Box>
                      {chunkOps.map((op) => {
                        const cycleTime = operations?.[op.idx]?.cycle_time;
                        return (
                          <Box
                            key={`cycle-${op.idx}`}
                            sx={{ p: "8pt 6pt", textAlign: "right" }}
                          >
                            <Typography
                              sx={{
                                fontSize: "9pt",
                                color: "#475569",
                                fontFamily: "monospace",
                              }}
                            >
                              {cycleTime ?? "-"}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>

                    {filteredMetricKeys.map((k, idx) => (
                      <Box
                        key={k}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: `minmax(250px, 2fr) repeat(${chunkOps.length}, 1fr)`,
                          bgcolor: idx % 2 === 0 ? "#ffffff" : "#f1f5f9",
                          borderTop: "1pt solid #e2e8f0",
                          p: "6pt 0",
                        }}
                      >
                        <Box sx={{ p: "8pt 12pt", bgcolor: "#f8fafc" }}>
                          <Typography
                            sx={{
                              fontSize: "10pt",
                              color: "#1e3a5f",
                              fontWeight: 600,
                            }}
                          >
                            {k}
                          </Typography>
                        </Box>
                        {chunkOps.map((op) => (
                          <Box
                            key={`${k}-${op.idx}`}
                            sx={{ p: "8pt 6pt", textAlign: "right" }}
                          >
                            <Typography
                              sx={{
                                fontSize: "9pt",
                                color: "#475569",
                                fontFamily: "monospace",
                              }}
                            >
                              {op.map.get(k) ?? "-"}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ))}
                    
                    {/* Miscellaneous Costs - Gold Highlight - Larger */}
                    {partMiscTotal > 0 && (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: `minmax(250px, 2fr) repeat(${chunkOps.length}, 1fr)`,
                          bgcolor: "#fef3c7",
                          borderTop: "2pt solid #d4af37",
                          p: "8pt 0",
                        }}
                      >
                        <Box sx={{ p: "8pt 12pt", bgcolor: "#fcd34d" }}>
                          <Typography
                            sx={{
                              fontSize: "10pt",
                              color: "#92400e",
                              fontWeight: "bold",
                            }}
                          >
                            Miscellaneous
                          </Typography>
                        </Box>
                        {chunkOps.map((op) => (
                          <Box
                            key={`misc-${op.idx}`}
                            sx={{ p: "8pt 6pt", textAlign: "right" }}
                          >
                            <Typography
                              sx={{
                                fontSize: "10pt",
                                color: "#92400e",
                                fontFamily: "monospace",
                                fontWeight: "bold",
                              }}
                            >
                              {formatCurrency(partMiscTotal)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* Definitions Box - only on last page */}
                  {chunkIndex === operationChunks.length - 1 && (
                    <Box sx={{ mt: 3, p: "10pt", bgcolor: "#f0f9ff", borderRadius: "4pt", border: "1pt solid #38bdf8", borderLeft: "4pt solid #38bdf8" }}>
                      <Typography
                        sx={{
                          fontSize: "8pt",
                          color: "#64748b",
                          fontWeight: "bold",
                          mb: 1,
                        }}
                      >
                        DEFINITIONS:
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: "4pt 16pt",
                        }}
                      >
                        <Typography sx={{ fontSize: "7pt", color: "#64748b" }}>
                          • <strong>Basic Cost:</strong> Raw material + Machine cost base
                        </Typography>
                        <Typography sx={{ fontSize: "7pt", color: "#64748b" }}>
                          • <strong>Overheads:</strong> Indirect operational costs
                        </Typography>
                        <Typography sx={{ fontSize: "7pt", color: "#64748b" }}>
                          • <strong>Profit:</strong> Margin applied to unit cost
                        </Typography>
                        <Typography sx={{ fontSize: "7pt", color: "#64748b" }}>
                          • <strong>MHR:</strong> Machine Hour Rate (₹/hour)
                        </Typography>
                        <Typography sx={{ fontSize: "7pt", color: "#64748b" }}>
                          • <strong>Misc:</strong> Miscellaneous additional costs
                        </Typography>
                        <Typography sx={{ fontSize: "7pt", color: "#64748b" }}>
                          • <strong>Total with Misc:</strong> Final cost including all items
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>

                {/* Page Footer - Thin */}
                <Box
                  sx={{
                    mt: "auto",
                    p: "4mm 15mm",
                    borderTop: "2pt solid #d4af37",
                    bgcolor: "#1e3a5f",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: "8pt", color: "#94a3b8" }}>
                      HAL Cost Estimation System | Generated on {new Date().toLocaleString("en-IN")}
                    </Typography>
                    <Typography sx={{ fontSize: "8pt", color: "#d4af37", fontWeight: "bold" }}>
                      Page {pageNumber} of {totalPages}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          bgcolor: "#0a0f1a",
          px: 3,
          py: 2,
          borderTop: "1px solid rgba(148,163,184,0.2)",
          justifyContent: "space-between",
        }}
      >
        <Button
          onClick={onClose}
          startIcon={<CloseIcon />}
          sx={{
            color: "#e5e7eb",
            textTransform: "none",
            fontWeight: 600,
            fontSize: "10pt",
          }}
        >
          Close Preview
        </Button>
        <Button
          onClick={handleDownload}
          variant="contained"
          startIcon={<DownloadIcon />}
          sx={{
            bgcolor: "#38bdf8",
            color: "#0f172a",
            textTransform: "none",
            fontWeight: "bold",
            fontSize: "10pt",
            px: 3,
            py: 1,
            "&:hover": { bgcolor: "#0ea5e9" },
          }}
        >
          Download PDF (A4 Full Page)
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PdfReportExport;
