import React, { useEffect, useState } from "react";
import CrudTable from "../components/CrudTable";
import api from "../api/client";
import { Box, Typography, Grid, Select, MenuItem, FormControl, InputLabel, Snackbar, Alert, Button, Stack } from "@mui/material";

function ConfigurationPage({ onChange }) {
  const [machines, setMachines] = useState([]);
  const [operationTypes, setOperationTypes] = useState([]);
  const [dimensions, setDimensions] = useState([]);
  const [duties, setDuties] = useState([]);
  const [materials, setMaterials] = useState([]);
  
  // Track the newly added operation for the workflow
  const [pendingOperation, setPendingOperation] = useState(null);
  
  // Notifications state
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
    actions: [],
  });

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [
          machinesRes,
          opTypesRes,
          dimensionsRes,
          dutiesRes,
          materialsRes,
        ] = await Promise.all([
          api.get("/machines/"),
          api.get("/operation-type/"),
          api.get("/dimensions/"),
          api.get("/duties/"),
          api.get("/materials/"),
        ]);
        setMachines(machinesRes.data || []);
        setOperationTypes(opTypesRes.data || []);
        setDimensions(dimensionsRes.data || []);
        setDuties(dutiesRes.data || []);
        setMaterials(materialsRes.data || []);
      } catch (err) {
        console.error("Failed to load lookup data", err);
      }
    };

    fetchLookups();
  }, []);

  // Show notification helper
  const showNotification = (message, severity = "info", actions = []) => {
    setNotification({
      open: true,
      message,
      severity,
      actions,
    });
  };

  const closeNotification = () => {
    setNotification({ open: false, message: "", severity: "info", actions: [] });
  };

  // Handle when operation type is added
  const handleOperationAdded = (item) => {
    // Store the pending operation for tracking
    setPendingOperation({
      id: item.id,
      name: item.operation_name,
    });
    
    showNotification(
      `Operation "${item.operation_name}" added! Please enter a machine for this operation.`,
      "info",
      [
        {
          label: "Add Machine",
          onClick: () => {
            closeNotification();
            onChange && onChange("config_machines");
          },
        },
        {
          label: "Dismiss",
          onClick: closeNotification,
        },
      ]
    );
  };

  // Handle when machine is added - check if it matches pending operation
  const handleMachineAdded = (item) => {
    // If we have a pending operation and this machine is for that operation
    if (pendingOperation && String(item.op_id) === String(pendingOperation.id)) {
      showNotification(
        `Machine "${item.name}" added for "${pendingOperation.name}"! Now please enter MHR values for this operation.`,
        "success",
        [
          {
            label: "Enter MHR",
            onClick: () => {
              closeNotification();
              setPendingOperation(null); // Clear pending operation
              onChange && onChange("config_mhr");
            },
          },
          {
            label: "Dismiss",
            onClick: () => {
              closeNotification();
              setPendingOperation(null);
            },
          },
        ]
      );
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 800 }}>
          Manage master data used for cost estimation. Use the Add, Edit and
          Delete actions in each card.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Operation Type */}
        <Grid item xs={12} xl={6}>
          <CrudTable
            title="Operation Type"
            resourcePath="/operation-type/"
            columns={[
              { key: "operation_name", label: "Operation Name" },
            ]}
            initialFormState={{ operation_name: "" }}
            onAddSuccess={handleOperationAdded}
          />
        </Grid>

        {/* Machines */}
        <Grid item xs={12} xl={6}>
          <CrudTable
            title="Machines"
            resourcePath="/machines/"
            columns={[
              { key: "name", label: "Machine Name" },
              {
                key: "op_id",
                label: "Operation Type",
                getValue: (item) => {
                  const opFromLookup = operationTypes.find(
                    (ot) => ot.id === item.op_id
                  );
                  return (
                    item.operation_types?.operation_name ??
                    opFromLookup?.operation_name ??
                    item.op_id ??
                    "-"
                  );
                },
                renderInput: ({ value, onChange }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Operation Type</InputLabel>
                    <Select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      label="Operation Type"
                    >
                      <MenuItem value="">Select Operation Type</MenuItem>
                      {operationTypes.map((ot) => (
                        <MenuItem key={ot.id} value={ot.id}>
                          {ot.operation_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ),
              },
            ]}
            initialFormState={{ name: "", op_id: pendingOperation?.id || "" }}
            onAddSuccess={handleMachineAdded}
          />
        </Grid>

        {/* Dimensions */}
        <Grid item xs={12} xl={6}>
          <CrudTable
            title="Dimensions"
            resourcePath="/dimensions/"
            columns={[{ key: "name", label: "Dimension" }]}
            initialFormState={{ name: "" }}
          />
        </Grid>

        {/* Duties */}
        <Grid item xs={12} xl={6}>
          <CrudTable
            title="Duties"
            resourcePath="/duties/"
            columns={[{ key: "name", label: "Duty" }]}
            initialFormState={{ name: "" }}
          />
        </Grid>

        {/* Materials */}
        <Grid item xs={12} xl={6}>
          <CrudTable
            title="Materials"
            resourcePath="/materials/"
            columns={[{ key: "name", label: "Material" }]}
            initialFormState={{ name: "" }}
          />
        </Grid>

        {/* Machine Selection */}
        <Grid item xs={12} xl={6}>
          <CrudTable
            title="Machine Selection"
            resourcePath="/machine-selection/"
            columns={[
              {
                key: "machine_id",
                label: "Machine",
                getValue: (item) => {
                  const m = machines.find((mach) => mach.id === item.machine_id);
                  return m?.name ?? item.machine_id ?? "-";
                },
                renderInput: ({ value, onChange }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Machine</InputLabel>
                    <Select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      label="Machine"
                    >
                      <MenuItem value="">Select Machine</MenuItem>
                      {machines.map((m) => (
                        <MenuItem key={m.id} value={m.id}>
                          {m.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ),
              },
              {
                key: "dimension_id",
                label: "Dimension",
                getValue: (item) => {
                  const d = dimensions.find((dim) => dim.id === item.dimension_id);
                  return d?.name ?? item.dimension_id ?? "-";
                },
                renderInput: ({ value, onChange }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Dimension</InputLabel>
                    <Select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      label="Dimension"
                    >
                      <MenuItem value="">Select Dimension</MenuItem>
                      {dimensions.map((d) => (
                        <MenuItem key={d.id} value={d.id}>
                          {d.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ),
              },
              {
                key: "duty_id",
                label: "Duty",
                getValue: (item) => {
                  const du = duties.find((duty) => duty.id === item.duty_id);
                  return du?.name ?? item.duty_id ?? "-";
                },
                renderInput: ({ value, onChange }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Duty</InputLabel>
                    <Select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      label="Duty"
                    >
                      <MenuItem value="">Select Duty</MenuItem>
                      {duties.map((du) => (
                        <MenuItem key={du.id} value={du.id}>
                          {du.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ),
              },
              {
                key: "material_id",
                label: "Material",
                getValue: (item) => {
                  const mat = materials.find((m) => m.id === item.material_id);
                  return mat?.name ?? item.material_id ?? "-";
                },
                renderInput: ({ value, onChange }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Material</InputLabel>
                    <Select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      label="Material"
                    >
                      <MenuItem value="">Select Material</MenuItem>
                      {materials.map((mat) => (
                        <MenuItem key={mat.id} value={mat.id}>
                          {mat.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ),
              },
              { key: "size", label: "Size" },
            ]}
            initialFormState={{
              machine_id: "",
              dimension_id: "",
              duty_id: "",
              material_id: "",
              size: "",
            }}
          />
        </Grid>

        {/* MHR */}
        <Grid item xs={12}>
          <CrudTable
            title="MHR"
            resourcePath="/mhr/"
            columns={[
              {
                key: "op_type_id",
                label: "Operation Type",
                getValue: (item) => {
                  const op = operationTypes.find(
                    (ot) => ot.id === item.op_type_id
                  );
                  return op?.operation_name ?? item.op_type_id ?? "-";
                },
                renderInput: ({ value, onChange }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Operation Type</InputLabel>
                    <Select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      label="Operation Type"
                    >
                      <MenuItem value="">Select Operation Type</MenuItem>
                      {operationTypes.map((ot) => (
                        <MenuItem key={ot.id} value={ot.id}>
                          {ot.operation_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ),
              },
              {
                key: "duty_id",
                label: "Duty",
                getValue: (item) => {
                  const du = duties.find((duty) => duty.id === item.duty_id);
                  return du?.name ?? item.duty_id ?? "-";
                },
                renderInput: ({ value, onChange }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Duty</InputLabel>
                    <Select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      label="Duty"
                    >
                      <MenuItem value="">Select Duty</MenuItem>
                      {duties.map((du) => (
                        <MenuItem key={du.id} value={du.id}>
                          {du.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ),
              },
              {
                key: "machine_id",
                label: "Machine",
                getValue: (item) => {
                  const m = machines.find((mach) => mach.id === item.machine_id);
                  return m?.name ?? item.machine_id ?? "-";
                },
                renderInput: ({ value, onChange }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Machine</InputLabel>
                    <Select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      label="Machine"
                    >
                      <MenuItem value="">Select Machine</MenuItem>
                      {machines.map((m) => (
                        <MenuItem key={m.id} value={m.id}>
                          {m.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ),
              },
              { key: "investment_cost", label: "Investment Cost" },
              { key: "elect_power_rating", label: "Electrical Power Rating" },
              { key: "elect_power_charges", label: "Electrical Power Charges" },
              { key: "available_hrs_per_annum", label: "Available Hrs/Annum" },
              { key: "utilization_hrs_year", label: "Utilization Hrs/Year" },
              { key: "machine_hr_rate", label: "Machine Hour Rate" },
            ]}
            initialFormState={{
              op_type_id: "",
              duty_id: "",
              machine_id: "",
              investment_cost: "",
              elect_power_rating: "",
              elect_power_charges: "",
              available_hrs_per_annum: "",
              utilization_hrs_year: "",
              machine_hr_rate: "",
            }}
          />
        </Grid>
      </Grid>
      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={null}
        onClose={closeNotification}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={notification.severity}
          sx={{ width: "100%" }}
          action={
            <Stack direction="row" spacing={1}>
              {notification.actions.map((action, index) => (
                <Button
                  key={index}
                  color="inherit"
                  size="small"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          }
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ConfigurationPage;
