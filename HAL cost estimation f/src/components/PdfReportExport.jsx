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
  const metricKeys =
    metricsOps.length > 0
      ? Array.from(
          metricsOps.reduce((acc, op) => {
            op.map.forEach((_, k) => acc.add(k));
            return acc;
          }, new Set())
        ).sort((a, b) => String(a).localeCompare(String(b)))
      : [];

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
      // Check if we need a second page
      const page2Content = content.querySelector('[data-page="2"]');
      
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

      // Add second page if detailed metrics exist
      if (page2Content && page2Content.children.length > 0) {
        pdf.addPage();
        const canvas2 = await html2canvas(page2Content, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 794,
          windowHeight: 1123,
        });
        const imgHeight2 = (canvas2.height * imgWidth) / canvas2.width;
        const imgData2 = canvas2.toDataURL("image/png", 1.0);
        pdf.addImage(imgData2, "PNG", MARGIN, MARGIN, imgWidth, Math.min(imgHeight2, A4_HEIGHT - 2 * MARGIN));
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
                borderBottom: "3pt solid #1e3a5f",
                bgcolor: "#f8fafc",
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
                      fontSize: "22pt",
                      fontWeight: "bold",
                      color: "#1e3a5f",
                      letterSpacing: "0.5pt",
                      mb: 0.5,
                    }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "12pt",
                      color: "#64748b",
                      fontWeight: 500,
                    }}
                  >
                    Project: {projectData?.project_name || "Untitled Project"}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography
                    sx={{
                      fontSize: "11pt",
                      color: "#475569",
                      fontWeight: "bold",
                    }}
                  >
                    Part No: {part?.part_number || "N/A"}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "9pt",
                      color: "#64748b",
                      mt: 0.5,
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
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontSize: "8pt",
                      color: "#64748b",
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
                      color: "#1e293b",
                    }}
                  >
                    {projectData?.po_reference_number || "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: "8pt",
                      color: "#64748b",
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
                      color: "#1e293b",
                    }}
                  >
                    {projectData?.customer_name || "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: "8pt",
                      color: "#64748b",
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
                      color: "#1e293b",
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
                  border: "1pt solid #e2e8f0",
                  borderRadius: "4pt",
                  overflow: "hidden",
                }}
              >
                {/* Table Header */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 1.2fr",
                    bgcolor: "#1e3a5f",
                    color: "#ffffff",
                  }}
                >
                  <Box sx={{ p: "8pt", textAlign: "center" }}>
                    <Typography sx={{ fontSize: "9pt", fontWeight: "bold" }}>
                      S.No
                    </Typography>
                  </Box>
                  <Box sx={{ p: "8pt" }}>
                    <Typography sx={{ fontSize: "9pt", fontWeight: "bold" }}>
                      Operation Description
                    </Typography>
                  </Box>
                  <Box sx={{ p: "8pt", textAlign: "right" }}>
                    <Typography sx={{ fontSize: "9pt", fontWeight: "bold" }}>
                      Total Cost (with Misc)
                    </Typography>
                  </Box>
                </Box>

                {/* Table Body */}
                {summaryRows.length === 0 ? (
                  <Box sx={{ p: "12pt", textAlign: "center" }}>
                    <Typography sx={{ color: "#64748b", fontSize: "10pt" }}>
                      No operations calculated yet
                    </Typography>
                  </Box>
                ) : (
                  summaryRows.map((row, idx) => (
                    <Box
                      key={row.idx}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "60px 1fr 1.2fr",
                        bgcolor: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                        borderTop: "1pt solid #e2e8f0",
                      }}
                    >
                      <Box sx={{ p: "8pt", textAlign: "center" }}>
                        <Typography sx={{ fontSize: "10pt", color: "#475569" }}>
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
                  ))
                )}

                {/* Grand Total */}
                {summaryRows.length > 0 && (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "60px 1fr 1.2fr",
                      bgcolor: "#1e3a5f",
                      color: "#ffffff",
                      borderTop: "2pt solid #38bdf8",
                    }}
                  >
                    <Box sx={{ p: "8pt" }}></Box>
                    <Box sx={{ p: "8pt" }}>
                      <Typography
                        sx={{ fontSize: "10pt", fontWeight: "bold" }}
                      >
                        GRAND TOTAL
                      </Typography>
                    </Box>
                    <Box sx={{ p: "8pt", textAlign: "right" }}>
                      <Typography
                        sx={{
                          fontSize: "11pt",
                          fontWeight: "bold",
                          color: "#38bdf8",
                        }}
                      >
                        {formatCurrency(totalAmount)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>

            {/* PAGE 1 FOOTER */}
            <Box
              sx={{
                mt: "auto",
                p: "15mm",
                pt: "8mm",
                borderTop: "1pt solid #e2e8f0",
                bgcolor: "#f8fafc",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: "7pt", color: "#94a3b8" }}>
                  HAL Cost Estimation System | Generated on {new Date().toLocaleString("en-IN")}
                </Typography>
                <Typography sx={{ fontSize: "7pt", color: "#94a3b8" }}>
                  Page 1 of {metricsOps.length > 0 ? "2" : "1"}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* PAGE 2: Detailed Cost Breakdown */}
          {metricsOps.length > 0 && (
            <Box data-page="2" sx={{ minHeight: "1123px", bgcolor: "#ffffff", display: "flex", flexDirection: "column" }}>
              {/* Header for Page 2 */}
              <Box
                sx={{
                  p: "15mm",
                  pb: "10mm",
                  borderBottom: "3pt solid #1e3a5f",
                  bgcolor: "#f8fafc",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box>
                    <Typography
                      sx={{
                        fontSize: "18pt",
                        fontWeight: "bold",
                        color: "#1e3a5f",
                        letterSpacing: "0.5pt",
                      }}
                    >
                      {title}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "10pt",
                        color: "#64748b",
                        fontWeight: 500,
                      }}
                    >
                      Detailed Cost Breakdown
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography sx={{ fontSize: "10pt", color: "#475569", fontWeight: "bold" }}>
                      Part: {part?.part_number || "N/A"}
                    </Typography>
                    <Typography sx={{ fontSize: "8pt", color: "#64748b", mt: 0.5 }}>
                      Page 2
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* DETAILED METRICS SECTION */}
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
                    DETAILED COST BREAKDOWN
                  </Typography>
                </Box>

                {/* Metrics Table */}
                <Box
                  sx={{
                    border: "1pt solid #e2e8f0",
                    borderRadius: "4pt",
                    overflow: "hidden",
                  }}
                >
                  {/* Header */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: `180px repeat(${metricsOps.length}, 1fr)`,
                      bgcolor: "#1e3a5f",
                      color: "#ffffff",
                    }}
                  >
                    <Box sx={{ p: "6pt" }}>
                      <Typography sx={{ fontSize: "8pt", fontWeight: "bold" }}>
                        COST COMPONENT
                      </Typography>
                    </Box>
                    {metricsOps.map((op) => (
                      <Box key={op.idx} sx={{ p: "6pt", textAlign: "center" }}>
                        <Typography sx={{ fontSize: "8pt", fontWeight: "bold" }}>
                          {op.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Body */}
                  {metricKeys.map((k, idx) => (
                    <Box
                      key={k}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: `180px repeat(${metricsOps.length}, 1fr)`,
                        bgcolor: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                        borderTop: "1pt solid #e2e8f0",
                      }}
                    >
                      <Box sx={{ p: "5pt 6pt" }}>
                        <Typography
                          sx={{
                            fontSize: "8pt",
                            color: "#475569",
                            fontWeight: 500,
                          }}
                        >
                          {k}
                        </Typography>
                      </Box>
                      {metricsOps.map((op) => (
                        <Box
                          key={`${k}-${op.idx}`}
                          sx={{ p: "5pt 6pt", textAlign: "right" }}
                        >
                          <Typography
                            sx={{
                              fontSize: "8pt",
                              color: "#1e293b",
                              fontFamily: "monospace",
                            }}
                          >
                            {op.map.get(k) ?? "-"}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Box>

                {/* Legend */}
                <Box sx={{ mt: 3, p: "8pt", bgcolor: "#f1f5f9", borderRadius: "4pt" }}>
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
              </Box>

              {/* PAGE 2 FOOTER */}
              <Box
                sx={{
                  mt: "auto",
                  p: "15mm",
                  pt: "8mm",
                  borderTop: "1pt solid #e2e8f0",
                  bgcolor: "#f8fafc",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontSize: "7pt", color: "#94a3b8" }}>
                    HAL Cost Estimation System | Generated on {new Date().toLocaleString("en-IN")}
                  </Typography>
                  <Typography sx={{ fontSize: "7pt", color: "#94a3b8" }}>
                    Page 2 of 2
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
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
