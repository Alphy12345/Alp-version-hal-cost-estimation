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
    Paper
} from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

function DocumentsTab({ projectData, onViewFile }) {
    const requirementDocs = projectData?.documents?.filter(doc => doc.document_type === 'requirement') || [];
    const otherDocs = projectData?.documents?.filter(doc => doc.document_type === 'other') || [];

    const DocumentList = ({ docs, emptyMessage }) => {
        if (docs.length === 0) {
            return (
                <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                </Typography>
            );
        }

        return (
            <List disablePadding>
                {docs.map((doc) => (
                    <ListItem
                        key={doc.id}
                        sx={{
                            bgcolor: "#FFFFFF",
                            border: 1,
                            borderColor: "#E2E8F0",
                            borderRadius: 2,
                            mb: 1,
                            py: 1,
                            "&:hover": { bgcolor: "#F8FAFC", borderColor: "#C7D2FE" },
                        }}
                        secondaryAction={
                            <Button
                                size="small"
                                onClick={() => onViewFile(doc.file_path, doc.filename)}
                                sx={{
                                    minWidth: "auto",
                                    color: "#6366F1",
                                    "&:hover": { bgcolor: "#EEF2FF" },
                                }}
                            >
                                View
                            </Button>
                        }
                    >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                            <InsertDriveFileIcon sx={{ color: "#6366F1" }} />
                        </ListItemIcon>
                        <ListItemText
                            primary={
                                <Typography variant="body2" fontWeight={500} sx={{ color: "#0F172A" }}>
                                    {doc.filename}
                                </Typography>
                            }
                            secondary={
                                <Typography variant="caption" sx={{ color: "#64748B" }}>
                                    Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                                </Typography>
                            }
                        />
                    </ListItem>
                ))}
            </List>
        );
    };

    return (
        <Stack spacing={4}>
            <Box>
                <Typography variant="h6" gutterBottom sx={{ color: "#0F172A", fontWeight: 600 }}>
                    Requirement Documents
                </Typography>
                <DocumentList
                    docs={requirementDocs}
                    emptyMessage="No requirement documents uploaded."
                />
            </Box>

            <Box>
                <Typography variant="h6" gutterBottom sx={{ color: "#0F172A", fontWeight: 600 }}>
                    Other Documents
                </Typography>
                <DocumentList
                    docs={otherDocs}
                    emptyMessage="No other documents uploaded."
                />
            </Box>
        </Stack>
    );
}

export default DocumentsTab;
