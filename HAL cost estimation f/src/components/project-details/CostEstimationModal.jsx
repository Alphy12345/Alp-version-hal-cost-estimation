import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Dialog,
    DialogActions,
    DialogContent,
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
    Collapse,
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
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import api from "../../api/client";

// Import the new professional PDF export component
import PdfReportExport from "../PdfReportExport";

const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

function CostEstimationModal({
    isOpen,
    onClose,
    projectData,
    part,
    activeOperationIndex = 0,
    operations = [],
    costForms,
    onSetActiveOperation,
    onAddOperation,
    onRemoveOperation,
    costResult,
    operationResults,
    combinedTotal,
    formState,
    onChangeForm,
    onSubmit, // (e, partId, opIndex)
    onSubmitAll,
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
    const [importLoading, setImportLoading] = useState(false);
    const fileInputRef = useRef(null);

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        
        setImportLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("project_id", projectData?.id);
            formData.append("part_id", part?.id);
            
            const response = await api.post("/files/import/file", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            
            // Extract data from response
            const extractedData = response.data?.extracted_data;
            if (extractedData && Object.keys(extractedData).some(k => extractedData[k] !== null)) {
                // Create a new operation first
                const newOpIndex = operations.length;
                onAddOperation(part.id);
                
                // Small delay to ensure operation is created
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Switch to the new operation
                onSetActiveOperation(part.id, newOpIndex);
                
                // Fill the new operation with extracted data
                const fields = [];
                
                // First set operation type so machine filtering works
                if (extractedData.operation_type) {
                    onChangeForm(part.id, newOpIndex, "operation_type", extractedData.operation_type);
                    fields.push("operation_type");
                }
                
                // Small delay to ensure operation type is set before filtering machines
                await new Promise(resolve => setTimeout(resolve, 50));
                
                if (extractedData.material) {
                    onChangeForm(part.id, newOpIndex, "material", extractedData.material);
                    fields.push("material");
                }
                
                // Use smart machine matching to find best match from available machines
                if (extractedData.machine) {
                    // Get available machines for the selected operation type
                    const opType = extractedData.operation_type || "turning";
                    const availableMachines = getFilteredMachinesForOperation(opType);
                    
                    // Find best matching machine
                    const matchedMachine = findBestMatchingMachine(extractedData.machine, availableMachines);
                    
                    if (matchedMachine) {
                        onChangeForm(part.id, newOpIndex, "machine_name", matchedMachine);
                        fields.push("machine_name");
                    } else {
                        // Fallback: just set the extracted value directly
                        onChangeForm(part.id, newOpIndex, "machine_name", extractedData.machine);
                        fields.push("machine_name (unmatched)");
                    }
                }
                if (extractedData.man_hours !== null && extractedData.man_hours !== undefined) {
                    onChangeForm(part.id, newOpIndex, "man_hours_per_unit", extractedData.man_hours);
                    fields.push("man_hours_per_unit");
                }
                if (extractedData.duty_category) {
                    onChangeForm(part.id, newOpIndex, "duty_category", extractedData.duty_category);
                    fields.push("duty_category");
                }
                if (extractedData.machine_setup_time !== null && extractedData.machine_setup_time !== undefined) {
                    onChangeForm(part.id, newOpIndex, "machine_setup_time", extractedData.machine_setup_time);
                    fields.push("machine_setup_time");
                }
                if (extractedData.cycle_time !== null && extractedData.cycle_time !== undefined) {
                    onChangeForm(part.id, newOpIndex, "cycle_time", extractedData.cycle_time);
                    fields.push("cycle_time");
                }
                if (extractedData.diameter !== null && extractedData.diameter !== undefined) {
                    onChangeForm(part.id, newOpIndex, "diameter", extractedData.diameter);
                    fields.push("diameter");
                }
                if (extractedData.length !== null && extractedData.length !== undefined) {
                    onChangeForm(part.id, newOpIndex, "length", extractedData.length);
                    fields.push("length");
                }
                if (extractedData.breadth !== null && extractedData.breadth !== undefined) {
                    onChangeForm(part.id, newOpIndex, "breadth", extractedData.breadth);
                    fields.push("breadth");
                }
                if (extractedData.height !== null && extractedData.height !== undefined) {
                    onChangeForm(part.id, newOpIndex, "height", extractedData.height);
                    fields.push("height");
                }
                if (extractedData.shape) {
                    onChangeForm(part.id, newOpIndex, "shape", extractedData.shape);
                    fields.push("shape");
                }
                
                alert(`Created new Operation ${newOpIndex + 1} and filled with extracted data!\n\nFields set:\n${fields.join(', ')}`);
            } else {
                alert("File uploaded but no operation data could be extracted from the file.");
            }
        } catch (err) {
            console.error("Upload failed:", err);
            alert("Failed to upload file: " + (err?.response?.data?.detail || err.message));
        } finally {
            setImportLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };
    const pdfPreviewRef = useRef(null);
    const drawingScrollRef = useRef(null);
    const contentRef = useRef(null);
    const dragStateRef = useRef({ isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

    const [expandedOperations, setExpandedOperations] = useState({});
    const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
    const [pdfExportOpen, setPdfExportOpen] = useState(false);

    const operationTypeOptions = useMemo(() => {
        const toOpValue = (name) => {
            const raw = name == null ? "" : String(name);
            const normalized = raw.trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
            return normalized.replace(/\s+/g, "_");
        };

        const supportedOperationValues = new Set([
            "turning",
            "milling",
            "drilling",
            "grinding",
            "boring",
            "heat_treatment",
            "welding",
            "surface_treatment",
            "rubber_press",
        ]);

        const toApiOpValue = (name) => {
            const v = toOpValue(name);
            if (supportedOperationValues.has(v)) return v;
            // Map common DB naming variants to supported API enums
            if (v.includes("boring")) return "boring";
            return v;
        };

        const rawList = Array.isArray(operationTypes) ? operationTypes : [];
        const optsFromDb = rawList
            .map((ot) => {
                const label = String(ot?.operation_name || "").trim();
                const apiValue = toApiOpValue(ot?.operation_name);
                const disabled = !supportedOperationValues.has(apiValue);
                return label ? { value: apiValue, label, disabled } : null;
            })
            .filter(Boolean);

        if (optsFromDb.length > 0) return optsFromDb;
        return Array.from(supportedOperationValues).map((v) => ({
            value: v,
            label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            disabled: false,
        }));
    }, [operationTypes]);

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

    const partMiscItems = useMemo(() => {
        const partForm = costForms?.[part?.id];
        const items = partForm?.miscellaneous_items;
        if (Array.isArray(items) && items.length > 0) return items;
        return [{ description: "", amount: "" }];
    }, [costForms, part?.id]);

    const partMiscTotal = useMemo(() => {
        return partMiscItems.reduce((sum, it) => {
            const n = Number(it?.amount);
            return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
        }, 0);
    }, [partMiscItems]);

    const updatePartMiscItems = (next) => {
        onChangeForm(part.id, -1, "miscellaneous_items", next);
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

    const handleOpenPdfPreview = () => {
        setPdfExportOpen(true);
    };

    const handleDownloadPdf = async () => {
        if (!part || !pdfPreviewRef.current) return;

        const element = pdfPreviewRef.current;
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#020617",
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const margin = 28;
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2;

        const imgWidth = usableWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = margin;

        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= usableHeight;

        while (heightLeft > 5) {
            position -= usableHeight;
            pdf.addPage();
            pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
            heightLeft -= usableHeight;
        }

        const safeProject = String(projectData?.project_name || "Project").replace(/[^a-z0-9-_ ]/gi, "").trim() || "Project";
        const safePart = String(part.part_number || "Part").replace(/[^a-z0-9-_ ]/gi, "").trim() || "Part";
        pdf.save(`${safeProject}-${safePart}-Cost-Estimation.pdf`);
    };

    const normalize = (value) => {
        if (value == null) return "";
        return String(value).trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
    };

    const normalizeMachineName = (value) => {
        if (value == null) return "";
        return String(value).trim().toLowerCase().replace(/\s+/g, " ");
    };

    // Smart machine matching - finds the best matching machine name from available options
    const findBestMatchingMachine = (extractedMachineName, availableMachines) => {
        if (!extractedMachineName || !Array.isArray(availableMachines) || availableMachines.length === 0) {
            return null;
        }
        
        const extracted = normalizeMachineName(extractedMachineName);
        if (!extracted) return null;
        
        // Common machine name mappings
        const machineMappings = {
            'cnc': ['cnc', 'cnc machine', 'cnc lathe', 'cnc milling'],
            'lathe': ['lathe', 'cnc lathe', 'turning lathe'],
            'milling': ['milling', 'cnc milling', 'milling machine', 'vmc', 'hmc'],
            'drilling': ['drilling', 'drilling machine', 'drill', 'cnc drilling'],
            'grinding': ['grinding', 'grinding machine', 'grinder'],
            'boring': ['boring', 'boring machine', 'jig boring'],
            'turning': ['turning', 'turning machine', 'cnc turning'],
        };
        
        // Try exact match first
        const exactMatch = availableMachines.find(m => normalizeMachineName(m?.name) === extracted);
        if (exactMatch) return exactMatch.name;
        
        // Try partial match
        for (const machine of availableMachines) {
            const machineName = normalizeMachineName(machine?.name);
            if (machineName.includes(extracted) || extracted.includes(machineName)) {
                return machine.name;
            }
        }
        
        // Try keyword matching
        for (const [key, variations] of Object.entries(machineMappings)) {
            if (variations.some(v => extracted.includes(v))) {
                // Find a machine that matches this keyword
                for (const machine of availableMachines) {
                    const machineName = normalizeMachineName(machine?.name);
                    if (variations.some(v => machineName.includes(v))) {
                        return machine.name;
                    }
                }
            }
        }
        
        // Try word-by-word matching (for machines like "3 axis CNC")
        const extractedWords = extracted.split(/\s+/);
        let bestMatch = null;
        let bestScore = 0;
        
        for (const machine of availableMachines) {
            const machineName = normalizeMachineName(machine?.name);
            const machineWords = machineName.split(/\s+/);
            
            let score = 0;
            for (const word of extractedWords) {
                if (word.length > 2 && machineWords.some(mw => mw.includes(word) || word.includes(mw))) {
                    score += 1;
                }
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = machine.name;
            }
        }
        
        return bestScore > 0 ? bestMatch : null;
    };

    const resolveOperationTypeId = (operationTypeValue) => {
        const opType = normalize(operationTypeValue);
        if (!opType) return "";

        const list = Array.isArray(operationTypes) ? operationTypes : [];
        const exact = list.find((ot) => normalize(ot?.operation_name) === opType);
        if (exact?.id != null) return String(exact.id);

        // Handle DB variants like 'JIG boring' while API value is 'boring'
        if (opType === "boring") {
            const variant = list.find((ot) => normalize(ot?.operation_name).includes("boring"));
            if (variant?.id != null) return String(variant.id);
        }

        return "";
    };

    const getFilteredMachines = () => {
        const opType = normalize(formState.operation_type);
        if (!opType) return machines;

        const selectedOpId = resolveOperationTypeId(formState.operation_type);

        // If we can't resolve a matching operation type id (DB naming mismatch), don't filter machines.
        if (!selectedOpId) return machines;

        return machines.filter((m) => {
            const opId = m?.op_id ?? m?.operation_type_id ?? m?.operation_type?.id ?? m?.operation_types?.id;
            // Some machines are not bound to a specific operation type in backend (operation_type_id null).
            // Treat them as valid for all operations so UI never hides valid backend machines.
            if (opId == null) return true;
            return String(opId) === selectedOpId;
        });
    };

    const filteredMachines = useMemo(() => {
        return getFilteredMachines();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [machines, operationTypes, formState.operation_type]);

    const getFilteredMachinesForOperation = (operationTypeValue) => {
        const opType = normalize(operationTypeValue);
        if (!opType) return machines;

        const selectedOpId = resolveOperationTypeId(operationTypeValue);

        if (!selectedOpId) return machines;

        return machines.filter((m) => {
            const opId = m?.op_id ?? m?.operation_type_id ?? m?.operation_type?.id ?? m?.operation_types?.id;
            if (opId == null) return true;
            return String(opId) === selectedOpId;
        });
    };

    useEffect(() => {
        const current = String(formState?.machine_name || "").trim();
        if (!current) return;
        const currentNorm = normalizeMachineName(current);
        const exists = filteredMachines.some((m) => normalizeMachineName(m?.name) === currentNorm);
        if (!exists) {
            onChangeForm(part.id, activeOperationIndex, "machine_name", "");
        }
    }, [filteredMachines, formState?.machine_name, onChangeForm, part?.id, activeOperationIndex]);

    if (!isOpen || !part) return null;

    const currentOpType = String(formState?.operation_type || "").trim().toLowerCase();
    const roundOnlyOps = new Set(["turning", "boring"]);
    const rectangularOnlyOps = new Set(["milling", "grinding", "surface_treatment"]);
    const flexibleOps = new Set(["drilling", "heat_treatment", "welding"]);

    const isRoundOnlyOp = roundOnlyOps.has(currentOpType);
    const isRectangularOnlyOp = rectangularOnlyOps.has(currentOpType);
    const isFlexibleOp = flexibleOps.has(currentOpType);
    const shapeValue = String(formState?.shape || "round").trim().toLowerCase() === "rectangular" ? "rectangular" : "round";

    const getOperationDisplayName = (operationTypeValue) => {
        const raw = String(operationTypeValue || "").trim();
        if (!raw) return "";

        const normalized = normalize(raw);
        const match = Array.isArray(operationTypes)
            ? operationTypes.find((ot) => normalize(ot?.operation_name) === normalized)
            : null;

        const fromDb = String(match?.operation_name || "").trim();
        if (fromDb) return fromDb;

        // Fall back to a readable version of the enum.
        return raw
            .replace(/[_-]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const operationSummaryRows = Array.isArray(operationResults)
        ? operationResults
              .map((r, idx) => {
                  const n = Number(r?.cost_breakdown?.total_unit_cost_with_misc);
                  const selectedOpType = operations?.[idx]?.operation_type;
                  const selectedOpName = getOperationDisplayName(selectedOpType);
                  return {
                      idx,
                      label: selectedOpName ? `Operation ${idx + 1} - ${selectedOpName}` : `Operation ${idx + 1}`,
                      value: Number.isFinite(n) ? n : null,
                  };
              })
              .filter((x) => x.value != null)
        : [];

    const operationSummaryTotal = operationSummaryRows.reduce((sum, r) => sum + (r.value || 0), 0);

    const flattenForReport = (obj, prefix = "") => {
        if (obj == null) return [];
        if (typeof obj !== "object") {
            return [{ key: prefix || "value", value: obj }];
        }
        if (Array.isArray(obj)) {
            return [{ key: prefix || "items", value: JSON.stringify(obj) }];
        }
        const rows = [];
        Object.entries(obj).forEach(([k, v]) => {
            const nextKey = prefix ? `${prefix}.${k}` : k;
            if (v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
                rows.push({ key: nextKey, value: v });
            } else if (Array.isArray(v)) {
                rows.push({ key: nextKey, value: JSON.stringify(v) });
            } else if (typeof v === "object") {
                rows.push(...flattenForReport(v, nextKey));
            } else {
                rows.push({ key: nextKey, value: String(v) });
            }
        });
        return rows;
    };

    return (
        <Dialog
            fullScreen
            open={isOpen}
            onClose={onClose}
            TransitionComponent={Transition}
            PaperProps={{
                sx: {
                    bgcolor: "#020617",
                    backgroundImage: "radial-gradient(circle at top left, #1e293b 0, #020617 55%, #000 100%)",
                },
            }}
        >
            <AppBar
                sx={{
                    position: "relative",
                    bgcolor: "transparent",
                    boxShadow: "none",
                    borderBottom: "1px solid rgba(148,163,184,0.25)",
                    backgroundImage: "linear-gradient(90deg, rgba(15,23,42,0.98), rgba(37,99,235,0.95))",
                }}
            >
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
                        {(costResult || Number.isFinite(Number(combinedTotal))) && (
                            <Box sx={{ textAlign: "right", mr: 2 }}>
                                <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                                    Final Part Cost
                                </Typography>
                                <Typography variant="h6" fontWeight="bold" color="#bbf7d0">
                                    {formatValue(
                                        "total_cost",
                                        Number.isFinite(Number(combinedTotal))
                                            ? Number(combinedTotal)
                                            : costResult?.cost_breakdown?.total_unit_cost_with_misc
                                    )}
                                </Typography>
                            </Box>
                        )}
                        <Button
                            color="inherit"
                            onClick={handleOpenPdfPreview}
                            startIcon={<DownloadIcon />}
                            variant="contained"
                            sx={{
                                bgcolor: "rgba(15,23,42,0.15)",
                                borderColor: "rgba(255,255,255,0.35)",
                                textTransform: "none",
                                fontWeight: 800,
                                "&:hover": { bgcolor: "rgba(15,23,42,0.25)" },
                            }}
                        >
                            Download PDF
                        </Button>
                        <Button autoFocus color="inherit" onClick={onClose} sx={{ textTransform: "none", fontWeight: 700 }}>
                            Close
                        </Button>
                    </Stack>
                </Toolbar>
            </AppBar>

            <Box
                ref={contentRef}
                sx={{
                    height: "100%",
                    display: "flex",
                    overflow: "hidden",
                    bgcolor: "transparent",
                }}
            >
            {/* Main Content - Drawing and Operations */}
            <Box sx={{ flex: 1, overflowY: "auto", p: { xs: 2.5, md: 3.5 } }}>
                <Grid container spacing={3.5}>
                    <Grid item xs={12}>
                        <Stack spacing={3.5}>
                            {/* Drawing */}
                            <Paper
                                variant="outlined"
                                sx={{
                                    overflow: "hidden",
                                    display: "flex",
                                    flexDirection: "column",
                                    height: { xs: 560, lg: "calc(100vh - 360px)" },
                                    borderRadius: 3,
                                    bgcolor: "rgba(15,23,42,0.98)",
                                    borderColor: "rgba(30,64,175,0.7)",
                                    boxShadow: "0 22px 54px rgba(15,23,42,0.9)",
                                }}
                            >
                                <Box
                                    sx={{
                                        px: 2.5,
                                        py: 1.75,
                                        bgcolor: "rgba(15,23,42,0.98)",
                                        borderBottom: 1,
                                        borderColor: "rgba(30,64,175,0.7)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <Typography variant="subtitle2" sx={{ color: "#e5e7eb", fontWeight: 700 }}>
                                        2D Drawing
                                    </Typography>
                                    <Stack direction="row" spacing={0.5}>
                                        <IconButton size="small" onClick={onZoomOut} title="Zoom Out" sx={{ color: "#e5e7eb" }}>
                                            <ZoomOutIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={onResetZoom} title="Reset" sx={{ color: "#e5e7eb" }}>
                                            <RestartAltIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={onZoomIn} title="Zoom In" sx={{ color: "#e5e7eb" }}>
                                            <ZoomInIcon fontSize="small" />
                                        </IconButton>
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
                                        bgcolor: "#020617",
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

                            <Paper
                                variant="outlined"
                                sx={{
                                    borderRadius: 3,
                                    overflow: "hidden",
                                    bgcolor: "rgba(15,23,42,0.98)",
                                    borderColor: "rgba(30,64,175,0.7)",
                                    boxShadow: "0 22px 54px rgba(15,23,42,0.9)",
                                }}
                            >
                                <Box sx={{ px: 3.5, py: 2.75, borderBottom: 1, borderColor: "rgba(30,64,175,0.7)", bgcolor: "rgba(15,23,42,0.98)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <Box>
                                        <Typography variant="h5" fontSize="1.4rem" fontWeight={900} sx={{ color: "#e5e7eb" }}>
                                            Machining Inputs
                                        </Typography>
                                        <Typography variant="body1" sx={{ opacity: 0.9, color: "rgba(148,163,184,0.95)" }}>
                                            Fill the values and calculate
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ p: 3.5 }}>
                                    <Stack spacing={2.25}>
                                            {(Array.isArray(operations) && operations.length > 0 ? operations : [formState]).map((op, opIndex) => {
                                                const opState = opIndex === activeOperationIndex ? formState : (op || {});
                                                const opResult = Array.isArray(operationResults) ? operationResults[opIndex] : null;
                                                const isExpanded = Boolean(expandedOperations?.[opIndex]);
                                                const opTypeValue = String(opState?.operation_type || "").trim().toLowerCase();
                                                const roundOnlyOpsForOp = new Set(["turning", "boring"]);
                                                const rectangularOnlyOpsForOp = new Set(["milling", "grinding", "surface_treatment", "rubber_press"]);
                                                const flexibleOpsForOp = new Set(["drilling", "heat_treatment", "welding"]);
                                                const isFlexibleOpForOp = flexibleOpsForOp.has(opTypeValue);
                                                const isRoundOnlyOpForOp = roundOnlyOpsForOp.has(opTypeValue);
                                                const isRectangularOnlyOpForOp = rectangularOnlyOpsForOp.has(opTypeValue);
                                                const shapeValueForOp = String(opState?.shape || "round").trim().toLowerCase() === "rectangular" ? "rectangular" : "round";
                                                const needsManualDutyForOp = opTypeValue && opTypeValue !== "turning" && opTypeValue !== "milling";

                                                const machinesForOp = getFilteredMachinesForOperation(opState?.operation_type);
                                                const machineValueForOp = (() => {
                                                    const current = String(opState?.machine_name || "").trim();
                                                    if (!current) return "";
                                                    const currentNorm = normalizeMachineName(current);
                                                    const exists = machinesForOp.some((m) => normalizeMachineName(m?.name) === currentNorm);
                                                    return exists ? String(opState?.machine_name || "").trim() : "";
                                                })();

                                                    return (
                                                        <Paper
                                                            key={`op-form-${opIndex}`}
                                                            variant="outlined"
                                                            sx={{ p: 2.5, borderRadius: 2, bgcolor: "rgba(2,6,23,0.55)", borderColor: "rgba(30,64,175,0.45)" }}
                                                        >
                                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2, flexWrap: "wrap" }}>
                                                                <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#e5e7eb" }}>
                                                                    Operation {opIndex + 1}
                                                                </Typography>
                                                                <Stack direction="row" spacing={0.75} alignItems="center">
                                                                    {opResult && (
                                                                        <IconButton
                                                                            onClick={() => {
                                                                                setExpandedOperations((prev) => ({
                                                                                    ...(prev || {}),
                                                                                    [opIndex]: !Boolean(prev?.[opIndex]),
                                                                                }));
                                                                            }}
                                                                            size="small"
                                                                            title={isExpanded ? "Hide cost breakdown" : "Show cost breakdown"}
                                                                            sx={{ border: "1px solid rgba(148,163,184,0.35)", borderRadius: 1.25 }}
                                                                        >
                                                                            {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                                                                        </IconButton>
                                                                    )}
                                                                    <Button
                                                                        variant="outlined"
                                                                        size="small"
                                                                        color="error"
                                                                        startIcon={<DeleteOutlineIcon />}
                                                                        disabled={!Array.isArray(operations) || operations.length <= 1}
                                                                        onClick={() => onRemoveOperation && onRemoveOperation(part.id, opIndex)}
                                                                        sx={{ textTransform: "none", fontWeight: 800 }}
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                </Stack>
                                                            </Box>

                                                            <form onSubmit={(e) => onSubmit(e, part.id, opIndex)}>
                                                                <Grid container spacing={2.5} alignItems="stretch">
                                                                    <Grid item xs={12} sm={6} md={5} lg={4}>
                                                                        <TextField
                                                                            select
                                                                            label="Operation Type"
                                                                            value={opState?.operation_type || "turning"}
                                                                            onChange={(e) => {
                                                                                onChangeForm(part.id, opIndex, "operation_type", e.target.value);
                                                                                onChangeForm(part.id, opIndex, "machine_name", "");
                                                                            }}
                                                                            fullWidth
                                                                            size="medium"
                                                                            sx={{
                                                                                '& .MuiSelect-select': { py: 2.5, px: 2.5, fontSize: '1.15rem', fontWeight: 500 },
                                                                                '& .MuiInputLabel-root': { fontSize: '1.05rem' },
                                                                                minWidth: 280,
                                                                            }}
                                                                        >
                                                                            {operationTypeOptions.map((opt) => (
                                                                                <MenuItem key={`${opt.value}-${opt.label}`} value={opt.value} disabled={Boolean(opt.disabled)} sx={{ fontSize: '1.05rem', py: 1.5 }}>
                                                                                    {opt.label}
                                                                                </MenuItem>
                                                                            ))}
                                                                        </TextField>
                                                                    </Grid>

                                                                    <Grid item xs={12} sm={6} md={5} lg={4}>
                                                                        <TextField
                                                                            select
                                                                            label="Material"
                                                                            value={opState?.material || "steel"}
                                                                            onChange={(e) => onChangeForm(part.id, opIndex, "material", e.target.value)}
                                                                            fullWidth
                                                                            size="medium"
                                                                            sx={{
                                                                                '& .MuiSelect-select': { py: 2.5, px: 2.5, fontSize: '1.15rem', fontWeight: 500 },
                                                                                '& .MuiInputLabel-root': { fontSize: '1.05rem' },
                                                                                minWidth: 280,
                                                                            }}
                                                                        >
                                                                            <MenuItem value="steel" sx={{ fontSize: '1.05rem', py: 1.5 }}>Steel</MenuItem>
                                                                            <MenuItem value="aluminium" sx={{ fontSize: '1.05rem', py: 1.5 }}>Aluminium</MenuItem>
                                                                            <MenuItem value="titanium" sx={{ fontSize: '1.05rem', py: 1.5 }}>Titanium</MenuItem>
                                                                        </TextField>
                                                                    </Grid>

                                                                    <Grid item xs={12} sm={6} md={5} lg={4}>
                                                                        <TextField
                                                                            select
                                                                            label="Machine"
                                                                            value={machineValueForOp}
                                                                            onChange={(e) => onChangeForm(part.id, opIndex, "machine_name", String(e.target.value || "").trim())}
                                                                            fullWidth
                                                                            size="medium"
                                                                            sx={{
                                                                                '& .MuiSelect-select': { py: 2.5, px: 2.5, fontSize: '1.15rem', fontWeight: 500 },
                                                                                '& .MuiInputLabel-root': { fontSize: '1.05rem' },
                                                                                minWidth: 280,
                                                                            }}
                                                                        >
                                                                            <MenuItem value="" sx={{ fontSize: '1.05rem', py: 1.5 }}>Select Machine</MenuItem>
                                                                            {machinesForOp.map((m) => (
                                                                                <MenuItem key={m.id} value={String(m?.name || "").trim()} sx={{ fontSize: '1.05rem', py: 1.5 }}>
                                                                                    {String(m?.name || "").trim()}
                                                                                </MenuItem>
                                                                            ))}
                                                                        </TextField>
                                                                    </Grid>

                                                                    <Grid item xs={12} sm={6} md={5} lg={4}>
                                                                        <TextField
                                                                            label="Man Hours / Unit"
                                                                            type="number"
                                                                            inputProps={{ step: "0.01" }}
                                                                            value={opState?.man_hours_per_unit || ""}
                                                                            onChange={(e) => onChangeForm(part.id, opIndex, "man_hours_per_unit", e.target.value)}
                                                                            fullWidth
                                                                            size="medium"
                                                                            required
                                                                            sx={{
                                                                                '& .MuiInputBase-input': { py: 2.5, px: 2.5, fontSize: '1.15rem' },
                                                                                '& .MuiInputLabel-root': { fontSize: '1.05rem' },
                                                                            }}
                                                                        />
                                                                    </Grid>

                                                                    <Grid item xs={12} sm={6} md={5} lg={4}>
                                                                        <TextField
                                                                            select
                                                                            label="Duty Category"
                                                                            value={opState?.duty_category || ""}
                                                                            onChange={(e) => onChangeForm(part.id, opIndex, "duty_category", e.target.value)}
                                                                            fullWidth
                                                                            size="medium"
                                                                            required={Boolean(needsManualDutyForOp)}
                                                                            sx={{
                                                                                '& .MuiSelect-select': { py: 2.5, px: 2.5, fontSize: '1.15rem', fontWeight: 500 },
                                                                                '& .MuiInputLabel-root': { fontSize: '1.05rem' },
                                                                                minWidth: 280,
                                                                            }}
                                                                        >
                                                                            <MenuItem value="" sx={{ fontSize: '1.05rem', py: 1.5 }}>Select Duty</MenuItem>
                                                                            <MenuItem value="light" sx={{ fontSize: '1.05rem', py: 1.5 }}>Light</MenuItem>
                                                                            <MenuItem value="medium" sx={{ fontSize: '1.05rem', py: 1.5 }}>Medium</MenuItem>
                                                                            <MenuItem value="heavy" sx={{ fontSize: '1.05rem', py: 1.5 }}>Heavy</MenuItem>
                                                                        </TextField>
                                                                    </Grid>

                                                                    {/* Machine Setup Time */}
                                                                    <Grid item xs={12} sm={6} md={5} lg={4}>
                                                                        <TextField
                                                                            label="Machine Setup Time (min)"
                                                                            type="number"
                                                                            inputProps={{ step: "0.01", min: "0" }}
                                                                            value={opState?.machine_setup_time || ""}
                                                                            onChange={(e) => onChangeForm(part.id, opIndex, "machine_setup_time", e.target.value)}
                                                                            fullWidth
                                                                            size="medium"
                                                                            sx={{
                                                                                '& .MuiInputBase-input': { py: 2.5, px: 2.5, fontSize: '1.15rem' },
                                                                                '& .MuiInputLabel-root': { fontSize: '1.05rem' },
                                                                            }}
                                                                        />
                                                                    </Grid>

                                                                    {/* Cycle Time */}
                                                                    <Grid item xs={12} sm={6} md={5} lg={4}>
                                                                        <TextField
                                                                            label="Cycle Time (min)"
                                                                            type="number"
                                                                            inputProps={{ step: "0.01", min: "0" }}
                                                                            value={opState?.cycle_time || ""}
                                                                            onChange={(e) => onChangeForm(part.id, opIndex, "cycle_time", e.target.value)}
                                                                            fullWidth
                                                                            size="medium"
                                                                            sx={{
                                                                                '& .MuiInputBase-input': { py: 2.5, px: 2.5, fontSize: '1.15rem' },
                                                                                '& .MuiInputLabel-root': { fontSize: '1.05rem' },
                                                                            }}
                                                                        />
                                                                    </Grid>

                                                                    {isFlexibleOpForOp && (
                                                                        <Grid item xs={12} sm={6} md={5} lg={4}>
                                                                            <TextField
                                                                                select
                                                                                label="Shape"
                                                                                value={shapeValueForOp}
                                                                                onChange={(e) => onChangeForm(part.id, opIndex, "shape", e.target.value)}
                                                                                fullWidth
                                                                                size="medium"
                                                                                sx={{
                                                                                    '& .MuiSelect-select': { py: 2.5, px: 2.5, fontSize: '1.15rem', fontWeight: 500 },
                                                                                    '& .MuiInputLabel-root': { fontSize: '1.05rem' },
                                                                                    minWidth: 280,
                                                                                }}
                                                                            >
                                                                                <MenuItem value="round" sx={{ fontSize: '1.05rem', py: 1.5 }}>Round</MenuItem>
                                                                                <MenuItem value="rectangular" sx={{ fontSize: '1.05rem', py: 1.5 }}>Rectangular</MenuItem>
                                                                            </TextField>
                                                                        </Grid>
                                                                    )}
                                                                </Grid>

                                                                {/* Second row - Dimensions */}
                                                                <Grid container spacing={2.5} sx={{ mt: 0 }}>
                                                                    <Grid item xs={12} md={5} lg={4}>
                                                                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(15,23,42,0.5)", height: "100%" }}>
                                                                            <Typography variant="subtitle2" sx={{ mb: 2, color: "#e5e7eb" }}>
                                                                                Dimensions
                                                                            </Typography>
                                                                            <Grid container spacing={2}>
                                                                                <Grid item xs={4}>
                                                                                    <TextField
                                                                                        label="Length (mm)"
                                                                                        type="number"
                                                                                        inputProps={{ step: "0.01" }}
                                                                                        value={opState?.length || ""}
                                                                                        onChange={(e) => onChangeForm(part.id, opIndex, "length", e.target.value)}
                                                                                        fullWidth
                                                                                        size="medium"
                                                                                        required
                                                                                    />
                                                                                </Grid>

                                                                                {(isRoundOnlyOpForOp || (isFlexibleOpForOp && shapeValueForOp === "round")) && (
                                                                                    <Grid item xs={4}>
                                                                                        <TextField
                                                                                            label="Diameter (mm)"
                                                                                            type="number"
                                                                                            inputProps={{ step: "0.01" }}
                                                                                            value={opState?.diameter || ""}
                                                                                            onChange={(e) => onChangeForm(part.id, opIndex, "diameter", e.target.value)}
                                                                                            fullWidth
                                                                                            size="medium"
                                                                                            required
                                                                                        />
                                                                                    </Grid>
                                                                                )}

                                                                                {(isRectangularOnlyOpForOp || (isFlexibleOpForOp && shapeValueForOp === "rectangular")) && (
                                                                                    <>
                                                                                        <Grid item xs={4}>
                                                                                            <TextField
                                                                                                label="Breadth (mm)"
                                                                                                type="number"
                                                                                                inputProps={{ step: "0.01" }}
                                                                                                value={opState?.breadth || ""}
                                                                                                onChange={(e) => onChangeForm(part.id, opIndex, "breadth", e.target.value)}
                                                                                                fullWidth
                                                                                                size="medium"
                                                                                                required
                                                                                            />
                                                                                        </Grid>
                                                                                        <Grid item xs={4}>
                                                                                            <TextField
                                                                                                label="Height (mm)"
                                                                                                type="number"
                                                                                                inputProps={{ step: "0.01" }}
                                                                                                value={opState?.height || ""}
                                                                                                onChange={(e) => onChangeForm(part.id, opIndex, "height", e.target.value)}
                                                                                                fullWidth
                                                                                                size="medium"
                                                                                                required
                                                                                            />
                                                                                        </Grid>
                                                                                    </>
                                                                                )}
                                                                            </Grid>
                                                                        </Paper>
                                                                    </Grid>
                                                                </Grid>

                                                                {/* Third row - Calculate Cost Buttons */}
                                                                <Grid container spacing={2.5} sx={{ mt: 2 }}>
                                                                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                                                        <Stack direction="row" spacing={2}>
                                                                            <Button 
                                                                                type="submit" 
                                                                                variant="contained" 
                                                                                disabled={loading} 
                                                                                sx={{ 
                                                                                    minWidth: 150, 
                                                                                    py: 1.5,
                                                                                    px: 3,
                                                                                    fontSize: '1rem'
                                                                                }}
                                                                            >
                                                                                {loading ? "Calculating..." : "Calculate Cost"}
                                                                            </Button>
                                                                            {opResult && (
                                                                                <Button 
                                                                                    variant="outlined" 
                                                                                    onClick={() => onClear(part.id)}
                                                                                    sx={{ py: 1.5, px: 2 }}
                                                                                >
                                                                                    Clear
                                                                                </Button>
                                                                            )}
                                                                        </Stack>
                                                                    </Grid>
                                                                </Grid>
                                                            </form>

                                                            <Collapse in={Boolean(opResult) && isExpanded} timeout="auto" unmountOnExit>
                                                                <Box sx={{ mt: 2.25 }}>
                                                                    <TableContainer
                                                                        component={Paper}
                                                                        variant="outlined"
                                                                        sx={{
                                                                            bgcolor: "#020617",
                                                                            borderColor: "rgba(30,64,175,0.55)",
                                                                            overflow: "hidden",
                                                                        }}
                                                                    >
                                                                        <Table
                                                                            sx={{
                                                                                fontSize: "1.02rem",
                                                                                "& th": {
                                                                                    bgcolor: "rgba(15,23,42,0.98)",
                                                                                    color: "#e5e7eb",
                                                                                    borderBottomColor: "rgba(30,64,175,0.8)",
                                                                                    fontSize: "1.05rem",
                                                                                    py: 1.6,
                                                                                },
                                                                                "& td": {
                                                                                    borderBottomColor: "rgba(30,64,175,0.45)",
                                                                                    color: "#e5e7eb",
                                                                                    fontSize: "1.02rem",
                                                                                    py: 1.45,
                                                                                },
                                                                            }}
                                                                        >
                                                                            <TableHead>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ fontWeight: 900 }}>Item</TableCell>
                                                                                    <TableCell sx={{ fontWeight: 900 }} align="right">
                                                                                        Value
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            </TableHead>
                                                                            <TableBody>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ py: 1.55 }}>Machine Setup Time (min)</TableCell>
                                                                                    <TableCell align="right" sx={{ py: 1.55 }}>{opResult?.inputs?.machine_setup_time || "-"}</TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ py: 1.55 }}>Cycle Time (min)</TableCell>
                                                                                    <TableCell align="right" sx={{ py: 1.55 }}>{opResult?.inputs?.cycle_time || "-"}</TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ py: 1.55 }}>Basic Cost</TableCell>
                                                                                    <TableCell align="right" sx={{ py: 1.55 }}>
                                                                                        {formatValue("basic_cost", opResult?.cost_breakdown?.basic_cost_per_unit)}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ py: 1.55 }}>Overheads</TableCell>
                                                                                    <TableCell align="right" sx={{ py: 1.55 }}>
                                                                                        {formatValue("overheads", opResult?.cost_breakdown?.overheads_per_unit)}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ py: 1.55 }}>Profit</TableCell>
                                                                                    <TableCell align="right" sx={{ py: 1.55 }}>
                                                                                        {formatValue("profit", opResult?.cost_breakdown?.profit_per_unit)}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ py: 1.55 }}>Packing & Fwd</TableCell>
                                                                                    <TableCell align="right" sx={{ py: 1.55 }}>
                                                                                        {formatValue("packing", opResult?.cost_breakdown?.packing_forwarding_per_unit)}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ py: 1.55 }}>Man Hours / Unit</TableCell>
                                                                                    <TableCell align="right" sx={{ py: 1.55 }}>{opResult?.cost_breakdown?.man_hours_per_unit}</TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ py: 1.55 }}>Machine Hour Rate</TableCell>
                                                                                    <TableCell align="right" sx={{ py: 1.55 }}>
                                                                                        {formatValue("machine_hour_rate", opResult?.cost_breakdown?.machine_hour_rate)}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                                <TableRow>
                                                                                    <TableCell sx={{ py: 1.55 }}>Wage Rate</TableCell>
                                                                                    <TableCell align="right" sx={{ py: 1.55 }}>
                                                                                        {formatValue("wage_rate", opResult?.cost_breakdown?.wage_rate)}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                                <TableRow selected>
                                                                                    <TableCell sx={{ fontWeight: 950, fontSize: "1.12rem", py: 1.7 }}>Final Part Cost</TableCell>
                                                                                    <TableCell align="right" sx={{ fontWeight: 950, fontSize: "1.15rem", color: "primary.main", py: 1.7 }}>
                                                                                        {formatValue("total_cost", opResult?.cost_breakdown?.total_unit_cost_with_misc)}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            </TableBody>
                                                                        </Table>
                                                                    </TableContainer>
                                                                </Box>
                                                            </Collapse>
                                                        </Paper>
                                                    );
                                            })}

                                            {/* Global Miscellaneous Section */}
                                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: "rgba(15,23,42,0.98)", borderColor: "rgba(30,64,175,0.7)" }}>
                                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                                                    <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#e5e7eb" }}>
                                                        Global Miscellaneous Costs
                                                    </Typography>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        startIcon={<AddCircleOutlineIcon />}
                                                        onClick={() => {
                                                            const next = [...partMiscItems, { description: "", amount: "" }];
                                                            updatePartMiscItems(next);
                                                        }}
                                                        sx={{ textTransform: "none", fontWeight: 700 }}
                                                    >
                                                        Add
                                                    </Button>
                                                </Box>

                                                <Stack spacing={1.5}>
                                                    {partMiscItems.map((item, idx) => (
                                                        <Grid container spacing={1.5} key={idx} alignItems="center">
                                                            <Grid item xs={12} md={7}>
                                                                <TextField
                                                                    label="Description"
                                                                    value={item?.description || ""}
                                                                    onChange={(e) => {
                                                                        const next = partMiscItems.map((x, i) => i === idx ? { ...x, description: e.target.value } : x);
                                                                        updatePartMiscItems(next);
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
                                                                        const next = partMiscItems.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x);
                                                                        updatePartMiscItems(next);
                                                                    }}
                                                                    fullWidth
                                                                    size="medium"
                                                                />
                                                            </Grid>
                                                            <Grid item xs={2} md={1} sx={{ display: "flex", justifyContent: "flex-end" }}>
                                                                <IconButton
                                                                    onClick={() => {
                                                                        const next = partMiscItems.filter((_, i) => i !== idx);
                                                                        updatePartMiscItems(next.length ? next : [{ description: "", amount: "" }]);
                                                                    }}
                                                                    title="Remove"
                                                                >
                                                                    <DeleteOutlineIcon />
                                                                </IconButton>
                                                            </Grid>
                                                        </Grid>
                                                    ))}
                                                </Stack>

                                                <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 3, alignItems: "center" }}>
                                                    <Typography variant="body2" fontWeight={700} sx={{ color: "rgba(148,163,184,0.95)" }}>
                                                        Miscellaneous Total:
                                                    </Typography>
                                                    <Typography variant="body1" fontWeight={900} sx={{ color: "#e5e7eb" }}>
                                                        {formatValue("miscellaneous_amount", partMiscTotal)}
                                                    </Typography>
                                                </Box>
                                            </Paper>

                                            {/* Add Operation and Calculate All Buttons - Moved to end */}
                                            <Box sx={{ display: "flex", justifyContent: "center", gap: 2, pt: 2, flexWrap: "wrap" }}>
                                                <Button
                                                    variant="outlined"
                                                    size="large"
                                                    startIcon={<AddCircleOutlineIcon />}
                                                    onClick={() => onAddOperation && onAddOperation(part.id)}
                                                    sx={{ textTransform: "none", fontWeight: 800, px: 4, py: 1.5 }}
                                                >
                                                    Add Operation
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="contained"
                                                    size="large"
                                                    disabled={loading || !Array.isArray(operations) || operations.length <= 1}
                                                    onClick={() => onSubmitAll && onSubmitAll(part.id)}
                                                    sx={{ textTransform: "none", fontWeight: 800, px: 4, py: 1.5 }}
                                                >
                                                    {loading ? "Calculating..." : "Calculate All Operations"}
                                                </Button>
                                            </Box>

                                        </Stack>
                                    </Box>
                                </Paper>

                                {operationSummaryRows.length > 0 && (
                                    <Paper variant="outlined" sx={{ overflow: "hidden", bgcolor: "rgba(15,23,42,0.98)", borderColor: "rgba(30,64,175,0.7)" }}>
                                        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "rgba(30,64,175,0.7)", bgcolor: "rgba(15,23,42,0.98)" }}>
                                            <Typography variant="h6" fontSize="1rem" sx={{ color: "#e5e7eb", fontWeight: 900 }}>Operations Summary</Typography>
                                        </Box>
                                        <Box sx={{ p: 3 }}>
                                            <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: "rgba(15,23,42,0.98)", borderColor: "rgba(30,64,175,0.6)" }}>
                                                <Table>
                                                    <TableHead>
                                                        <TableRow sx={{ bgcolor: "rgba(30,64,175,0.15)" }}>
                                                            <TableCell sx={{ fontWeight: 900, color: "#e5e7eb" }}>Operation</TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 900, color: "#e5e7eb" }}>Total Cost</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {operationSummaryRows.map((row) => (
                                                            <TableRow key={row.idx}>
                                                                <TableCell sx={{ color: "#e5e7eb" }}>{row.label}</TableCell>
                                                                <TableCell align="right" sx={{ color: "#e5e7eb" }}>{formatValue("total_cost", row.value)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {partMiscTotal > 0 && (
                                                            <TableRow sx={{ bgcolor: "rgba(30,64,175,0.08)" }}>
                                                                <TableCell sx={{ color: "#38bdf8", fontWeight: 800 }}>Global Miscellaneous</TableCell>
                                                                <TableCell align="right" sx={{ color: "#38bdf8", fontWeight: 800 }}>
                                                                    {formatValue("miscellaneous_amount", partMiscTotal)}
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                        <TableRow sx={{ bgcolor: "rgba(30,64,175,0.15)" }}>
                                                            <TableCell sx={{ fontWeight: 900, color: "#e5e7eb", fontSize: "1.05rem" }}>Grand Total</TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 900, color: "#38bdf8", fontSize: "1.05rem" }}>
                                                                {formatValue(
                                                                    "total_cost",
                                                                    (Number.isFinite(Number(combinedTotal)) ? Number(combinedTotal) : operationSummaryTotal) + partMiscTotal
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </Box>
                                    </Paper>
                                )}
                            </Stack>
                        </Grid>
                    </Grid>
                </Box>

                {/* Right Sidebar - Project Info */}
                <Paper
                    elevation={0}
                    sx={{
                        width: { xs: 360, md: 420, lg: 460 },
                        borderLeft: "1px solid rgba(30,64,175,0.6)",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        overflowY: "auto",
                        bgcolor: "rgba(15,23,42,0.96)",
                        flexShrink: 0,
                    }}
                >
                <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3, flex: 1, minHeight: 0 }}>
                    {/* Project Info Card */}
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 2.5,
                            borderRadius: 2.5,
                            bgcolor: "rgba(15,23,42,0.98)",
                            borderColor: "rgba(30,64,175,0.65)",
                        }}
                    >
                        <Typography variant="overline" sx={{ letterSpacing: 1, fontSize: "0.75rem" }} color="rgba(148,163,184,0.9)">
                            PROJECT
                        </Typography>
                        <Typography variant="h5" fontWeight={900} gutterBottom sx={{ color: "#e5e7eb" }}>
                            {projectData?.project_name || "Untitled Project"}
                        </Typography>
                        <Typography variant="body1" display="block" sx={{ lineHeight: 1.45, color: "rgba(148,163,184,0.95)" }}>
                            PO/Ref: {projectData?.po_reference_number || "N/A"}
                        </Typography>
                        <Typography variant="body1" display="block" sx={{ lineHeight: 1.45, color: "rgba(148,163,184,0.95)" }}>
                            Customer: {projectData?.customer_name || "N/A"}
                        </Typography>
                        <Typography variant="body1" display="block" sx={{ lineHeight: 1.45, color: "rgba(148,163,184,0.95)" }}>
                            Date: {projectData?.project_date || "N/A"}
                        </Typography>

                        {/* Import Button */}
                        <Button
                            variant="contained"
                            size="small"
                            fullWidth
                            disabled={importLoading}
                            startIcon={importLoading ? <CircularProgress size={16} /> : <UploadFileIcon />}
                            onClick={handleImportClick}
                            sx={{
                                mt: 2,
                                textTransform: "none",
                                fontWeight: 600,
                                borderRadius: 2,
                                background: "linear-gradient(135deg, #0284c7 0%, #6366f1 100%)",
                            }}
                        >
                            {importLoading ? "Uploading..." : "Import operations"}
                        </Button>
                        <input
                            type="file"
                            hidden
                            ref={fileInputRef}
                            accept="*/*"
                            onChange={handleFileSelected}
                        />
                    </Paper>

                    {/* Operation Details */}
                    <Paper
                        variant="outlined"
                        sx={{
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            bgcolor: "rgba(15,23,42,0.98)",
                            borderColor: "rgba(30,64,175,0.7)",
                        }}
                    >
                        <Box sx={{ px: 2, py: 1.5, bgcolor: "rgba(15,23,42,0.98)", borderBottom: 1, borderColor: "rgba(30,64,175,0.7)" }}>
                            <Typography variant="subtitle2" sx={{ color: "#e5e7eb" }}>
                                Operation Details
                            </Typography>
                        </Box>
                        <Box sx={{ p: 2.5 }}>
                            {!costResult ? (
                                <Typography variant="caption" sx={{ color: "rgba(148,163,184,0.9)" }}>
                                    Calculate cost to see the details.
                                </Typography>
                            ) : (
                                <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: "#020617", borderColor: "rgba(30,64,175,0.6)" }}>
                                    <Table size="small">
                                        <TableBody>
                                            <TableRow>
                                                <TableCell sx={{ color: "rgba(148,163,184,0.95)", fontSize: "0.9rem", py: 1.25 }}>Operation</TableCell>
                                                <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.operation_type}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell sx={{ color: "rgba(148,163,184,0.95)", fontSize: "0.9rem", py: 1.25 }}>Machine</TableCell>
                                                <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.selected_machine?.name}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell sx={{ color: "rgba(148,163,184,0.95)", fontSize: "0.9rem", py: 1.25 }}>Material</TableCell>
                                                <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.material}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell sx={{ color: "rgba(148,163,184,0.95)", fontSize: "0.9rem", py: 1.25 }}>Duty Category</TableCell>
                                                <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.duty_category}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell sx={{ color: "rgba(148,163,184,0.95)", fontSize: "0.9rem", py: 1.25 }}>Shape</TableCell>
                                                <TableCell align="right" sx={{ fontSize: "1rem", py: 1.25 }}>{costResult.shape}</TableCell>
                                            </TableRow>
                                            {costResult.volume ? (
                                                <TableRow>
                                                    <TableCell sx={{ color: "rgba(148,163,184,0.95)", fontSize: "0.9rem", py: 1.25 }}>Volume</TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "0.9rem", py: 1.25 }}>{costResult.volume.toFixed(2)} mm³</TableCell>
                                                </TableRow>
                                            ) : null}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Box>
                    </Paper>

                    {/* Global Misc Summary */}
                    {partMiscTotal > 0 && (
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2.5,
                                borderRadius: 2.5,
                                bgcolor: "rgba(56,189,248,0.12)",
                                borderColor: "rgba(56,189,248,0.45)",
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ color: "#38bdf8", mb: 1 }}>
                                Global Miscellaneous
                            </Typography>
                            <Typography variant="h6" fontWeight={900} sx={{ color: "#38bdf8" }}>
                                {formatValue("miscellaneous_amount", partMiscTotal)}
                            </Typography>
                        </Paper>
                    )}
                </Box>
            </Paper>
        </Box>

        <Dialog
                open={pdfPreviewOpen}
                onClose={() => setPdfPreviewOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: "transparent",
                        boxShadow: "none",
                    },
                }}
            >
                <DialogContent
                    sx={{
                        p: 2,
                        bgcolor: "transparent",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "flex-start",
                    }}
                >
                    <Box
                        ref={pdfPreviewRef}
                        sx={{
                            bgcolor: "#020617",
                            color: "#e5e7eb",
                            width: "min(794px, 100%)",
                            minHeight: "1123px",
                            p: 4,
                            borderRadius: 2,
                            border: "1px solid rgba(148,163,184,0.18)",
                            fontSize: "14px",
                            lineHeight: 1.35,
                            "& .MuiTypography-root": { fontSize: "1em" },
                            "& .MuiTableCell-root": { fontSize: "0.95em" },
                        }}
                    >
                        {/* PAGE 1 */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="h5" fontWeight={900} sx={{ color: "#e5e7eb", lineHeight: 1.1, fontSize: "1.6em" }}>
                                    {projectData?.project_name || "Untitled Project"}
                                </Typography>
                                <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1.5, rowGap: 0.5, maxWidth: 640 }}>
                                    <Typography variant="body2" fontWeight={800} sx={{ color: "rgba(229,231,235,0.85)" }}>PO/Ref</Typography>
                                    <Typography variant="body2" sx={{ color: "rgba(229,231,235,0.85)" }}>{projectData?.po_reference_number || "N/A"}</Typography>
                                    <Typography variant="body2" fontWeight={800} sx={{ color: "rgba(229,231,235,0.85)" }}>Customer</Typography>
                                    <Typography variant="body2" sx={{ color: "rgba(229,231,235,0.85)" }}>{projectData?.customer_name || "N/A"}</Typography>
                                    <Typography variant="body2" fontWeight={800} sx={{ color: "rgba(229,231,235,0.85)" }}>Date</Typography>
                                    <Typography variant="body2" sx={{ color: "rgba(229,231,235,0.85)" }}>{projectData?.project_date || "N/A"}</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                                <Typography variant="h6" fontWeight={900} sx={{ color: "#e5e7eb", fontSize: "1.25em" }}>
                                    HAL Cost Estimation
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.5, color: "rgba(229,231,235,0.75)" }}>
                                    Part: {part?.part_number || "N/A"}
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ mt: 2.5, height: 4, bgcolor: "#38bdf8", borderRadius: 999 }} />

                        <Box sx={{ mt: 2.5 }}>
                            <Box sx={{ px: 1.5, py: 1, bgcolor: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 1.5 }}>
                                <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#38bdf8" }}>
                                    2D Drawing
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    mt: 1.5,
                                    border: "1px solid rgba(148,163,184,0.18)",
                                    borderRadius: 1.5,
                                    overflow: "hidden",
                                    height: 420,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    bgcolor: "#0b1220",
                                }}
                            >
                                {part?.drawing_2d_path ? (
                                    isPdfPath(part.drawing_2d_path) ? (
                                        <Box sx={{ p: 1.5, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <PdfPreview
                                                url={getInlineFileUrl(part.drawing_2d_path)}
                                                style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                                            />
                                        </Box>
                                    ) : (
                                        <img
                                            src={getInlineFileUrl(part.drawing_2d_path)}
                                            alt="2D Drawing"
                                            style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                                        />
                                    )
                                ) : (
                                    <Typography variant="body2" sx={{ color: "rgba(229,231,235,0.75)" }}>
                                        No 2D drawing uploaded.
                                    </Typography>
                                )}
                            </Box>
                        </Box>

                        <Box sx={{ mt: 2.5 }}>
                            <Box sx={{ px: 1.5, py: 1, bgcolor: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 1.5 }}>
                                <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#38bdf8" }}>
                                    Operation Totals
                                </Typography>
                            </Box>
                            <TableContainer sx={{ mt: 1.5, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 1.5, overflow: "hidden" }}>
                                <Table size="small" sx={{ "& th, & td": { borderColor: "rgba(148,163,184,0.18)", color: "rgba(229,231,235,0.9)" } }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: "rgba(56,189,248,0.14)" }}>
                                            <TableCell sx={{ fontWeight: 900, color: "#38bdf8" }}>Operation</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 900, color: "#38bdf8" }}>Total (with Misc)</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {operationSummaryRows.map((r) => (
                                            <TableRow key={`op-total-${r.idx}`}>
                                                <TableCell sx={{ fontWeight: 800, color: "#e5e7eb" }}>{r.label}</TableCell>
                                                <TableCell align="right">{formatValue("total_cost", r.value)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>

                        {/* Global Miscellaneous Section in PDF */}
                        {partMiscTotal > 0 && (
                            <Box sx={{ mt: 2.5 }}>
                                <Box sx={{ px: 1.5, py: 1, bgcolor: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 1.5 }}>
                                    <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#38bdf8" }}>
                                        Global Miscellaneous Costs
                                    </Typography>
                                </Box>
                                <TableContainer sx={{ mt: 1.5, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 1.5, overflow: "hidden" }}>
                                    <Table size="small" sx={{ "& th, & td": { borderColor: "rgba(148,163,184,0.18)", color: "rgba(229,231,235,0.9)" } }}>
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: "rgba(56,189,248,0.10)" }}>
                                                <TableCell sx={{ fontWeight: 900, color: "#38bdf8" }}>Description</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900, color: "#38bdf8" }}>Amount</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {partMiscItems
                                                .filter((item) => String(item?.description || "").trim() || Number(item?.amount) > 0)
                                                .map((item, idx) => (
                                                    <TableRow key={`pdf-misc-${idx}`}>
                                                        <TableCell sx={{ color: "#e5e7eb" }}>
                                                            {String(item?.description || "").trim() || "Miscellaneous"}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {formatValue("miscellaneous_amount", Number(item?.amount) || 0)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            <TableRow sx={{ bgcolor: "rgba(56,189,248,0.06)" }}>
                                                <TableCell sx={{ fontWeight: 900, color: "#38bdf8" }}>Miscellaneous Total</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900, color: "#38bdf8" }}>
                                                    {formatValue("miscellaneous_amount", partMiscTotal)}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        )}

                        <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end" }}>
                            <Box sx={{ minWidth: 320, border: "1px solid rgba(56,189,248,0.35)", borderRadius: 1.5, overflow: "hidden" }}>
                                <Box sx={{ px: 1.5, py: 1, bgcolor: "rgba(56,189,248,0.14)" }}>
                                    <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#38bdf8" }}>
                                        Final Total
                                    </Typography>
                                </Box>
                                <Box sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <Typography variant="body2" fontWeight={800} sx={{ color: "rgba(229,231,235,0.75)" }}>
                                        Total (with Misc)
                                    </Typography>
                                    <Typography variant="h6" fontWeight={900} sx={{ color: "#38bdf8" }}>{formatValue("total_cost", operationSummaryTotal)}</Typography>
                                </Box>
                            </Box>
                        </Box>

                        {/* PAGE 2+ */}
                        <Box sx={{ mt: 6, borderTop: "2px solid rgba(56,189,248,0.35)", pt: 3 }}>
                            <Box sx={{ px: 1.5, py: 1, bgcolor: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 1.5 }}>
                                <Typography variant="subtitle1" fontWeight={900} sx={{ color: "#38bdf8" }}>
                                    All Calculated Metrics
                                </Typography>
                            </Box>

                            {(() => {
                                const rawOps = Array.isArray(operationResults) ? operationResults : [];

                                const opsWithData = rawOps
                                    .map((opRes, idx) => {
                                        if (!opRes) return null;

                                        const opType = String(operations?.[idx]?.operation_type || opRes?.inputs?.operation_type || "").trim();
                                        const opLabel = opType
                                            ? opType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                                            : `Operation ${idx + 1}`;

                                        const rows = [...flattenForReport(opRes?.inputs), ...flattenForReport(opRes?.cost_breakdown)];
                                        const map = new Map();
                                        rows.forEach((r) => {
                                            if (!r?.key) return;
                                            map.set(String(r.key), r.value);
                                        });
                                        if (map.size === 0) return null;

                                        return {
                                            idx,
                                            label: `Op ${idx + 1}`,
                                            opLabel,
                                            map,
                                        };
                                    })
                                    .filter(Boolean);

                                if (opsWithData.length === 0) return null;

                                const metricKeys = Array.from(
                                    opsWithData.reduce((acc, op) => {
                                        op.map.forEach((_, k) => acc.add(k));
                                        return acc;
                                    }, new Set())
                                ).sort((a, b) => String(a).localeCompare(String(b)));

                                return (
                                    <TableContainer sx={{ mt: 2.5, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 1.5, overflow: "hidden" }}>
                                        <Table size="small" sx={{ "& th, & td": { borderColor: "rgba(148,163,184,0.18)", color: "rgba(229,231,235,0.9)" } }}>
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: "rgba(56,189,248,0.14)" }}>
                                                    <TableCell sx={{ fontWeight: 900, color: "#38bdf8" }}>Metric</TableCell>
                                                    {opsWithData.map((op) => (
                                                        <TableCell key={`metric-h-${op.idx}`} sx={{ fontWeight: 900, color: "#38bdf8" }} align="right">
                                                            {op.label}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {metricKeys.map((k) => (
                                                    <TableRow key={`metric-row-${k}`}>
                                                        <TableCell sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
                                                            {String(k).replace(/_/g, " ")}
                                                        </TableCell>
                                                        {opsWithData.map((op) => (
                                                            <TableCell key={`metric-${k}-${op.idx}`} align="right">
                                                                {op.map.get(k) == null ? "-" : String(op.map.get(k))}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                );
                            })()}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ bgcolor: "transparent", px: 0, pb: 0, pt: 2, justifyContent: "space-between" }}>
                    <Button onClick={() => setPdfPreviewOpen(false)} sx={{ textTransform: "none", fontWeight: 800, color: "#e5e7eb" }}>
                        Close
                    </Button>
                    <Button
                        onClick={handleDownloadPdf}
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        sx={{ textTransform: "none", fontWeight: 900, bgcolor: "#38bdf8", "&:hover": { bgcolor: "#0ea5e9" } }}
                    >
                        Download PDF
                    </Button>
                </DialogActions>
            </Dialog>

            {/* New Professional PDF Export Component */}
            <PdfReportExport
                open={pdfExportOpen}
                onClose={() => setPdfExportOpen(false)}
                projectData={projectData}
                part={part}
                operations={operations}
                operationResults={operationResults}
                drawingPath={part?.drawing_2d_path}
                getInlineFileUrl={getInlineFileUrl}
                isPdfPath={isPdfPath}
                PdfPreview={PdfPreview}
                partMiscItems={partMiscItems}
                partMiscTotal={partMiscTotal}
            />
        </Dialog>
    );
}

export default CostEstimationModal;
