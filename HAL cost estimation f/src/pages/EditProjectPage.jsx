import React, { useState, useEffect } from "react";
import { getProject, updateProject } from "../api/projects";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

function EditProjectPage({ onChange, projectId }) {
  const [projectName, setProjectName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [projectDate, setProjectDate] = useState("");
  const [customFields, setCustomFields] = useState([]);
  const [requirementDocs, setRequirementDocs] = useState([]);
  const [otherDocs, setOtherDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const addCustomField = () => {
    setCustomFields((p) => [...p, { label: "", value: "" }]);
  };

  const updateCustomField = (idx, key, value) => {
    setCustomFields((p) => {
      const next = [...p];
      const row = next[idx] || { label: "", value: "" };
      next[idx] = { ...row, [key]: value };
      return next;
    });
  };

  const removeCustomField = (idx) => {
    setCustomFields((p) => p.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const project = await getProject(projectId);
      setProjectName(project.project_name || "");
      setCustomerName(project.customer_name || "");
      setPoNumber(project.po_reference_number || "");
      setProjectDate(project.project_date || "");
      const incomingCustomFields = Array.isArray(project.custom_fields)
        ? project.custom_fields
            .map((f) => ({
              label: String(f?.label || "").trim(),
              value: String(f?.value || "").trim(),
            }))
            .filter((f) => f.label)
        : [];
      setCustomFields(incomingCustomFields);
      setError(null);
    } catch (err) {
      setError("Failed to fetch project data");
      console.error("Error fetching project:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (setter, multiple) => (event) => {
    setter(multiple ? Array.from(event.target.files) : event.target.files[0]);
  };

  const removeFile = (setter, index) => {
    setter((prev) => {
      if (Array.isArray(prev)) {
        return prev.filter((_, i) => i !== index);
      } else {
        return null;
      }
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Create FormData for project update
      const formData = new FormData();
      formData.append('project_name', projectName);
      formData.append('customer_name', customerName);
      formData.append('po_reference_number', poNumber);
      formData.append('project_date', projectDate);

      const cleanedCustomFields = (customFields || [])
        .map((f) => ({
          label: String(f?.label || "").trim(),
          value: String(f?.value || "").trim(),
        }))
        .filter((f) => f.label);

      formData.append("custom_fields", JSON.stringify(cleanedCustomFields));

      // Add requirement docs (take first one if multiple)
      if (requirementDocs.length > 0) {
        formData.append('requirement_docs', requirementDocs[0]);
      }

      // Add other docs (take first one if multiple)
      if (otherDocs.length > 0) {
        formData.append('other_docs', otherDocs[0]);
      }

      // Update the project
      await updateProject(projectId, formData);

      // Show success message
      alert(`Project "${projectName}" updated successfully!`);

      // Navigate back to projects list
      onChange("projects");
    } catch (err) {
      setError("Failed to update project. Please try again.");
      console.error("Error updating project:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading project data...
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Stack spacing={3}>
        <Paper
          sx={{
            borderRadius: 3,
            background: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)",
            color: "white",
            p: 3,
          }}
        >
          <Typography variant="h4" fontWeight={600} sx={{ letterSpacing: 0.5 }}>
            Edit Project
          </Typography>
        </Paper>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            {error && <Alert severity="error">{error}</Alert>}

            <Card variant="outlined">
              <CardHeader title="Project Information" />
              <Divider />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Project Name"
                      placeholder="Enter project name"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="PO / Reference Number"
                      placeholder="Enter PO or reference number"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Customer Name"
                      placeholder="Enter customer name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Project Date"
                      type="date"
                      value={projectDate}
                      onChange={(e) => setProjectDate(e.target.value)}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardHeader
                title="Additional Fields"
                subheader="Add any extra project fields you want"
                action={
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addCustomField}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    Add Field
                  </Button>
                }
              />
              <Divider />
              <CardContent>
                {customFields.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No additional fields.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {customFields.map((row, idx) => (
                      <Grid container spacing={1.5} alignItems="center" key={idx}>
                        <Grid item xs={12} md={5}>
                          <TextField
                            label="Field name"
                            value={row.label}
                            onChange={(e) => updateCustomField(idx, "label", e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Value"
                            value={row.value}
                            onChange={(e) => updateCustomField(idx, "value", e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={1}>
                          <IconButton aria-label="remove" onClick={() => removeCustomField(idx)}>
                            <DeleteIcon />
                          </IconButton>
                        </Grid>
                      </Grid>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardHeader
                title="Add Additional Documents"
                subheader="Upload new documents to add to this project"
              />
              <Divider />
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                      Additional Requirement Documents
                    </Typography>
                    <Button variant="outlined" component="label" size="small" fullWidth sx={{ justifyContent: "flex-start" }}>
                      Choose Files
                      <input
                        type="file"
                        multiple
                        hidden
                        onChange={handleFileChange(setRequirementDocs, true)}
                      />
                    </Button>
                    {requirementDocs.length > 0 && (
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        {requirementDocs.map((f, i) => (
                          <Box
                            key={i}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              bgcolor: "grey.50",
                              px: 1.5,
                              py: 0.75,
                              borderRadius: 1,
                              border: 1,
                              borderColor: "divider",
                            }}
                          >
                            <Typography variant="caption" noWrap sx={{ flex: 1, mr: 1 }}>
                              {f.name}
                            </Typography>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => removeFile(setRequirementDocs, i)}
                              sx={{ minWidth: "auto", px: 1, fontSize: "0.7rem" }}
                            >
                              Remove
                            </Button>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                      Additional Other Documents
                    </Typography>
                    <Button variant="outlined" component="label" size="small" fullWidth sx={{ justifyContent: "flex-start" }}>
                      Choose Files
                      <input
                        type="file"
                        multiple
                        hidden
                        onChange={handleFileChange(setOtherDocs, true)}
                      />
                    </Button>
                    {otherDocs.length > 0 && (
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        {otherDocs.map((f, i) => (
                          <Box
                            key={i}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              bgcolor: "grey.50",
                              px: 1.5,
                              py: 0.75,
                              borderRadius: 1,
                              border: 1,
                              borderColor: "divider",
                            }}
                          >
                            <Typography variant="caption" noWrap sx={{ flex: 1, mr: 1 }}>
                              {f.name}
                            </Typography>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => removeFile(setOtherDocs, i)}
                              sx={{ minWidth: "auto", px: 1, fontSize: "0.7rem" }}
                            >
                              Remove
                            </Button>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Button
                variant="outlined"
                onClick={() => onChange("projects")}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                ← Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="warning"
                disabled={saving}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                {saving ? "Updating Project..." : "Update Project"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

export default EditProjectPage;
