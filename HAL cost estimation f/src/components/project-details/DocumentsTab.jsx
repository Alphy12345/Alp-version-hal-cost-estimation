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
                            bgcolor: "rgba(15, 23, 42, 0.6)",
                            border: 1,
                            borderColor: "rgba(30, 64, 175, 0.3)",
                            borderRadius: 2,
                            mb: 1,
                            py: 1
                        }}
                        secondaryAction={
                            <Button
                                size="small"
                                onClick={() => onViewFile(doc.file_path, doc.filename)}
                                sx={{ minWidth: "auto" }}
                            >
                                View
                            </Button>
                        }
                    >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                            <InsertDriveFileIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                            primary={
                                <Typography variant="body2" fontWeight={500}>
                                    {doc.filename}
                                </Typography>
                            }
                            secondary={
                                <Typography variant="caption" color="text.secondary">
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
                <Typography variant="h6" gutterBottom>
                    Requirement Documents
                </Typography>
                <DocumentList
                    docs={requirementDocs}
                    emptyMessage="No requirement documents uploaded."
                />
            </Box>

            <Box>
                <Typography variant="h6" gutterBottom>
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
