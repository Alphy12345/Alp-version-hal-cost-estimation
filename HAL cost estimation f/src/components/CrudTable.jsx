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
} from "@mui/material";

function CrudTable({
  title,
  resourcePath, // e.g. "/operation-type/"
  columns, // [{ key: "operation_name", label: "Operation Name" }, ...]
  initialFormState,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setForm(initialFormState);
    setEditingId(null);
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
        await api.post(resourcePath, form);
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

  const handleEdit = (item) => {
    setEditingId(item.id);
    const next = { ...initialFormState };
    Object.keys(next).forEach((k) => {
      next[k] = item[k] ?? "";
    });
    setForm(next);
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
                    sx={{ textTransform: "none" }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  size="small"
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {editingId != null ? "Update" : "Add"}
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
                    bgcolor: "rgba(56,189,248,0.12)",
                    color: "primary.light",
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
                    "& td": {
                      bgcolor: "background.paper",
                    },
                    "& td:first-of-type": { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
                    "& td:last-of-type": { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
                  }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {(() => {
                        const rawValue = col.getValue
                          ? col.getValue(item)
                          : item[col.key];
                        return rawValue != null ? String(rawValue) : "-";
                      })()}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleEdit(item)}
                        sx={{ minWidth: "auto", px: 1.5, fontSize: "0.7rem" }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => handleDelete(item.id)}
                        sx={{ minWidth: "auto", px: 1.5, fontSize: "0.7rem" }}
                      >
                        Delete
                      </Button>
                    </Stack>
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
