import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Tooltip,
  Fade,
  Grow,
  Slide,
  Zoom
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import CalculateIcon from "@mui/icons-material/Calculate";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EngineeringIcon from "@mui/icons-material/Engineering";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import DrawIcon from "@mui/icons-material/Draw";
import SettingsIcon from "@mui/icons-material/Settings";
import AssessmentIcon from "@mui/icons-material/Assessment";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import api from "../api/client";
import { getProject, getProjectParts } from "../api/projects";
import PdfPreview from "../components/PdfPreview";
import PdfReportExport from "../components/PdfReportExport";
import { calculateCostEstimation } from "../api/costEstimation";

function isMoneyFieldKey(key) {
  if (!key) return false;
  if (key.includes("man_hours")) return false;
  return /(cost|rate|profit|overheads|packing|outsourcing)/i.test(key);
}

function formatIndianCurrency(value, alwaysShowDecimals = true) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  const num = Number(value);
  const hasDecimals = Math.abs(num - Math.trunc(num)) > Number.EPSILON || alwaysShowDecimals;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatIndianNumber(value) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  const num = Number(value);
  const hasDecimals = Math.abs(num - Math.trunc(num)) > Number.EPSILON;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatValue(key, value) {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (isMoneyFieldKey(key) || key?.includes("cost") || key?.includes("price") || key?.includes("amount") || key?.includes("total") || key?.includes("profit") || key?.includes("overheads") || key?.includes("packing")) {
      return formatIndianCurrency(value);
    }
    return formatIndianNumber(value);
  }
  return JSON.stringify(value);
}

function getInlineFileUrl(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  if (!normalized) return "";
  const isLocalUploads = normalized.startsWith("uploads/") || normalized.startsWith("uploads");
  const encodedKey = normalized.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return isLocalUploads
    ? `http://127.0.0.1:8000/files/uploads/${normalized}?inline=true`
    : `http://127.0.0.1:8000/files/download/${encodedKey}?inline=true`;
}

function isPdfPath(filePath) {
  return String(filePath || "").toLowerCase().endsWith(".pdf");
}

export default function PartCostEstimationPage({ onChange, projectId, partId }) {
  const [projectData, setProjectData] = useState(null);
  const [part, setPart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [costError, setCostError] = useState("");

  const [machines, setMachines] = useState([]);
  const [operationTypes, setOperationTypes] = useState([]);

  const [form, setForm] = useState({
    operation_type: "turning",
    shape: "round",
    diameter: "",
    length: "",
    breadth: "",
    height: "",
    material: "steel",
    machine_name: "",
    man_hours_per_unit: "",
    duty_category: "",
    miscellaneous_items: [{ description: "", amount: "" }],
  });

  const operationTypeOptions = useMemo(() => {
    const toOpValue = (name) => {
      const raw = name == null ? "" : String(name);
      const normalized = raw.trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
      return normalized.replace(/\s+/g, "_");
    };

    const supportedOperationValues = new Set([
      "turning",
      "milling",
      "drilling",
      "grinding",
      "boring",
      "heat_treatment",
      "welding",
      "surface_treatment",
      "rubber_press",
    ]);

    const toApiOpValue = (name) => {
      const v = toOpValue(name);
      if (supportedOperationValues.has(v)) return v;
      if (v.includes("boring")) return "boring";
      return v;
    };

    const rawList = Array.isArray(operationTypes) ? operationTypes : [];
    const optsFromDb = rawList
      .map((ot) => {
        const label = String(ot?.operation_name || "").trim();
        const apiValue = toApiOpValue(ot?.operation_name);
        const disabled = !supportedOperationValues.has(apiValue);
        return label ? { value: apiValue, label, disabled } : null;
      })
      .filter(Boolean);

    if (optsFromDb.length > 0) return optsFromDb;
    return Array.from(supportedOperationValues).map((v) => ({
      value: v,
      label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      disabled: false,
    }));
  }, [operationTypes]);

  const miscItems = useMemo(() => {
    const items = form?.miscellaneous_items;
    return Array.isArray(items) && items.length > 0 ? items : [{ description: "", amount: "" }];
  }, [form?.miscellaneous_items]);

  const miscTotal = useMemo(() => {
    return miscItems.reduce((sum, it) => {
      const n = Number(it?.amount);
      return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
    }, 0);
  }, [miscItems]);

  const [manHoursUploadLoading, setManHoursUploadLoading] = useState(false);
  const [manHoursUploadError, setManHoursUploadError] = useState("");
  const manHoursFileInputRef = useRef(null);

  const [costLoading, setCostLoading] = useState(false);
  const [costResult, setCostResult] = useState(null);

  const [nonrecurringCostType, setNonrecurringCostType] = useState("");
  const [nonrecurringCostAmount, setNonrecurringCostAmount] = useState("");

  const nonrecurringCostValue = useMemo(() => {
    if (!nonrecurringCostType) return 0;
    const n = Number(nonrecurringCostAmount);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [nonrecurringCostAmount, nonrecurringCostType]);

  const displayedTotalCost = useMemo(() => {
    const base = Number(costResult?.cost_breakdown?.unit_cost ?? costResult?.cost_breakdown?.total_unit_cost_with_misc);
    const baseValue = Number.isFinite(base) ? base : 0;
    return baseValue + nonrecurringCostValue;
  }, [costResult, nonrecurringCostValue]);

  const [drawingZoom, setDrawingZoom] = useState(1);
  const drawingCaptureRef = useRef(null);
  const pdfPreviewRef = useRef(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfExportOpen, setPdfExportOpen] = useState(false);

  // --- Loading Data ---
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setCostError("");
        setDrawingZoom(1);

        const [proj, parts] = await Promise.all([getProject(projectId), getProjectParts(projectId)]);
        if (cancelled) return;
        setProjectData(proj);
        const found = Array.isArray(parts) ? parts.find((p) => p.id === partId) : null;
        setPart(found || null);

        const [machinesRes, operationTypesRes] = await Promise.all([
          api.get("/machines/"),
          api.get("/operation-type/"),
        ]);
        if (cancelled) return;
        setMachines(Array.isArray(machinesRes.data) ? machinesRes.data : []);
        setOperationTypes(Array.isArray(operationTypesRes.data) ? operationTypesRes.data : []);
      } catch (e) {
        if (!cancelled) setCostError("Failed to load part/cost data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (projectId != null && partId != null) load();
    return () => { cancelled = true; };
  }, [projectId, partId]);

  // --- Filtering ---
  const normalize = (value) => {
    return value == null ? "" : String(value).trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
  };

  const filteredMachines = useMemo(() => {
    const opType = normalize(form.operation_type);
    if (!opType) return machines;
    const selectedOp = operationTypes.find((ot) => normalize(ot?.operation_name) === opType);
    const selectedOpId = selectedOp?.id != null ? String(selectedOp.id) : "";
    return machines.filter((m) => {
      const opId = m?.op_id ?? m?.operation_type_id ?? m?.operation_type?.id ?? m?.operation_types?.id;
      if (opId == null) return true;
      return String(opId) === selectedOpId;
    });
  }, [machines, operationTypes, form.operation_type]);

  useEffect(() => {
    const current = String(form.machine_name || "").trim();
    if (!current) return;
    const exists = filteredMachines.some((m) => String(m?.name || "").trim() === current);
    if (!exists) {
      setForm((p) => ({ ...p, machine_name: "" }));
    }
  }, [filteredMachines, form.machine_name]);

  // --- Handlers ---
  const handleManHoursUploadClick = () => {
    setManHoursUploadError("");
    if (manHoursFileInputRef.current) {
      manHoursFileInputRef.current.value = "";
      manHoursFileInputRef.current.click();
    }
  };

  const handleManHoursFileSelected = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setManHoursUploadLoading(true);
    setManHoursUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/man-hours/extract", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const value = res?.data?.man_hours_per_unit;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("Could not extract valid Man Hours");
      }
      setForm((p) => ({ ...p, man_hours_per_unit: String(value) }));
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to extract Man Hours";
      setManHoursUploadError(String(msg));
    } finally {
      setManHoursUploadLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCostLoading(true);
    setCostError("");
    try {
      const opType = String(form.operation_type || "").trim().toLowerCase();
      const material = String(form.material || "").trim().toLowerCase();
      const machineName = String(form.machine_name || "").trim();

      const selectedOp = operationTypes.find((ot) => normalize(ot?.operation_name) === normalize(opType));
      const selectedOpId = selectedOp?.id != null ? String(selectedOp.id) : "";
      const machineRecord = machines.find((m) => String(m?.name || "").trim() === machineName);
      if (!machineRecord) {
        throw new Error("Selected machine is not available. Please re-select the machine.");
      }
      const machineOpId = machineRecord?.op_id ?? machineRecord?.operation_type_id ?? machineRecord?.operation_type?.id ?? machineRecord?.operation_types?.id;
      const machineIsCompatible = machineOpId == null ? true : String(machineOpId) === selectedOpId;
      if (!machineIsCompatible) {
        throw new Error("Selected machine does not match the operation type. Please re-select the machine.");
      }

      const length = Number(form.length);
      const diameter = Number(form.diameter);
      const breadth = Number(form.breadth);
      const height = Number(form.height);
      const manHours = Number(form.man_hours_per_unit);
      const miscAmount = miscTotal;

      if (!machineName) {
        throw new Error("Please select a machine");
      }

      if (!Number.isFinite(manHours) || manHours <= 0) {
        throw new Error("Please enter a valid Man Hours / Unit");
      }

      if (!Number.isFinite(length) || length <= 0) {
        throw new Error("Please enter a valid Length");
      }

      if (!Number.isFinite(miscAmount) || miscAmount < 0) {
        throw new Error("Please enter a valid Miscellaneous Amount");
      }

      const roundOnlyOps = new Set(["turning", "boring"]);
      const rectangularOnlyOps = new Set(["milling", "grinding", "surface_treatment"]);
      const flexibleOps = new Set(["drilling", "heat_treatment", "welding"]);

      const dimensions = { length };
      if (roundOnlyOps.has(opType)) {
        if (!Number.isFinite(diameter) || diameter <= 0) {
          throw new Error("Please enter a valid Diameter");
        }
        dimensions.diameter = diameter;
      } else if (rectangularOnlyOps.has(opType)) {
        if (!Number.isFinite(breadth) || breadth <= 0) {
          throw new Error("Please enter a valid Breadth");
        }
        if (!Number.isFinite(height) || height <= 0) {
          throw new Error("Please enter a valid Height");
        }
        dimensions.breadth = breadth;
        dimensions.height = height;
      } else if (flexibleOps.has(opType)) {
        const shape = String(form.shape || "round").trim().toLowerCase();
        if (shape === "rectangular") {
          if (!Number.isFinite(breadth) || breadth <= 0) {
            throw new Error("Please enter a valid Breadth");
          }
          if (!Number.isFinite(height) || height <= 0) {
            throw new Error("Please enter a valid Height");
          }
          dimensions.breadth = breadth;
          dimensions.height = height;
        } else {
          if (!Number.isFinite(diameter) || diameter <= 0) {
            throw new Error("Please enter a valid Diameter");
          }
          dimensions.diameter = diameter;
        }
      } else {
        throw new Error("Invalid operation type");
      }

      const dutyCategory = String(form?.duty_category || "").trim().toLowerCase();
      const needsManualDuty = opType && opType !== "turning" && opType !== "milling";
      if (needsManualDuty && !dutyCategory) {
        throw new Error("Duty Category is required for this operation type. Please select light/medium/heavy.");
      }

      const payload = {
        dimensions,
        material,
        operation_type: opType,
        machine_name: machineName,
        man_hours_per_unit: manHours,
        ...(dutyCategory ? { duty_category: dutyCategory } : {}),
        miscellaneous_amount: miscAmount,
      };

      const res = await calculateCostEstimation(payload);
      setCostResult(res.data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || err?.toString() || "Failed to calculate cost";
      setCostError(msg);
    } finally {
      setCostLoading(false);
    }
  };

  const handleOpenPdfPreview = () => {
    setPdfExportOpen(true);
  };

  const handleDownloadPdf = async () => {
    if (!projectData || !part || !pdfPreviewRef.current) return;

    try {
      const element = pdfPreviewRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#020617",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 28;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= usableHeight;

      while (heightLeft > 5) {
        position -= usableHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= usableHeight;
      }

      const safeProject = String(projectData?.project_name || "Project").replace(/[^a-z0-9-_ ]/gi, "").trim() || "Project";
      const safePart = String(part.part_number || "Part").replace(/[^a-z0-9-_ ]/gi, "").trim() || "Part";
      pdf.save(`${safeProject}-${safePart}-Cost-Estimation.pdf`);
    } catch (e) {
      console.error("PDF Fail", e);
    }
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>;
  if (!projectData || !part) return <Box sx={{ p: 4 }}><Alert severity="error">Part or Project not found</Alert></Box>;

  const flattenForReport = (obj, prefix = "") => {
    if (obj == null) return [];
    if (typeof obj !== "object") return [{ key: prefix || "value", value: obj }];
    if (Array.isArray(obj)) return [{ key: prefix || "items", value: JSON.stringify(obj) }];

    const rows = [];
    Object.entries(obj).forEach(([k, v]) => {
      const nextKey = prefix ? `${prefix}.${k}` : k;
      if (v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        rows.push({ key: nextKey, value: v });
      } else if (Array.isArray(v)) {
        rows.push({ key: nextKey, value: JSON.stringify(v) });
      } else if (typeof v === "object") {
        rows.push(...flattenForReport(v, nextKey));
      } else {
        rows.push({ key: nextKey, value: String(v) });
      }
    });
    return rows;
  };

  return (
    <motion.Box
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      sx={{ maxWidth: 1400, mx: "auto", p: { xs: 2, md: 4 } }}
    >
      {/* Back Button with Animation */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => onChange("project_detail", { projectId })} 
          sx={{ 
            mb: 3,
            color: "text.secondary",
            '&:hover': { 
              color: "primary.main",
              transform: "translateX(-4px)",
              transition: "transform 0.2s ease"
            }
          }}
        >
          Back to Project
        </Button>
      </motion.div>

      {/* Header Section with Staggered Animation */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5, type: "spring", stiffness: 100 }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h3" 
            fontWeight={800} 
            gutterBottom
            sx={{
              background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.5px"
            }}
          >
            Part Cost Estimation
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Chip 
              icon={<PrecisionManufacturingIcon />}
              label={part.part_number}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: "0.95rem" }}
            />
            <Typography variant="h6" color="text.secondary" fontWeight={500}>
              {part.part_name}
            </Typography>
          </Box>
        </Box>
      </motion.div>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* 2D Drawing Section */}
        <Grid item xs={12}>
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
          >
            <Paper 
              elevation={0}
              sx={{ 
                overflow: "hidden",
                borderRadius: 3,
                border: "1px solid rgba(56,189,248,0.2)",
                background: "linear-gradient(135deg, rgba(56,189,248,0.03) 0%, rgba(129,140,248,0.03) 100%)"
              }}
            >
              <Box
                sx={{
                  p: 2,
                  bgcolor: "rgba(56,189,248,0.08)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(56,189,248,0.15)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <DrawIcon sx={{ color: "primary.main" }} />
                  <Typography variant="h6" fontWeight={600}>2D Technical Drawing</Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Zoom Out">
                    <IconButton 
                      size="small" 
                      onClick={() => setDrawingZoom((z) => Math.max(0.2, z - 0.2))}
                      sx={{ 
                        transition: "all 0.2s",
                        '&:hover': { transform: "scale(1.1)", bgcolor: "rgba(56,189,248,0.15)" }
                      }}
                    >
                      <ZoomOutIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reset Zoom">
                    <IconButton 
                      size="small" 
                      onClick={() => setDrawingZoom(1)}
                      sx={{ 
                        transition: "all 0.2s",
                        '&:hover': { transform: "rotate(180deg)", bgcolor: "rgba(56,189,248,0.15)" }
                      }}
                    >
                      <RestartAltIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Zoom In">
                    <IconButton 
                      size="small" 
                      onClick={() => setDrawingZoom((z) => Math.min(4, z + 0.2))}
                      sx={{ 
                        transition: "all 0.2s",
                        '&:hover': { transform: "scale(1.1)", bgcolor: "rgba(56,189,248,0.15)" }
                      }}
                    >
                      <ZoomInIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
              <Box
                sx={{
                  p: 3,
                  height: 520,
                  bgcolor: "rgba(2,6,23,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <AnimatePresence mode="wait">
                  {part.drawing_2d_path ? (
                    <motion.Box
                      key="drawing"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: drawingZoom, 
                        opacity: 1,
                        transition: { type: "spring", stiffness: 200, damping: 20 }
                      }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      sx={{
                        transformOrigin: "center center",
                        display: "inline-block",
                        willChange: "transform",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
                      }}
                    >
                      {isPdfPath(part.drawing_2d_path) ? (
                        <PdfPreview
                          url={getInlineFileUrl(part.drawing_2d_path)}
                          style={{ width: 560, maxWidth: "100%", maxHeight: 500, objectFit: "contain" }}
                        />
                      ) : (
                        <img 
                          src={getInlineFileUrl(part.drawing_2d_path)} 
                          style={{ maxHeight: 500, maxWidth: "100%", borderRadius: 8 }} 
                          alt="Drawing" 
                        />
                      )}
                    </motion.Box>
                  ) : (
                    <motion.Typography 
                      key="no-drawing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      color="text.secondary"
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <DrawIcon />
                      No 2D drawing uploaded
                    </motion.Typography>
                  )}
                </AnimatePresence>
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        {/* Input Parameters */}
        <Grid item xs={12} md={5} lg={4}>
          <motion.div
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5, type: "spring" }}
          >
            <Paper 
              elevation={0}
              sx={{ 
                p: 3, 
                borderRadius: 3,
                border: "1px solid rgba(56,189,248,0.15)",
                background: "linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(2,6,23,0.8) 100%)",
                backdropFilter: "blur(10px)"
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                <SettingsIcon sx={{ color: "primary.main" }} />
                <Typography variant="h5" fontWeight={700}>Input Parameters</Typography>
              </Box>
              
              {costError && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                >
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{costError}</Alert>
                </motion.div>
              )}

              <form onSubmit={handleSubmit}>
                <Stack spacing={2.5}>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <TextField
                      select
                      label="Operation Type"
                      fullWidth
                      size="small"
                      value={form.operation_type}
                      onChange={(e) => setForm({ ...form, operation_type: e.target.value, machine_name: "" })}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: "all 0.3s",
                          '&:hover': { boxShadow: "0 0 0 2px rgba(56,189,248,0.2)" },
                          '&.Mui-focused': { boxShadow: "0 0 0 3px rgba(56,189,248,0.3)" }
                        }
                      }}
                    >
                      {operationTypeOptions.map((opt) => (
                        <MenuItem key={`${opt.value}-${opt.label}`} value={opt.value} disabled={Boolean(opt.disabled)}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.55 }}
                  >
                    <TextField 
                      select 
                      label="Material" 
                      fullWidth 
                      size="small" 
                      value={form.material} 
                      onChange={(e) => setForm({ ...form, material: e.target.value })}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: "all 0.3s",
                          '&:hover': { boxShadow: "0 0 0 2px rgba(56,189,248,0.2)" },
                        }
                      }}
                    >
                      <MenuItem value="steel">Steel</MenuItem>
                      <MenuItem value="aluminium">Aluminium</MenuItem>
                      <MenuItem value="titanium">Titanium</MenuItem>
                    </TextField>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <TextField 
                      select 
                      label="Machine" 
                      fullWidth 
                      size="small" 
                      value={form.machine_name} 
                      onChange={(e) => setForm({ ...form, machine_name: e.target.value })}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: "all 0.3s",
                          '&:hover': { boxShadow: "0 0 0 2px rgba(56,189,248,0.2)" },
                        }
                      }}
                    >
                      {filteredMachines.map((m) => <MenuItem key={m.id || m.name} value={m.name}>{m.name}</MenuItem>)}
                    </TextField>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.65 }}
                  >
                    <TextField
                      select
                      label="Duty Category"
                      fullWidth
                      size="small"
                      value={form.duty_category}
                      onChange={(e) => setForm({ ...form, duty_category: e.target.value })}
                      required={Boolean(normalize(form.operation_type) && normalize(form.operation_type) !== "turning" && normalize(form.operation_type) !== "milling")}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          transition: "all 0.3s",
                          '&:hover': { boxShadow: "0 0 0 2px rgba(56,189,248,0.2)" },
                        }
                      }}
                    >
                      <MenuItem value="">Select Duty</MenuItem>
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="heavy">Heavy</MenuItem>
                    </TextField>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <EngineeringIcon fontSize="inherit" />
                        Man Hours / Unit
                      </Typography>
                      <Grid container spacing={1}>
                        <Grid item xs={8}>
                          <TextField
                            type="number"
                            fullWidth
                            size="small"
                            value={form.man_hours_per_unit}
                            onChange={(e) => setForm({ ...form, man_hours_per_unit: e.target.value })}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                              }
                            }}
                          />
                        </Grid>
                        <Grid item xs={4}>
                          <Button
                            variant="outlined"
                            component="label"
                            fullWidth
                            size="small"
                            disabled={manHoursUploadLoading}
                            startIcon={manHoursUploadLoading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                            sx={{ 
                              fontSize: "0.75rem", 
                              height: "100%",
                              borderRadius: 2,
                              transition: "all 0.3s",
                              '&:hover': { 
                                transform: "translateY(-2px)",
                                boxShadow: "0 4px 12px rgba(56,189,248,0.3)" 
                              }
                            }}
                            onClick={handleManHoursUploadClick}
                          >
                            Extract
                          </Button>
                          <input
                            type="file"
                            hidden
                            ref={manHoursFileInputRef}
                            accept=".pdf,.doc,.docx,.txt"
                            onChange={handleManHoursFileSelected}
                          />
                        </Grid>
                      </Grid>
                      {manHoursUploadError && <Typography variant="caption" color="error">{manHoursUploadError}</Typography>}
                    </Box>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.75 }}
                  >
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        borderRadius: 2,
                        background: "rgba(56,189,248,0.05)",
                        border: "1px solid rgba(56,189,248,0.15)"
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <AttachMoneyIcon fontSize="small" />
                          Miscellaneous Costs
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AddCircleOutlineIcon />}
                          sx={{ 
                            textTransform: "none", 
                            fontWeight: 700,
                            borderRadius: 2,
                            transition: "all 0.2s",
                            '&:hover': { transform: "scale(1.05)" }
                          }}
                          onClick={() => setForm((p) => ({
                            ...p,
                            miscellaneous_items: [...miscItems, { description: "", amount: "" }],
                          }))}
                        >
                          Add
                        </Button>
                      </Box>

                      <AnimatePresence>
                        <Stack spacing={1.25}>
                          {miscItems.map((item, idx) => (
                            <motion.Grid 
                              container 
                              spacing={1} 
                              key={idx} 
                              alignItems="center"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              transition={{ delay: idx * 0.05 }}
                            >
                              <Grid item xs={12} sm={7}>
                                <TextField
                                  label="Description"
                                  size="small"
                                  fullWidth
                                  value={item?.description || ""}
                                  onChange={(e) => {
                                    const next = miscItems.map((x, i) => i === idx ? { ...x, description: e.target.value } : x);
                                    setForm((p) => ({ ...p, miscellaneous_items: next }));
                                  }}
                                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                              </Grid>
                              <Grid item xs={10} sm={4}>
                                <TextField
                                  label="Amount"
                                  type="number"
                                  size="small"
                                  fullWidth
                                  inputProps={{ step: "0.01", min: "0" }}
                                  value={item?.amount ?? ""}
                                  onChange={(e) => {
                                    const next = miscItems.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x);
                                    setForm((p) => ({ ...p, miscellaneous_items: next }));
                                  }}
                                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                              </Grid>
                              <Grid item xs={2} sm={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
                                <IconButton
                                  title="Remove"
                                  onClick={() => {
                                    const next = miscItems.filter((_, i) => i !== idx);
                                    setForm((p) => ({ ...p, miscellaneous_items: next.length ? next : [{ description: "", amount: "" }] }));
                                  }}
                                  sx={{ 
                                    transition: "all 0.2s",
                                    '&:hover': { 
                                      color: "error.main",
                                      transform: "rotate(90deg)"
                                    }
                                  }}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Grid>
                            </motion.Grid>
                          ))}
                        </Stack>
                      </AnimatePresence>

                      <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "baseline", p: 1, borderRadius: 1, bgcolor: "rgba(56,189,248,0.1)" }}>
                        <Typography variant="caption" color="text.secondary">Total Misc</Typography>
                        <Typography variant="body2" fontWeight={800} color="primary.main">
                          {formatIndianCurrency(miscTotal)}
                        </Typography>
                      </Box>
                    </Paper>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                  >
                    <Divider sx={{ my: 1 }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">Dimensions (mm)</Typography>
                    </Divider>
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {(["drilling", "heat_treatment", "welding"].includes(String(form.operation_type || "").trim().toLowerCase())) && (
                      <motion.div
                        key="shape-selector"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <TextField
                          select
                          label="Shape"
                          size="small"
                          fullWidth
                          value={String(form.shape || "round").trim().toLowerCase() === "rectangular" ? "rectangular" : "round"}
                          onChange={(e) => setForm({ ...form, shape: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        >
                          <MenuItem value="round">Round</MenuItem>
                          <MenuItem value="rectangular">Rectangular</MenuItem>
                        </TextField>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.85 }}
                  >
                    <TextField 
                      label="Length" 
                      type="number" 
                      size="small" 
                      fullWidth 
                      value={form.length} 
                      onChange={(e) => setForm({ ...form, length: e.target.value })} 
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {(["turning", "boring"].includes(String(form.operation_type || "").trim().toLowerCase()) ||
                      (["drilling", "heat_treatment", "welding"].includes(String(form.operation_type || "").trim().toLowerCase()) && String(form.shape || "round").trim().toLowerCase() !== "rectangular")) && (
                      <motion.div
                        key="diameter-field"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <TextField 
                          label="Diameter" 
                          type="number" 
                          size="small" 
                          fullWidth 
                          value={form.diameter} 
                          onChange={(e) => setForm({ ...form, diameter: e.target.value })} 
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    {(["milling", "grinding", "surface_treatment"].includes(String(form.operation_type || "").trim().toLowerCase()) ||
                      (["drilling", "heat_treatment", "welding"].includes(String(form.operation_type || "").trim().toLowerCase()) && String(form.shape || "round").trim().toLowerCase() === "rectangular")) && (
                      <motion.div
                        key="rectangular-fields"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Stack spacing={2}>
                          <TextField 
                            label="Breadth" 
                            type="number" 
                            size="small" 
                            fullWidth 
                            value={form.breadth} 
                            onChange={(e) => setForm({ ...form, breadth: e.target.value })} 
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                          <TextField 
                            label="Height" 
                            type="number" 
                            size="small" 
                            fullWidth 
                            value={form.height} 
                            onChange={(e) => setForm({ ...form, height: e.target.value })} 
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Stack>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.9, type: "spring", stiffness: 200 }}
                  >
                    <Button 
                      type="submit" 
                      variant="contained" 
                      fullWidth
                      disabled={costLoading} 
                      startIcon={costLoading ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
                      sx={{ 
                        py: 1.5,
                        borderRadius: 2,
                        fontSize: "1rem",
                        fontWeight: 600,
                        textTransform: "none",
                        background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
                        boxShadow: "0 4px 14px rgba(56,189,248,0.4)",
                        transition: "all 0.3s",
                        '&:hover': { 
                          background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
                          boxShadow: "0 6px 20px rgba(56,189,248,0.5)",
                          transform: "translateY(-2px)"
                        },
                        '&:disabled': {
                          background: "rgba(148,163,184,0.3)",
                        }
                      }}
                    >
                      {costLoading ? "Calculating..." : "Calculate Cost"}
                    </Button>
                  </motion.div>
                </Stack>
              </form>
            </Paper>
          </motion.div>
        </Grid>

        {/* Results Section */}
        <Grid item xs={12} md={7} lg={8}>
          <AnimatePresence>
            {costResult && (
              <motion.div
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                transition={{ duration: 0.5, type: "spring" }}
              >
                <Stack spacing={3}>
                  <Box ref={drawingCaptureRef}>
                    <Card 
                      elevation={0}
                      sx={{ 
                        borderRadius: 3,
                        border: "1px solid rgba(56,189,248,0.2)",
                        background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.9) 100%)",
                        backdropFilter: "blur(10px)",
                        overflow: "hidden"
                      }}
                    >
                      <CardHeader
                        title={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <AssessmentIcon sx={{ color: "primary.main" }} />
                            <Typography variant="h6" fontWeight={700}>Estimation Results</Typography>
                          </Box>
                        }
                        action={
                          <Button 
                            startIcon={<DownloadIcon />} 
                            onClick={handleOpenPdfPreview}
                            variant="outlined"
                            sx={{ 
                              borderRadius: 2,
                              textTransform: "none",
                              fontWeight: 600,
                              transition: "all 0.3s",
                              '&:hover': {
                                transform: "translateY(-2px)",
                                boxShadow: "0 4px 12px rgba(56,189,248,0.3)"
                              }
                            }}
                          >
                            Download Report
                          </Button>
                        }
                        sx={{ 
                          bgcolor: "rgba(56,189,248,0.08)", 
                          borderBottom: "1px solid rgba(56,189,248,0.15)",
                          py: 2
                        }}
                      />
                      <CardContent sx={{ p: 3 }}>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom fontWeight={600} color="text.secondary">Cost Breakdown</Typography>
                            <Stack spacing={1.5}>
                              {[
                                { label: "Basic Cost:", value: formatValue("basic_cost", costResult.cost_breakdown?.basic_cost_per_unit) },
                                { label: "Overheads:", value: formatValue("overheads", costResult.cost_breakdown?.overheads_per_unit) },
                                { label: "Profit:", value: formatValue("profit", costResult.cost_breakdown?.profit_per_unit) },
                                { label: "Packing:", value: formatValue("packing", costResult.cost_breakdown?.packing_forwarding_per_unit) },
                              ].map((item, idx) => (
                                <motion.Box 
                                  key={idx}
                                  display="flex" 
                                  justifyContent="space-between"
                                  alignItems="center"
                                  initial={{ x: -20, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: 0.1 + idx * 0.05 }}
                                  sx={{ py: 0.5 }}
                                >
                                  <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                                  <Typography variant="body2" fontWeight="bold" color="text.primary">{item.value}</Typography>
                                </motion.Box>
                              ))}
                              <Divider sx={{ my: 1 }} />
                              <motion.Box 
                                display="flex" 
                                justifyContent="space-between"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                sx={{ 
                                  p: 1.5, 
                                  borderRadius: 2, 
                                  bgcolor: "rgba(56,189,248,0.1)",
                                  border: "1px solid rgba(56,189,248,0.2)"
                                }}
                              >
                                <Typography variant="subtitle1" fontWeight={700}>Unit Cost:</Typography>
                                <Typography variant="subtitle1" fontWeight={800} color="primary.main">{formatValue("total_cost", costResult.cost_breakdown?.unit_cost)}</Typography>
                              </motion.Box>
                            </Stack>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Typography variant="subtitle2" gutterBottom fontWeight={600} color="text.secondary">Non-Recurring Costs</Typography>
                            <Stack spacing={2}>
                              <TextField 
                                label="Description (e.g. Fixtures)" 
                                size="small" 
                                fullWidth 
                                value={nonrecurringCostType} 
                                onChange={(e) => setNonrecurringCostType(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                              <TextField 
                                label="Amount" 
                                type="number" 
                                size="small" 
                                fullWidth 
                                value={nonrecurringCostAmount} 
                                onChange={(e) => setNonrecurringCostAmount(e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                              <motion.Box 
                                display="flex" 
                                justifyContent="space-between" 
                                mt={2}
                                p={2}
                                borderRadius={2}
                                sx={{ 
                                  background: "linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(129,140,248,0.15) 100%)",
                                  border: "2px solid rgba(56,189,248,0.3)"
                                }}
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.5, type: "spring" }}
                              >
                                <Typography variant="h6" fontWeight={700}>Final Total:</Typography>
                                <Typography variant="h6" color="primary.main" fontWeight={800}>{formatValue("total_cost", displayedTotalCost)}</Typography>
                              </motion.Box>
                            </Stack>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Box>
                </Stack>
              </motion.div>
            )}
          </AnimatePresence>
        </Grid>
      </Grid>

      {/* PDF Export Dialogs */}
      <Dialog
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { bgcolor: "transparent", boxShadow: "none" } }}
      >
        <DialogContent sx={{ p: 2, bgcolor: "transparent", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          <Box
            ref={pdfPreviewRef}
            sx={{
              bgcolor: "#020617",
              color: "#e5e7eb",
              width: "min(794px, 100%)",
              minHeight: "1123px",
              p: 4,
              borderRadius: 2,
              border: "1px solid rgba(148,163,184,0.18)",
              fontSize: "14px",
              lineHeight: 1.35,
              "& .MuiTypography-root": { fontSize: "1em" },
            }}
          >
            <Typography>Legacy Preview Mode</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: "transparent", px: 0, pb: 0, pt: 2, justifyContent: "space-between" }}>
          <Button onClick={() => setPdfPreviewOpen(false)} sx={{ textTransform: "none", fontWeight: 800, color: "#e5e7eb" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <PdfReportExport
        open={pdfExportOpen}
        onClose={() => setPdfExportOpen(false)}
        projectData={projectData}
        part={part}
        operations={[form]}
        operationResults={[costResult]}
        drawingPath={part?.drawing_2d_path}
        getInlineFileUrl={getInlineFileUrl}
        isPdfPath={isPdfPath}
        PdfPreview={PdfPreview}
      />
    </motion.Box>
  );
}
