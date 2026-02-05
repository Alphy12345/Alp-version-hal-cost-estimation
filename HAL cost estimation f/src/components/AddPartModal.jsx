import React, { useState, useEffect } from "react";
import { updatePart, addProjectPart } from '../api/projects';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  Alert,
  Stack,
} from "@mui/material";

function AddPartModal({ isOpen, onClose, projectId, partToEdit, onPartAdded, onPartUpdated }) {
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [drawing2d, setDrawing2d] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (partToEdit) {
      setPartNumber(partToEdit.part_number || "");
      setPartName(partToEdit.part_name || "");
      setDrawing2d(null);
    } else {
      // Reset form for new part
      setPartNumber("");
      setPartName("");
      setDrawing2d(null);
    }
    setError(null);
  }, [partToEdit, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('part_number', partNumber);
      formData.append('part_name', partName);

      if (drawing2d) {
        formData.append('drawing_2d', drawing2d);
      }

      let result;
      if (partToEdit) {
        // Update existing part
        result = await updatePart(partToEdit.id, formData);
        onPartUpdated && onPartUpdated(result);
      } else {
        // Add new part
        result = await addProjectPart(projectId, formData);
        onPartAdded && onPartAdded(result);
      }

      onClose();
    } catch (err) {
      setError(partToEdit ? "Failed to update part. Please try again." : "Failed to add part. Please try again.");
      console.error("Error saving part:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (setter) => (e) => {
    setter(e.target.files[0]);
  };

  const removeFile = (setter) => {
    setter(null);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight={600}>
          {partToEdit ? "Edit Part" : "Add New Part"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {partToEdit ? "Update part information and files" : "Enter part details and upload files"}
        </Typography>
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <Stack spacing={3}>
            {error && (
              <Alert severity="error">{error}</Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Part Number"
                  placeholder="e.g., PART-001"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  fullWidth
                  required
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Part Name"
                  placeholder="e.g., Main Assembly"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  fullWidth
                  required
                  size="small"
                />
              </Grid>
            </Grid>

            <Box>
              <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                2D Drawing File
              </Typography>
              <Button variant="outlined" component="label" size="small" fullWidth sx={{ justifyContent: "flex-start" }}>
                Choose File
                <input
                  type="file"
                  hidden
                  onChange={handleFileChange(setDrawing2d)}
                  accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png"
                />
              </Button>
              {drawing2d && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    bgcolor: "grey.50",
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    border: 1,
                    borderColor: "divider",
                    mt: 1,
                  }}
                >
                  <Typography variant="caption" noWrap sx={{ flex: 1, mr: 1 }}>
                    {drawing2d.name}
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => removeFile(setDrawing2d)}
                    sx={{ minWidth: "auto", px: 1, fontSize: "0.7rem" }}
                  >
                    Remove
                  </Button>
                </Box>
              )}
              {!drawing2d && partToEdit?.drawing_2d_path && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  Current file: {partToEdit.drawing_2d_path.split('\\').pop()}
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
          >
            {loading ? (partToEdit ? "Updating..." : "Adding...") : (partToEdit ? "Update Part" : "Add Part")}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default AddPartModal;
