import React from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Grid,
    IconButton,
    Stack,
    Typography,
    Divider
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import DescriptionIcon from "@mui/icons-material/Description";

function PartsTab({ parts, onAddPart, onEditPart, onDeletePart, onViewFile }) {
    if (parts.length === 0) {
        return (
            <Box sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="body2" sx={{ mb: 2, color: "#64748B" }}>
                    No parts added yet.
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={onAddPart}
                    sx={{
                        bgcolor: "#6366F1",
                        "&:hover": { bgcolor: "#4F46E5" },
                        textTransform: "none",
                        fontWeight: 600,
                    }}
                >
                    Add Your First Part
                </Button>
            </Box>
        );
    }

    return (
        <Stack spacing={2}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="h6" fontWeight={600} sx={{ color: "#0F172A" }}>
                    Project Parts
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={onAddPart}
                    size="small"
                    sx={{
                        bgcolor: "#6366F1",
                        "&:hover": { bgcolor: "#4F46E5" },
                        textTransform: "none",
                        fontWeight: 600,
                    }}
                >
                    Add Part
                </Button>
            </Box>

            <Grid container spacing={2}>
                {parts.map((part) => (
                    <Grid item xs={12} md={6} lg={4} key={part.id}>
                        <Card 
                            variant="outlined" 
                            sx={{ 
                                borderColor: "#C7D2FE", 
                                bgcolor: "#F5F7FF", 
                                height: 280,
                                display: "flex",
                                flexDirection: "column",
                                "&:hover": { borderColor: "#6366F1", boxShadow: "0 4px 12px rgba(99,102,241,0.15)" } 
                            }}
                        >
                            <CardHeader
                                title={
                                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#0F172A" }}>
                                        Part {part.part_number}
                                    </Typography>
                                }
                                action={
                                    <Stack direction="row" spacing={0.5}>
                                        <IconButton
                                            size="small"
                                            onClick={() => onEditPart(part)}
                                            title="Edit Part"
                                            sx={{ color: "#6366F1", "&:hover": { bgcolor: "#EEF2FF" } }}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => onDeletePart(part.id)}
                                            title="Delete Part"
                                            sx={{ color: "#EF4444", "&:hover": { bgcolor: "#FEE2E2" } }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                }
                                sx={{ pb: 1 }}
                            />
                            <CardContent sx={{ pt: 0, flex: 1, display: "flex", flexDirection: "column" }}>
                                <Grid container spacing={1} sx={{ mb: 2 }}>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" sx={{ color: "#64748B" }} display="block">
                                            Part Number
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}>
                                            {part.part_number || "—"}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" sx={{ color: "#64748B" }} display="block">
                                            Part Name
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}>
                                            {part.part_name || "—"}
                                        </Typography>
                                    </Grid>
                                </Grid>

                                <Typography variant="caption" fontWeight={600} sx={{ color: "#64748B", textTransform: "uppercase", display: "block", mb: 1 }}>
                                    Part Files
                                </Typography>

                                <Stack spacing={1} sx={{ flex: 1 }}>
                                    {part.drawing_2d_path ? (
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                border: 1,
                                                borderColor: "#C7D2FE",
                                                borderRadius: 1,
                                                p: 1,
                                                bgcolor: "#FFFFFF",
                                                "&:hover": { borderColor: "#6366F1", bgcolor: "#EEF2FF" },
                                            }}
                                        >
                                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                                                <DescriptionIcon sx={{ color: "#6366F1", flexShrink: 0 }} fontSize="small" />
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography variant="body2" fontWeight={500} sx={{ color: "#0F172A" }}>2D Drawing</Typography>
                                                    <Typography 
                                                        variant="caption" 
                                                        sx={{ 
                                                            color: "#64748B", 
                                                            display: "block",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                            maxWidth: "100%",
                                                        }}
                                                        title={part.drawing_2d_path.split('\\').pop()}
                                                    >
                                                        {part.drawing_2d_path.split('\\').pop()}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                            <Button
                                                size="small"
                                                onClick={() => onViewFile(part.drawing_2d_path, part.drawing_2d_path.split('\\').pop())}
                                                sx={{
                                                    minWidth: "auto",
                                                    color: "#6366F1",
                                                    "&:hover": { bgcolor: "#EEF2FF" },
                                                    flexShrink: 0,
                                                }}
                                            >
                                                View
                                            </Button>
                                        </Box>
                                    ) : null}

                                    {!part.drawing_2d_path && (
                                        <Typography variant="caption" sx={{ color: "#94A3B8" }} fontStyle="italic">
                                            No files uploaded for this part.
                                        </Typography>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Stack>
    );
}

export default PartsTab;
