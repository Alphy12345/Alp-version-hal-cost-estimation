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
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import DescriptionIcon from "@mui/icons-material/Description";

function PartsTab({ parts, onAddPart, onEditPart, onDeletePart, onViewFile }) {
    if (parts.length === 0) {
        return (
            <Box sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No parts added yet.
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={onAddPart}
                >
                    Add Your First Part
                </Button>
            </Box>
        );
    }

    return (
        <Stack spacing={2}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="h6" fontWeight={600}>
                    Project Parts
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={onAddPart}
                    size="small"
                >
                    Add Part
                </Button>
            </Box>

            <Grid container spacing={2}>
                {parts.map((part) => (
                    <Grid item xs={12} md={6} key={part.id}>
                        <Card variant="outlined">
                            <CardHeader
                                title={
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Part {part.part_number}
                                    </Typography>
                                }
                                action={
                                    <Stack direction="row" spacing={0.5}>
                                        <IconButton
                                            size="small"
                                            onClick={() => onEditPart(part)}
                                            title="Edit Part"
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => onDeletePart(part.id)}
                                            title="Delete Part"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                }
                                sx={{ pb: 1 }}
                            />
                            <CardContent sx={{ pt: 0 }}>
                                <Grid container spacing={1} sx={{ mb: 2 }}>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Part Number
                                        </Typography>
                                        <Typography variant="body2">
                                            {part.part_number || "—"}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Part Name
                                        </Typography>
                                        <Typography variant="body2">
                                            {part.part_name || "—"}
                                        </Typography>
                                    </Grid>
                                </Grid>

                                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", display: "block", mb: 1 }}>
                                    Part Files
                                </Typography>

                                <Stack spacing={1}>
                                    {part.model_3d_path ? (
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                border: 1,
                                                borderColor: "divider",
                                                borderRadius: 1,
                                                p: 1,
                                                bgcolor: "background.paper"
                                            }}
                                        >
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <ViewInArIcon color="primary" fontSize="small" />
                                                <Box>
                                                    <Typography variant="body2" fontWeight={500}>3D Model</Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                                        {part.model_3d_path.split('\\').pop()}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                            <Button
                                                size="small"
                                                onClick={() => onViewFile(part.model_3d_path, part.model_3d_path.split('\\').pop())}
                                                sx={{ minWidth: "auto" }}
                                            >
                                                View
                                            </Button>
                                        </Box>
                                    ) : null}

                                    {part.drawing_2d_path ? (
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                border: 1,
                                                borderColor: "divider",
                                                borderRadius: 1,
                                                p: 1,
                                                bgcolor: "background.paper"
                                            }}
                                        >
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <DescriptionIcon color="primary" fontSize="small" />
                                                <Box>
                                                    <Typography variant="body2" fontWeight={500}>2D Drawing</Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                                        {part.drawing_2d_path.split('\\').pop()}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                            <Button
                                                size="small"
                                                onClick={() => onViewFile(part.drawing_2d_path, part.drawing_2d_path.split('\\').pop())}
                                                sx={{ minWidth: "auto" }}
                                            >
                                                View
                                            </Button>
                                        </Box>
                                    ) : null}

                                    {!part.model_3d_path && !part.drawing_2d_path && (
                                        <Typography variant="caption" color="text.secondary" fontStyle="italic">
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
