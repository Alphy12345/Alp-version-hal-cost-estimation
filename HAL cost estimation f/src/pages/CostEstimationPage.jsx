import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import CalculateIcon from "@mui/icons-material/Calculate";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { calculateCostEstimation } from "../api/costEstimation";

function flattenObject(obj, prefix = "") {
  if (obj == null) return [];
  if (typeof obj !== "object") return [[prefix, obj]];
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [[prefix, "[]"]];
    return obj.flatMap((item, idx) => flattenObject(item, prefix ? `${prefix}[${idx}]` : `[${idx}]`));
  }
  return Object.entries(obj).flatMap(([k, v]) => flattenObject(v, prefix ? `${prefix}.${k}` : k));
}

export default function CostEstimationPage() {
  const [showSteps, setShowSteps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    operation_type: "turning",
    material: "steel",
    machine_name: "",
    man_hours_per_unit: "",
    miscellaneous_amount: "0",
    diameter: "",
    length: "",
    breadth: "",
    height: "",
    shape: "round",
  });

  const opTypeNormalized = useMemo(() => {
    return String(form.operation_type || "").trim().toLowerCase();
  }, [form.operation_type]);

  const roundOnlyOps = useMemo(() => new Set(["turning", "boring"]), []);
  const rectangularOnlyOps = useMemo(() => new Set(["milling", "grinding", "surface_treatment"]), []);
  const flexibleOps = useMemo(() => new Set(["drilling", "heat_treatment", "welding"]), []);

  const isFlexibleOp = flexibleOps.has(opTypeNormalized);
  const isRoundDims = roundOnlyOps.has(opTypeNormalized) || (isFlexibleOp && String(form.shape || "round").trim().toLowerCase() !== "rectangular");

  const dimensions = useMemo(() => {
    const n = (v) => {
      const num = Number(v);
      return Number.isFinite(num) ? num : NaN;
    };

    if (isRoundDims) {
      return {
        diameter: n(form.diameter),
        length: n(form.length),
      };
    }

    return {
      length: n(form.length),
      breadth: n(form.breadth),
      height: n(form.height),
    };
  }, [form, isRoundDims]);

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const validate = () => {
    const machine = String(form.machine_name || "").trim();
    if (!machine) return "Machine is required";

    const manHours = Number(form.man_hours_per_unit);
    if (!Number.isFinite(manHours) || manHours <= 0) return "Man Hours / Unit must be a valid number";

    if (!Number.isFinite(dimensions.length) || dimensions.length <= 0) return "Length must be a valid number";

    if (roundOnlyOps.has(opTypeNormalized)) {
      if (!Number.isFinite(dimensions.diameter) || dimensions.diameter <= 0) return "Diameter must be a valid number";
      return "";
    }

    if (rectangularOnlyOps.has(opTypeNormalized)) {
      if (!Number.isFinite(dimensions.breadth) || dimensions.breadth <= 0) return "Breadth must be a valid number";
      if (!Number.isFinite(dimensions.height) || dimensions.height <= 0) return "Height must be a valid number";
      return "";
    }

    if (flexibleOps.has(opTypeNormalized)) {
      const shape = String(form.shape || "round").trim().toLowerCase();
      if (shape === "rectangular") {
        if (!Number.isFinite(dimensions.breadth) || dimensions.breadth <= 0) return "Breadth must be a valid number";
        if (!Number.isFinite(dimensions.height) || dimensions.height <= 0) return "Height must be a valid number";
        return "";
      }
      if (!Number.isFinite(dimensions.diameter) || dimensions.diameter <= 0) return "Diameter must be a valid number";
      return "";
    }

    return "Invalid operation type";
  };

  const handleSubmit = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    const manHours = Number(form.man_hours_per_unit);

    const payload = {
      dimensions,
      material: String(form.material || ""),
      operation_type: String(form.operation_type || ""),
      machine_name: String(form.machine_name || ""),
      man_hours_per_unit: manHours,
      miscellaneous_amount: Array.isArray(form.miscellaneous_items)
        ? form.miscellaneous_items.reduce((sum, it) => {
            const n = Number(it?.amount);
            return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
          }, 0)
        : Number(form.miscellaneous_amount || 0),
    };

    try {
      setLoading(true);
      setError("");
      const res = await calculateCostEstimation(payload);
      setResult(res.data);
    } catch (err) {
      const e = err?.response?.data?.detail || err?.message || "Failed to calculate cost";
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    if (!result) return [];
    const flat = flattenObject(result);
    return flat.filter(([k]) => k && !k.startsWith("calculation_steps"));
  }, [result]);

  const stepRows = useMemo(() => {
    if (!result?.calculation_steps) return [];
    return flattenObject(result.calculation_steps);
  }, [result]);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Cost Estimation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter machining inputs and calculate the cost breakdown.
          </Typography>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={7}>
            <Card variant="outlined">
              <CardHeader title="Machining Inputs" subheader="Fill the values and calculate" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Operation Type"
                      value={form.operation_type}
                      onChange={handleChange("operation_type")}
                    >
                      <MenuItem value="turning">Turning</MenuItem>
                      <MenuItem value="milling">Milling</MenuItem>
                      <MenuItem value="drilling">Drilling</MenuItem>
                      <MenuItem value="grinding">Grinding</MenuItem>
                      <MenuItem value="boring">Boring</MenuItem>
                      <MenuItem value="heat_treatment">Heat Treatment</MenuItem>
                      <MenuItem value="welding">Welding</MenuItem>
                      <MenuItem value="surface_treatment">Surface Treatment</MenuItem>
                    </TextField>
                  </Grid>

                  {isFlexibleOp && (
                    <Grid item xs={12} sm={6}>
                      <TextField
                        select
                        fullWidth
                        label="Shape"
                        value={String(form.shape || "round").trim().toLowerCase() === "rectangular" ? "rectangular" : "round"}
                        onChange={handleChange("shape")}
                      >
                        <MenuItem value="round">Round</MenuItem>
                        <MenuItem value="rectangular">Rectangular</MenuItem>
                      </TextField>
                    </Grid>
                  )}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Material"
                      value={form.material}
                      onChange={handleChange("material")}
                    >
                      <MenuItem value="steel">Steel</MenuItem>
                      <MenuItem value="aluminium">Aluminium</MenuItem>
                      <MenuItem value="ss">SS</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Machine"
                      value={form.machine_name}
                      onChange={handleChange("machine_name")}
                      placeholder="e.g. CNC Lathe"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Man Hours / Unit"
                      value={form.man_hours_per_unit}
                      onChange={handleChange("man_hours_per_unit")}
                      inputMode="decimal"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Shape"
                      value={form.shape}
                      onChange={handleChange("shape")}
                    >
                      <MenuItem value="round">Round</MenuItem>
                      <MenuItem value="rectangular">Rectangular</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Miscellaneous Amount"
                      value={form.miscellaneous_amount}
                      onChange={handleChange("miscellaneous_amount")}
                      inputMode="decimal"
                    />
                  </Grid>

                  {form.shape === "round" ? (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Diameter (mm)"
                          value={form.diameter}
                          onChange={handleChange("diameter")}
                          inputMode="decimal"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Length (mm)"
                          value={form.length}
                          onChange={handleChange("length")}
                          inputMode="decimal"
                        />
                      </Grid>
                    </>
                  ) : (
                    <>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          label="Length (mm)"
                          value={form.length}
                          onChange={handleChange("length")}
                          inputMode="decimal"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          label="Breadth (mm)"
                          value={form.breadth}
                          onChange={handleChange("breadth")}
                          inputMode="decimal"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          label="Height (mm)"
                          value={form.height}
                          onChange={handleChange("height")}
                          inputMode="decimal"
                        />
                      </Grid>
                    </>
                  )}

                  <Grid item xs={12}>
                    <Button
                      onClick={handleSubmit}
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={18} /> : <CalculateIcon />}
                      disabled={loading}
                      sx={{ textTransform: "none", fontWeight: 800, px: 3, py: 1.25, borderRadius: 2 }}
                    >
                      Calculate
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card variant="outlined">
              <CardHeader title="Result" subheader={result ? "Calculation completed" : "Calculate to see the breakdown"} />
              <CardContent>
                {!result ? (
                  <Typography variant="body2" color="text.secondary">
                    No result yet.
                  </Typography>
                ) : (
                  <Stack spacing={1.25}>
                    <Button
                      variant="outlined"
                      onClick={() => setShowSteps((v) => !v)}
                      startIcon={showSteps ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, width: "fit-content" }}
                    >
                      {showSteps ? "Hide Steps" : "Show Steps"}
                    </Button>

                    <Divider />

                    <Stack spacing={0.75}>
                      {rows.map(([k, v]) => (
                        <Box key={k} sx={{ display: "flex", gap: 1.5, justifyContent: "space-between" }}>
                          <Typography variant="body2" color="text.secondary" sx={{ pr: 2 }}>
                            {k}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, textAlign: "right" }}>
                            {typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("en-IN") : String(v)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>

                    {showSteps ? (
                      <>
                        <Divider />
                        <Stack spacing={0.5}>
                          {stepRows.map(([k, v]) => (
                            <Box key={k} sx={{ display: "flex", gap: 1.5, justifyContent: "space-between" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ pr: 2 }}>
                                {k}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, textAlign: "right" }}>
                                {typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("en-IN") : String(v)}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </>
                    ) : null}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
