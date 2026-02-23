import React from "react";
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Button,
    Stack,
    Paper,
    Chip
} from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ImageIcon from "@mui/icons-material/Image";
import DescriptionIcon from "@mui/icons-material/Description";

function DocumentsTab({ projectData, onViewFile }) {
    const requirementDocs = projectData?.documents?.filter(doc => doc.document_type === 'requirement') || [];
    const otherDocs = projectData?.documents?.filter(doc => doc.document_type === 'other') || [];

    const getFileIcon = (filename) => {
        if (!filename) return <InsertDriveFileIcon sx={{ color: "#6366F1" }} fontSize="small" />;
        const lowerName = filename.toLowerCase();
        if (lowerName.endsWith('.pdf')) return <PictureAsPdfIcon sx={{ color: "#EF4444" }} fontSize="small" />;
        if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png')) return <ImageIcon sx={{ color: "#10B981" }} fontSize="small" />;
        return <DescriptionIcon sx={{ color: "#6366F1" }} fontSize="small" />;
    };

    const DocumentList = ({ docs, emptyMessage }) => {
        if (docs.length === 0) {
            return (
                <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                </Typography>
            );
        }

        return (
            <Stack spacing={1}>
                {docs.map((doc) => (
                    <Paper
                        key={doc.id}
                        variant="outlined"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            px: 2,
                            py: 0.75,
                            borderColor: "#E2E8F0",
                            borderRadius: 1,
                            "&:hover": { bgcolor: "#F8FAFC", borderColor: "#C7D2FE" },
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, overflow: "hidden" }}>
                            {getFileIcon(doc.filename)}
                            <Box sx={{ overflow: "hidden" }}>
                                <Typography variant="body2" fontWeight={500} noWrap sx={{ color: "#0F172A" }}>
                                    {doc.filename}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "#64748B" }}>
                                    {new Date(doc.uploaded_at).toLocaleDateString()}
                                </Typography>
                            </Box>
                        </Box>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onViewFile(doc.file_path, doc.filename)}
                            sx={{
                                minWidth: "auto",
                                color: "#6366F1",
                                borderColor: "#C7D2FE",
                                fontSize: "0.75rem",
                                textTransform: "none",
                                fontWeight: 600,
                                "&:hover": { bgcolor: "#EEF2FF", borderColor: "#6366F1" },
                            }}
                        >
                            View
                        </Button>
                    </Paper>
                ))}
            </Stack>
        );
    };

    return (
        <Stack spacing={3}>
            <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0F172A" }}>
                        Requirement Documents
                    </Typography>
                    {requirementDocs.length > 0 && (
                        <Chip 
                            label={requirementDocs.length} 
                            size="small" 
                            sx={{ bgcolor: "#EEF2FF", color: "#4338CA", fontWeight: 600, fontSize: "0.75rem" }}
                        />
                    )}
                </Box>
                <DocumentList
                    docs={requirementDocs}
                    emptyMessage="No requirement documents uploaded."
                />
            </Box>

            <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0F172A" }}>
                        Other Documents
                    </Typography>
                    {otherDocs.length > 0 && (
                        <Chip 
                            label={otherDocs.length} 
                            size="small" 
                            sx={{ bgcolor: "#F1F5F9", color: "#64748B", fontWeight: 600, fontSize: "0.75rem" }}
                        />
                    )}
                </Box>
                <DocumentList
                    docs={otherDocs}
                    emptyMessage="No other documents uploaded."
                />
            </Box>
        </Stack>
    );
}

export default DocumentsTab;
