import React, { useEffect, useState } from "react";
import api from "../api/client";
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Grid,
  IconButton,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

function CrudTable({
  title,
  resourcePath, // e.g. "/operation-type/"
  columns, // [{ key: "operation_name", label: "Operation Name" }, ...]
  initialFormState,
  onAddSuccess, // callback when item is added
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [inlineForm, setInlineForm] = useState({});

  const resetForm = () => {
    setForm(initialFormState);
    setEditingId(null);
    setInlineEditingId(null);
    setInlineForm({});
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(resourcePath);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourcePath]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      if (editingId != null) {
        await api.put(`${resourcePath}${editingId}`, form);
      } else {
        const res = await api.post(resourcePath, form);
        // Call onAddSuccess callback if provided
        if (onAddSuccess && typeof onAddSuccess === "function") {
          onAddSuccess(form);
        }
      }
      resetForm();
      fetchItems();
    } catch (err) {
      console.error(err);
      setError("Failed to save data");
    } finally {
      setLoading(false);
    }
  };

  const handleInlineEdit = (item) => {
    setInlineEditingId(item.id);
    const next = { ...initialFormState };
    Object.keys(next).forEach((k) => {
      next[k] = item[k] ?? "";
    });
    setInlineForm(next);
  };

  const handleInlineChange = (key, value) => {
    setInlineForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleInlineSubmit = async (id) => {
    try {
      setLoading(true);
      setError("");
      await api.put(`${resourcePath}${id}`, inlineForm);
      resetForm();
      fetchItems();
    } catch (err) {
      console.error(err);
      setError("Failed to save data");
    } finally {
      setLoading(false);
    }
  };

  const handleInlineCancel = () => {
    setInlineEditingId(null);
    setInlineForm({});
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      setError("");
      await api.delete(`${resourcePath}${id}`);
      fetchItems();
    } catch (err) {
      console.error(err);
      setError("Failed to delete data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <Stack spacing={2}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
          {loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Loading...
              </Typography>
            </Box>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ fontSize: "0.875rem" }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} md={9}>
              <Grid container spacing={2}>
                {columns.map((col) => (
                  <Grid item xs={12} sm={6} lg={4} key={col.key}>
                    {col.renderInput ? (
                      col.renderInput({
                        value: form[col.key] ?? "",
                        onChange: (value) => handleChange(col.key, value),
                        form,
                      })
                    ) : (
                      <TextField
                        label={col.label}
                        value={form[col.key] ?? ""}
                        onChange={(e) => handleChange(col.key, e.target.value)}
                        placeholder={col.placeholder || col.label}
                        fullWidth
                        size="small"
                      />
                    )}
                  </Grid>
                ))}
              </Grid>
            </Grid>
            <Grid item xs={12} md={3}>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {editingId != null && (
                  <Button
                    variant="outlined"
                    onClick={resetForm}
                    size="small"
                    sx={{
                      textTransform: "none",
                      bgcolor: "#F1F5F9",
                      borderColor: "#CBD5E1",
                      color: "#334155",
                      "&:hover": { bgcolor: "#E2E8F0", borderColor: "#CBD5E1" },
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
                    "&:hover": { bgcolor: "#4F46E5" },
                  }}
                >
                  Add
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>

        <TableContainer>
          <Table
            size="small"
            sx={{
              borderCollapse: "separate",
              borderSpacing: "0px 8px",
              px: 1,
            }}
          >
            <TableHead>
              <TableRow
                sx={{
                  "& th": {
                    bgcolor: "#6366F1",
                    color: "#FFFFFF",
                    fontWeight: 600,
                  },
                  "& th:first-of-type": { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
                  "& th:last-of-type": { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
                }}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} sx={{ fontWeight: 600 }}>
                    {col.label}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 3 }}>
                    <Typography variant="caption" color="text.secondary">
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
                    "& td": {
                      borderColor: "#E2E8F0",
                    },
                    "& td:first-of-type": { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
                    "& td:last-of-type": { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
                  }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {inlineEditingId === item.id ? (
                        col.renderInput ? (
                          col.renderInput({
                            value: inlineForm[col.key] ?? "",
                            onChange: (value) => handleInlineChange(col.key, value),
                            form: inlineForm,
                          })
                        ) : (
                          <TextField
                            value={inlineForm[col.key] ?? ""}
                            onChange={(e) => handleInlineChange(col.key, e.target.value)}
                            size="small"
                            fullWidth
                            sx={{ minWidth: 100 }}
                          />
                        )
                      ) : (
                        (() => {
                          const rawValue = col.getValue
                            ? col.getValue(item)
                            : item[col.key];
                          return rawValue != null ? String(rawValue) : "-";
                        })()
                      )}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    {inlineEditingId === item.id ? (
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
                    ) : (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          size="small"
                          onClick={() => handleInlineEdit(item)}
                          title="Edit"
                          sx={{ color: "#6366F1" }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(item.id)}
                          title="Delete"
                          sx={{ color: "#EF4444" }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  );
}

export default CrudTable;
