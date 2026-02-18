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
          {/* PAGE 1: Header, Drawing, Operation Summary */}
          <Box data-page="1" sx={{ minHeight: "1123px", bgcolor: "#ffffff", display: "flex", flexDirection: "column" }}>
            {/* HEADER SECTION */}
            <Box
              sx={{
                p: "15mm",
                pb: "10mm",
                bgcolor: "#1e3a5f",
                borderBottom: "4pt solid #d4af37",
              }}
            >
              {/* Title Row */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontSize: "24pt",
                      fontWeight: "bold",
                      color: "#ffffff",
                      letterSpacing: "0.5pt",
                      mb: 0.5,
                    }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "12pt",
                      color: "#94a3b8",
                      fontWeight: 500,
                    }}
                  >
                    Project: {projectData?.project_name || "Untitled Project"}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Box
                    sx={{
                      bgcolor: "#d4af37",
                      color: "#1e3a5f",
                      px: "12pt",
                      py: "6pt",
                      borderRadius: "4pt",
                      mb: 1,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "10pt",
                        fontWeight: "bold",
                      }}
                    >
                      Part No: {part?.part_number || "N/A"}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: "9pt",
                      color: "#94a3b8",
                    }}
                  >
                    Date: {new Date().toLocaleDateString("en-IN")}
                  </Typography>
                </Box>
              </Box>

              {/* Project Info Grid */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 2,
                  mt: 2,
                  p: "8pt",
                  bgcolor: "rgba(255,255,255,0.1)",
                  borderRadius: "4pt",
                  border: "1pt solid rgba(212,175,55,0.5)",
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontSize: "8pt",
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
                      fontSize: "10pt",
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
                      fontSize: "8pt",
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
                      fontSize: "10pt",
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
                      fontSize: "8pt",
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
                      fontSize: "10pt",
                      fontWeight: "bold",
                      color: "#ffffff",
                    }}
                  >
                    {projectData?.project_date || "N/A"}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* 2D DRAWING SECTION */}
            <Box sx={{ p: "15mm", pt: "12mm" }}>
              <Box
                sx={{
                  mb: 3,
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
                  height: "320px",
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

            {/* OPERATION SUMMARY SECTION */}
            <Box sx={{ px: "15mm", py: "8mm", flex: 1 }}>
              <Box sx={{ mb: 3 }}>
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
                  OPERATION COST SUMMARY
                </Typography>
              </Box>

              {/* Summary Table */}
              <Box
                sx={{
                  border: "1pt solid #d4af37",
                  borderRadius: "4pt",
                  overflow: "hidden",
                  boxShadow: "0 2pt 4pt rgba(0,0,0,0.1)",
                }}
              >
                {/* Table Header */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "50px 1.5fr 1fr 1fr 1.2fr",
                    bgcolor: "#1e3a5f",
                    color: "#d4af37",
                  }}
                >
                  <Box sx={{ p: "8pt", textAlign: "center" }}>
                    <Typography sx={{ fontSize: "9pt", fontWeight: "bold", color: "#d4af37" }}>
                      S.No
                    </Typography>
                  </Box>
                  <Box sx={{ p: "8pt" }}>
                    <Typography sx={{ fontSize: "9pt", fontWeight: "bold", color: "#d4af37" }}>
                      Operation
                    </Typography>
                  </Box>
                  <Box sx={{ p: "8pt", textAlign: "right" }}>
                    <Typography sx={{ fontSize: "9pt", fontWeight: "bold", color: "#d4af37" }}>
                      Base Cost
                    </Typography>
                  </Box>
                  <Box sx={{ p: "8pt", textAlign: "right" }}>
                    <Typography sx={{ fontSize: "9pt", fontWeight: "bold", color: "#d4af37" }}>
                      Misc Cost
                    </Typography>
                  </Box>
                  <Box sx={{ p: "8pt", textAlign: "right" }}>
                    <Typography sx={{ fontSize: "9pt", fontWeight: "bold", color: "#d4af37" }}>
                      Total Cost
                    </Typography>
                  </Box>
                </Box>

                {/* Table Body */}
                {summaryRows.length === 0 ? (
                  <Box sx={{ p: "12pt", textAlign: "center", bgcolor: "#f8fafc" }}>
                    <Typography sx={{ color: "#64748b", fontSize: "10pt" }}>
                      No operations calculated yet
                    </Typography>
                  </Box>
                ) : (
                  summaryRows.map((row, idx) => {
                    const miscPerOp = partMiscTotal / summaryRows.length;
                    const baseCost = row.value - miscPerOp;
                    return (
                      <Box
                        key={row.idx}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "50px 1.5fr 1fr 1fr 1.2fr",
                          bgcolor: idx % 2 === 0 ? "#ffffff" : "#f1f5f9",
                          borderTop: "1pt solid #e2e8f0",
                        }}
                      >
                        <Box sx={{ p: "8pt", textAlign: "center" }}>
                          <Typography sx={{ fontSize: "10pt", color: "#475569", fontWeight: 600 }}>
                            {idx + 1}
                          </Typography>
                        </Box>
                        <Box sx={{ p: "8pt" }}>
                          <Typography
                            sx={{
                              fontSize: "10pt",
                              color: "#1e293b",
                              fontWeight: 600,
                            }}
                          >
                            {row.label}
                          </Typography>
                        </Box>
                        <Box sx={{ p: "8pt", textAlign: "right" }}>
                          <Typography sx={{ fontSize: "10pt", color: "#475569" }}>
                            {formatCurrency(baseCost)}
                          </Typography>
                        </Box>
                        <Box sx={{ p: "8pt", textAlign: "right" }}>
                          <Typography sx={{ fontSize: "10pt", color: "#1e3a5f", fontWeight: 600 }}>
                            {formatCurrency(miscPerOp)}
                          </Typography>
                        </Box>
                        <Box sx={{ p: "8pt", textAlign: "right" }}>
                          <Typography
                            sx={{
                              fontSize: "10pt",
                              color: "#1e3a5f",
                              fontWeight: "bold",
                            }}
                          >
                            {formatCurrency(row.value)}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })
                )}

                {/* Global Misc Summary Row */}
                {partMiscTotal > 0 && summaryRows.length > 0 && (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "50px 1.5fr 1fr 1fr 1.2fr",
                      bgcolor: "#fef3c7",
                      borderTop: "2pt solid #d4af37",
                    }}
                  >
                    <Box sx={{ p: "8pt" }}></Box>
                    <Box sx={{ p: "8pt" }}>
                      <Typography sx={{ fontSize: "9pt", fontWeight: "bold", color: "#92400e" }}>
                        GLOBAL MISC TOTAL
                      </Typography>
                    </Box>
                    <Box sx={{ p: "8pt", textAlign: "right" }}>
                      <Typography sx={{ fontSize: "9pt", color: "#92400e" }}>—</Typography>
                    </Box>
                    <Box sx={{ p: "8pt", textAlign: "right" }}>
                      <Typography sx={{ fontSize: "10pt", fontWeight: "bold", color: "#92400e" }}>
                        {formatCurrency(partMiscTotal)}
                      </Typography>
                    </Box>
                    <Box sx={{ p: "8pt", textAlign: "right" }}>
                      <Typography sx={{ fontSize: "9pt", color: "#92400e" }}>—</Typography>
                    </Box>
                  </Box>
                )}

                {/* Grand Total */}
                {summaryRows.length > 0 && (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "50px 1.5fr 1fr 1fr 1.2fr",
                      bgcolor: "#1e3a5f",
                      color: "#ffffff",
                      borderTop: "3pt solid #d4af37",
                    }}
                  >
                    <Box sx={{ p: "8pt" }}></Box>
                    <Box sx={{ p: "8pt" }}>
                      <Typography
                        sx={{ fontSize: "11pt", fontWeight: "bold", color: "#d4af37" }}
                      >
                        GRAND TOTAL
                      </Typography>
                    </Box>
                    <Box sx={{ p: "8pt", textAlign: "right" }}>
                      <Typography sx={{ fontSize: "9pt", color: "#94a3b8" }}>
                        {formatCurrency(totalAmount - partMiscTotal)}
                      </Typography>
                    </Box>
                    <Box sx={{ p: "8pt", textAlign: "right" }}>
                      <Typography sx={{ fontSize: "10pt", fontWeight: "bold", color: "#d4af37" }}>
                        {formatCurrency(partMiscTotal)}
                      </Typography>
                    </Box>
                    <Box sx={{ p: "8pt", textAlign: "right" }}>
                      <Typography
                        sx={{
                          fontSize: "12pt",
                          fontWeight: "bold",
                          color: "#d4af37",
                        }}
                      >
                        {formatCurrency(totalAmount)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Cost Calculation Note */}
              {partMiscTotal > 0 && (
                <Box sx={{ mt: 2, p: "8pt", bgcolor: "#f0f9ff", borderRadius: "4pt", border: "1pt solid #38bdf8" }}>
                  <Typography sx={{ fontSize: "8pt", color: "#0369a1", textAlign: "center" }}>
                    <strong>Calculation:</strong> Base Cost + Misc Cost ({formatCurrency(partMiscTotal)} distributed equally across {summaryRows.length} operations) = Total Cost
                  </Typography>
                </Box>
              )}
            </Box>

            {/* PAGE 1 FOOTER */}
            <Box
              sx={{
                mt: "auto",
                p: "15mm",
                pt: "8mm",
                borderTop: "3pt solid #d4af37",
                bgcolor: "#1e3a5f",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: "8pt", color: "#94a3b8" }}>
                  HAL Cost Estimation System | Generated on {new Date().toLocaleString("en-IN")}
                </Typography>
                <Typography sx={{ fontSize: "8pt", color: "#d4af37", fontWeight: "bold" }}>
                  Page 1 of {metricsOps.length > 0 ? 1 + totalDetailPages : "1"}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* DETAILED BREAKDOWN PAGES: Split operations into chunks of 10 per page */}
          {operationChunks.map((chunkOps, chunkIndex) => {
            const pageNumber = chunkIndex + 2; // Page 2, 3, 4, etc.
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
                <Box sx={{ px: "15mm", py: "8mm", flex: 1 }}>
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

                  {/* Metrics Table with Professional Styling */}
                  <Box
                    sx={{
                      border: "1pt solid #d4af37",
                      borderRadius: "4pt",
                      overflow: "hidden",
                      boxShadow: "0 2pt 4pt rgba(0,0,0,0.1)",
                    }}
                  >
                    {/* Header */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: `180px repeat(${chunkOps.length}, 1fr)`,
                        bgcolor: "#1e3a5f",
                        color: "#d4af37",
                      }}
                    >
                      <Box sx={{ p: "6pt" }}>
                        <Typography sx={{ fontSize: "8pt", fontWeight: "bold", color: "#d4af37" }}>
                          COST COMPONENT
                        </Typography>
                      </Box>
                      {chunkOps.map((op) => (
                        <Box key={op.idx} sx={{ p: "6pt", textAlign: "center" }}>
                          <Typography sx={{ fontSize: "8pt", fontWeight: "bold", color: "#d4af37" }}>
                            {op.label}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Body with Alternating Colors */}
                    {filteredMetricKeys.map((k, idx) => (
                      <Box
                        key={k}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: `180px repeat(${chunkOps.length}, 1fr)`,
                          bgcolor: idx % 2 === 0 ? "#ffffff" : "#f1f5f9",
                          borderTop: "1pt solid #e2e8f0",
                        }}
                      >
                        <Box sx={{ p: "5pt 6pt", bgcolor: "#f8fafc" }}>
                          <Typography
                            sx={{
                              fontSize: "8pt",
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
                            sx={{ p: "5pt 6pt", textAlign: "right" }}
                          >
                            <Typography
                              sx={{
                                fontSize: "8pt",
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
                    
                    {/* Global Miscellaneous Row - Gold Highlight */}
                    {partMiscTotal > 0 && (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: `180px repeat(${chunkOps.length}, 1fr)`,
                          bgcolor: "#fef3c7",
                          borderTop: "2pt solid #d4af37",
                        }}
                      >
                        <Box sx={{ p: "6pt", bgcolor: "#fcd34d" }}>
                          <Typography
                            sx={{
                              fontSize: "9pt",
                              color: "#92400e",
                              fontWeight: "bold",
                            }}
                          >
                            Global Miscellaneous
                          </Typography>
                        </Box>
                        {chunkOps.map((op) => (
                          <Box
                            key={`misc-${op.idx}`}
                            sx={{ p: "6pt", textAlign: "right" }}
                          >
                            <Typography
                              sx={{
                                fontSize: "9pt",
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

                {/* Page Footer */}
                <Box
                  sx={{
                    mt: "auto",
                    p: "15mm",
                    pt: "8mm",
                    borderTop: "3pt solid #d4af37",
                    bgcolor: "#1e3a5f",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: "8pt", color: "#94a3b8" }}>
                      HAL Cost Estimation System | Generated on {new Date().toLocaleString("en-IN")}
                    </Typography>
                    <Typography sx={{ fontSize: "8pt", color: "#d4af37", fontWeight: "bold" }}>
                      Page {pageNumber} of {1 + totalDetailPages}
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
