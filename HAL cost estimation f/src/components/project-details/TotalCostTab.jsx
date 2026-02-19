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
                sx={{ bgcolor: "rgba(2,6,23,0.55)", borderColor: "rgba(148,163,184,0.25)", borderRadius: 2 }}
            >
                <CardHeader
                    title="Total Cost"
                    subheader="Project-level totals based on calculated part estimations"
                    sx={{ bgcolor: "rgba(15,23,42,0.75)", borderBottom: 1, borderColor: "rgba(148,163,184,0.25)" }}
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
            sx={{ bgcolor: "rgba(2,6,23,0.55)", borderColor: "rgba(148,163,184,0.25)", borderRadius: 2 }}
        >
            <CardHeader
                title="Total Cost"
                subheader="Project-level totals based on calculated part estimations"
                sx={{ bgcolor: "rgba(15,23,42,0.75)", borderBottom: 1, borderColor: "rgba(148,163,184,0.25)" }}
            />
            <CardContent sx={{ p: 4 }}>
                <Stack spacing={4}>
                    {/* Summary Cards */}
                    <Paper
                        variant="outlined"
                        sx={{ bgcolor: "rgba(15,23,42,0.65)", borderColor: "rgba(148,163,184,0.25)", borderRadius: 2 }}
                    >
                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={4}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "text.primary" }}>
                                        Project Summary
                                    </Typography>
                                    <Stack spacing={1}>
                                        <Typography variant="body2"><Box component="span" fontWeight={500}>Total Parts:</Box> {partCount}</Typography>
                                        <Typography variant="body2"><Box component="span" fontWeight={500}>Total Operations:</Box> {opCount}</Typography>
                                        <Typography variant="body2"><Box component="span" fontWeight={500}>Total Man Hours:</Box> {totalCosts.man_hours_total.toFixed(2)}</Typography>
                                        <Typography variant="body2"><Box component="span" fontWeight={500}>Avg Machine Hour Rate:</Box> {formatValue("machine_hour_rate", totalCosts.machine_hour_rate / partCount)}</Typography>
                                        <Typography variant="body2"><Box component="span" fontWeight={500}>Avg Wage Rate:</Box> {formatValue("wage_rate", totalCosts.wage_rate / partCount)}</Typography>
                                    </Stack>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: "text.primary" }}>
                                        Total Project Cost
                                    </Typography>
                                    <Stack spacing={1}>
                                        <Typography variant="body2"><Box component="span" fontWeight={500}>Total Basic Cost:</Box> {formatValue("basic_cost", totalCosts.basic_cost)}</Typography>
                                        <Typography variant="body2"><Box component="span" fontWeight={500}>Total Overheads:</Box> {formatValue("overheads", totalCosts.overheads)}</Typography>
                                        <Typography variant="body2"><Box component="span" fontWeight={500}>Total Profit:</Box> {formatValue("profit", totalCosts.profit)}</Typography>

                                        <Divider sx={{ my: 1 }} />

                                        <Typography variant="h6" color="success.main" fontSize="1.1rem">
                                            <Box component="span" fontWeight={600} color="text.primary">Total Project Cost:</Box> {formatValue("total_cost", totalCosts.unit_cost)}
                                        </Typography>
                                        <Typography variant="body1" color="primary" fontWeight={600}>
                                            <Box component="span" color="text.secondary" fontWeight={400}>Total with Miscellaneous:</Box> {formatValue("total_cost", totalCosts.total_unit_cost_with_misc)}
                                        </Typography>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Box>
                    </Paper>

                    {/* Breakdown Table */}
                    <Box>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Total Cost Breakdown
                        </Typography>
                        <TableContainer
                            component={Paper}
                            variant="outlined"
                            sx={{ bgcolor: "rgba(15,23,42,0.65)", borderColor: "rgba(148,163,184,0.25)", borderRadius: 2 }}
                        >
                            <Table size="small" sx={{ "& th, & td": { borderColor: "rgba(148,163,184,0.18)" } }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: "rgba(30,41,59,0.85)" }}>
                                        <TableCell>Cost Component</TableCell>
                                        <TableCell>Total Value</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>Total Man Hours</TableCell>
                                        <TableCell>{totalCosts.man_hours_total.toFixed(2)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "rgba(30,41,59,0.45)" }}>
                                        <TableCell>Machine Hour Rate (Avg)</TableCell>
                                        <TableCell>{formatValue("machine_hour_rate", totalCosts.machine_hour_rate / partCount)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Wage Rate (Avg)</TableCell>
                                        <TableCell>{formatValue("wage_rate", totalCosts.wage_rate / partCount)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "rgba(30,41,59,0.45)" }}>
                                        <TableCell>Total Basic Cost</TableCell>
                                        <TableCell fontWeight="bold">{formatValue("basic_cost", totalCosts.basic_cost)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Total Overheads</TableCell>
                                        <TableCell fontWeight="bold">{formatValue("overheads", totalCosts.overheads)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "rgba(30,41,59,0.45)" }}>
                                        <TableCell>Total Profit</TableCell>
                                        <TableCell fontWeight="bold">{formatValue("profit", totalCosts.profit)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Total Packing & Forwarding</TableCell>
                                        <TableCell fontWeight="bold">{formatValue("packing", totalCosts.packing_forwarding)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "rgba(30,41,59,0.45)" }}>
                                        <TableCell>Total Miscellaneous</TableCell>
                                        <TableCell fontWeight="bold">{formatValue("miscellaneous_amount", totalCosts.miscellaneous_amount)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Total Project Cost</TableCell>
                                        <TableCell fontWeight="bold">{formatValue("total_cost", totalCosts.unit_cost)}</TableCell>
                                    </TableRow>
                                    <TableRow sx={{ bgcolor: "rgba(34,197,94,0.15)" }}>
                                        <TableCell sx={{ fontWeight: "bold" }}>Total Project Cost with Misc</TableCell>
                                        <TableCell sx={{ fontWeight: "bold", color: "success.main", fontSize: "1.05rem" }}>{formatValue("total_cost", totalCosts.total_unit_cost_with_misc)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>

                    <Box>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Individual Parts
                        </Typography>
                        <TableContainer
                            component={Paper}
                            variant="outlined"
                            sx={{ bgcolor: "rgba(15,23,42,0.65)", borderColor: "rgba(148,163,184,0.25)", borderRadius: 2 }}
                        >
                            <Table size="small" sx={{ "& th, & td": { borderColor: "rgba(148,163,184,0.18)" } }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: "rgba(30,41,59,0.85)" }}>
                                        <TableCell>Part</TableCell>
                                        <TableCell>Part Name</TableCell>
                                        <TableCell align="right">Operations</TableCell>
                                        <TableCell align="right">Final Unit Cost (with Misc)</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {partSummaries.map((s, idx) => (
                                        <TableRow key={s.partId} sx={idx % 2 === 0 ? { bgcolor: "rgba(30,41,59,0.45)" } : undefined}>
                                            <TableCell>{s.part?.part_number || "Unknown Part"}</TableCell>
                                            <TableCell>{s.part?.part_name || "—"}</TableCell>
                                            <TableCell align="right">{Array.isArray(s.operations) ? s.operations.length : 0}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, color: "#38bdf8" }}>
                                                {formatValue("total_cost", s.combined_total_unit_cost_with_misc)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow sx={{ bgcolor: "rgba(34,197,94,0.12)" }}>
                                        <TableCell colSpan={2} sx={{ fontWeight: 800 }}>TOTAL</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 800 }}>{opCount}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 800, color: "success.main" }}>
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
