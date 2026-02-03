import React, { useEffect, useMemo, useRef } from "react";
import {
    Dialog,
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Slide,
    Button,
    Box,
    Grid,
    Paper,
    Stack,
    TextField,
    MenuItem,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert,
    Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

function CostEstimationModal({
    isOpen,
    onClose,
    projectData,
    part,
    costResult,
    formState,
    onChangeForm,
    onSubmit, // (e, partId)
    onClear,
    loading,
    machines, // already filtered? No, pass all and filter inside or pass filtered
    operationTypes, // need this for filtering logic if done inside
    drawingZoom,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    getInlineFileUrl,
    isPdfPath,
    PdfPreview, // Component passed as prop
    formatValue,
}) {
    const contentRef = useRef(null);
    const drawingScrollRef = useRef(null);
    const dragStateRef = useRef({ isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

    const drawingUrl = useMemo(() => {
        if (!part?.drawing_2d_path) return "";
        return getInlineFileUrl(part.drawing_2d_path);
    }, [part?.drawing_2d_path, getInlineFileUrl]);

    const handleDrawingWheel = (e) => {
        if (!drawingScrollRef.current) return;

        const isPdf = part?.drawing_2d_path && isPdfPath(part.drawing_2d_path);

        // For images: zoom on wheel by default (easier UX; you can pan via click-drag).
        // For PDFs (iframe): keep Ctrl+wheel zoom so normal scrolling still works inside the PDF viewer.
        const shouldZoom = isPdf ? e.ctrlKey : true;
        if (!shouldZoom) return;

        e.preventDefault();
        if (e.deltaY < 0) onZoomIn();
        else onZoomOut();
    };

    const miscItems = useMemo(() => {
        const items = formState?.miscellaneous_items;
        if (Array.isArray(items) && items.length > 0) return items;
        const desc = String(formState?.miscellaneous_description || "").trim();
        const amt = formState?.miscellaneous_amount;
        if (desc || (amt !== "" && amt != null)) {
            return [{ description: desc, amount: amt }];
        }
        return [{ description: "", amount: "" }];
    }, [formState?.miscellaneous_amount, formState?.miscellaneous_description, formState?.miscellaneous_items]);

    const miscTotal = useMemo(() => {
        return miscItems.reduce((sum, it) => {
            const n = Number(it?.amount);
            return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
        }, 0);
    }, [miscItems]);

    const updateMiscItems = (next) => {
        const total = Array.isArray(next)
            ? next.reduce((sum, it) => {
                const n = Number(it?.amount);
                return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
            }, 0)
            : 0;

        onChangeForm(part.id, "miscellaneous_items", next);
        onChangeForm(part.id, "miscellaneous_amount", String(total));
    };

    const handleMouseDown = (e) => {
        if (!drawingScrollRef.current) return;
        // Only enable drag-pan for non-PDF (iframe will capture pointer events)
        if (part?.drawing_2d_path && isPdfPath(part.drawing_2d_path)) return;
        dragStateRef.current.isDown = true;
        dragStateRef.current.startX = e.clientX;
        dragStateRef.current.startY = e.clientY;
        dragStateRef.current.scrollLeft = drawingScrollRef.current.scrollLeft;
        dragStateRef.current.scrollTop = drawingScrollRef.current.scrollTop;
    };

    const handleMouseUp = () => {
        dragStateRef.current.isDown = false;
    };

    const handleMouseLeave = () => {
        dragStateRef.current.isDown = false;
    };

    const handleMouseMove = (e) => {
        if (!drawingScrollRef.current) return;
        if (!dragStateRef.current.isDown) return;
        e.preventDefault();
        const dx = e.clientX - dragStateRef.current.startX;
        const dy = e.clientY - dragStateRef.current.startY;
        drawingScrollRef.current.scrollLeft = dragStateRef.current.scrollLeft - dx;
        drawingScrollRef.current.scrollTop = dragStateRef.current.scrollTop - dy;
    };

    const handleDownloadPdf = async () => {
        if (!part || !contentRef.current) return;

        const element = contentRef.current;

        // We need to temporarily force the element to be visible and have explicit width for capture
        // But since it's already rendered in Dialog, it should be fine.

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 5) {
            position -= pageHeight;
            pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const safeProject = String(projectData?.project_name || "Project").replace(/[^a-z0-9-_ ]/gi, "").trim() || "Project";
        const safePart = String(part.part_number || "Part").replace(/[^a-z0-9-_ ]/gi, "").trim() || "Part";
        pdf.save(`${safeProject}-${safePart}-Cost-Estimation.pdf`);
    };

    const normalize = (value) => {
        if (value == null) return "";
        return String(value).trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
    };

    const getFilteredMachines = () => {
        const opType = normalize(formState.operation_type);
        if (!opType) return machines;

        const selectedOp = operationTypes.find((ot) => normalize(ot?.operation_name) === opType);
        const selectedOpId = selectedOp?.id != null ? String(selectedOp.id) : "";

        return machines.filter((m) => {
            const opId = m?.op_id ?? m?.operation_type_id ?? m?.operation_type?.id ?? m?.operation_types?.id;
            return opId == null ? "" : String(opId) === selectedOpId;
        });
    };

    const filteredMachines = useMemo(() => {
        return getFilteredMachines();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [machines, operationTypes, formState.operation_type]);

    useEffect(() => {
        const current = String(formState?.machine_name || "").trim();
        if (!current) return;
        const exists = filteredMachines.some((m) => String(m?.name || "").trim() === current);
        if (!exists) {
            onChangeForm(part.id, "machine_name", "");
        }
    }, [filteredMachines, formState?.machine_name, onChangeForm, part?.id]);

    if (!isOpen || !part) return null;

    return (
        <Dialog
            fullScreen
            open={isOpen}
            onClose={onClose}
            TransitionComponent={Transition}
        >
            <AppBar sx={{ position: "relative", bgcolor: "background.paper", borderBottom: 1, borderColor: "rgba(56,189,248,0.10)" }}>
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        onClick={onClose}
                        aria-label="close"
                    >
                        <CloseIcon />
                    </IconButton>
                    <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                        Part Cost Estimation – {part.part_number}
                        <Typography variant="caption" display="block" color="inherit" sx={{ opacity: 0.8 }}>
                            {part.part_name}
                        </Typography>
                    </Typography>

                    <Stack direction="row" spacing={2} alignItems="center">
                        {costResult && (
                            <Box sx={{ textAlign: "right", mr: 2 }}>
                                <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                                    Final Part Cost
                                </Typography>
                                <Typography variant="h6" fontWeight="bold" color="primary.main">
                                    {formatValue("total_cost", costResult.cost_breakdown?.total_unit_cost_with_misc)}
                                </Typography>
                            </Box>
                        )}
                        <Button
                            color="inherit"
                            onClick={handleDownloadPdf}
                            startIcon={<DownloadIcon />}
                            variant="outlined"
                            sx={{ borderColor: "rgba(255,255,255,0.3)" }}
                        >
                            Download PDF
                        </Button>
                        <Button autoFocus color="inherit" onClick={onClose}>
                            Close
                        </Button>
                    </Stack>
                </Toolbar>
            </AppBar>

            <Box ref={contentRef} sx={{ height: "100%", display: "flex", overflow: "hidden", bgcolor: "background.default" }}>
                {/* Sidebar - Drawing & Info */}
                <Paper
                    elevation={0}
                    sx={{
                        width: { xs: 360, md: 420, lg: 460 },
                        borderRight: 1,
                        borderColor: "divider",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        overflowY: "auto",
                        bgcolor: "background.paper",
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3, flex: 1, minHeight: 0 }}>
                        {/* Project Info Card */}
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                            <Typography variant="overline" sx={{ letterSpacing: 0.8, fontSize: "0.85rem" }} color="text.secondary">Project</Typography>
                            <Typography variant="h5" fontWeight={900} gutterBottom>
                                {projectData?.project_name || "Untitled Project"}
                            </Typography>
                            <Typography variant="body1" display="block" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                                PO/Ref: {projectData?.po_reference_number || "N/A"}
                            </Typography>
                            <Typography variant="body1" display="block" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                                Customer: {projectData?.customer_name || "N/A"}
                            </Typography>
                        </Paper>

                        {/* Operation Details (replaces drawing in sidebar) */}
                        <Paper variant="outlined" sx={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
                            <Box sx={{ px: 2, py: 1.5, bgcolor: "rgba(56,189,248,0.08)", borderBottom: 1, borderColor: "rgba(56,189,248,0.12)" }}>
                                <Typography variant="subtitle2">Operation Details</Typography>
                            </Box>
                            <Box sx={{ p: 2.5 }}>
                                {!costResult ? (
                                    <Typography variant="caption" color="text.secondary">Calculate cost to see the details.</Typography>
                                ) : (
                                    <TableContainer component={Paper} variant="outlined">
                                        <Table>
                                            <TableBody>
                                                <TableRow>
                                                    <TableCell sx={{ color: "text.secondary", fontSize: "1rem", py: 1.25 }}>Operation</TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.operation_type}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell sx={{ color: "text.secondary", fontSize: "1rem", py: 1.25 }}>Machine</TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.selected_machine?.name}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell sx={{ color: "text.secondary", fontSize: "1rem", py: 1.25 }}>Material</TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.material}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell sx={{ color: "text.secondary", fontSize: "1rem", py: 1.25 }}>Duty Category</TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.duty_category}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell sx={{ color: "text.secondary", fontSize: "1rem", py: 1.25 }}>Shape</TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.shape}</TableCell>
                                                </TableRow>
                                                {costResult.volume ? (
                                                    <TableRow>
                                                        <TableCell sx={{ color: "text.secondary", fontSize: "1rem", py: 1.25 }}>Volume</TableCell>
                                                        <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.volume.toFixed(2)} mm³</TableCell>
                                                    </TableRow>
                                                ) : null}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Box>
                        </Paper>
                    </Box>
                </Paper>

                {/* Main Content - Form, Cost Breakdown, Drawing */}
                <Box sx={{ flex: 1, overflowY: "auto", p: { xs: 2, md: 3 } }}>
                    <Grid container spacing={3.5}>
                        <Grid item xs={12}>
                            <Stack spacing={3.5}>
                                {/* Input Form */}
                                <Paper variant="outlined">
                                    <Box sx={{ px: 3.5, py: 2.75, borderBottom: 1, borderColor: "rgba(56,189,248,0.12)", bgcolor: "rgba(56,189,248,0.08)" }}>
                                        <Typography variant="h5" fontSize="1.4rem" fontWeight={900}>Machining Inputs</Typography>
                                        <Typography variant="body1" color="text.secondary" sx={{ opacity: 0.9 }}>
                                            Fill the values and calculate
                                        </Typography>
                                    </Box>
                                    <Box sx={{ p: 3.5 }}>
                                        <form onSubmit={(e) => onSubmit(e, part.id)}>
                                            <Grid container spacing={3}>
                                                <Grid item xs={12} sm={6} md={4}>
                                                    <TextField
                                                        select
                                                        label="Operation Type"
                                                        value={formState.operation_type || "turning"}
                                                        onChange={(e) => onChangeForm(part.id, "operation_type", e.target.value)}
                                                        fullWidth
                                                        size="medium"
                                                    >
                                                        <MenuItem value="turning">Turning</MenuItem>
                                                        <MenuItem value="milling">Milling</MenuItem>
                                                    </TextField>
                                                </Grid>

                                                <Grid item xs={12} sm={6} md={4}>
                                                    <TextField
                                                        select
                                                        label="Material"
                                                        value={formState.material || "steel"}
                                                        onChange={(e) => onChangeForm(part.id, "material", e.target.value)}
                                                        fullWidth
                                                        size="medium"
                                                    >
                                                        <MenuItem value="steel">Steel</MenuItem>
                                                        <MenuItem value="aluminium">Aluminium</MenuItem>
                                                        <MenuItem value="titanium">Titanium</MenuItem>
                                                    </TextField>
                                                </Grid>

                                                <Grid item xs={12} sm={6} md={4}>
                                                    <TextField
                                                        select
                                                        label="Machine"
                                                        value={formState.machine_name || ""}
                                                        onChange={(e) => onChangeForm(part.id, "machine_name", e.target.value)}
                                                        fullWidth
                                                        size="medium"
                                                    >
                                                        <MenuItem value="">Select Machine</MenuItem>
                                                        {filteredMachines.map((m) => (
                                                            <MenuItem key={m.id} value={m.name}>{m.name}</MenuItem>
                                                        ))}
                                                    </TextField>
                                                </Grid>

                                                <Grid item xs={12} sm={6} md={4}>
                                                    <TextField
                                                        label="Man Hours / Unit"
                                                        type="number"
                                                        inputProps={{ step: "0.01" }}
                                                        value={formState.man_hours_per_unit || ""}
                                                        onChange={(e) => onChangeForm(part.id, "man_hours_per_unit", e.target.value)}
                                                        fullWidth
                                                        size="medium"
                                                        required
                                                    />
                                                </Grid>

                                                <Grid item xs={12}>
                                                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                                                            <Typography variant="subtitle2">Miscellaneous Costs</Typography>
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                startIcon={<AddCircleOutlineIcon />}
                                                                onClick={() => {
                                                                    const next = [...miscItems, { description: "", amount: "" }];
                                                                    updateMiscItems(next);
                                                                }}
                                                                sx={{ textTransform: "none", fontWeight: 700 }}
                                                            >
                                                                Add
                                                            </Button>
                                                        </Box>

                                                        <Stack spacing={1.5}>
                                                            {miscItems.map((item, idx) => (
                                                                <Grid container spacing={1.5} key={idx} alignItems="center">
                                                                    <Grid item xs={12} md={7}>
                                                                        <TextField
                                                                            label="Description"
                                                                            value={item?.description || ""}
                                                                            onChange={(e) => {
                                                                                const next = miscItems.map((x, i) => i === idx ? { ...x, description: e.target.value } : x);
                                                                                updateMiscItems(next);
                                                                            }}
                                                                            fullWidth
                                                                            size="medium"
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={10} md={4}>
                                                                        <TextField
                                                                            label="Amount"
                                                                            type="number"
                                                                            inputProps={{ step: "0.01", min: "0" }}
                                                                            value={item?.amount ?? ""}
                                                                            onChange={(e) => {
                                                                                const next = miscItems.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x);
                                                                                updateMiscItems(next);
                                                                            }}
                                                                            fullWidth
                                                                            size="medium"
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={2} md={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
                                                                        <IconButton
                                                                            onClick={() => {
                                                                                const next = miscItems.filter((_, i) => i !== idx);
                                                                                updateMiscItems(next.length ? next : [{ description: "", amount: "" }]);
                                                                            }}
                                                                            title="Remove"
                                                                        >
                                                                            <DeleteOutlineIcon />
                                                                        </IconButton>
                                                                    </Grid>
                                                                </Grid>
                                                            ))}
                                                        </Stack>

                                                        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mr: 1.5 }}>
                                                                Total
                                                            </Typography>
                                                            <Typography variant="body2" fontWeight={900} color="primary.main">
                                                                {formatValue("miscellaneous_amount", miscTotal)}
                                                            </Typography>
                                                        </Box>
                                                    </Paper>
                                                </Grid>

                                                <Grid item xs={12} sm={6} md={4}>
                                                    <TextField
                                                        label="Length (mm)"
                                                        type="number"
                                                        inputProps={{ step: "0.01" }}
                                                        value={formState.length || ""}
                                                        onChange={(e) => onChangeForm(part.id, "length", e.target.value)}
                                                        fullWidth
                                                        size="medium"
                                                        required
                                                    />
                                                </Grid>

                                                {formState.operation_type === "turning" && (
                                                    <Grid item xs={12} sm={6} md={4}>
                                                        <TextField
                                                            label="Diameter (mm)"
                                                            type="number"
                                                            inputProps={{ step: "0.01" }}
                                                            value={formState.diameter || ""}
                                                            onChange={(e) => onChangeForm(part.id, "diameter", e.target.value)}
                                                            fullWidth
                                                            size="medium"
                                                            required
                                                        />
                                                    </Grid>
                                                )}

                                                {formState.operation_type === "milling" && (
                                                    <>
                                                        <Grid item xs={12} sm={6} md={4}>
                                                            <TextField
                                                                label="Breadth (mm)"
                                                                type="number"
                                                                inputProps={{ step: "0.01" }}
                                                                value={formState.breadth || ""}
                                                                onChange={(e) => onChangeForm(part.id, "breadth", e.target.value)}
                                                                fullWidth
                                                                size="medium"
                                                                required
                                                            />
                                                        </Grid>
                                                        <Grid item xs={12} sm={6} md={4}>
                                                            <TextField
                                                                label="Height (mm)"
                                                                type="number"
                                                                inputProps={{ step: "0.01" }}
                                                                value={formState.height || ""}
                                                                onChange={(e) => onChangeForm(part.id, "height", e.target.value)}
                                                                fullWidth
                                                                size="medium"
                                                                required
                                                            />
                                                        </Grid>
                                                    </>
                                                )}

                                                <Grid item xs={12}>
                                                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                                                        <Button type="submit" variant="contained" disabled={loading} sx={{ minWidth: 150 }}>
                                                            {loading ? "Calculating..." : "Calculate Cost"}
                                                        </Button>
                                                        {costResult && (
                                                            <Button variant="outlined" onClick={() => onClear(part.id)}>
                                                                Clear
                                                            </Button>
                                                        )}
                                                    </Stack>
                                                </Grid>
                                            </Grid>
                                        </form>
                                    </Box>
                                </Paper>

                                {/* Drawing (full width above Cost Breakdown) */}
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        overflow: "hidden",
                                        display: "flex",
                                        flexDirection: "column",
                                        height: { xs: 560, lg: "calc(100vh - 360px)" },
                                    }}
                                >
                                    <Box sx={{ px: 2, py: 1.5, bgcolor: "rgba(56,189,248,0.08)", borderBottom: 1, borderColor: "rgba(56,189,248,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <Typography variant="subtitle2">2D Drawing</Typography>
                                        <Stack direction="row" spacing={0.5}>
                                            <IconButton size="small" onClick={onZoomOut} title="Zoom Out"><ZoomOutIcon fontSize="small" /></IconButton>
                                            <IconButton size="small" onClick={onResetZoom} title="Reset"><RestartAltIcon fontSize="small" /></IconButton>
                                            <IconButton size="small" onClick={onZoomIn} title="Zoom In"><ZoomInIcon fontSize="small" /></IconButton>
                                        </Stack>
                                    </Box>

                                    <Box
                                        ref={drawingScrollRef}
                                        onWheel={handleDrawingWheel}
                                        onMouseDown={handleMouseDown}
                                        onMouseUp={handleMouseUp}
                                        onMouseLeave={handleMouseLeave}
                                        onMouseMove={handleMouseMove}
                                        sx={{
                                            p: 2,
                                            bgcolor: "rgba(56,189,248,0.06)",
                                            flex: 1,
                                            minHeight: 0,
                                            overflow: "auto",
                                            cursor: part?.drawing_2d_path && !isPdfPath(part.drawing_2d_path) ? "grab" : "default",
                                        }}
                                    >
                                        {!part.drawing_2d_path ? (
                                            <Typography variant="caption" color="text.secondary">No drawing uploaded.</Typography>
                                        ) : (
                                            <Box sx={{ minWidth: "100%", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {isPdfPath(part.drawing_2d_path) ? (
                                                    <Box
                                                        component="iframe"
                                                        title="2D Drawing"
                                                        src={`${drawingUrl}#toolbar=1&navpanes=0&scrollbar=1&zoom=${Math.round(drawingZoom * 100)}`}
                                                        sx={{
                                                            width: "100%",
                                                            height: "100%",
                                                            minHeight: 520,
                                                            border: 0,
                                                            borderRadius: 1,
                                                        }}
                                                    />
                                                ) : (
                                                    <Box
                                                        sx={{
                                                            transform: `scale(${drawingZoom})`,
                                                            transformOrigin: "0 0",
                                                            transition: "transform 0.1s ease-out",
                                                            display: "inline-block",
                                                        }}
                                                    >
                                                        <Box
                                                            component="img"
                                                            src={drawingUrl}
                                                            alt="Drawing Preview"
                                                            sx={{
                                                                display: "block",
                                                                maxWidth: "none",
                                                                maxHeight: "none",
                                                                width: "auto",
                                                                height: "auto",
                                                                imageRendering: "auto",
                                                            }}
                                                        />
                                                    </Box>
                                                )}
                                            </Box>
                                        )}
                                    </Box>
                                </Paper>

                                {/* Cost Breakdown (summary only; operation details are in sidebar) */}
                                <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                                    <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "rgba(56,189,248,0.12)", bgcolor: "rgba(56,189,248,0.08)" }}>
                                        <Typography variant="h6" fontSize="1rem" color="primary.main">Cost Breakdown</Typography>
                                    </Box>
                                    <Box sx={{ p: 4.5 }}>
                                        {!costResult ? (
                                            <Typography variant="body2" color="text.secondary">
                                                Calculate cost to see the breakdown.
                                            </Typography>
                                        ) : (
                                            <TableContainer component={Paper} variant="outlined">
                                                <Table>
                                                    <TableHead>
                                                        <TableRow sx={{ "& th": { bgcolor: "rgba(56,189,248,0.10)", color: "primary.light" } }}>
                                                            <TableCell sx={{ fontWeight: 900 }}>Item</TableCell>
                                                            <TableCell sx={{ fontWeight: 900 }} align="right">Value</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell sx={{ fontSize: "1.05rem", py: 1.6 }}>Basic Cost</TableCell>
                                                            <TableCell align="right" sx={{ fontSize: "1.05rem", py: 1.6 }}>{formatValue("basic_cost", costResult.cost_breakdown?.basic_cost_per_unit)}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell sx={{ fontSize: "1.05rem", py: 1.6 }}>Overheads</TableCell>
                                                            <TableCell align="right" sx={{ fontSize: "1.05rem", py: 1.6 }}>{formatValue("overheads", costResult.cost_breakdown?.overheads_per_unit)}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell sx={{ fontSize: "1.05rem", py: 1.6 }}>Profit</TableCell>
                                                            <TableCell align="right" sx={{ fontSize: "1.05rem", py: 1.6 }}>{formatValue("profit", costResult.cost_breakdown?.profit_per_unit)}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell sx={{ fontSize: "1.05rem", py: 1.6 }}>Packing & Fwd</TableCell>
                                                            <TableCell align="right" sx={{ fontSize: "1.05rem", py: 1.6 }}>{formatValue("packing", costResult.cost_breakdown?.packing_forwarding_per_unit)}</TableCell>
                                                        </TableRow>
                                                        {miscItems.filter((x) => String(x?.description || "").trim() || (x?.amount !== "" && x?.amount != null)).map((x, i) => (
                                                            <TableRow key={`misc-${i}`}>
                                                                <TableCell sx={{ fontSize: "1.05rem", py: 1.6 }}>Misc: {String(x?.description || "").trim() || "(no description)"}</TableCell>
                                                                <TableCell align="right" sx={{ fontSize: "1.05rem", py: 1.6 }}>{formatValue("miscellaneous_amount", Number(x?.amount) || 0)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                        <TableRow>
                                                            <TableCell sx={{ fontSize: "1.05rem", py: 1.6 }}>Miscellaneous Total</TableCell>
                                                            <TableCell align="right" sx={{ fontSize: "1.05rem", py: 1.6 }}>{formatValue("miscellaneous_amount", costResult.cost_breakdown?.miscellaneous_amount)}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell sx={{ fontSize: "1.05rem", py: 1.6 }}>Man Hours / Unit</TableCell>
                                                            <TableCell align="right" sx={{ fontSize: "1.05rem", py: 1.6 }}>{costResult.cost_breakdown?.man_hours_per_unit}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell sx={{ fontSize: "1.05rem", py: 1.6 }}>Machine Hour Rate</TableCell>
                                                            <TableCell align="right" sx={{ fontSize: "1.05rem", py: 1.6 }}>{formatValue("machine_hour_rate", costResult.cost_breakdown?.machine_hour_rate)}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell sx={{ fontSize: "1.05rem", py: 1.6 }}>Wage Rate</TableCell>
                                                            <TableCell align="right" sx={{ fontSize: "1.05rem", py: 1.6 }}>{formatValue("wage_rate", costResult.cost_breakdown?.wage_rate)}</TableCell>
                                                        </TableRow>
                                                        <TableRow selected>
                                                            <TableCell sx={{ fontWeight: 900, fontSize: "1.15rem", py: 1.8 }}>Final Part Cost</TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 950, fontSize: "1.25rem", color: "primary.main", py: 1.8 }}>
                                                                {formatValue("total_cost", costResult.cost_breakdown?.total_unit_cost_with_misc)}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        )}
                                    </Box>
                                </Paper>
                            </Stack>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        </Dialog>
    );
}

export default CostEstimationModal;
