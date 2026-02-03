import React from "react";
import {
    Box,
    Button,
    Grid,
    Paper,
    Stack,
    Typography,
    Card,
    CardContent
} from "@mui/material";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import PdfPreview from "../PdfPreview";

function DrawingsSection({ parts, onViewFile, getInlineFileUrl, isPdfPath }) {
    const models3d = parts.filter((p) => p.model_3d_path);
    const drawings2d = parts.filter((p) => p.drawing_2d_path);

    return (
        <Stack spacing={4}>
            <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Project Drawings
                </Typography>

                {/* 3D Models */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        3D Models
                    </Typography>
                    {models3d.length > 0 ? (
                        <Stack spacing={1}>
                            {models3d.map((part) => (
                                <Paper
                                    key={part.id}
                                    variant="outlined"
                                    sx={{
                                        p: 1.5,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        bgcolor: "rgba(56,189,248,0.06)"
                                    }}
                                >
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <ViewInArIcon color="primary" fontSize="small" />
                                        <Box>
                                            <Typography variant="body2" fontWeight={500}>
                                                {part.part_number} - 3D Model
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {part.model_3d_path.split('\\').pop()}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Button
                                        size="small"
                                        onClick={() => onViewFile(part.model_3d_path, part.model_3d_path.split('\\').pop())}
                                    >
                                        View
                                    </Button>
                                </Paper>
                            ))}
                        </Stack>
                    ) : (
                        <Typography variant="caption" color="text.secondary">
                            No 3D models uploaded.
                        </Typography>
                    )}
                </Box>

                {/* 2D Drawings */}
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        2D Drawings
                    </Typography>
                    {drawings2d.length > 0 ? (
                        <Grid container spacing={2}>
                            {drawings2d.map((part) => {
                                const fileName = String(part.drawing_2d_path).split("\\").pop();
                                const imgUrl = getInlineFileUrl(part.drawing_2d_path);
                                return (
                                    <Grid item xs={12} sm={6} md={4} key={part.id}>
                                        <Card variant="outlined">
                                            <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", bgcolor: "rgba(56,189,248,0.08)" }}>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {part.part_number} - 2D Drawing
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap display="block">
                                                    {fileName}
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    bgcolor: "rgba(56,189,248,0.06)",
                                                    minHeight: 200,
                                                    alignItems: "center",
                                                    borderTop: 1,
                                                    borderColor: "rgba(56,189,248,0.10)",
                                                }}
                                            >
                                                {isPdfPath(part.drawing_2d_path) ? (
                                                    <PdfPreview
                                                        url={imgUrl}
                                                        alt={`${part.part_number} - 2D Drawing`}
                                                        style={{ maxHeight: 192, width: 'auto', objectFit: 'contain' }}
                                                    />
                                                ) : (
                                                    <Box
                                                        component="img"
                                                        src={imgUrl}
                                                        alt={`${part.part_number} - 2D Drawing`}
                                                        sx={{ maxHeight: 192, maxWidth: "100%", objectFit: "contain" }}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = "none";
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        </Card>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    ) : (
                        <Typography variant="caption" color="text.secondary">
                            No 2D drawings uploaded.
                        </Typography>
                    )}
                </Box>
            </Box>
        </Stack>
    );
}

export default DrawingsSection;
