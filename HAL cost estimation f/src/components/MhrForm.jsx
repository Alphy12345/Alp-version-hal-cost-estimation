import React, { useState, useEffect } from "react";
import api from "../api/client";
import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

function MhrForm({
  operationTypes,
  duties,
  machines,
  onSubmit,
  onCancel,
  initialData = {},
  loading = false
}) {
  const [form, setForm] = useState({
    op_type_id: "",
    duty_id: "",
    machine_id: "",
    investment_cost: "",
    elect_power_rating: "",
    elect_power_charges: "",
    available_hrs_per_annum: "",
    utilization_hrs_year: "",
    machine_hr_rate: "",
    ...initialData
  });

  const [calculatedMHR, setCalculatedMHR] = useState("");
  const [autoCalculated, setAutoCalculated] = useState({
    elect_power_charges: true,
    utilization_hrs_year: true,
  });

  // Immediate electrical power charges calculation when power rating changes
  useEffect(() => {
    const { elect_power_rating, elect_power_charges } = form;

    // Auto-calculate if user hasn't manually overridden it
    if (
      elect_power_rating &&
      (autoCalculated.elect_power_charges || !elect_power_charges || elect_power_charges === "")
    ) {
      const calculatedPowerCharges = parseFloat(elect_power_rating) * 5.0;
      setForm(prev => ({
        ...prev,
        elect_power_charges: calculatedPowerCharges.toString()
      }));
      setAutoCalculated(prev => ({ ...prev, elect_power_charges: true }));
    }
  }, [form.elect_power_rating, autoCalculated.elect_power_charges]);

  // Immediate utilization hours calculation when available hours or machine type changes
  useEffect(() => {
    const { available_hrs_per_annum, utilization_hrs_year, machine_id } = form;

    // If available hours is empty and this field is auto-calculated, clear it
    if (!available_hrs_per_annum) {
      if (autoCalculated.utilization_hrs_year && utilization_hrs_year) {
        setForm(prev => ({ ...prev, utilization_hrs_year: "" }));
      }
      return;
    }

    // Auto-calculate if user hasn't manually overridden it
    if (
      available_hrs_per_annum &&
      (autoCalculated.utilization_hrs_year || !utilization_hrs_year || utilization_hrs_year === "")
    ) {
      // Get machine type from selected machine
      let machineType = "conventional"; // default
      if (machine_id && machines) {
        const selectedMachine = machines.find(m => m.id === parseInt(machine_id));
        if (selectedMachine && selectedMachine.name) {
          machineType = selectedMachine.name.toLowerCase().includes("cnc") ? "cnc" : "conventional";
        }
      }

      // Calculate downtime based on machine type
      const downtimePercentage = machineType === "cnc" ? 0.15 : 0.07;
      const available = Number.parseFloat(available_hrs_per_annum);
      if (!Number.isFinite(available)) {
        if (autoCalculated.utilization_hrs_year && utilization_hrs_year) {
          setForm(prev => ({ ...prev, utilization_hrs_year: "" }));
        }
        return;
      }

      const downtimeHours = available * downtimePercentage;
      const calculatedUtilizationHours = available - downtimeHours;

      // Prefer integer display when result is effectively an integer (e.g. 3348)
      const roundedUtilization = Math.round(calculatedUtilizationHours);
      const utilizationDisplay =
        Math.abs(calculatedUtilizationHours - roundedUtilization) < 1e-9
          ? String(roundedUtilization)
          : String(Number(calculatedUtilizationHours.toFixed(2)));

      setForm(prev => ({
        ...prev,
        utilization_hrs_year: utilizationDisplay
      }));
      setAutoCalculated(prev => ({ ...prev, utilization_hrs_year: true }));
    }
  }, [form.available_hrs_per_annum, form.machine_id, machines, autoCalculated.utilization_hrs_year]);

  const handleChange = (key, value) => {
    if (key === "elect_power_charges") {
      setAutoCalculated(prev => ({ ...prev, elect_power_charges: false }));
    }
    if (key === "utilization_hrs_year") {
      setAutoCalculated(prev => ({ ...prev, utilization_hrs_year: false }));
    }
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const handleReset = () => {
    setForm({
      op_type_id: "",
      duty_id: "",
      machine_id: "",
      investment_cost: "",
      elect_power_rating: "",
      elect_power_charges: "",
      available_hrs_per_annum: "",
      utilization_hrs_year: "",
      machine_hr_rate: "",
    });
    setCalculatedMHR("");
    onCancel();
  };

  const isElectPowerChargesAutoCalculated = form.elect_power_rating && (!form.elect_power_charges || form.elect_power_charges === "");
  const isUtilizationHoursAutoCalculated = form.available_hrs_per_annum && (!form.utilization_hrs_year || form.utilization_hrs_year === "");

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ bgcolor: "#FFFFFF", p: 2, borderRadius: "12px", border: "1px solid #E2E8F0" }}>
      <Stack spacing={3}>
        <Grid container spacing={2}>
          {/* Operation Type */}
          <Grid item xs={12} sm={6} lg={4}>
            <FormControl fullWidth size="small" sx={{ 
              "& .MuiInputBase-root": { 
                bgcolor: "#F8FAFC", 
                borderColor: "#E2E8F0",
              },
              "& .MuiOutlinedInput-root": {
                "&:hover fieldset": { borderColor: "#CBD5E1" },
                "&.Mui-focused fieldset": { borderColor: "#6366F1" },
              }
            }}>
              <InputLabel sx={{ color: "#64748B", fontSize: "11px" }}>Operation Type</InputLabel>
              <Select
                value={form.op_type_id}
                onChange={(e) => handleChange("op_type_id", e.target.value)}
                label="Operation Type"
                sx={{ bgcolor: "#F8FAFC", "& .MuiSelect-select": { color: "#334155" } }}
              >
                <MenuItem value="">Select Operation Type</MenuItem>
                {operationTypes.map((ot) => (
                  <MenuItem key={ot.id} value={ot.id}>
                    {ot.operation_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Duty */}
          <Grid item xs={12} sm={6} lg={4}>
            <FormControl fullWidth size="small" sx={{ 
              "& .MuiInputBase-root": { 
                bgcolor: "#F8FAFC", 
                borderColor: "#E2E8F0",
              },
              "& .MuiOutlinedInput-root": {
                "&:hover fieldset": { borderColor: "#CBD5E1" },
                "&.Mui-focused fieldset": { borderColor: "#6366F1" },
              }
            }}>
              <InputLabel sx={{ color: "#64748B", fontSize: "11px" }}>Duty</InputLabel>
              <Select
                value={form.duty_id}
                onChange={(e) => handleChange("duty_id", e.target.value)}
                label="Duty"
                sx={{ bgcolor: "#F8FAFC", "& .MuiSelect-select": { color: "#334155" } }}
              >
                <MenuItem value="">Select Duty</MenuItem>
                {duties.map((du) => (
                  <MenuItem key={du.id} value={du.id}>
                    {du.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Machine */}
          <Grid item xs={12} sm={6} lg={4}>
            <FormControl fullWidth size="small" sx={{ 
              "& .MuiInputBase-root": { 
                bgcolor: "#F8FAFC", 
                borderColor: "#E2E8F0",
              },
              "& .MuiOutlinedInput-root": {
                "&:hover fieldset": { borderColor: "#CBD5E1" },
                "&.Mui-focused fieldset": { borderColor: "#6366F1" },
              }
            }}>
              <InputLabel sx={{ color: "#64748B", fontSize: "11px" }}>Machine</InputLabel>
              <Select
                value={form.machine_id}
                onChange={(e) => handleChange("machine_id", e.target.value)}
                label="Machine"
                sx={{ bgcolor: "#F8FAFC", "& .MuiSelect-select": { color: "#334155" } }}
              >
                <MenuItem value="">Select Machine</MenuItem>
                {machines.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Investment Cost */}
          <Grid item xs={12} sm={6} lg={4}>
            <TextField
              label="Investment Cost"
              type="number"
              inputProps={{ step: "0.01" }}
              value={form.investment_cost}
              onChange={(e) => handleChange("investment_cost", e.target.value)}
              placeholder="Enter investment cost"
              fullWidth
              size="small"
              sx={{
                "& .MuiInputBase-root": { 
                  bgcolor: "#F8FAFC",
                  "& fieldset": { borderColor: "#E2E8F0" },
                  "&:hover fieldset": { borderColor: "#CBD5E1" },
                  "&.Mui-focused fieldset": { borderColor: "#6366F1" },
                },
                "& .MuiInputLabel-root": { color: "#64748B", fontSize: "11px" },
                "& .MuiInputBase-input": { color: "#334155" },
              }}
            />
          </Grid>

          {/* Electrical Power Rating */}
          <Grid item xs={12} sm={6} lg={4}>
            <TextField
              label="Electrical Power Rating"
              type="number"
              inputProps={{ step: "0.01" }}
              value={form.elect_power_rating}
              onChange={(e) => handleChange("elect_power_rating", e.target.value)}
              placeholder="Enter power rating in kW"
              fullWidth
              size="small"
              sx={{
                "& .MuiInputBase-root": { 
                  bgcolor: "#F8FAFC",
                  "& fieldset": { borderColor: "#E2E8F0" },
                  "&:hover fieldset": { borderColor: "#CBD5E1" },
                  "&.Mui-focused fieldset": { borderColor: "#6366F1" },
                },
                "& .MuiInputLabel-root": { color: "#64748B", fontSize: "11px" },
                "& .MuiInputBase-input": { color: "#334155" },
              }}
            />
          </Grid>

          {/* Electrical Power Charges */}
          <Grid item xs={12} sm={6} lg={4}>
            <TextField
              label={
                <Box component="span">
                  Electrical Power Charges
                  {isElectPowerChargesAutoCalculated && (
                    <Box component="span" sx={{ color: "#6366F1", ml: 0.5, fontSize: "0.75rem" }}>
                      ✓ Auto-calculated
                    </Box>
                  )}
                </Box>
              }
              type="number"
              inputProps={{ step: "0.01", readOnly: isElectPowerChargesAutoCalculated }}
              value={form.elect_power_charges}
              onChange={(e) => handleChange("elect_power_charges", e.target.value)}
              placeholder={form.elect_power_rating ? `Auto-calculated: ${form.elect_power_rating} × 5 = ${(parseFloat(form.elect_power_rating) * 5).toFixed(2)}` : "Enter power rating first"}
              fullWidth
              size="small"
              sx={{
                "& .MuiInputBase-root": isElectPowerChargesAutoCalculated
                  ? {
                      bgcolor: "#EEF2FF",
                      "& fieldset": { borderColor: "#6366F1" },
                    }
                  : {
                      bgcolor: "#F8FAFC",
                      "& fieldset": { borderColor: "#E2E8F0" },
                      "&:hover fieldset": { borderColor: "#CBD5E1" },
                      "&.Mui-focused fieldset": { borderColor: "#6366F1" },
                    },
                "& .MuiInputLabel-root": { color: "#64748B", fontSize: "11px" },
                "& .MuiInputBase-input": { color: "#334155" },
              }}
              helperText={isElectPowerChargesAutoCalculated && (
                <Typography variant="caption" sx={{ color: "#6366F1" }}>
                  Formula: {form.elect_power_rating} kW × 5.0 = {(parseFloat(form.elect_power_rating) * 5).toFixed(2)}
                </Typography>
              )}
            />
          </Grid>

          {/* Available Hrs/Annum */}
          <Grid item xs={12} sm={6} lg={4}>
            <TextField
              label="Available Hrs/Annum"
              type="number"
              inputProps={{ step: "0.01" }}
              value={form.available_hrs_per_annum}
              onChange={(e) => handleChange("available_hrs_per_annum", e.target.value)}
              placeholder="Enter available hours per annum"
              fullWidth
              size="small"
              sx={{
                "& .MuiInputBase-root": { 
                  bgcolor: "#F8FAFC",
                  "& fieldset": { borderColor: "#E2E8F0" },
                  "&:hover fieldset": { borderColor: "#CBD5E1" },
                  "&.Mui-focused fieldset": { borderColor: "#6366F1" },
                },
                "& .MuiInputLabel-root": { color: "#64748B", fontSize: "11px" },
                "& .MuiInputBase-input": { color: "#334155" },
              }}
            />
          </Grid>

          {/* Utilization Hrs/Year */}
          <Grid item xs={12} sm={6} lg={4}>
            <TextField
              label={
                <Box component="span">
                  Utilization Hrs/Year
                  {isUtilizationHoursAutoCalculated && (
                    <Box component="span" sx={{ color: "#6366F1", ml: 0.5, fontSize: "0.75rem" }}>
                      ✓ Auto-calculated
                    </Box>
                  )}
                </Box>
              }
              type="number"
              inputProps={{ step: "0.01", readOnly: isUtilizationHoursAutoCalculated }}
              value={form.utilization_hrs_year}
              onChange={(e) => handleChange("utilization_hrs_year", e.target.value)}
              placeholder={form.available_hrs_per_annum ? "Auto-calculated from available hours - downtime" : "Enter available hours first"}
              fullWidth
              size="small"
              sx={{
                "& .MuiInputBase-root": isUtilizationHoursAutoCalculated
                  ? {
                      bgcolor: "#EEF2FF",
                      "& fieldset": { borderColor: "#6366F1" },
                    }
                  : {
                      bgcolor: "#F8FAFC",
                      "& fieldset": { borderColor: "#E2E8F0" },
                      "&:hover fieldset": { borderColor: "#CBD5E1" },
                      "&.Mui-focused fieldset": { borderColor: "#6366F1" },
                    },
                "& .MuiInputLabel-root": { color: "#64748B", fontSize: "11px" },
                "& .MuiInputBase-input": { color: "#334155" },
              }}
              helperText={isUtilizationHoursAutoCalculated && (() => {
                // Get machine type for display
                let machineType = "conventional";
                if (form.machine_id && machines) {
                  const selectedMachine = machines.find(m => m.id === parseInt(form.machine_id));
                  if (selectedMachine && selectedMachine.name) {
                    machineType = selectedMachine.name.toLowerCase().includes("cnc") ? "cnc" : "conventional";
                  }
                }
                const downtimePercentage = machineType === "cnc" ? 15 : 7;
                const downtimeHours = (parseFloat(form.available_hrs_per_annum) * downtimePercentage / 100).toFixed(2);
                const utilizationHours = (parseFloat(form.available_hrs_per_annum) - parseFloat(downtimeHours)).toFixed(2);

                return (
                  <Typography variant="caption" sx={{ color: "#6366F1" }}>
                    Formula: {form.available_hrs_per_annum} - {downtimeHours} ({downtimePercentage}% downtime) = {utilizationHours}
                  </Typography>
                );
              })()}
            />
          </Grid>

          {/* Machine Hour Rate */}
          <Grid item xs={12} sm={6} lg={4}>
            <TextField
              label="Machine Hour Rate"
              type="number"
              inputProps={{ step: "0.01" }}
              value={form.machine_hr_rate || ""}
              onChange={(e) => handleChange("machine_hr_rate", e.target.value)}
              placeholder="Enter reference MHR"
              fullWidth
              size="small"
              sx={{
                "& .MuiInputBase-root": { 
                  bgcolor: "#F8FAFC",
                  "& fieldset": { borderColor: "#E2E8F0" },
                  "&:hover fieldset": { borderColor: "#CBD5E1" },
                  "&.Mui-focused fieldset": { borderColor: "#6366F1" },
                },
                "& .MuiInputLabel-root": { color: "#64748B", fontSize: "11px" },
                "& .MuiInputBase-input": { color: "#334155" },
              }}
            />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {initialData.id && (
            <Button
              variant="outlined"
              onClick={handleReset}
              size="small"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                borderColor: "#E2E8F0",
                color: "#64748B",
                "&:hover": { bgcolor: "#F1F5F9", borderColor: "#CBD5E1" },
              }}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            size="small"
            sx={{
              textTransform: "none",
              fontWeight: 600,
              bgcolor: "#6366F1",
              borderRadius: "8px",
              "&:hover": { bgcolor: "#4F46E5" },
              "&:disabled": { bgcolor: "#A5B4FC" },
            }}
          >
            {loading ? "Saving..." : (initialData.id ? "Update" : "Add")}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default MhrForm;
