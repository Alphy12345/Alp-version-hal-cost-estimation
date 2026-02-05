import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  CardHeader
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

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import api from "../api/client";
import { getProject, getProjectParts } from "../api/projects";
import PdfPreview from "../components/PdfPreview"; // Use shared component
import { calculateCostEstimation } from "../api/costEstimation";

function isMoneyFieldKey(key) {
  if (!key) return false;
  if (key.includes("man_hours")) return false;
  return /(cost|rate|profit|overheads|packing|outsourcing)/i.test(key);
}

function formatValue(key, value) {
  if (value == null) return "-";
  if (typeof value === "number" && Number.isFinite(value) && isMoneyFieldKey(key)) {
    const hasDecimals = Math.abs(value - Math.trunc(value)) > Number.EPSILON;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(value);
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("en-IN");
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
    setPdfPreviewOpen(true);
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
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 5) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
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
    <Box sx={{ maxWidth: 1400, mx: "auto", p: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => onChange("project_detail", { projectId })} sx={{ mb: 2 }}>
        Back to Project
      </Button>

      <Typography variant="h4" fontWeight={700} gutterBottom>Part Cost Estimation</Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        {part.part_number} — {part.part_name}
      </Typography>

      <Grid container spacing={4} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <Box
              sx={{
                p: 1.5,
                bgcolor: "rgba(56,189,248,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: 1,
                borderColor: "rgba(56,189,248,0.12)",
              }}
            >
              <Typography variant="subtitle2" sx={{ ml: 1 }}>2D Drawing</Typography>
              <Stack direction="row">
                <IconButton size="small" onClick={() => setDrawingZoom((z) => Math.max(0.2, z - 0.2))}><ZoomOutIcon /></IconButton>
                <IconButton size="small" onClick={() => setDrawingZoom(1)}><RestartAltIcon /></IconButton>
                <IconButton size="small" onClick={() => setDrawingZoom((z) => Math.min(4, z + 0.2))}><ZoomInIcon /></IconButton>
              </Stack>
            </Box>
            <Box
              sx={{
                p: 2,
                height: 520,
                bgcolor: "rgba(56,189,248,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {part.drawing_2d_path ? (
                <Box sx={{ transform: `scale(${drawingZoom})`, transition: "transform 0.2s" }}>
                  {isPdfPath(part.drawing_2d_path) ? (
                    <PdfPreview url={getInlineFileUrl(part.drawing_2d_path)} style={{ maxHeight: 500 }} />
                  ) : (
                    <img src={getInlineFileUrl(part.drawing_2d_path)} style={{ maxHeight: 500, maxWidth: "100%" }} alt="Drawing" />
                  )}
                </Box>
              ) : (
                <Typography color="text.secondary">No 2D drawing uploaded</Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5} lg={4}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Input Parameters</Typography>
            {costError && <Alert severity="error" sx={{ mb: 2 }}>{costError}</Alert>}

            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <TextField
                  select
                  label="Operation Type"
                  fullWidth
                  size="small"
                  value={form.operation_type}
                  onChange={(e) => setForm({ ...form, operation_type: e.target.value, machine_name: "" })}
                >
                  {operationTypeOptions.map((opt) => (
                    <MenuItem key={`${opt.value}-${opt.label}`} value={opt.value} disabled={Boolean(opt.disabled)}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField select label="Material" fullWidth size="small" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })}>
                  <MenuItem value="steel">Steel</MenuItem>
                  <MenuItem value="aluminium">Aluminium</MenuItem>
                  <MenuItem value="titanium">Titanium</MenuItem>
                </TextField>

                <TextField select label="Machine" fullWidth size="small" value={form.machine_name} onChange={(e) => setForm({ ...form, machine_name: e.target.value })}>
                  {filteredMachines.map((m) => <MenuItem key={m.id || m.name} value={m.name}>{m.name}</MenuItem>)}
                </TextField>

                <TextField
                  select
                  label="Duty Category"
                  fullWidth
                  size="small"
                  value={form.duty_category}
                  onChange={(e) => setForm({ ...form, duty_category: e.target.value })}
                  required={Boolean(normalize(form.operation_type) && normalize(form.operation_type) !== "turning" && normalize(form.operation_type) !== "milling")}
                >
                  <MenuItem value="">Select Duty</MenuItem>
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="heavy">Heavy</MenuItem>
                </TextField>

                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom>Man Hours / Unit</Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={8}>
                      <TextField
                        type="number"
                        fullWidth
                        size="small"
                        value={form.man_hours_per_unit}
                        onChange={(e) => setForm({ ...form, man_hours_per_unit: e.target.value })}
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
                        sx={{ fontSize: "0.7rem", height: "100%" }}
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

                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle2">Miscellaneous Costs</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddCircleOutlineIcon />}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                      onClick={() => setForm((p) => ({
                        ...p,
                        miscellaneous_items: [...miscItems, { description: "", amount: "" }],
                      }))}
                    >
                      Add
                    </Button>
                  </Box>

                  <Stack spacing={1.25}>
                    {miscItems.map((item, idx) => (
                      <Grid container spacing={1} key={idx} alignItems="center">
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
                          />
                        </Grid>
                        <Grid item xs={2} sm={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
                          <IconButton
                            title="Remove"
                            onClick={() => {
                              const next = miscItems.filter((_, i) => i !== idx);
                              setForm((p) => ({ ...p, miscellaneous_items: next.length ? next : [{ description: "", amount: "" }] }));
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    ))}
                  </Stack>

                  <Box sx={{ mt: 1.5, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                    <Typography variant="body2" fontWeight={800} color="primary.main">
                      {miscTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Paper>

                <Divider />
                <Typography variant="caption" fontWeight={600}>Dimensions (mm)</Typography>

                {(["drilling", "heat_treatment", "welding"].includes(String(form.operation_type || "").trim().toLowerCase())) && (
                  <TextField
                    select
                    label="Shape"
                    size="small"
                    fullWidth
                    value={String(form.shape || "round").trim().toLowerCase() === "rectangular" ? "rectangular" : "round"}
                    onChange={(e) => setForm({ ...form, shape: e.target.value })}
                  >
                    <MenuItem value="round">Round</MenuItem>
                    <MenuItem value="rectangular">Rectangular</MenuItem>
                  </TextField>
                )}

                <TextField label="Length" type="number" size="small" fullWidth value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} />

                {(["turning", "boring"].includes(String(form.operation_type || "").trim().toLowerCase()) ||
                  (["drilling", "heat_treatment", "welding"].includes(String(form.operation_type || "").trim().toLowerCase()) && String(form.shape || "round").trim().toLowerCase() !== "rectangular")) && (
                  <TextField label="Diameter" type="number" size="small" fullWidth value={form.diameter} onChange={(e) => setForm({ ...form, diameter: e.target.value })} />
                )}

                {(["milling", "grinding", "surface_treatment"].includes(String(form.operation_type || "").trim().toLowerCase()) ||
                  (["drilling", "heat_treatment", "welding"].includes(String(form.operation_type || "").trim().toLowerCase()) && String(form.shape || "round").trim().toLowerCase() === "rectangular")) && (
                  <>
                    <TextField label="Breadth" type="number" size="small" fullWidth value={form.breadth} onChange={(e) => setForm({ ...form, breadth: e.target.value })} />
                    <TextField label="Height" type="number" size="small" fullWidth value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
                  </>
                )}

                <Button type="submit" variant="contained" disabled={costLoading} startIcon={<CalculateIcon />}>
                  Calculate Cost
                </Button>
              </Stack>
            </form>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7} lg={8}>
          <Stack spacing={3}>
            {costResult && (
              <Box ref={drawingCaptureRef}>
                <Card variant="outlined">
                  <CardHeader
                    title="Estimation Results"
                    action={
                      <Button startIcon={<DownloadIcon />} onClick={handleOpenPdfPreview}>Download Report</Button>
                    }
                    sx={{ bgcolor: "rgba(56,189,248,0.08)", borderBottom: 1, borderColor: "rgba(56,189,248,0.12)" }}
                  />
                  <CardContent>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>Breakdown</Typography>
                        <Stack spacing={1}>
                          <Box display="flex" justifyContent="space-between"><Typography variant="body2">Basic Cost:</Typography><Typography variant="body2" fontWeight="bold">{formatValue("basic_cost", costResult.cost_breakdown?.basic_cost_per_unit)}</Typography></Box>
                          <Box display="flex" justifyContent="space-between"><Typography variant="body2">Overheads:</Typography><Typography variant="body2" fontWeight="bold">{formatValue("overheads", costResult.cost_breakdown?.overheads_per_unit)}</Typography></Box>
                          <Box display="flex" justifyContent="space-between"><Typography variant="body2">Profit:</Typography><Typography variant="body2" fontWeight="bold">{formatValue("profit", costResult.cost_breakdown?.profit_per_unit)}</Typography></Box>
                          <Box display="flex" justifyContent="space-between"><Typography variant="body2">Packing:</Typography><Typography variant="body2" fontWeight="bold">{formatValue("packing", costResult.cost_breakdown?.packing_forwarding_per_unit)}</Typography></Box>
                          <Divider />
                          <Box display="flex" justifyContent="space-between"><Typography variant="subtitle1">Unit Cost:</Typography><Typography variant="subtitle1" fontWeight="bold" color="primary">{formatValue("total_cost", costResult.cost_breakdown?.unit_cost)}</Typography></Box>
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>Non-Recurring Costs</Typography>
                        <Stack spacing={2}>
                          <TextField label="Description (e.g. Fixtures)" size="small" fullWidth value={nonrecurringCostType} onChange={(e) => setNonrecurringCostType(e.target.value)} />
                          <TextField label="Amount" type="number" size="small" fullWidth value={nonrecurringCostAmount} onChange={(e) => setNonrecurringCostAmount(e.target.value)} />
                          <Box display="flex" justifyContent="space-between" mt={2}>
                            <Typography variant="h6">Final Total:</Typography>
                            <Typography variant="h6" color="primary.main">{formatValue("total_cost", displayedTotalCost)}</Typography>
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Box>
            )}
          </Stack>
        </Grid>
      </Grid>

      <Dialog
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { bgcolor: "transparent", boxShadow: "none" } }}
      >
        <DialogContent sx={{ p: 0, bgcolor: "transparent" }}>
          <Box
            ref={pdfPreviewRef}
            sx={{
              bgcolor: "#020617",
              color: "#e5e7eb",
              width: "100%",
              p: 3,
              borderRadius: 2,
              border: "1px solid rgba(148,163,184,0.18)",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" fontWeight={900} sx={{ color: "#e5e7eb", lineHeight: 1.1 }}>
                  {projectData?.project_name || "Untitled Project"}
                </Typography>
                <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1.5, rowGap: 0.5, maxWidth: 640 }}>
                  <Typography variant="body2" fontWeight={800} sx={{ color: "rgba(229,231,235,0.85)" }}>PO/Ref</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(229,231,235,0.85)" }}>{projectData?.po_reference_number || "N/A"}</Typography>
                  <Typography variant="body2" fontWeight={800} sx={{ color: "rgba(229,231,235,0.85)" }}>Customer</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(229,231,235,0.85)" }}>{projectData?.customer_name || "N/A"}</Typography>
                  <Typography variant="body2" fontWeight={800} sx={{ color: "rgba(229,231,235,0.85)" }}>Date</Typography>
                  <Typography variant="body2" sx={{ color: "rgba(229,231,235,0.85)" }}>{projectData?.project_date || "N/A"}</Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography variant="h6" fontWeight={900} sx={{ color: "#e5e7eb" }}>
                  HAL Cost Estimation
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: "rgba(229,231,235,0.75)" }}>
                  Part: {part?.part_number || "N/A"}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mt: 2.5, height: 4, bgcolor: "#38bdf8", borderRadius: 999 }} />

            <Box sx={{ mt: 2.5 }}>
              <Box sx={{ px: 1.5, py: 1, bgcolor: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#38bdf8" }}>
                  2D Drawing
                </Typography>
              </Box>
              <Box
                sx={{
                  mt: 1.5,
                  border: "1px solid rgba(148,163,184,0.18)",
                  borderRadius: 1.5,
                  overflow: "hidden",
                  height: 420,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "#0b1220",
                }}
              >
                {part?.drawing_2d_path ? (
                  isPdfPath(part.drawing_2d_path) ? (
                    <Box sx={{ p: 1.5, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <PdfPreview
                        url={getInlineFileUrl(part.drawing_2d_path)}
                        style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                      />
                    </Box>
                  ) : (
                    <img
                      src={getInlineFileUrl(part.drawing_2d_path)}
                      alt="2D Drawing"
                      style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                    />
                  )
                ) : (
                  <Typography variant="body2" sx={{ color: "rgba(229,231,235,0.75)" }}>
                    No 2D drawing uploaded.
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ mt: 2.5 }}>
              <Box sx={{ px: 1.5, py: 1, bgcolor: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#38bdf8" }}>
                  Operation Totals
                </Typography>
              </Box>
              <Box sx={{ mt: 1.5, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 1.5, overflow: "hidden" }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 0, bgcolor: "rgba(56,189,248,0.14)", px: 1.25, py: 1 }}>
                  <Typography variant="body2" fontWeight={900} sx={{ color: "#38bdf8" }}>Operation</Typography>
                  <Typography variant="body2" fontWeight={900} sx={{ color: "#38bdf8", textAlign: "right" }}>Total (with Misc)</Typography>
                </Box>
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 0, alignItems: "center" }}>
                    <Typography variant="body2" sx={{ color: "#e5e7eb", fontWeight: 800 }}>
                      {String(form.operation_type || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Operation 1"}
                    </Typography>
                    <Typography variant="body2" sx={{ textAlign: "right", color: "rgba(229,231,235,0.9)" }}>
                      {formatValue("total_cost", costResult?.cost_breakdown?.total_unit_cost_with_misc)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end" }}>
              <Box sx={{ minWidth: 320, border: "1px solid rgba(56,189,248,0.35)", borderRadius: 1.5, overflow: "hidden" }}>
                <Box sx={{ px: 1.5, py: 1, bgcolor: "rgba(56,189,248,0.14)" }}>
                  <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#38bdf8" }}>
                    Final Total
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" fontWeight={800} sx={{ color: "rgba(229,231,235,0.75)" }}>
                    Total (with Misc)
                  </Typography>
                  <Typography variant="h6" fontWeight={900} sx={{ color: "#38bdf8" }}>
                    {formatValue("total_cost", costResult?.cost_breakdown?.total_unit_cost_with_misc)}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* PAGE 2+ */}
            <Box sx={{ mt: 6, borderTop: "2px solid rgba(56,189,248,0.35)", pt: 3 }}>
              <Box sx={{ px: 1.5, py: 1, bgcolor: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#38bdf8" }}>
                  All Calculated Metrics
                </Typography>
              </Box>

              {(() => {
                const rows = [...flattenForReport(costResult?.inputs), ...flattenForReport(costResult?.cost_breakdown)];
                const map = new Map();
                rows.forEach((r) => {
                  if (!r?.key) return;
                  map.set(String(r.key), r.value);
                });

                const metricKeys = Array.from(map.keys())
                  .sort((a, b) => String(a).localeCompare(String(b)));

                if (metricKeys.length === 0) return null;

                return (
                  <Box sx={{ mt: 2.5, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 1.5, overflow: "hidden" }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 0, bgcolor: "rgba(56,189,248,0.14)", px: 1.25, py: 1 }}>
                      <Typography variant="body2" fontWeight={900} sx={{ color: "#38bdf8" }}>Metric</Typography>
                      <Typography variant="body2" fontWeight={900} sx={{ color: "#38bdf8" }}>Value</Typography>
                    </Box>

                    {metricKeys.map((k) => (
                      <Box
                        key={`metric-${k}`}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1.2fr 1.8fr",
                          gap: 0,
                          px: 1.25,
                          py: 0.75,
                          borderTop: "1px solid rgba(148,163,184,0.18)",
                        }}
                      >
                        <Typography variant="caption" sx={{ color: "rgba(229,231,235,0.85)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
                          {String(k).replace(/_/g, " ")}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(229,231,235,0.85)" }}>
                          {map.get(k) == null ? "-" : String(map.get(k))}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                );
              })()}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: "transparent", px: 0, pb: 0, pt: 2, justifyContent: "space-between" }}>
          <Button onClick={() => setPdfPreviewOpen(false)} sx={{ textTransform: "none", fontWeight: 800, color: "#e5e7eb" }}>
            Close
          </Button>
          <Button
            onClick={handleDownloadPdf}
            variant="contained"
            startIcon={<DownloadIcon />}
            sx={{ textTransform: "none", fontWeight: 900, bgcolor: "#38bdf8", "&:hover": { bgcolor: "#0ea5e9" } }}
          >
            Download PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
