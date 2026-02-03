import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningIcon from "@mui/icons-material/Warning";
import DescriptionIcon from "@mui/icons-material/Description";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import ImageIcon from "@mui/icons-material/Image";

function FileViewerModal({ isOpen, onClose, fileUrl, fileName, fileType }) {
  if (!isOpen) return null;

  const isImage = fileType === 'image' || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);
  const isPDF = fileType === 'pdf' || /\.pdf$/i.test(fileName);
  const is3DModel = fileType === '3d' || /\.(step|stp|iges|igs|stl|obj|ply)$/i.test(fileName);

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Typography variant="h6" fontWeight={600} noWrap sx={{ flex: 1, mr: 2 }}>
          {fileName}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2, minHeight: 400 }}>
        {isImage && (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <Box
              component="img"
              src={fileUrl}
              alt={fileName}
              sx={{
                maxWidth: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: 1,
                boxShadow: 2,
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                document.getElementById('error-message').style.display = 'flex';
              }}
            />
            <Box id="error-message" sx={{ display: "none", flexDirection: "column", alignItems: "center", py: 4 }}>
              <WarningIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Failed to load image
              </Typography>
              <Button
                variant="contained"
                onClick={() => window.open(fileUrl, '_blank')}
                sx={{ mt: 2 }}
              >
                Open in New Tab
              </Button>
            </Box>
          </Box>
        )}

        {isPDF && (
          <Box sx={{ height: "70vh" }}>
            <Box
              component="iframe"
              src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              sx={{
                width: "100%",
                height: "100%",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
              }}
              title={fileName}
              onLoad={() => {
                document.getElementById('pdf-error')?.style && (document.getElementById('pdf-error').style.display = 'none');
                document.getElementById('pdf-embed-fallback')?.style && (document.getElementById('pdf-embed-fallback').style.display = 'none');
              }}
              onError={() => {
                document.querySelector('iframe').style.display = 'none';
                document.getElementById('pdf-embed-fallback').style.display = 'block';
              }}
            />

            <Box
              component="embed"
              id="pdf-embed-fallback"
              src={fileUrl}
              type="application/pdf"
              sx={{
                display: "none",
                width: "100%",
                height: "100%",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
              }}
              onError={() => {
                document.getElementById('pdf-embed-fallback').style.display = 'none';
                document.getElementById('pdf-error').style.display = 'flex';
              }}
            />

            <Box id="pdf-error" sx={{ display: "none", flexDirection: "column", alignItems: "center", py: 4 }}>
              <DescriptionIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                PDF preview not available
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Your browser may be downloading the PDF instead of displaying it.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={() => window.open(fileUrl, '_blank')}
                >
                  Open in New Tab
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = fileUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  Download PDF
                </Button>
              </Stack>
            </Box>
          </Box>
        )}

        {is3DModel && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4 }}>
            <ViewInArIcon sx={{ fontSize: 64, color: "primary.main", mb: 2 }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>
              3D Model Viewer
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              3D model preview is not available in the browser
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              File: {fileName}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={() => window.open(fileUrl, '_blank')}
              >
                Download 3D Model
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  alert('To view this 3D model, download it and open it in a 3D modeling software like:\n\n• AutoCAD\n• SolidWorks\n• Fusion 360\n• Blender\n• 3D Viewer Online');
                }}
              >
                View Instructions
              </Button>
            </Stack>
          </Box>
        )}

        {!isImage && !isPDF && !is3DModel && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4 }}>
            <DescriptionIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Preview not available for this file type
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.open(fileUrl, '_blank')}
              sx={{ mt: 2 }}
            >
              Download File
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary">
          {isImage && "Image Viewer"}
          {isPDF && "PDF Viewer"}
          {is3DModel && "3D Model Info"}
          {!isImage && !isPDF && !is3DModel && "File Info"}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => window.open(fileUrl, '_blank')}
          >
            Open in New Tab
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={onClose}
          >
            Close
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default FileViewerModal;
