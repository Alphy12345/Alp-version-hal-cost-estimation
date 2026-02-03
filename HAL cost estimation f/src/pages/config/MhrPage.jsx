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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

function MhrPage() {
  const [operationTypes, setOperationTypes] = useState([]);
  const [duties, setDuties] = useState([]);
  const [machines, setMachines] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingItem, setEditingItem] = useState(null);

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
      <Card variant="outlined">
        <CardHeader
          title={`MHR ${editingItem ? "Edit" : "Add"}`}
          action={loading && <CircularProgress size={20} />}
        />
        <Divider />
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
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
      <Card variant="outlined">
        <CardHeader
          title="MHR Records"
          action={loading && <CircularProgress size={20} />}
        />
        <Divider />
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "grey.50" }}>
                  <TableCell>Operation Type</TableCell>
                  <TableCell>Duty</TableCell>
                  <TableCell>Machine</TableCell>
                  <TableCell>Investment Cost</TableCell>
                  <TableCell>Power Rating</TableCell>
                  <TableCell>Power Charges</TableCell>
                  <TableCell>Available Hrs</TableCell>
                  <TableCell>Utilization Hrs</TableCell>
                  <TableCell>MHR</TableCell>
                  <TableCell align="right">Actions</TableCell>
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
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{getOperationTypeName(item.op_type_id)}</TableCell>
                    <TableCell>{getDutyName(item.duty_id)}</TableCell>
                    <TableCell>{getMachineName(item.machine_id)}</TableCell>
                    <TableCell>{item.investment_cost || "-"}</TableCell>
                    <TableCell>{item.elect_power_rating || "-"}</TableCell>
                    <TableCell>{item.elect_power_charges || "-"}</TableCell>
                    <TableCell>{item.available_hrs_per_annum || "-"}</TableCell>
                    <TableCell>{item.utilization_hrs_year || "-"}</TableCell>
                    <TableCell>{item.machine_hr_rate || "-"}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(item)}
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(item.id)}
                          title="Delete"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
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
