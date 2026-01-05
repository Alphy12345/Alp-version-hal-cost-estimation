import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import api from "../api/client";
import { getProject, getProjectParts } from "../api/projects";

function isMoneyFieldKey(key) {
  if (!key) return false;
  if (key.includes("man_hours")) return false;
  return /(cost|rate|profit|overheads|packing|outsourcing)/i.test(key);
}

function formatValue(key, value) {
  if (value == null) return "-";

  if (typeof value === "number" && Number.isFinite(value) && isMoneyFieldKey(key)) {
    const hasDecimals = Math.abs(value - Math.trunc(value)) > Number.EPSILON;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(value);
  }

  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("en-IN");
  return JSON.stringify(value);
}

function getInlineFileUrl(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  if (!normalized) return "";

  const isLocalUploads = normalized.startsWith("uploads/") || normalized.startsWith("uploads");
  const encodedKey = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return isLocalUploads
    ? `http://127.0.0.1:8000/files/uploads/${normalized}?inline=true`
    : `http://127.0.0.1:8000/files/download/${encodedKey}?inline=true`;
}

function isPdfPath(filePath) {
  const value = String(filePath || "").toLowerCase();
  return value.endsWith(".pdf");
}

export default function PartCostEstimationPage({ onChange, projectId, partId }) {
  const [projectData, setProjectData] = useState(null);
  const [part, setPart] = useState(null);
  const [loading, setLoading] = useState(true);

  const [machines, setMachines] = useState([]);
  const [operationTypes, setOperationTypes] = useState([]);

  const [form, setForm] = useState({
    operation_type: "turning",
    diameter: "",
    length: "",
    breadth: "",
    height: "",
    material: "steel",
    machine_name: "",
    man_hours_per_unit: "",
    miscellaneous_amount: "",
  });

  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState("");
  const [costResult, setCostResult] = useState(null);

  const [drawingZoom, setDrawingZoom] = useState(1);
  const pdfAreaRef = useRef(null);
  const drawingViewportRef = useRef(null);
  const drawingContentRef = useRef(null);
  const [drawingPan, setDrawingPan] = useState({ x: 0, y: 0 });
  const drawingPanStateRef = useRef({ isPanning: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const drawingContentSizeRef = useRef({ width: 0, height: 0 });
  const drawingCaptureRef = useRef(null);

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  }, []);

  const PdfPreview = ({ url, alt, className, onLoad }) => {
    const [dataUrl, setDataUrl] = useState("");
    const [failed, setFailed] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      let cancelled = false;
      let loadingTask;
      let timeoutId;

      const render = async () => {
        try {
          setFailed(false);
          setDataUrl("");
          setLoading(true);

          if (!url) {
            setFailed(true);
            return;
          }

          // Large PDFs may hang if the server doesn't support range requests properly.
          // Force a simple full download + add a timeout.
          loadingTask = pdfjsLib.getDocument({
            url,
            disableRange: true,
            disableStream: true,
            disableAutoFetch: true,
          });

          const pdfPromise = loadingTask.promise;
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("PDF preview timeout")), 20000);
          });

          const pdf = await Promise.race([pdfPromise, timeoutPromise]);
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1.0 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          if (!context) throw new Error("Canvas context not available");

          await page.render({ canvasContext: context, viewport }).promise;
          const imgData = canvas.toDataURL("image/png");
          if (!cancelled) setDataUrl(imgData);
        } catch (e) {
          if (!cancelled) setFailed(true);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
          if (!cancelled) setLoading(false);
        }
      };

      render();
      return () => {
        cancelled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (loadingTask?.destroy) {
          try {
            loadingTask.destroy();
          } catch {
            // ignore
          }
        }
      };
    }, [url]);

    if (failed) {
      return (
        <div className="text-xs text-slate-500 space-y-2">
          <div>Preview not available for this drawing.</div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 hover:text-sky-700 underline"
            >
              Open drawing
            </a>
          )}
        </div>
      );
    }
    if (loading && !dataUrl) return <div className="text-xs text-slate-400">Loading preview...</div>;
    return <img src={dataUrl} alt={alt} className={className} onLoad={onLoad} />;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setCostError("");
        setDrawingZoom(1);

        const [proj, parts] = await Promise.all([getProject(projectId), getProjectParts(projectId)]);
        if (cancelled) return;

        setProjectData(proj);
        const found = Array.isArray(parts) ? parts.find((p) => p.id === partId) : null;
        setPart(found || null);

        const [machinesRes, operationTypesRes] = await Promise.all([
          api.get("/machines/"),
          api.get("/operation-type/"),
        ]);

        if (cancelled) return;
        setMachines(Array.isArray(machinesRes.data) ? machinesRes.data : []);
        setOperationTypes(Array.isArray(operationTypesRes.data) ? operationTypesRes.data : []);
      } catch (e) {
        if (!cancelled) setCostError("Failed to load part/cost data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (projectId != null && partId != null) load();

    return () => {
      cancelled = true;
    };
  }, [projectId, partId]);

  const normalize = (value) => {
    if (value == null) return "";
    return String(value).trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
  };

  const filteredMachines = useMemo(() => {
    const opType = normalize(form.operation_type);
    if (!opType) return machines;

    const selectedOp = operationTypes.find((ot) => normalize(ot?.operation_name) === opType);
    const selectedOpId = selectedOp?.id != null ? String(selectedOp.id) : "";

    return machines.filter((m) => {
      const opId = m?.op_id ?? m?.operation_type_id ?? m?.operation_type?.id ?? m?.operation_types?.id;
      return opId == null ? "" : String(opId) === selectedOpId;
    });
  }, [form.operation_type, machines, operationTypes]);

  const clampZoom = (z) => Math.max(0.03, Math.min(10, Math.round(z * 100) / 100));

  const centerDrawing = useCallback(() => {
    const viewport = drawingViewportRef.current;
    const { width: cw, height: ch } = drawingContentSizeRef.current;
    if (!viewport || !cw || !ch) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;

    const x = (vw - cw * drawingZoom) / 2;
    const y = (vh - ch * drawingZoom) / 2;
    setDrawingPan({ x, y });
  }, [drawingZoom]);

  const fitDrawingToScreen = useCallback(() => {
    const viewport = drawingViewportRef.current;
    const { width: cw, height: ch } = drawingContentSizeRef.current;
    if (!viewport || !cw || !ch) return;

    const padding = 24;
    const targetW = Math.max(1, viewport.clientWidth - padding);
    const targetH = Math.max(1, viewport.clientHeight - padding);
    const scale = Math.min(targetW / cw, targetH / ch);
    const nextZoom = clampZoom(scale);
    setDrawingZoom(nextZoom);

    const x = (viewport.clientWidth - cw * nextZoom) / 2;
    const y = (viewport.clientHeight - ch * nextZoom) / 2;
    setDrawingPan({ x, y });
  }, []);

  const zoomBy = useCallback(
    (delta, anchorClientX, anchorClientY) => {
      const viewport = drawingViewportRef.current;
      const { width: cw, height: ch } = drawingContentSizeRef.current;
      const prevZoom = drawingZoom;
      const nextZoom = clampZoom(prevZoom + delta);
      if (nextZoom === prevZoom) return;

      // If the drawing size isn't known yet (or viewport not ready), still allow zooming.
      // We'll keep pan as-is and the next fit/center will correct positioning.
      if (!viewport || !cw || !ch) {
        setDrawingZoom(nextZoom);
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const ax = (anchorClientX ?? rect.left + rect.width / 2) - rect.left;
      const ay = (anchorClientY ?? rect.top + rect.height / 2) - rect.top;

      const contentX = (ax - drawingPan.x) / prevZoom;
      const contentY = (ay - drawingPan.y) / prevZoom;

      const nextPanX = ax - contentX * nextZoom;
      const nextPanY = ay - contentY * nextZoom;

      setDrawingZoom(nextZoom);
      setDrawingPan({ x: nextPanX, y: nextPanY });
    },
    [drawingPan.x, drawingPan.y, drawingZoom]
  );

  const zoomInDrawing = () => zoomBy(0.1);
  const zoomOutDrawing = () => zoomBy(-0.1);
  const resetDrawingZoom = () => {
    setDrawingZoom(1);
    centerDrawing();
  };

  const handleDrawingMouseDown = (e) => {
    const viewport = drawingViewportRef.current;
    if (!viewport) return;
    if (e.button !== 0) return;

    drawingPanStateRef.current = {
      isPanning: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: drawingPan.x,
      startPanY: drawingPan.y,
    };

    viewport.style.cursor = "grabbing";
    viewport.style.userSelect = "none";
  };

  const handleDrawingMouseMove = (e) => {
    const viewport = drawingViewportRef.current;
    if (!viewport) return;

    const state = drawingPanStateRef.current;
    if (!state.isPanning) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    setDrawingPan({ x: state.startPanX + dx, y: state.startPanY + dy });
  };

  const stopDrawingPan = () => {
    const viewport = drawingViewportRef.current;
    if (viewport) {
      viewport.style.cursor = "grab";
      viewport.style.userSelect = "auto";
    }
    drawingPanStateRef.current.isPanning = false;
  };

  const handleDrawingWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomBy(delta, e.clientX, e.clientY);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCostLoading(true);
    setCostError("");

    try {
      const opType = String(form.operation_type || "").toLowerCase();
      const length = Number(form.length);
      const diameter = Number(form.diameter);
      const breadth = Number(form.breadth);
      const height = Number(form.height);
      const manHours = Number(form.man_hours_per_unit);

      if (!opType || !Number.isFinite(length) || length <= 0 || !Number.isFinite(manHours) || manHours < 0) {
        setCostError("Please fill in all required fields with valid values");
        return;
      }

      if (opType === "turning" && (!Number.isFinite(diameter) || diameter <= 0)) {
        setCostError("Diameter must be a positive number for turning operation");
        return;
      }

      if (opType === "milling" && (!Number.isFinite(breadth) || breadth <= 0 || !Number.isFinite(height) || height <= 0)) {
        setCostError("Breadth and height must be positive numbers for milling operation");
        return;
      }

      const dimensions = { length };
      if (opType === "turning") dimensions.diameter = diameter;
      if (opType === "milling") {
        dimensions.breadth = breadth;
        dimensions.height = height;
      }

      const payload = {
        dimensions,
        material: String(form.material || ""),
        operation_type: opType,
        machine_name: String(form.machine_name || ""),
        man_hours_per_unit: manHours,
        miscellaneous_amount: Number(form.miscellaneous_amount || 0),
      };

      const res = await api.post("/cost-estimation/calculate", payload);
      setCostResult(res.data);
    } catch (err) {
      const serverMessage = err?.response?.data?.detail || err?.message || "Failed to calculate cost";
      setCostError(String(serverMessage));
    } finally {
      setCostLoading(false);
    }
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!projectData || !part) return;

    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const contentW = pageWidth - margin * 2;
    const brand = {
      navy: [15, 23, 42],
      slate: [100, 116, 139],
      border: [226, 232, 240],
      mutedBg: [248, 250, 252],
      tableHead: [241, 245, 249],
      zebra: [248, 250, 252],
      accent: [16, 185, 129],
    };

    let y = margin;

    const safeProject = String(projectData?.project_name || "Project").replace(/[^a-z0-9-_ ]/gi, "").trim() || "Project";
    const safePart = String(part?.part_number || "Part").replace(/[^a-z0-9-_ ]/gi, "").trim() || "Part";

    let pageIndex = 1;
    const addFooter = () => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...brand.slate);
      pdf.text(`Page ${pageIndex}`, pageWidth - margin, pageHeight - 18, { align: "right" });
    };

    const addPage = () => {
      addFooter();
      pdf.addPage();
      pageIndex += 1;
      y = margin;
    };

    const ensureSpace = (needed) => {
      if (y + needed <= pageHeight - margin) return;
      addPage();
    };

    const pdfMoney = (value) => {
      if (value == null || value === "-") return "-";
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      const hasDecimals = Math.abs(n - Math.trunc(n)) > Number.EPSILON;
      const formatted = new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: hasDecimals ? 2 : 0,
      }).format(n);
      return `INR ${formatted}`;
    };

    const pdfValue = (key, value) => {
      if (value == null) return "-";
      if (typeof value === "number" && Number.isFinite(value) && isMoneyFieldKey(key)) return pdfMoney(value);
      if (typeof value === "string") {
        if (isMoneyFieldKey(key)) {
          const n = Number(String(value).replace(/[, ]/g, ""));
          if (Number.isFinite(n)) return pdfMoney(n);
        }
        return value;
      }
      if (typeof value === "number" && Number.isFinite(value)) return new Intl.NumberFormat("en-IN").format(value);
      return String(value);
    };

    const drawSectionTitle = (title) => {
      ensureSpace(26);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.text(String(title), margin, y);
      y += 14;
      pdf.setDrawColor(...brand.border);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 12;
    };

    const drawInfoRow = (label, value, x, yPos, w) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text(String(label), x, yPos);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 41, 59);
      const v = String(value ?? "-");
      const lines = pdf.splitTextToSize(v, w - 90);
      pdf.text(lines, x + 80, yPos);
    };

    // Top header band
    pdf.setFillColor(...brand.navy);
    pdf.rect(0, 0, pageWidth, 92, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    {
      const projectLine = `Project: ${String(projectData?.project_name || "Project")}`;
      const projectLines = pdf.splitTextToSize(projectLine, contentW);
      pdf.text(projectLines, margin, 34);
    }
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    {
      const partLine = `Part: ${String(part?.part_name || part?.part_number || "Part")}`;
      const partLines = pdf.splitTextToSize(partLine, contentW);
      pdf.text(partLines, margin, 58);
    }
    pdf.setFontSize(10);
    pdf.setTextColor(226, 232, 240);
    pdf.text("Cost Estimation Report", margin, 74);

    y = 110;
    pdf.setTextColor(15, 23, 42);

    // Info card
    ensureSpace(86);
    pdf.setFillColor(...brand.mutedBg);
    pdf.setDrawColor(...brand.border);
    pdf.roundedRect(margin, y, contentW, 76, 8, 8, "FD");
    const cardX = margin + 14;
    const cardY = y + 22;
    const halfW = (contentW - 28) / 2;
    drawInfoRow("Part No", part?.part_number, cardX, cardY, halfW);
    drawInfoRow("PO/Ref", projectData?.po_reference_number, cardX + halfW, cardY, halfW);
    drawInfoRow("Customer", projectData?.customer_name, cardX, cardY + 22, halfW);
    drawInfoRow("Date", projectData?.project_date, cardX + halfW, cardY + 22, halfW);
    y += 96;

    // Drawing image
    const captureEl = drawingCaptureRef.current;
    if (captureEl) {
      drawSectionTitle("2D Drawing");

      const canvas = await html2canvas(captureEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const imgMaxW = contentW;
      const imgMaxH = 320;
      const imgW = imgMaxW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const drawH = Math.min(imgH, imgMaxH);
      const drawW = (imgW * drawH) / imgH;
      const x = margin + (imgMaxW - drawW) / 2;

      // Frame
      pdf.setDrawColor(...brand.border);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(margin, y, contentW, drawH + 16, 10, 10, "FD");
      pdf.addImage(imgData, "PNG", x, y + 8, drawW, drawH);
      y += drawH + 28;
    }

    // Cost breakdown
    drawSectionTitle("Cost Breakdown");

    const breakdown = costResult?.cost_breakdown || {};

    const rows = [
      ["Man Hours per Unit", breakdown.man_hours_per_unit ?? "-", false],
      ["Machine Hour Rate", pdfValue("machine_hour_rate", breakdown.machine_hour_rate), true],
      ["Wage Rate", pdfValue("wage_rate", breakdown.wage_rate), true],
      ["Basic Cost", pdfValue("basic_cost", breakdown.basic_cost_per_unit), true],
      ["Overheads", pdfValue("overheads", breakdown.overheads_per_unit), true],
      ["Profit (10%)", pdfValue("profit", breakdown.profit_per_unit), true],
      ["Packing & Forwarding (2%)", pdfValue("packing", breakdown.packing_forwarding_per_unit), true],
      ["Miscellaneous Amount", pdfValue("miscellaneous_amount", breakdown.miscellaneous_amount), true],
      ["Total Unit Cost", pdfValue("total_cost", breakdown.unit_cost), true],
    ];

    const tableW = contentW;
    const col1W = tableW * 0.64;
    const col2W = tableW - col1W;
    const rowH = 24;

    const drawHeaderRow = () => {
      ensureSpace(rowH + 10);
      pdf.setFillColor(...brand.tableHead);
      pdf.setDrawColor(...brand.border);
      pdf.rect(margin, y, tableW, rowH, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text("Component", margin + 10, y + 16);
      pdf.text("Value", margin + col1W + col2W - 10, y + 16, { align: "right" });
      y += rowH;
    };

    let zebraIndex = 0;
    const drawRow = (label, value) => {
      if (y + rowH > pageHeight - margin) {
        addPage();
        drawSectionTitle("Cost Breakdown (cont.)");
        drawHeaderRow();
      }

      const isZebra = zebraIndex % 2 === 1;
      zebraIndex += 1;

      pdf.setDrawColor(...brand.border);
      if (isZebra) {
        pdf.setFillColor(...brand.zebra);
        pdf.rect(margin, y, tableW, rowH, "FD");
      } else {
        pdf.rect(margin, y, tableW, rowH, "S");
      }

      pdf.line(margin + col1W, y, margin + col1W, y + rowH);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      const labelLines = pdf.splitTextToSize(String(label), col1W - 20);
      const valueText = String(value);
      pdf.text(labelLines, margin + 10, y + 16);
      pdf.text(valueText, margin + col1W + col2W - 10, y + 16, { align: "right" });
      y += rowH;
    };

    drawHeaderRow();
    rows.forEach(([label, value]) => {
      drawRow(label, value);
    });

    // Total + summary
    y += 20;
    drawSectionTitle("Total & Summary");

    const finalTotal = pdfValue("total_cost", breakdown.total_unit_cost_with_misc);
    ensureSpace(78);
    pdf.setFillColor(236, 253, 245);
    pdf.setDrawColor(167, 243, 208);
    pdf.roundedRect(margin, y, contentW, 54, 10, 10, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text("Final Part Cost", margin + 14, y + 22);
    pdf.setFontSize(15);
    pdf.setTextColor(...brand.accent);
    pdf.text(finalTotal, margin + contentW - 14, y + 24, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...brand.slate);
    pdf.text("(Unit cost with misc)", margin + 14, y + 42);
    y += 74;

    // Summary card
    ensureSpace(100);
    pdf.setFillColor(...brand.mutedBg);
    pdf.setDrawColor(...brand.border);
    pdf.roundedRect(margin, y, contentW, 90, 10, 10, "FD");
    const sX = margin + 14;
    const sY = y + 24;
    const sHalfW = (contentW - 28) / 2;
    drawInfoRow("Operation", costResult?.operation_type, sX, sY, sHalfW);
    drawInfoRow("Machine", costResult?.selected_machine?.name, sX + sHalfW, sY, sHalfW);
    drawInfoRow("Material", costResult?.material, sX, sY + 22, sHalfW);
    drawInfoRow("Duty", costResult?.duty_category, sX + sHalfW, sY + 22, sHalfW);
    drawInfoRow("Shape", costResult?.shape, sX, sY + 44, sHalfW);
    y += 112;

    pdf.save(`${safeProject}-${safePart}-Cost-Estimation.pdf`);
  }, [costResult, part, projectData]);

  if (loading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  if (!projectData || !part) {
    return (
      <div className="space-y-4">
        <div className="text-red-600 text-sm">Could not load project/part.</div>
        <button
          type="button"
          onClick={() => onChange("project_detail", { projectId })}
          className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
        >
          ← Back to Project
        </button>
      </div>
    );
  }

  return (
    <div className="-m-6 -mt-6 lg:-m-8 lg:-mt-8 h-[calc(100vh-0px)]">
      <div className="h-full w-full bg-white shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Part Cost Estimation – {part.part_number}</div>
              <div className="text-xs text-slate-300 mt-0.5">{part.part_name}</div>
              <div className="text-[11px] text-slate-300 mt-2">
                <span className="font-semibold text-slate-200">Project:</span> {projectData?.project_name || "Untitled Project"}
                <span className="mx-2 text-slate-500">|</span>
                <span className="font-semibold text-slate-200">PO/Ref:</span> {projectData?.po_reference_number || "N/A"}
                <span className="mx-2 text-slate-500">|</span>
                <span className="font-semibold text-slate-200">Customer:</span> {projectData?.customer_name || "N/A"}
                <span className="mx-2 text-slate-500">|</span>
                <span className="font-semibold text-slate-200">Date:</span> {projectData?.project_date || "N/A"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {costResult && (
                <div className="text-right">
                  <div className="text-[11px] text-slate-300">Final Part Cost</div>
                  <div className="text-base font-bold text-emerald-300">
                    {formatValue("total_cost", costResult.cost_breakdown?.total_unit_cost_with_misc)}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => onChange("project_detail", { projectId })}
                className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                ← Back to Project
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>

        <div ref={pdfAreaRef} className="h-[calc(100vh-73px)]">
          <div className="flex h-full overflow-hidden">
            <aside className="w-[520px] xl:w-[680px] border-r border-slate-200 bg-slate-50">
              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">2D Drawing</div>
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] text-slate-500">Zoom: {Math.round(drawingZoom * 100)}%</div>
                        <button type="button" onClick={zoomOutDrawing} className="px-2 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 hover:bg-white">-10</button>
                        <button type="button" onClick={fitDrawingToScreen} className="px-2 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 hover:bg-white">Fit</button>
                        <button type="button" onClick={resetDrawingZoom} className="px-2 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 hover:bg-white">Reset</button>
                        <button type="button" onClick={zoomInDrawing} className="px-2 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 hover:bg-white">+10</button>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-white">
                    {!part.drawing_2d_path ? (
                      <div className="text-xs text-slate-400">No drawing uploaded.</div>
                    ) : (
                      <div
                        ref={drawingViewportRef}
                        className="relative h-[76vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                        style={{ cursor: "grab", touchAction: "none" }}
                        onMouseDown={handleDrawingMouseDown}
                        onMouseMove={handleDrawingMouseMove}
                        onMouseUp={stopDrawingPan}
                        onMouseLeave={stopDrawingPan}
                        onWheel={handleDrawingWheel}
                      >
                        <div
                          className="absolute left-0 top-0"
                          style={{
                            transform: `translate(${drawingPan.x}px, ${drawingPan.y}px) scale(${drawingZoom})`,
                            transformOrigin: "top left",
                          }}
                        >
                          <div ref={drawingCaptureRef} className="bg-white">
                          {isPdfPath(part.drawing_2d_path) ? (
                            <PdfPreview
                              url={getInlineFileUrl(part.drawing_2d_path)}
                              alt={`${part.part_number} - 2D Drawing`}
                              className="block max-w-none w-auto h-auto object-contain select-none"
                              onLoad={() => {
                                const el = drawingContentRef.current;
                                if (el && el.getBoundingClientRect) {
                                  const r = el.getBoundingClientRect();
                                  drawingContentSizeRef.current = { width: r.width, height: r.height };
                                }
                                fitDrawingToScreen();
                              }}
                            />
                          ) : (
                            <img
                              ref={drawingContentRef}
                              src={getInlineFileUrl(part.drawing_2d_path)}
                              alt={`${part.part_number} - 2D Drawing`}
                              className="block max-w-none w-auto h-auto object-contain select-none"
                              onLoad={() => {
                                const el = drawingContentRef.current;
                                if (el) {
                                  const w = el.naturalWidth || el.width || 0;
                                  const h = el.naturalHeight || el.height || 0;
                                  drawingContentSizeRef.current = { width: w, height: h };
                                }
                                fitDrawingToScreen();
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          {isPdfPath(part.drawing_2d_path) && <div ref={drawingContentRef} className="hidden" />}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div className="text-sm font-semibold text-slate-800">Machining Inputs</div>
                        <div className="text-xs text-slate-500 mt-0.5">Fill the values and calculate</div>
                      </div>
                      <div className="p-4">
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium text-slate-700">Operation Type</label>
                              <select
                                value={form.operation_type}
                                onChange={(e) => setForm((p) => ({ ...p, operation_type: e.target.value, machine_name: "" }))}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                              >
                                <option value="turning">Turning</option>
                                <option value="milling">Milling</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium text-slate-700">Material</label>
                              <select
                                value={form.material}
                                onChange={(e) => setForm((p) => ({ ...p, material: e.target.value }))}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                              >
                                <option value="steel">Steel</option>
                                <option value="aluminium">Aluminium</option>
                                <option value="titanium">Titanium</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium text-slate-700">Machine</label>
                              <select
                                value={form.machine_name}
                                onChange={(e) => setForm((p) => ({ ...p, machine_name: e.target.value }))}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                              >
                                <option value="">Select Machine</option>
                                {filteredMachines.map((m) => (
                                  <option key={m.id} value={m.name}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium text-slate-700">Man Hours / Unit</label>
                              <input
                                type="number"
                                step="0.01"
                                value={form.man_hours_per_unit}
                                onChange={(e) => setForm((p) => ({ ...p, man_hours_per_unit: e.target.value }))}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                                required
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium text-slate-700">Miscellaneous Amount</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.miscellaneous_amount}
                                onChange={(e) => setForm((p) => ({ ...p, miscellaneous_amount: e.target.value }))}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium text-slate-700">Length (mm)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={form.length}
                                onChange={(e) => setForm((p) => ({ ...p, length: e.target.value }))}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                                required
                              />
                            </div>

                            {String(form.operation_type) === "turning" && (
                              <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-slate-700">Diameter (mm)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={form.diameter}
                                  onChange={(e) => setForm((p) => ({ ...p, diameter: e.target.value }))}
                                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                                  required
                                />
                              </div>
                            )}

                            {String(form.operation_type) === "milling" && (
                              <>
                                <div className="flex flex-col gap-1">
                                  <label className="text-sm font-medium text-slate-700">Breadth (mm)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={form.breadth}
                                    onChange={(e) => setForm((p) => ({ ...p, breadth: e.target.value }))}
                                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                                    required
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-sm font-medium text-slate-700">Height (mm)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={form.height}
                                    onChange={(e) => setForm((p) => ({ ...p, height: e.target.value }))}
                                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
                                    required
                                  />
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={costLoading}
                              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {costLoading ? "Calculating..." : "Calculate Cost"}
                            </button>
                            {costResult && (
                              <button
                                type="button"
                                onClick={() => setCostResult(null)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {costError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <p className="text-red-600 text-sm">{costError}</p>
                            </div>
                          )}
                        </form>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div className="text-sm font-semibold text-slate-800">Part Cost Summary</div>
                        <div className="text-xs text-slate-500 mt-0.5">Comprehensive cost breakdown</div>
                      </div>
                      <div className="p-4">
                        {!costResult ? (
                          <div className="text-sm text-slate-500">Calculate cost to see the breakdown.</div>
                        ) : (
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Basic Cost</span>
                              <span className="font-semibold text-slate-900">{formatValue("basic_cost", costResult.cost_breakdown?.basic_cost_per_unit)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Overheads</span>
                              <span className="font-semibold text-slate-900">{formatValue("overheads", costResult.cost_breakdown?.overheads_per_unit)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Profit</span>
                              <span className="font-semibold text-slate-900">{formatValue("profit", costResult.cost_breakdown?.profit_per_unit)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Packing & Forwarding</span>
                              <span className="font-semibold text-slate-900">{formatValue("packing", costResult.cost_breakdown?.packing_forwarding_per_unit)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Miscellaneous</span>
                              <span className="font-semibold text-slate-900">{formatValue("miscellaneous_amount", costResult.cost_breakdown?.miscellaneous_amount)}</span>
                            </div>
                            <div className="pt-3 mt-3 border-t border-slate-200 flex items-center justify-between">
                              <span className="text-slate-700 font-semibold">Final Part Cost</span>
                              <span className="font-bold text-emerald-700">{formatValue("total_cost", costResult.cost_breakdown?.total_unit_cost_with_misc)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {costResult && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-sky-50 to-indigo-50 rounded-xl p-6 border border-sky-200">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <h5 className="text-base font-semibold text-slate-700 mb-3">Operation Details</h5>
                          <div className="space-y-2 text-sm text-slate-600">
                            <p><span className="font-medium">Operation:</span> {costResult.operation_type}</p>
                            <p><span className="font-medium">Machine:</span> {costResult.selected_machine?.name}</p>
                            <p><span className="font-medium">Material:</span> {costResult.material}</p>
                            <p><span className="font-medium">Duty Category:</span> {costResult.duty_category}</p>
                            <p><span className="font-medium">Shape:</span> {costResult.shape}</p>
                            {costResult.volume && (
                              <p><span className="font-medium">Volume:</span> {costResult.volume.toFixed(2)} mm³</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-base font-semibold text-slate-700 mb-3">Detailed Cost Breakdown</h5>
                          <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white">
                            <table className="min-w-full text-sm">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-100">Component</th>
                                  <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-100">Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-white">
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">Man Hours per Unit</td>
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700">{costResult.cost_breakdown?.man_hours_per_unit}</td>
                                </tr>
                                <tr className="bg-slate-50/40">
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">Machine Hour Rate</td>
                                  <td className="px-4 py-3 border-b border-slate-100">{formatValue("machine_hour_rate", costResult.cost_breakdown?.machine_hour_rate)}</td>
                                </tr>
                                <tr className="bg-white">
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">Wage Rate</td>
                                  <td className="px-4 py-3 border-b border-slate-100">{formatValue("wage_rate", costResult.cost_breakdown?.wage_rate)}</td>
                                </tr>
                                <tr className="bg-slate-50/40">
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">Basic Cost</td>
                                  <td className="px-4 py-3 border-b border-slate-100 font-semibold">{formatValue("basic_cost", costResult.cost_breakdown?.basic_cost_per_unit)}</td>
                                </tr>
                                <tr className="bg-white">
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">Overheads</td>
                                  <td className="px-4 py-3 border-b border-slate-100 font-semibold">{formatValue("overheads", costResult.cost_breakdown?.overheads_per_unit)}</td>
                                </tr>
                                <tr className="bg-slate-50/40">
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">Profit (10%)</td>
                                  <td className="px-4 py-3 border-b border-slate-100 font-semibold">{formatValue("profit", costResult.cost_breakdown?.profit_per_unit)}</td>
                                </tr>
                                <tr className="bg-white">
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">Packing & Forwarding (2%)</td>
                                  <td className="px-4 py-3 border-b border-slate-100 font-semibold">{formatValue("packing", costResult.cost_breakdown?.packing_forwarding_per_unit)}</td>
                                </tr>
                                <tr className="bg-slate-50/40">
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">Miscellaneous Amount</td>
                                  <td className="px-4 py-3 border-b border-slate-100 font-semibold">{formatValue("miscellaneous_amount", costResult.cost_breakdown?.miscellaneous_amount)}</td>
                                </tr>
                                <tr className="bg-white">
                                  <td className="px-4 py-3 border-b border-slate-100 text-slate-700 font-medium">Total Unit Cost</td>
                                  <td className="px-4 py-3 border-b border-slate-100 font-semibold">{formatValue("total_cost", costResult.cost_breakdown?.unit_cost)}</td>
                                </tr>
                                <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 font-bold">
                                  <td className="px-4 py-4 border-b border-slate-100 text-slate-900">Total Unit Cost with Misc</td>
                                  <td className="px-4 py-4 border-b border-slate-100 text-emerald-700 text-lg">{formatValue("total_cost", costResult.cost_breakdown?.total_unit_cost_with_misc)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
