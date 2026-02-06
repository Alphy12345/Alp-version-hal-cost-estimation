import React, { useState, useEffect, useMemo, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Skeleton, Box, Button, Typography } from "@mui/material";

// Set worker source once
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

const PdfPreview = ({ url, alt, className, style }) => {
    const [dataUrl, setDataUrl] = useState("");
    const [failed, setFailed] = useState(false);
    const [loading, setLoading] = useState(true);

    const lastRenderKeyRef = useRef("");
    const renderTaskRef = useRef(null);
    const debounceTimerRef = useRef(0);

    const containerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;

        const el = containerRef.current;
        let rafId = 0;
        const ro = new ResizeObserver((entries) => {
            const w = entries?.[0]?.contentRect?.width;
            if (!Number.isFinite(w)) return;

            const next = Math.max(0, Math.floor(w));
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                setContainerWidth((prev) => {
                    // Avoid resize/render feedback loops: ignore tiny 1px oscillations.
                    if (Math.abs((prev || 0) - next) < 2) return prev;
                    return next;
                });
            });
        });

        ro.observe(el);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            ro.disconnect();
        };
    }, []);

    const styleWidth = useMemo(() => {
        const w = style && typeof style === "object" ? Number(style?.width) : 0;
        return Number.isFinite(w) ? w : 0;
    }, [style?.width]);

    const effectiveWidth = useMemo(() => {
        if (Number.isFinite(containerWidth) && containerWidth > 0) return containerWidth;
        return styleWidth;
    }, [containerWidth, styleWidth]);

    useEffect(() => {
        let cancelled = false;
        let activeKey = "";

        const render = async () => {
            try {
                setFailed(false);
                setLoading(true);

                if (!url) {
                    setFailed(true);
                    setLoading(false);
                    return;
                }

                if (renderTaskRef.current && typeof renderTaskRef.current.cancel === "function") {
                    try {
                        renderTaskRef.current.cancel();
                    } catch {
                        // ignore
                    }
                }

                const loadingTask = pdfjsLib.getDocument({ url });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);

                const baseViewport = page.getViewport({ scale: 1 });
                const targetWidth = Number.isFinite(effectiveWidth) && effectiveWidth > 0 ? effectiveWidth : baseViewport.width;
                const scale = Math.max(0.5, Math.min(3, targetWidth / baseViewport.width));
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);

                if (!context) {
                    throw new Error("Canvas context not available");
                }

                const task = page.render({ canvasContext: context, viewport });
                renderTaskRef.current = task;
                await task.promise;

                const imgData = canvas.toDataURL("image/png");
                if (!cancelled) {
                    setDataUrl(imgData);
                    setLoading(false);
                }
            } catch (e) {
                const name = e && typeof e === "object" ? e.name : "";
                const msg = e && typeof e === "object" ? String(e.message || "") : "";
                const isCancelledRender = name === "RenderingCancelledException" || msg.toLowerCase().includes("rendering cancelled");
                if (isCancelledRender) {
                    // Ignore: a new render (or unmount) cancelled this one.
                    return;
                }

                if (!cancelled) {
                    console.error("PDF Preview Error:", e);
                    setFailed(true);
                    setLoading(false);
                }
            }
        };

        const widthBucket = Number.isFinite(effectiveWidth) && effectiveWidth > 0 ? Math.round(effectiveWidth) : 0;
        const key = `${url || ""}::${widthBucket}`;
        // Only skip if we've already successfully rendered this key (i.e., we have an image).
        if (key === lastRenderKeyRef.current && dataUrl) return;
        lastRenderKeyRef.current = key;
        activeKey = key;

        if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = window.setTimeout(() => {
            if (!cancelled) render();
        }, 200);
        return () => {
            cancelled = true;
            if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = 0;
            // If we unmount/cancel before an image was produced, don't lock-out future renders.
            if (activeKey && activeKey === lastRenderKeyRef.current && !dataUrl) {
                lastRenderKeyRef.current = "";
            }
            if (renderTaskRef.current && typeof renderTaskRef.current.cancel === "function") {
                try {
                    renderTaskRef.current.cancel();
                } catch {
                    // ignore
                }
            }
        };
    }, [url, effectiveWidth, dataUrl]);

    if (failed) {
        return (
            <Box sx={{ textAlign: "center", py: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Preview not available
                </Typography>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => window.open(url, "_blank")}
                    sx={{ borderColor: "rgba(56,189,248,0.35)", color: "primary.main" }}
                >
                    Open PDF
                </Button>
            </Box>
        );
    }

    if (loading && !dataUrl) {
        return (
            <Box ref={containerRef} className={className} sx={{ width: "100%", ...style }}>
                <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 1 }} />
            </Box>
        );
    }

    return (
        <Box ref={containerRef} className={className} sx={{ width: "100%", ...style }}>
            <Box
                component="img"
                src={dataUrl}
                alt={alt}
                sx={{ width: "100%", height: "auto", display: "block", opacity: loading ? 0.98 : 1 }}
            />
        </Box>
    );
};

export default PdfPreview;
