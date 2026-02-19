import React from "react";
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    Divider,
    Grid,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from "@mui/material";

function TotalCostTab({ costResults, parts, formatValue }) {
    const costEntries = costResults && typeof costResults === "object" ? Object.entries(costResults) : [];
    const partSummaries = costEntries
        .map(([partId, value]) => {
            const ops = Array.isArray(value?.operations)
                ? value.operations.filter(Boolean)
                : (value?.cost_breakdown ? [value] : []);

            const combined = Number(value?.combined_total_unit_cost_with_misc);
            const combinedValue = Number.isFinite(combined)
                ? combined
                : ops.reduce((sum, r) => {
                    const n = Number(r?.cost_breakdown?.total_unit_cost_with_misc);
                    return sum + (Number.isFinite(n) ? n : 0);
                }, 0);

            return {
                partId,
                part: (Array.isArray(parts) ? parts : []).find((p) => String(p?.id) === String(partId)) || null,
                operations: ops,
                combined_total_unit_cost_with_misc: combinedValue,
            };
        })
        .filter((x) => (x.operations && x.operations.length > 0) || Number(x.combined_total_unit_cost_with_misc) > 0);

    if (partSummaries.length === 0) {
        return (
            <Card
                variant="outlined"
                sx={{ bgcolor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
            >
                <CardHeader
                    title="Total Cost"
                    subheader="Project-level totals based on calculated part estimations"
                    sx={{ bgcolor: "#F1F5F9", color: "#0F172A", borderBottom: 1, borderColor: "#E2E8F0", "& .MuiCardHeader-subheader": { color: "#64748B" } }}
                />
                <CardContent sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                        Calculate at least one part cost to see the total project cost.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    const totalCosts = {
        basic_cost: 0,
        overheads: 0,
        profit: 0,
        packing_forwarding: 0,
        unit_cost: 0,
        total_unit_cost_with_misc: 0,
        miscellaneous_amount: 0,
        machine_hour_rate: 0,
        wage_rate: 0,
        outsourcing_mhr: 0,
        man_hours_total: 0
    };

    partSummaries.forEach((summary) => {
        (summary.operations || []).forEach((result) => {
            const breakdown = result?.cost_breakdown;
            if (!breakdown) return;

            totalCosts.basic_cost += Number(breakdown?.basic_cost_per_unit) || 0;
            totalCosts.overheads += Number(breakdown?.overheads_per_unit) || 0;
            totalCosts.profit += Number(breakdown?.profit_per_unit) || 0;
            totalCosts.packing_forwarding += Number(breakdown?.packing_forwarding_per_unit) || 0;
            totalCosts.unit_cost += Number(breakdown?.unit_cost) || 0;
            totalCosts.total_unit_cost_with_misc += Number(breakdown?.total_unit_cost_with_misc) || 0;
            totalCosts.miscellaneous_amount += Number(breakdown?.miscellaneous_amount) || 0;
            totalCosts.machine_hour_rate += Number(breakdown?.machine_hour_rate) || 0;
            totalCosts.wage_rate += Number(breakdown?.wage_rate) || 0;
            totalCosts.outsourcing_mhr += Number(breakdown?.outsourcing_mhr) || 0;
            totalCosts.man_hours_total += Number(breakdown?.man_hours_per_unit) || 0;
        });
    });

    const partCount = partSummaries.length;
    const opCount = partSummaries.reduce((sum, s) => sum + (Array.isArray(s.operations) ? s.operations.length : 0), 0);

    const partsTotalWithMisc = partSummaries.reduce((sum, s) => sum + (Number(s.combined_total_unit_cost_with_misc) || 0), 0);

    return (
        <Card
            variant="outlined"
            sx={{ bgcolor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
        >
            <CardHeader
                title="Total Cost"
                subheader="Project-level totals based on calculated part estimations"
                sx={{ 
                    bgcolor: "#F59E0B", 
                    color: "#FFFFFF", 
                    borderBottom: 1, 
                    borderColor: "#F59E0B", 
                    "& .MuiCardHeader-subheader": { color: "rgba(255,255,255,0.9)" },
                    "& .MuiCardHeader-title": { color: "#FFFFFF", fontWeight: 700 }
                }}
            />
            <CardContent sx={{ p: 4 }}>
                <Stack spacing={4}>
                    {/* Summary Cards */}
                    <Paper
                        variant="outlined"
                        sx={{ bgcolor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
                    >
                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={4}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "#0F172A" }}>
                                        Project Summary
                                    </Typography>
                                    <Stack spacing={1}>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}><Box component="span" fontWeight={500} sx={{ color: "#64748B" }}>Total Parts:</Box> {partCount}</Typography>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}><Box component="span" fontWeight={500} sx={{ color: "#64748B" }}>Total Operations:</Box> {opCount}</Typography>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}><Box component="span" fontWeight={500} sx={{ color: "#64748B" }}>Total Man Hours:</Box> {totalCosts.man_hours_total.toFixed(2)}</Typography>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}><Box component="span" fontWeight={500} sx={{ color: "#64748B" }}>Avg Machine Hour Rate:</Box> {formatValue("machine_hour_rate", totalCosts.machine_hour_rate / partCount)}</Typography>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}><Box component="span" fontWeight={500} sx={{ color: "#64748B" }}>Avg Wage Rate:</Box> {formatValue("wage_rate", totalCosts.wage_rate / partCount)}</Typography>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "#0F172A" }}>
                                        Total Project Cost
                                    </Typography>
                                    <Stack spacing={1}>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}><Box component="span" fontWeight={500} sx={{ color: "#64748B" }}>Total Basic Cost:</Box> {formatValue("basic_cost", totalCosts.basic_cost)}</Typography>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}><Box component="span" fontWeight={500} sx={{ color: "#64748B" }}>Total Overheads:</Box> {formatValue("overheads", totalCosts.overheads)}</Typography>
                                        <Typography variant="body2" sx={{ color: "#0F172A" }}><Box component="span" fontWeight={500} sx={{ color: "#64748B" }}>Total Profit:</Box> {formatValue("profit", totalCosts.profit)}</Typography>

                                        <Divider sx={{ my: 1, borderColor: "#E2E8F0" }} />

                                        <Typography variant="h6" sx={{ color: "#6366F1", fontSize: "1.1rem", fontWeight: 700 }}>
                                            <Box component="span" fontWeight={600} sx={{ color: "#0F172A" }}>Total Project Cost:</Box> {formatValue("total_cost", totalCosts.unit_cost)}
                                        </Typography>
                                        <Typography variant="body1" sx={{ color: "#6366F1", fontWeight: 600 }}>
                                            <Box component="span" sx={{ color: "#64748B", fontWeight: 400 }}>Total with Miscellaneous:</Box> {formatValue("total_cost", totalCosts.total_unit_cost_with_misc)}
                                        </Typography>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Box>
                    </Paper>

                    {/* Breakdown Table */}
                    <Box>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "#0F172A" }}>
                            Total Cost Breakdown
                        </Typography>
                        <TableContainer
                            component={Paper}
                            variant="outlined"
                            sx={{ bgcolor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: 2 }}
                        >
                            <Table size="small" sx={{ "& th, & td": { borderColor: "#E2E8F0", color: "#0F172A" } }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: "#FCA5A5" }}>
                                        <TableCell sx={{ color: "#7F1D1D", fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>Cost Component</TableCell>
                                        <TableCell sx={{ color: "#7F1D1D", fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>Total Value</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow>
                                        <TableCell sx={{ color: "#0F172A" }}>Total Man Hours</TableCell>
                                        <TableCell sx={{ color: "#0F172A" }}>{totalCosts.man_hours_total.toFixed(2)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                                        <TableCell sx={{ color: "#0F172A" }}>Machine Hour Rate (Avg)</TableCell>
                                        <TableCell sx={{ color: "#0F172A" }}>{formatValue("machine_hour_rate", totalCosts.machine_hour_rate / partCount)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ color: "#0F172A" }}>Wage Rate (Avg)</TableCell>
                                        <TableCell sx={{ color: "#0F172A" }}>{formatValue("wage_rate", totalCosts.wage_rate / partCount)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                                        <TableCell sx={{ color: "#0F172A" }}>Total Basic Cost</TableCell>
                                        <TableCell sx={{ color: "#0F172A", fontWeight: 600 }}>{formatValue("basic_cost", totalCosts.basic_cost)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ color: "#0F172A" }}>Total Overheads</TableCell>
                                        <TableCell sx={{ color: "#0F172A", fontWeight: 600 }}>{formatValue("overheads", totalCosts.overheads)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                                        <TableCell sx={{ color: "#0F172A" }}>Total Profit</TableCell>
                                        <TableCell sx={{ color: "#0F172A", fontWeight: 600 }}>{formatValue("profit", totalCosts.profit)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ color: "#0F172A" }}>Total Packing & Forwarding</TableCell>
                                        <TableCell sx={{ color: "#0F172A", fontWeight: 600 }}>{formatValue("packing", totalCosts.packing_forwarding)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                                        <TableCell sx={{ color: "#0F172A" }}>Total Miscellaneous</TableCell>
                                        <TableCell sx={{ color: "#0F172A", fontWeight: 600 }}>{formatValue("miscellaneous_amount", totalCosts.miscellaneous_amount)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ color: "#0F172A" }}>Total Project Cost</TableCell>
                                        <TableCell sx={{ color: "#0F172A", fontWeight: 600 }}>{formatValue("total_cost", totalCosts.unit_cost)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "#EEF2FF" }}>
                                        <TableCell sx={{ color: "#6366F1", fontWeight: 700 }}>Total Project Cost with Misc</TableCell>
                                        <TableCell sx={{ color: "#6366F1", fontWeight: 700, fontSize: "1.05rem" }}>{formatValue("total_cost", totalCosts.total_unit_cost_with_misc)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>

                    <Box>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "#0F172A" }}>
                            Individual Parts
                        </Typography>
                        <TableContainer
                            component={Paper}
                            variant="outlined"
                            sx={{ bgcolor: "#FFFFFF", borderColor: "#E2E8F0", borderRadius: 2 }}
                        >
                            <Table size="small" sx={{ "& th, & td": { borderColor: "#E2E8F0", color: "#0F172A" } }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: "#FCA5A5" }}>
                                        <TableCell sx={{ color: "#7F1D1D", fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>Part</TableCell>
                                        <TableCell sx={{ color: "#7F1D1D", fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>Part Name</TableCell>
                                        <TableCell align="right" sx={{ color: "#7F1D1D", fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>Operations</TableCell>
                                        <TableCell align="right" sx={{ color: "#7F1D1D", fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem" }}>Final Unit Cost (with Misc)</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {partSummaries.map((s, idx) => (
                                        <TableRow key={s.partId} sx={idx % 2 === 0 ? { bgcolor: "#F8FAFC" } : undefined}>
                                            <TableCell sx={{ color: "#0F172A" }}>{s.part?.part_number || "Unknown Part"}</TableCell>
                                            <TableCell sx={{ color: "#0F172A" }}>{s.part?.part_name || "—"}</TableCell>
                                            <TableCell align="right" sx={{ color: "#0F172A" }}>{Array.isArray(s.operations) ? s.operations.length : 0}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, color: "#6366F1" }}>
                                                {formatValue("total_cost", s.combined_total_unit_cost_with_misc)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell colSpan={2} sx={{ color: "#0F172A", fontWeight: 800 }}>TOTAL</TableCell>
                                        <TableCell align="right" sx={{ color: "#0F172A", fontWeight: 800 }}>{opCount}</TableCell>
                                        <TableCell align="right" sx={{ color: "#0F172A", fontWeight: 800 }}>
                                            {formatValue("total_cost", partsTotalWithMisc)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );
}

export default TotalCostTab;
