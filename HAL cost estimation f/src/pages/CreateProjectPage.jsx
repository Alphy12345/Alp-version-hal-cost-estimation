import React, { useState } from "react";
import { createProject, addProjectPart } from "../api/projects";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

function CreateProjectPage({ onChange, onCreate }) {
  const [projectName, setProjectName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [projectDate, setProjectDate] = useState("");
  const [customFields, setCustomFields] = useState([]);
  const [requirementDocs, setRequirementDocs] = useState([]);
  const [otherDocs, setOtherDocs] = useState([]);
  const [parts, setParts] = useState([
    {
      partNumber: "",
      partName: "",
      drawing2D: null,
    },
  ]);
  const [loading, setLoading] = useState(false);
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

  const replaceFile = (setter, index, multiple) => (event) => {
    const newFiles = Array.from(event.target.files);
    setter((prev) => {
      if (Array.isArray(prev)) {
        const updated = [...prev];
        updated[index] = newFiles[0];
        return updated;
      } else {
        return newFiles[0];
      }
    });
  };

  const handlePartFileChange = (index, field) => (event) => {
    const newParts = [...parts];
    newParts[index][field] = event.target.files[0];
    setParts(newParts);
  };

  const addPart = () => {
    setParts([
      ...parts,
      {
        partNumber: "",
        partName: "",
        drawing2D: null,
      },
    ]);
  };

  const removePart = (index) => {
    const newParts = parts.filter((_, i) => i !== index);
    setParts(newParts);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create FormData for project creation
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

      if (cleanedCustomFields.length > 0) {
        formData.append("custom_fields", JSON.stringify(cleanedCustomFields));
      }

      // Add requirement docs (take first one if multiple)
      if (requirementDocs.length > 0) {
        formData.append('requirement_docs', requirementDocs[0]);
      }

      // Add other docs (take first one if multiple)
      if (otherDocs.length > 0) {
        formData.append('other_docs', otherDocs[0]);
      }

      // Create the project
      const createdProject = await createProject(formData);

      // Add parts to the created project
      const validParts = parts.filter(part =>
        part.partNumber.trim() !== '' || part.partName.trim() !== ''
      );

      if (validParts.length > 0) {
        for (const part of validParts) {
          const partFormData = new FormData();
          partFormData.append('part_number', part.partNumber || '');
          partFormData.append('part_name', part.partName || '');

          if (part.drawing2D) {
            partFormData.append('drawing_2d', part.drawing2D);
          }

          try {
            await addProjectPart(createdProject.id, partFormData);
          } catch (partError) {
            console.error(`Error adding part ${part.partNumber}:`, partError);
            // Continue with other parts even if one fails
          }
        }
      }

      // Show success message
      const message = validParts.length > 0
        ? `Project "${createdProject.project_name}" created successfully with ${validParts.length} part(s)!`
        : `Project "${createdProject.project_name}" created successfully!`;
      alert(message);

      // Call onCreate callback if provided
      if (onCreate) {
        onCreate(createdProject);
      }

      // Navigate back to projects list
      onChange("projects");
    } catch (err) {
      setError("Failed to create project. Please try again.");
      console.error("Error creating project:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: "100%" }}>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => onChange("projects")}
        sx={{ 
          textTransform: "none", 
          fontWeight: 700, 
          mb: 2,
          color: "#6366F1",
          "&:hover": { bgcolor: "#EEF2FF" }
        }}
      >
        Back to Projects
      </Button>

      <Stack spacing={3}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h4" fontWeight={800} sx={{ fontSize: "1.75rem" }}>
            Create New Project
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            {error && <Alert severity="error">{error}</Alert>}

            <Card variant="outlined" sx={{ boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <CardHeader 
                title="Project Information" 
                sx={{ bgcolor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}
              />
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

            <Card variant="outlined" sx={{ boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <CardHeader
                title="Additional Fields"
                sx={{ bgcolor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}
                action={
                  <Button startIcon={<AddIcon />} onClick={addCustomField} sx={{ textTransform: "none", fontWeight: 700 }}>
                    Add Field
                  </Button>
                }
              />
              <Divider />
              <CardContent>
                {customFields.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Add any extra project fields you want (e.g., Department, Vendor, Notes).
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

            <Card variant="outlined" sx={{ boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <CardHeader 
                title="Documents" 
                sx={{ bgcolor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}
              />
              <Divider />
              <CardContent>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                      Requirement Documents
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
                              bgcolor: "rgba(15, 23, 42, 0.6)",
                              px: 1.5,
                              py: 0.75,
                              borderRadius: 1,
                              border: 1,
                              borderColor: "rgba(30, 64, 175, 0.3)",
                            }}
                          >
                            <Typography variant="caption" noWrap sx={{ flex: 1, mr: 1 }}>
                              {f.name}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              <Button size="small" component="label" sx={{ minWidth: "auto", px: 1, fontSize: "0.7rem" }}>
                                Edit
                                <input
                                  type="file"
                                  hidden
                                  onChange={replaceFile(setRequirementDocs, i, true)}
                                />
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                onClick={() => removeFile(setRequirementDocs, i)}
                                sx={{ minWidth: "auto", px: 1, fontSize: "0.7rem" }}
                              >
                                Delete
                              </Button>
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                      Other Documents
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
                              bgcolor: "rgba(15, 23, 42, 0.6)",
                              px: 1.5,
                              py: 0.75,
                              borderRadius: 1,
                              border: 1,
                              borderColor: "rgba(30, 64, 175, 0.3)",
                            }}
                          >
                            <Typography variant="caption" noWrap sx={{ flex: 1, mr: 1 }}>
                              {f.name}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              <Button size="small" component="label" sx={{ minWidth: "auto", px: 1, fontSize: "0.7rem" }}>
                                Edit
                                <input
                                  type="file"
                                  hidden
                                  onChange={replaceFile(setOtherDocs, i, true)}
                                />
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                onClick={() => removeFile(setOtherDocs, i)}
                                sx={{ minWidth: "auto", px: 1, fontSize: "0.7rem" }}
                              >
                                Delete
                              </Button>
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
              <CardHeader
                title="Parts"
                sx={{ bgcolor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}
                action={
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addPart}
                    variant="contained"
                    size="small"
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    Add Part
                  </Button>
                }
              />
              <Divider />
              <CardContent>
                <Stack spacing={2}>
                  {parts.map((part, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Part {index + 1}
                        </Typography>
                        {parts.length > 1 && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removePart(index)}
                            title="Remove Part"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Part Number"
                            placeholder="Enter part number"
                            value={part.partNumber}
                            onChange={(e) => {
                              const newParts = [...parts];
                              newParts[index].partNumber = e.target.value;
                              setParts(newParts);
                            }}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Part Name"
                            placeholder="Enter part name"
                            value={part.partName}
                            onChange={(e) => {
                              const newParts = [...parts];
                              newParts[index].partName = e.target.value;
                              setParts(newParts);
                            }}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                            2D Drawing
                          </Typography>
                          {part.drawing2D ? (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                bgcolor: "rgba(15, 23, 42, 0.6)",
                                px: 1.5,
                                py: 0.75,
                                borderRadius: 1,
                                border: 1,
                                borderColor: "rgba(30, 64, 175, 0.3)",
                              }}
                            >
                              <Typography variant="caption" noWrap sx={{ flex: 1, mr: 1 }}>
                                {part.drawing2D.name}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <Button size="small" component="label" sx={{ minWidth: "auto", px: 1, fontSize: "0.7rem" }}>
                                  Edit
                                  <input
                                    type="file"
                                    hidden
                                    onChange={handlePartFileChange(index, "drawing2D")}
                                  />
                                </Button>
                                <Button
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    const newParts = [...parts];
                                    newParts[index].drawing2D = null;
                                    setParts(newParts);
                                  }}
                                  sx={{ minWidth: "auto", px: 1, fontSize: "0.7rem" }}
                                >
                                  Delete
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <Button variant="outlined" component="label" size="small" fullWidth sx={{ justifyContent: "flex-start" }}>
                              Choose File
                              <input
                                type="file"
                                hidden
                                onChange={handlePartFileChange(index, "drawing2D")}
                              />
                            </Button>
                          )}
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                {loading ? "Creating Project..." : "Create Project"}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

export default CreateProjectPage;
