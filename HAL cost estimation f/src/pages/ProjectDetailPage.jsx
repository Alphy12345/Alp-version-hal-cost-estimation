import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Tab,
  Tabs,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Stack,
  Button
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getProject, getProjectParts, deleteProjectPart, addProjectPart, updatePart } from "../api/projects";
import AddPartModal from "../components/AddPartModal";
import FileViewerModal from "../components/FileViewerModal";
import DocumentsTab from "../components/project-details/DocumentsTab";
import PartsTab from "../components/project-details/PartsTab";
import CostEstimationTab from "../components/project-details/CostEstimationTab";
import TotalCostTab from "../components/project-details/TotalCostTab";
import PdfPreview from "../components/PdfPreview"; // Helper for potential usage, though mostly passed down or used in sub-components
import api from "../api/client";
import { calculateCostEstimation } from "../api/costEstimation";

function ProjectDetailPage({ onChange, projectId }) {
  const [projectData, setProjectData] = useState(null);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("documents");

  // Modal states
  const [isAddPartModalOpen, setIsAddPartModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [fileViewer, setFileViewer] = useState({ isOpen: false, fileUrl: '', fileName: '', fileType: '' });

  // Cost Estimation State
  const [costForms, setCostForms] = useState({}); // { partId: { ...formData } }
  const [machines, setMachines] = useState([]);
  const [operationTypes, setOperationTypes] = useState([]);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState("");
  const [costResults, setCostResults] = useState({}); // { partId: resultData }

  // --- Initial Data Fetching ---
  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!projectId) throw new Error("No project ID provided");

        const data = await getProject(projectId);
        setProjectData(data);

        // Fetch Parts
        try {
          const partsData = await getProjectParts(projectId);
          setParts(partsData || []);

          // Initialize cost forms for parts
          const initialForms = {};
          partsData?.forEach(p => {
            initialForms[p.id] = {
              operation_type: "turning",
              material: "steel",
              machine_name: "",
              man_hours_per_unit: "",
              miscellaneous_amount: "",
              length: "",
              diameter: "", // for turning
              breadth: "", // for milling
              height: "", // for milling
            };
          });
          setCostForms(prev => ({ ...initialForms, ...prev })); // Merge to keep existing edits if any re-fetch happens
        } catch (err) {
          console.error("Failed to fetch parts:", err);
          // Don't block main render if parts fail, just show empty
          setParts([]);
        }

        // Fetch Lookups for Cost Calculation
        try {
          const [machinesRes, opTypesRes] = await Promise.all([
            api.get("/machines/"),
            api.get("/operation-type/")
          ]);
          setMachines(machinesRes.data || []);
          setOperationTypes(opTypesRes.data || []);
        } catch (err) {
          console.error("Failed to fetch lookups:", err);
        }

      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Failed to load project details.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectDetails();
  }, [projectId]);

  // --- Helpers ---
  const handleBack = () => {
    onChange("projects");
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const isPdfPath = (path) => {
    return typeof path === 'string' && path.toLowerCase().endsWith('.pdf');
  };

  const getInlineFileUrl = (path) => {
    const normalized = String(path || "").replace(/\\/g, "/");
    if (!normalized) return "";

    if (normalized.startsWith("http")) return normalized;

    const isLocalUploads = normalized.startsWith("uploads/") || normalized.startsWith("uploads");
    const encodedKey = normalized
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    return isLocalUploads
      ? `http://127.0.0.1:8000/files/uploads/${normalized}?inline=true`
      : `http://127.0.0.1:8000/files/download/${encodedKey}?inline=true`;
  };

  const formatValue = (key, value) => {
    if (value === undefined || value === null) return "-";
    if (typeof value === "number") {
      if (key === "man_hours_per_unit") return value.toFixed(2);
      if (key === "cost_per_hour" || key.includes("cost") || key.includes("price") || key.includes("rate") || key.includes("amount") || key.includes("overheads") || key.includes("profit") || key.includes("packing")) {
        return `₹${value.toFixed(2)}`;
      }
      return value;
    }
    return value;
  };

  // --- Parts Logic ---
  const handleAddPart = () => {
    setEditingPart(null);
    setIsAddPartModalOpen(true);
  };

  const handleEditPart = (part) => {
    setEditingPart(part);
    setIsAddPartModalOpen(true);
  };

  const handleModalClose = () => {
    setIsAddPartModalOpen(false);
    setEditingPart(null);
  };

  const handlePartAdded = (newPart) => {
    setParts([...parts, newPart]);
    // Init form for new part
    setCostForms(prev => ({
      ...prev,
      [newPart.id]: {
        operation_type: "turning",
        material: "steel",
        machine_name: "",
        man_hours_per_unit: "",
        miscellaneous_amount: "",
        length: "",
        diameter: "",
        breadth: "",
        height: "",
      }
    }));
  };

  const handlePartUpdated = (updatedPart) => {
    setParts(parts.map((p) => (p.id === updatedPart.id ? updatedPart : p)));
  };

  const handleDeletePart = async (partId) => {
    if (window.confirm("Are you sure you want to delete this part?")) {
      try {
        await deleteProjectPart(partId);
        setParts(parts.filter((p) => p.id !== partId));
        // Cleanup cost results/forms
        const newResults = { ...costResults };
        delete newResults[partId];
        setCostResults(newResults);

        const newForms = { ...costForms };
        delete newForms[partId];
        setCostForms(newForms);
      } catch (err) {
        console.error("Failed to delete part:", err);
        alert("Failed to delete part");
      }
    }
  };

  // --- File Viewer Logic ---
  const handleViewFile = (filePath, fileName) => {
    if (!filePath) return;
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filePath);
    const isPdf = /\.pdf$/i.test(filePath);
    const fileType = isImage ? 'image' : isPdf ? 'pdf' : 'other';
    const url = getInlineFileUrl(filePath);

    setFileViewer({
      isOpen: true,
      fileUrl: url,
      fileName: fileName || "File",
      fileType: fileType
    });
  };

  const closeFileViewer = () => {
    setFileViewer({ ...fileViewer, isOpen: false });
  };

  // --- Cost Estimation Logic ---
  const handleCostFormChange = (partId, field, value) => {
    setCostForms(prev => ({
      ...prev,
      [partId]: {
        ...prev[partId],
        [field]: value
      }
    }));
  };

  const handleCostSubmit = async (e, partId) => {
    e.preventDefault();
    setCostLoading(true);
    setCostError("");

    const formData = costForms[partId];
    if (!formData) {
      setCostError("Form data not found");
      setCostLoading(false);
      return;
    }

    try {
      const opType = String(formData.operation_type || "").trim().toLowerCase();
      const material = String(formData.material || "").trim().toLowerCase();
      const machineName = String(formData.machine_name || "").trim();

      const normalize = (value) => {
        return value == null ? "" : String(value).trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
      };

      const selectedOp = operationTypes.find((ot) => normalize(ot?.operation_name) === normalize(opType));
      const selectedOpId = selectedOp?.id != null ? String(selectedOp.id) : "";
      const machineRecord = machines.find((m) => String(m?.name || "").trim() === machineName);
      if (!machineRecord) {
        throw new Error("Selected machine is not available. Please re-select the machine.");
      }
      const machineOpId = machineRecord?.op_id ?? machineRecord?.operation_type_id ?? machineRecord?.operation_type?.id ?? machineRecord?.operation_types?.id;
      const machineIsCompatible = machineOpId == null ? true : String(machineOpId) === selectedOpId;
      if (!machineIsCompatible) {
        throw new Error("Selected machine does not match the operation type. Please re-select the machine.");
      }

      const manHours = Number(formData.man_hours_per_unit);
      const miscAmountRaw = formData.miscellaneous_amount;
      const miscItems = formData.miscellaneous_items;
      const miscAmountFromItems = Array.isArray(miscItems)
        ? miscItems.reduce((sum, it) => {
            const n = Number(it?.amount);
            return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
          }, 0)
        : null;
      const miscAmount = typeof miscAmountFromItems === "number"
        ? miscAmountFromItems
        : (miscAmountRaw === "" || miscAmountRaw == null ? 0 : Number(miscAmountRaw));
      const length = Number(formData.length);
      const diameter = Number(formData.diameter);
      const breadth = Number(formData.breadth);
      const height = Number(formData.height);

      if (!machineName) {
        throw new Error("Please select a machine");
      }

      if (!Number.isFinite(manHours) || manHours <= 0) {
        throw new Error("Please enter a valid Man Hours / Unit");
      }

      if (!Number.isFinite(length) || length <= 0) {
        throw new Error("Please enter a valid Length");
      }

      const dimensions = { length };
      if (opType === "turning") {
        if (!Number.isFinite(diameter) || diameter <= 0) {
          throw new Error("Please enter a valid Diameter");
        }
        dimensions.diameter = diameter;
      } else if (opType === "milling") {
        if (!Number.isFinite(breadth) || breadth <= 0) {
          throw new Error("Please enter a valid Breadth");
        }
        if (!Number.isFinite(height) || height <= 0) {
          throw new Error("Please enter a valid Height");
        }
        dimensions.breadth = breadth;
        dimensions.height = height;
      } else {
        throw new Error("Invalid operation type");
      }

      const payload = {
        dimensions,
        material,
        operation_type: opType,
        machine_name: machineName,
        man_hours_per_unit: manHours,
        miscellaneous_amount: Number.isFinite(miscAmount) ? miscAmount : 0,
      };

      const res = await calculateCostEstimation(payload);
      setCostResults(prev => ({
        ...prev,
        [partId]: res.data
      }));
    } catch (err) {
      console.error("Cost calculation failed:", err);
      setCostError(
        err.response?.data?.detail ||
        err.message ||
        "Failed to calculate cost. Please check inputs."
      );
    } finally {
      setCostLoading(false);
    }
  };

  const handleClearCost = (partId) => {
    setCostResults(prev => {
      const newState = { ...prev };
      delete newState[partId];
      return newState;
    });
  };

  // --- Render ---
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !projectData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error || "Project not found"}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mt: 2 }}>
          Back to Projects
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ width: "100%", pb: 8 }}>
      <Stack spacing={3} sx={{ maxWidth: "1600px", mx: "auto" }}>
        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            sx={{ mb: 2, color: "text.secondary" }}
          >
            Back to Projects
          </Button>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                {projectData.project_name}
              </Typography>
              <Stack direction="row" spacing={3} color="text.secondary">
                <Typography variant="body2">PO/Ref: {projectData.po_reference_number || "N/A"}</Typography>
                <Typography variant="body2">Customer: {projectData.customer_name || "N/A"}</Typography>
                <Typography variant="body2">Date: {projectData.project_date || "N/A"}</Typography>
              </Stack>
            </Box>
          </Box>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="project details tabs">
            <Tab label="Documents" value="documents" />
            <Tab label="Parts" value="parts" />
            <Tab label="Cost Estimation" value="cost_estimation" />
            <Tab label="Total Cost" value="total_cost" />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ py: 2 }}>
          {activeTab === "documents" && (
            <DocumentsTab
              projectData={projectData}
              onViewFile={handleViewFile}
            />
          )}
          {activeTab === "parts" && (
            <PartsTab
              parts={parts}
              onAddPart={handleAddPart}
              onEditPart={handleEditPart}
              onDeletePart={handleDeletePart}
              onViewFile={handleViewFile}
            />
          )}
          {activeTab === "cost_estimation" && (
            <CostEstimationTab
              parts={parts}
              costResults={costResults}
              costForms={costForms}
              onChangeForm={handleCostFormChange}
              setCostResults={setCostResults}
              onClearCost={handleClearCost}
              onSubmitCost={handleCostSubmit}
              onViewFile={handleViewFile}
              machines={machines}
              operationTypes={operationTypes}
              projectData={projectData}
              getInlineFileUrl={getInlineFileUrl}
              isPdfPath={isPdfPath}
              formatValue={formatValue}
              costLoading={costLoading}
              costError={costError}
              setCostError={setCostError}
              PdfPreview={PdfPreview}
            />
          )}
          {activeTab === "total_cost" && (
            <TotalCostTab
              costResults={costResults}
              parts={parts}
              formatValue={formatValue}
            />
          )}
        </Box>
      </Stack>

      {/* Modals */}
      <AddPartModal
        isOpen={isAddPartModalOpen}
        onClose={handleModalClose}
        projectId={projectId}
        partToEdit={editingPart}
        onPartAdded={handlePartAdded}
        onPartUpdated={handlePartUpdated}
      />

      <FileViewerModal
        isOpen={fileViewer.isOpen}
        onClose={closeFileViewer}
        fileUrl={fileViewer.fileUrl}
        fileName={fileViewer.fileName}
        fileType={fileViewer.fileType}
      />
    </Box>
  );
}

export default ProjectDetailPage;
