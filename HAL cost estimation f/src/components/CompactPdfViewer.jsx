import React, { useState } from "react";
import { Paper, Box, Typography, IconButton, Stack, Button } from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

function CompactPdfViewer({ fileUrl, fileName }) {
  const [hasError, setHasError] = useState(false);

  if (!fileUrl) return null;

  return (
    <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2 }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "background.paper",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <DescriptionIcon sx={{ fontSize: 16, color: "error.main" }} />
          <Typography variant="body2" fontWeight={600}>
            {fileName}
          </Typography>
        </Stack>
        <IconButton
          size="small"
          onClick={() => window.open(fileUrl, '_blank')}
          title="Open in new tab"
        >
          <OpenInNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Full PDF Content - No Preview Restrictions */}
      <Box sx={{ bgcolor: "grey.50", height: 800 }}>
        <Box
          sx={{
            height: "100%",
            bgcolor: "background.paper",
            m: 1,
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {hasError ? (
            <Box sx={{ textAlign: "center", p: 4 }}>
              <ErrorOutlineIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1.5 }} />
              <Typography variant="body2" color="text.secondary" gutterBottom>
                PDF could not be loaded
              </Typography>
              <Typography variant="caption" display="block" color="text.disabled" sx={{ mb: 2 }}>
                Please try opening in a new tab
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => window.open(fileUrl, '_blank')}
                endIcon={<OpenInNewIcon />}
              >
                Open in New Tab
              </Button>
            </Box>
          ) : (
            <Box
              component="iframe"
              src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
              sx={{ width: "100%", height: "100%", border: 0 }}
              title={fileName}
              onError={() => setHasError(true)}
            />
          )}
        </Box>
      </Box>

      {/* Footer Info */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "grey.50",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Full PDF Document • Use toolbar to navigate pages
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Interactive viewer
        </Typography>
      </Box>
    </Paper>
  );
}

export default CompactPdfViewer;
