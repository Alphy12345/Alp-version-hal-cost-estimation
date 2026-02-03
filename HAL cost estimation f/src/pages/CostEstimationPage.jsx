import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Divider,
  Chip,
  Card,
  CardContent,
  CardHeader
} from "@mui/material";
import CalculateIcon from "@mui/icons-material/Calculate";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import api from "../api/client";
import CompactPdfViewer from "../components/CompactPdfViewer";
import { calculateCostEstimation } from "../api/costEstimation";

// --- Helpers ---
function flattenObject(obj, prefix = "") {
  if (obj == null) return [];
  if (typeof obj !== "object") return [[prefix, obj]];
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [[prefix, "[]"]];
    return obj.flatMap((item, idx) => flattenObject(item, prefix ? `${prefix}[${idx}]` : `[${idx}]`));
  }
  const entries = Object.entries(obj);
  if (entries.length === 0) return [[prefix, "{}"]];
  return entries.flatMap(([k, v]) => {
    const nextPrefix = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === "object") return flattenObject(v, nextPrefix);
    return [[nextPrefix, v]];
  });
}

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

function CostEstimationPage() {
  const [form, setForm] = useState({
    operation_type: "milling",
    diameter: 50,
    length: 200,
    breadth: 50,
    height: 50,
    material: "aluminium",
    machine_name: "",
    man_hours_per_unit: 2,
    miscellaneous_amount: 0,
  });

  const [machines, setMachines] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(false);
  const [machinesError, setMachinesError] = useState("");

  const [operationTypes, setOperationTypes] = useState([]);
  const [operationTypesLoading, setOperationTypesLoading] = useState(false);
  const [operationTypesError, setOperationTypesError] = useState("");

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setMachinesLoading(true);
        setMachinesError("");
        const res = await api.get("/machines/");
        setMachines(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setMachinesError("Failed to load machines");
      } finally {
        setMachinesLoading(false);
      }
    };
    fetchMachines();
  }, []);

  useEffect(() => {
    const fetchOperationTypes = async () => {
      try {
        setOperationTypesLoading(true);
        setOperationTypesError("");
        const res = await api.get("/operation-type/");
        setOperationTypes(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setOperationTypesError("Failed to load operation types");
      } finally {
        setOperationTypesLoading(false);
      }
    };
    fetchOperationTypes();
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  const totalCost = result?.cost_breakdown?.total_unit_cost_with_misc;

  const normalize = (value) => {
    if (value == null) return "";
    return String(value).trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
  };

  const filteredMachines = useMemo(() => {
    const opType = normalize(form.operation_type);
    if (!opType) return machines;

    const selectedOp = operationTypes.find((ot) => normalize(ot?.operation_name) === opType);
    const selectedOpId = selectedOp?.id != null ? String(selectedOp.id) : "";

    const getMachineOpId = (m) => {
      const opId = m?.op_id ?? m?.operation_type_id ?? m?.operation_type?.id ?? m?.operation_types?.id;
      return opId == null ? "" : String(opId);
    };

    const getMachineOpName = (m) => {
      const fromNested = m?.operation_type?.operation_name ?? m?.operation_types?.operation_name;
      if (fromNested) return normalize(fromNested);
      const opId = getMachineOpId(m);
      if (!opId) return "";
      const lookup = operationTypes.find((ot) => String(ot.id) === String(opId));
      return normalize(lookup?.operation_name);
    };

    return machines.filter((m) => {
      if (selectedOpId) return getMachineOpId(m) === selectedOpId;
      return getMachineOpName(m) === opType;
    });
  }, [form.operation_type, machines, operationTypes]);

  useEffect(() => {
    setForm((prev) => {
      if (!filteredMachines || filteredMachines.length === 0) {
        return prev.machine_name ? { ...prev, machine_name: "" } : prev;
      }
      const stillValid = filteredMachines.some((m) => m.name === prev.machine_name);
      if (stillValid) return prev;
      const nextName = filteredMachines[0]?.name;
      return nextName ? { ...prev, machine_name: nextName } : prev;
    });
  }, [filteredMachines]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const opType = String(form.operation_type || "").toLowerCase();
    const length = Number(form.length);
    const diameter = Number(form.diameter);
    const breadth = Number(form.breadth);
    const height = Number(form.height);
    const manHours = Number(form.man_hours_per_unit);

    if (!opType) return setError("Operation Type is required");
    if (!Number.isFinite(length) || length <= 0) return setError("Length must be a positive number");
    if (opType === "turning" && (!Number.isFinite(diameter) || diameter <= 0)) return setError("Diameter must be positive");
    if (opType === "milling" && ((!Number.isFinite(breadth) || breadth <= 0) || (!Number.isFinite(height) || height <= 0))) {
      return setError("Breadth and Height must be positive");
    }
    if (!Number.isFinite(manHours) || manHours < 0) return setError("Man Hours must be valid");

    const dimensions = { length };
    if (opType === "turning") dimensions.diameter = diameter;
    if (opType === "milling") {
      dimensions.breadth = breadth;
      dimensions.height = height;
    }

    const payload = {
      dimensions,
      material: String(form.material || ""),
      operation_type: String(form.operation_type || ""),
      machine_name: String(form.machine_name || ""),
      man_hours_per_unit: manHours,
      miscellaneous_amount: Number(form.miscellaneous_amount || 0),
    };

    try {
      setLoading(true);
      setError("");
      const res = await calculateCostEstimation(payload);
      setResult(res.data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to calculate cost";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", py: 4, px: 2 }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 4, mb: 4, bgcolor: "linear-gradient(to right, #ffffff, #f8fafc)", border: 1, borderColor: "divider", borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h4" fontWeight={600} gutterBottom>Cost Estimation</Typography>
            <Typography variant="body2" color="text.secondary">Enter inputs and calculate the unit cost.</Typography>
          </Box>
          {loading && <CircularProgress size={24} />}
        </Stack>
      </Paper>

      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardHeader
          title="Calculate"
          action={
            <Stack direction="row" spacing={1}>
              <Chip label={form.operation_type || "-"} size="small" color="primary" variant="outlined" />
              <Chip label={form.material || "-"} size="small" variant="outlined" />
            </Stack>
          }
          sx={{ bgcolor: "grey.50", borderBottom: 1, borderColor: "divider" }}
        />
        <CardContent sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  select
                  label="Operation Type"
                  value={form.operation_type}
                  onChange={(e) => handleChange("operation_type", e.target.value)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="milling">milling</MenuItem>
                  <MenuItem value="turning">turning</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  select
                  label="Material Type"
                  value={form.material}
                  onChange={(e) => handleChange("material", e.target.value)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="steel">steel</MenuItem>
                  <MenuItem value="aluminium">aluminium</MenuItem>
                  <MenuItem value="titanium">titanium</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  select
                  label="Machine Name"
                  value={form.machine_name}
                  onChange={(e) => handleChange("machine_name", e.target.value)}
                  fullWidth
                  size="small"
                  disabled={machinesLoading || operationTypesLoading || filteredMachines.length === 0}
                  helperText={filteredMachines.length === 0 ? "No machines for this operation" : `${filteredMachines.length} available`}
                >
                  {filteredMachines.map((m) => (
                    <MenuItem key={m.id || m.name} value={m.name}>{m.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Man Hours / Unit"
                  type="number"
                  inputProps={{ step: "0.01" }}
                  value={form.man_hours_per_unit}
                  onChange={(e) => handleChange("man_hours_per_unit", e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Miscellaneous Amount"
                  type="number"
                  inputProps={{ step: "0.01", min: "0" }}
                  value={form.miscellaneous_amount}
                  onChange={(e) => handleChange("miscellaneous_amount", e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Additional costs"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Length (mm)"
                  type="number"
                  value={form.length}
                  onChange={(e) => handleChange("length", e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>

              {form.operation_type === "turning" && (
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label="Diameter (mm)"
                    type="number"
                    value={form.diameter}
                    onChange={(e) => handleChange("diameter", e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
              )}

              {form.operation_type === "milling" && (
                <>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Breadth (mm)"
                      type="number"
                      value={form.breadth}
                      onChange={(e) => handleChange("breadth", e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Height (mm)"
                      type="number"
                      value={form.height}
                      onChange={(e) => handleChange("height", e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={<CalculateIcon />}
                >
                  Calculate
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ p: 2, bgcolor: "grey.50", borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6">Cost Estimation Results</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant={showPdfViewer ? "outlined" : "contained"}
                color={showPdfViewer ? "primary" : "secondary"}
                onClick={() => setShowPdfViewer(!showPdfViewer)}
                startIcon={showPdfViewer ? <VisibilityOffIcon /> : <VisibilityIcon />}
                size="small"
              >
                {showPdfViewer ? 'Hide Drawing' : 'View 2D Drawing'}
              </Button>
              {totalCost != null && (
                <Typography variant="h6" color="primary.main" fontWeight="bold">
                  {formatValue("total_cost", totalCost)}
                </Typography>
              )}
            </Stack>
          </Box>

          <CardContent sx={{ p: 4 }}>
            <Grid container spacing={4}>
              {/* Summary Cards */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: "primary.50", borderColor: "primary.100" }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Operation Details</Typography>
                      <Stack spacing={1}>
                        <Typography variant="caption" display="block">Operation: {result.operation_type}</Typography>
                        <Typography variant="caption" display="block">Machine: {result.selected_machine?.name}</Typography>
                        <Typography variant="caption" display="block">Material: {result.material}</Typography>
                        {result.volume && <Typography variant="caption" display="block">Volume: {result.volume.toFixed(2)} mm³</Typography>}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Cost Summary</Typography>
                      <Stack spacing={1}>
                        <Typography variant="body2" sx={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Basic Cost:</span> <b>{formatValue("basic_cost", result.cost_breakdown?.basic_cost_per_unit)}</b>
                        </Typography>
                        <Typography variant="body2" sx={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Total Unit Cost:</span> <b>{formatValue("total_cost", result.cost_breakdown?.unit_cost)}</b>
                        </Typography>
                        <Typography variant="subtitle1" color="primary.main" sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                          <span>Total with Misc:</span> <b>{formatValue("total_cost", result.cost_breakdown?.total_unit_cost_with_misc)}</b>
                        </Typography>
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Breakdown Table */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Detailed Cost Breakdown</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: "grey.50" }}>
                        <TableCell>Cost Component</TableCell>
                        <TableCell>Value</TableCell>
                        <TableCell>Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Man Hours per Unit</TableCell>
                        <TableCell>{result.cost_breakdown?.man_hours_per_unit}</TableCell>
                        <TableCell>-</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Machine Hour Rate</TableCell>
                        <TableCell>{formatValue("machine_hour_rate", result.cost_breakdown?.machine_hour_rate)}</TableCell>
                        <TableCell>per hour</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Wage Rate</TableCell>
                        <TableCell>{formatValue("wage_rate", result.cost_breakdown?.wage_rate)}</TableCell>
                        <TableCell>per hour</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Basic Cost</TableCell>
                        <TableCell fontWeight="bold">{formatValue("basic_cost", result.cost_breakdown?.basic_cost_per_unit)}</TableCell>
                        <TableCell>per unit</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Overheads</TableCell>
                        <TableCell fontWeight="bold">{formatValue("overheads", result.cost_breakdown?.overheads_per_unit)}</TableCell>
                        <TableCell>per unit</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Profit (10%)</TableCell>
                        <TableCell fontWeight="bold">{formatValue("profit", result.cost_breakdown?.profit_per_unit)}</TableCell>
                        <TableCell>per unit</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Packing & Fwd (2%)</TableCell>
                        <TableCell fontWeight="bold">{formatValue("packing", result.cost_breakdown?.packing_forwarding_per_unit)}</TableCell>
                        <TableCell>per unit</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Miscellaneous</TableCell>
                        <TableCell fontWeight="bold">{formatValue("miscellaneous_amount", result.cost_breakdown?.miscellaneous_amount)}</TableCell>
                        <TableCell>per unit</TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: "success.50" }}>
                        <TableCell sx={{ fontWeight: "bold" }}>Total Unit Cost with Misc</TableCell>
                        <TableCell sx={{ fontWeight: "bold", color: "success.main" }}>{formatValue("total_cost", result.cost_breakdown?.total_unit_cost_with_misc)}</TableCell>
                        <TableCell>per unit</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Calculation Steps */}
              {result.calculation_steps && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Calculation Steps</Typography>
                  <Stack spacing={2}>
                    {Object.entries(result.calculation_steps).map(([step, data]) => (
                      <Paper key={step} variant="outlined" sx={{ p: 2, bgcolor: "grey.50" }}>
                        <Typography variant="subtitle2" sx={{ textTransform: "capitalize", mb: 1 }}>{step.replace(/_/g, ' ')}</Typography>
                        <Grid container spacing={2}>
                          {data.formula && (
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">Formula</Typography>
                              <Paper sx={{ p: 1, fontFamily: "monospace", fontSize: "0.75rem" }}>{data.formula}</Paper>
                            </Grid>
                          )}
                          {data.calculation && (
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">Calculation</Typography>
                              <Paper sx={{ p: 1, fontFamily: "monospace", fontSize: "0.75rem" }}>{data.calculation}</Paper>
                            </Grid>
                          )}
                          {data.result !== undefined && (
                            <Grid item xs={12}>
                              <Divider sx={{ my: 1 }} />
                              <Typography variant="body2" fontWeight="bold" color="primary">Result: {formatValue(step, data.result)}</Typography>
                            </Grid>
                          )}
                        </Grid>
                      </Paper>
                    ))}
                  </Stack>
                </Grid>
              )}

              {/* Machine Info & Outsourcing */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Machine Information</Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="caption">ID: {result.selected_machine?.id}</Typography>
                    <Typography variant="caption">Name: {result.selected_machine?.name}</Typography>
                    <Typography variant="caption">Cat: {result.machine_category}</Typography>
                    <Typography variant="caption">MHR: {formatValue("machine_hour_rate", result.cost_breakdown?.machine_hour_rate)}</Typography>
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Outsourcing Information</Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="caption">Outsourcing MHR: {formatValue("outsourcing_mhr", result.cost_breakdown?.outsourcing_mhr)}</Typography>
                    <Typography variant="caption">Material: {result.material}</Typography>
                    <Typography variant="caption">Shape: {result.shape}</Typography>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {showPdfViewer && (
        <Paper variant="outlined" sx={{ mt: 4, overflow: "hidden" }}>
          <Box sx={{ p: 2, bgcolor: "grey.50", borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle2">2D Drawing Viewer</Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <CompactPdfViewer
              fileUrl="http://127.0.0.1:8000/files/sample-cost-estimation.pdf?inline=true"
              fileName="Sample Cost Estimation Drawing.pdf"
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
}

export default CostEstimationPage;
