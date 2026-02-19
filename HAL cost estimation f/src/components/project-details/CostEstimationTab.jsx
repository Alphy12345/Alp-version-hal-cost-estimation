import React, { useState } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Divider,
    Stack,
    Typography,
    Alert
} from "@mui/material";
import CalculateIcon from "@mui/icons-material/Calculate";
import DrawingsSection from "./DrawingsSection";
import CostEstimationModal from "./CostEstimationModal";

function CostEstimationTab({
    parts,
    costResults,
    costForms,
    onChangeForm,
    onSetActiveOperation,
    onAddOperation,
    onRemoveOperation,
    setCostResults, // passed to clear local state inside modal logic if needed? no, clear logic is in parent
    onClearCost, // New prop
    onSubmitCost, // New prop
    onSubmitAllCost,
    onViewFile,
    machines,
    operationTypes,
    projectData,
    getInlineFileUrl,
    isPdfPath,
    formatValue,
    costLoading,
    costError,
    setCostError, // to clear error on open
    PdfPreview
}) {
    const [activeCostPartId, setActiveCostPartId] = useState(null);
    const [drawingZoom, setDrawingZoom] = useState(1);

    const activeCostPart = activeCostPartId != null ? parts.find((p) => p.id === activeCostPartId) : null;

    const openCostModal = (partId) => {
        setCostError("");
        setDrawingZoom(1);
        setActiveCostPartId(partId);
    };

    const closeCostModal = () => {
        setActiveCostPartId(null);
    };

    const zoomInDrawing = () => setDrawingZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));
    const zoomOutDrawing = () => setDrawingZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100));
    const resetDrawingZoom = () => setDrawingZoom(1);

    const getActiveOpIndex = (partId) => {
        const idx = costForms?.[partId]?.activeOperationIndex;
        const n = Number(idx);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    };

    return (
        <Stack spacing={4}>
            <Card variant="outlined" sx={{ borderColor: "#E2E8F0", bgcolor: "#FFFFFF" }}>
                <CardHeader
                    title="Project Drawings & Cost Estimation"
                    subheader="View all project drawings and calculate manufacturing costs for each part"
                    sx={{ bgcolor: "#F59E0B", color: "#FFFFFF", borderBottom: 1, borderColor: "#F59E0B", "& .MuiCardHeader-subheader": { color: "#FFFFFF" } }}
                />
                <CardContent sx={{ p: 4 }}>
                    <Stack spacing={4}>
                        {/* Drawings Section */}
                        <DrawingsSection
                            parts={parts}
                            onViewFile={onViewFile}
                            getInlineFileUrl={getInlineFileUrl}
                            isPdfPath={isPdfPath}
                        />

                        <Divider />

                        {/* Cost Estimation List */}
                        <Box>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                Part Cost Estimations
                            </Typography>

                            {parts.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    No parts available for cost estimation.
                                </Typography>
                            ) : (
                                <Stack spacing={2}>
                                    {parts.map(part => (
                                        <Card key={part.id} variant="outlined" sx={{ borderLeft: "4px solid #F59E0B", bgcolor: "#FFFBEB", borderColor: "#FCD34D" }}>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    bgcolor: "#FFFBEB",
                                                }}
                                            >
                                                <Box>
                                                    <Typography variant="subtitle2" sx={{ color: "#0F172A", fontWeight: 600 }}>{part.part_number}</Typography>
                                                    <Typography variant="caption" sx={{ color: "#64748B" }}>{part.part_name}</Typography>
                                                </Box>

                                                <Stack direction="row" spacing={3} alignItems="center">
                                                    {costResults[part.id] && (
                                                        <Box sx={{ textAlign: "right" }}>
                                                            <Typography variant="caption" display="block" sx={{ color: "#64748B" }}>Unit Cost (with Misc)</Typography>
                                                            <Typography variant="body1" fontWeight="bold" sx={{ color: "#10B981" }}>
                                                                {formatValue(
                                                                    "total_cost",
                                                                    costResults[part.id]?.combined_total_unit_cost_with_misc ?? costResults[part.id]?.cost_breakdown?.total_unit_cost_with_misc
                                                                )}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    <Button
                                                        variant="contained"
                                                        startIcon={<CalculateIcon />}
                                                        onClick={() => openCostModal(part.id)}
                                                        sx={{
                                                            bgcolor: "#6366F1",
                                                            "&:hover": { bgcolor: "#4F46E5" },
                                                            textTransform: "none",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        Calculate Cost
                                                    </Button>
                                                </Stack>
                                            </Box>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </Box>

                        {costError && (
                            <Alert severity="error">
                                {typeof costError === 'object' ? JSON.stringify(costError) : costError}
                            </Alert>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {/* Modal */}
            {activeCostPart && (
                <CostEstimationModal
                    isOpen={!!activeCostPartId}
                    onClose={closeCostModal}
                    projectData={projectData}
                    part={activeCostPart}
                    activeOperationIndex={getActiveOpIndex(activeCostPartId)}
                    operations={costForms?.[activeCostPartId]?.operations || []}
                    costForms={costForms}
                    onSetActiveOperation={onSetActiveOperation}
                    onAddOperation={onAddOperation}
                    onRemoveOperation={onRemoveOperation}
                    costResult={costResults?.[activeCostPartId]?.operations?.[getActiveOpIndex(activeCostPartId)]}
                    operationResults={costResults?.[activeCostPartId]?.operations}
                    combinedTotal={costResults?.[activeCostPartId]?.combined_total_unit_cost_with_misc}
                    formState={costForms?.[activeCostPartId]?.operations?.[getActiveOpIndex(activeCostPartId)] || {}}
                    onChangeForm={onChangeForm}
                    onSubmit={onSubmitCost}
                    onSubmitAll={onSubmitAllCost}
                    onClear={onClearCost}
                    loading={costLoading}
                    machines={machines}
                    operationTypes={operationTypes}
                    drawingZoom={drawingZoom}
                    onZoomIn={zoomInDrawing}
                    onZoomOut={zoomOutDrawing}
                    onResetZoom={resetDrawingZoom}
                    getInlineFileUrl={getInlineFileUrl}
                    isPdfPath={isPdfPath}
                    PdfPreview={PdfPreview}
                    formatValue={formatValue}
                />
            )}
        </Stack>
    );
}

export default CostEstimationTab;
