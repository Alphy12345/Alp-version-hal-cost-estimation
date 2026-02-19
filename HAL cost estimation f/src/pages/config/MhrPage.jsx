import React, { useEffect, useState } from "react";
import MhrForm from "../../components/MhrForm";
import api from "../../api/client";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";

function MhrPage() {
  const [operationTypes, setOperationTypes] = useState([]);
  const [duties, setDuties] = useState([]);
  const [machines, setMachines] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [inlineForm, setInlineForm] = useState({});

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [opTypesRes, dutiesRes, machinesRes] = await Promise.all([
          api.get("/operation-type/"),
          api.get("/duties/"),
          api.get("/machines/"),
        ]);
        setOperationTypes(opTypesRes.data || []);
        setDuties(dutiesRes.data || []);
        setMachines(machinesRes.data || []);
      } catch (err) {
        console.error("Failed to load lookup data", err);
      }
    };
    fetchLookups();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/mhr/");
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);
      setError("");

      if (editingItem) {
        await api.put(`/mhr/${editingItem.id}`, formData);
      } else {
        await api.post("/mhr/", formData);
      }

      setEditingItem(null);
      fetchItems();
    } catch (err) {
      console.error(err);
      setError("Failed to save data");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      setError("");
      await api.delete(`/mhr/${id}`);
      fetchItems();
    } catch (err) {
      console.error(err);
      setError("Failed to delete data");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingItem(null);
  };

  const handleInlineEdit = (item) => {
    setInlineEditingId(item.id);
    setInlineForm({ ...item });
  };

  const handleInlineCancel = () => {
    setInlineEditingId(null);
    setInlineForm({});
  };

  const handleInlineChange = (key, value) => {
    setInlineForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleInlineSubmit = async (id) => {
    try {
      setLoading(true);
      setError("");
      await api.put(`/mhr/${id}`, inlineForm);
      setInlineEditingId(null);
      setInlineForm({});
      fetchItems();
    } catch (err) {
      console.error(err);
      setError("Failed to save data");
    } finally {
      setLoading(false);
    }
  };

  const getOperationTypeName = (opTypeId) => {
    const op = operationTypes.find(ot => ot.id === opTypeId);
    return op?.operation_name ?? opTypeId ?? "-";
  };

  const getDutyName = (dutyId) => {
    const du = duties.find(duty => duty.id === dutyId);
    return du?.name ?? dutyId ?? "-";
  };

  const getMachineName = (machineId) => {
    const m = machines.find(mach => mach.id === machineId);
    return m?.name ?? machineId ?? "-";
  };

  return (
    <Stack spacing={4}>
      {/* Form Section */}
      <Card variant="outlined" sx={{ bgcolor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <CardHeader
          title={`MHR ${editingItem ? "Edit" : "Add"}`}
          titleTypographyProps={{ 
            sx: { 
              color: "#6366F1", 
              fontWeight: 700, 
              fontSize: "24px" 
            } 
          }}
          action={loading && <CircularProgress size={20} />}
          sx={{ 
            bgcolor: "#F1F5F9", 
            borderBottom: "1px solid #E2E8F0",
            "& .MuiCardHeader-title": { color: "#0F172A", fontWeight: 700, fontSize: "24px" }
          }}
        />
        <Divider sx={{ borderColor: "#E2E8F0" }} />
        <CardContent sx={{ bgcolor: "#FFFFFF" }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, bgcolor: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA" }}>
              {error}
            </Alert>
          )}
          <MhrForm
            operationTypes={operationTypes}
            duties={duties}
            machines={machines}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            initialData={editingItem || {}}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Table Section */}
      <Card variant="outlined" sx={{ bgcolor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <CardHeader
          title="MHR Records"
          titleTypographyProps={{ 
            sx: { 
              color: "#6366F1", 
              fontWeight: 700 
            } 
          }}
          action={loading && <CircularProgress size={20} />}
          sx={{ 
            bgcolor: "#F1F5F9", 
            borderBottom: "1px solid #E2E8F0",
            "& .MuiCardHeader-title": { color: "#0F172A", fontWeight: 700 }
          }}
        />
        <Divider sx={{ borderColor: "#E2E8F0" }} />
        <CardContent sx={{ p: 0, bgcolor: "#FFFFFF" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#6366F1" }}>
                  <TableCell sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Operation Type</TableCell>
                  <TableCell sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Duty</TableCell>
                  <TableCell sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Machine</TableCell>
                  <TableCell sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Investment Cost</TableCell>
                  <TableCell sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Power Rating</TableCell>
                  <TableCell sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Power Charges</TableCell>
                  <TableCell sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Available Hrs</TableCell>
                  <TableCell sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Utilization Hrs</TableCell>
                  <TableCell sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>MHR</TableCell>
                  <TableCell align="right" sx={{ color: "#FFFFFF", fontWeight: 600, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        No data available
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item, index) => (
                  <TableRow 
                    key={item.id} 
                    sx={{ 
                      bgcolor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                      "&:hover": { bgcolor: "#EEF2FF" },
                      borderBottom: "1px solid #F1F5F9",
                    }}
                  >
                    {inlineEditingId === item.id ? (
                      <>
                        <TableCell>
                          <FormControl fullWidth size="small">
                            <InputLabel>Operation Type</InputLabel>
                            <Select
                              value={inlineForm.op_type_id || ""}
                              onChange={(e) => handleInlineChange("op_type_id", e.target.value)}
                              label="Operation Type"
                            >
                              {operationTypes.map((ot) => (
                                <MenuItem key={ot.id} value={ot.id}>
                                  {ot.operation_name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <FormControl fullWidth size="small">
                            <InputLabel>Duty</InputLabel>
                            <Select
                              value={inlineForm.duty_id || ""}
                              onChange={(e) => handleInlineChange("duty_id", e.target.value)}
                              label="Duty"
                            >
                              {duties.map((d) => (
                                <MenuItem key={d.id} value={d.id}>
                                  {d.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <FormControl fullWidth size="small">
                            <InputLabel>Machine</InputLabel>
                            <Select
                              value={inlineForm.machine_id || ""}
                              onChange={(e) => handleInlineChange("machine_id", e.target.value)}
                              label="Machine"
                            >
                              {machines.map((m) => (
                                <MenuItem key={m.id} value={m.id}>
                                  {m.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={inlineForm.investment_cost || ""}
                            onChange={(e) => handleInlineChange("investment_cost", e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={inlineForm.elect_power_rating || ""}
                            onChange={(e) => handleInlineChange("elect_power_rating", e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={inlineForm.elect_power_charges || ""}
                            onChange={(e) => handleInlineChange("elect_power_charges", e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={inlineForm.available_hrs_per_annum || ""}
                            onChange={(e) => handleInlineChange("available_hrs_per_annum", e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={inlineForm.utilization_hrs_year || ""}
                            onChange={(e) => handleInlineChange("utilization_hrs_year", e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            value={inlineForm.machine_hr_rate || ""}
                            onChange={(e) => handleInlineChange("machine_hr_rate", e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleInlineSubmit(item.id)}
                              title="Save"
                            >
                              <SaveIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={handleInlineCancel}
                              title="Cancel"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell sx={{ color: "#334155" }}>{getOperationTypeName(item.op_type_id)}</TableCell>
                        <TableCell sx={{ color: "#334155" }}>{getDutyName(item.duty_id)}</TableCell>
                        <TableCell sx={{ color: "#334155" }}>{getMachineName(item.machine_id)}</TableCell>
                        <TableCell sx={{ color: "#334155" }}>{item.investment_cost || "-"}</TableCell>
                        <TableCell sx={{ color: "#334155" }}>{item.elect_power_rating || "-"}</TableCell>
                        <TableCell sx={{ color: "#334155" }}>{item.elect_power_charges || "-"}</TableCell>
                        <TableCell sx={{ color: "#334155" }}>{item.available_hrs_per_annum || "-"}</TableCell>
                        <TableCell sx={{ color: "#334155" }}>{item.utilization_hrs_year || "-"}</TableCell>
                        <TableCell sx={{ color: "#334155" }}>{item.machine_hr_rate || "-"}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              onClick={() => handleInlineEdit(item)}
                              title="Edit"
                              sx={{ color: "#6366F1", "&:hover": { color: "#4F46E5", bgcolor: "#EEF2FF" } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(item.id)}
                              title="Delete"
                              sx={{ color: "#EF4444", "&:hover": { color: "#DC2626", bgcolor: "#FEE2E2" } }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default MhrPage;
