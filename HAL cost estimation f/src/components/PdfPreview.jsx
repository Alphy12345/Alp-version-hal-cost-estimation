import React, { useState, useEffect } from "react";
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

    useEffect(() => {
        let cancelled = false;

        const render = async () => {
            try {
                setFailed(false);
                setLoading(true);
                setDataUrl("");

                if (!url) {
                    setFailed(true);
                    setLoading(false);
                    return;
                }

                const loadingTask = pdfjsLib.getDocument({ url });
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);

                if (!context) {
                    throw new Error("Canvas context not available");
                }

                await page.render({ canvasContext: context, viewport }).promise;

                const imgData = canvas.toDataURL("image/png");
                if (!cancelled) {
                    setDataUrl(imgData);
                    setLoading(false);
                }
            } catch (e) {
                if (!cancelled) {
                    console.error("PDF Preview Error:", e);
                    setFailed(true);
                    setLoading(false);
                }
            }
        };

        render();
        return () => {
            cancelled = true;
        };
    }, [url]);

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

    if (loading) {
        return (
            <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 1 }} />
        );
    }

    return (
        <Box
            component="img"
            src={dataUrl}
            alt={alt}
            className={className}
            sx={{ ...style, maxWidth: "100%", height: "auto" }}
        />
    );
};

export default PdfPreview;
