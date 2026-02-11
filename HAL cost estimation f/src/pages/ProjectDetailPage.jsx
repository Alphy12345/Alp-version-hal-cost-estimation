import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Tabs,
  Tab,
  Stack,
  Typography,
  Alert,
  Paper,
  Link
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getProject, getProjectParts, deleteProjectPart, addProjectPart, updatePart, getPartCostForm, savePartCostForm } from "../api/projects";
import AddPartModal from "../components/AddPartModal";
import FileViewerModal from "../components/FileViewerModal";
import DocumentsTab from "../components/project-details/DocumentsTab";
import PartsTab from "../components/project-details/PartsTab";
import CostEstimationTab from "../components/project-details/CostEstimationTab";
import TotalCostTab from "../components/project-details/TotalCostTab";
import PdfPreview from "../components/PdfPreview"; // Helper for potential usage, though mostly passed down or used in sub-components
import api from "../api/client";
import { calculateCostEstimation, calculateCostEstimationBatch } from "../api/costEstimation";

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
  const [costResults, setCostResults] = useState({}); // { partId: { operations: [resultData|null], combined_total_unit_cost_with_misc: number } }

  const isHydratingCostFormsRef = useRef(false);
  const lastSavedCostFormsRef = useRef({});
  const saveTimersRef = useRef({});

  const buildSavedCostPayload = useCallback((partId, formObj, resultsObj) => {
    const base = formObj && typeof formObj === "object" ? formObj : {};
    const merged = { ...base };
    if (resultsObj && typeof resultsObj === "object") {
      merged.__calc_results = resultsObj;
    } else {
      delete merged.__calc_results;
    }
    return merged;
  }, []);

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
          const defaultOperation = {
            operation_type: "turning",
            shape: "round",
            material: "steel",
            machine_name: "",
            man_hours_per_unit: "",
            duty_category: "",
            machine_setup_time: "",
            cycle_time: "",
            length: "",
            diameter: "", // for turning
            breadth: "", // for milling
            height: "", // for milling
          };

          partsData?.forEach((p) => {
            initialForms[p.id] = {
              activeOperationIndex: 0,
              operations: [{ ...defaultOperation }],
              miscellaneous_items: [{ description: "", amount: "" }],
            };
          });

          // Hydrate saved form data from backend (if any). Saved data wins over defaults.
          isHydratingCostFormsRef.current = true;
          let savedByPartId = {};
          let savedResultsByPartId = {};
          try {
            const results = await Promise.all(
              (partsData || []).map(async (p) => {
                try {
                  const res = await getPartCostForm(p.id);
                  return { partId: p.id, data: res?.data };
                } catch (e) {
                  return { partId: p.id, data: null };
                }
              })
            );
            results.forEach((r) => {
              if (r?.partId != null && r?.data && typeof r.data === "object") {
                const raw = r.data;
                const next = { ...raw };
                if (raw && typeof raw === "object" && raw.__calc_results && typeof raw.__calc_results === "object") {
                  savedResultsByPartId[r.partId] = raw.__calc_results;
                  delete next.__calc_results;
                }
                savedByPartId[r.partId] = next;
              }
            });
          } catch (e) {
            // ignore hydration failures
          }

          setCostForms((prev) => {
            const next = { ...prev };
            Object.keys(initialForms).forEach((pid) => {
              const partIdNum = Number(pid);
              const saved = savedByPartId[partIdNum] || savedByPartId[pid];
              next[pid] = { ...initialForms[pid], ...(saved || {}) };
            });
            return next;
          });

          // Hydrate saved calculation results (if any)
          if (savedResultsByPartId && typeof savedResultsByPartId === "object") {
            setCostResults((prev) => {
              const next = { ...prev };
              Object.entries(savedResultsByPartId).forEach(([pid, v]) => {
                if (!v || typeof v !== "object") return;
                next[pid] = v;
              });
              return next;
            });
          }

          // allow subsequent changes to trigger autosave
          setTimeout(() => {
            isHydratingCostFormsRef.current = false;
          }, 0);
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
    
    // Ensure value is a number
    const numValue = typeof value === "number" ? value : Number(value);
    
    if (Number.isFinite(numValue)) {
      if (key === "man_hours_per_unit") return numValue.toLocaleString("en-IN", { maximumFractionDigits: 2 });
      if (key === "cost_per_hour" || key.includes("cost") || key.includes("price") || key.includes("rate") || key.includes("amount") || key.includes("overheads") || key.includes("profit") || key.includes("packing") || key.includes("total")) {
        return new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(numValue);
      }
      return numValue.toLocaleString("en-IN");
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
        activeOperationIndex: 0,
        operations: [
          {
            operation_type: "turning",
            shape: "round",
            material: "steel",
            machine_name: "",
            man_hours_per_unit: "",
            length: "",
            diameter: "",
            breadth: "",
            height: "",
          },
        ],
        miscellaneous_items: [{ description: "", amount: "" }],
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

  const handleCostSubmitAll = async (partId) => {
    setCostLoading(true);
    setCostError("");
    try {
      const partForm = costForms?.[partId];
      const ops = Array.isArray(partForm?.operations) ? partForm.operations : [];
      if (!ops.length) throw new Error("No operations found");

      // Prefer the new batch endpoint (single request). If it's missing, fall back to sequential.
      try {
        const operationsPayload = ops.map((_, idx) => buildOperationPayload(partId, idx));
        const res = await calculateCostEstimationBatch({ operations: operationsPayload });
        const data = res?.data;

        const nextOps = Array.isArray(data?.operations) ? data.operations : [];
        
        // Merge inputs from the form data into the results
        const opsWithInputs = nextOps.map((opResult, idx) => {
          const formData = ops[idx];
          return {
            ...opResult,
            inputs: {
              machine_setup_time: formData?.machine_setup_time,
              cycle_time: formData?.cycle_time,
              ...opResult?.inputs,
            },
          };
        });
        
        const combined = Number(data?.combined_total_unit_cost_with_misc);

        setCostResults((prev) => {
          const current = prev?.[partId] || { operations: [] };
          const combinedValue = Number.isFinite(combined)
            ? combined
            : opsWithInputs.reduce((sum, r) => {
                const n = Number(r?.cost_breakdown?.total_unit_cost_with_misc);
                return sum + (Number.isFinite(n) ? n : 0);
              }, 0);

          return {
            ...prev,
            [partId]: {
              ...current,
              operations: opsWithInputs,
              combined_total_unit_cost_with_misc: combinedValue,
            },
          };
        });

        return;
      } catch (err) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail;
        const isMissing = status === 404 && (detail === "Not Found" || detail === "Not Found.");
        if (!isMissing) throw err;
      }

      for (let i = 0; i < ops.length; i += 1) {
        const { res, operationsLength } = await calculateSingleOperation(partId, i);
        
        // Get the form data for this operation
        const formData = ops[i];
        
        setCostResults((prev) => {
          const current = prev?.[partId] || { operations: [] };
          const existingOps = Array.isArray(current.operations) ? current.operations : [];
          const nextOps = existingOps.slice();
          while (nextOps.length < operationsLength) nextOps.push(null);
          nextOps[i] = {
            ...res.data,
            inputs: {
              machine_setup_time: formData?.machine_setup_time,
              cycle_time: formData?.cycle_time,
              ...res.data?.inputs,
            },
          };

          const combined = nextOps.reduce((sum, r) => {
            const n = Number(r?.cost_breakdown?.total_unit_cost_with_misc);
            return sum + (Number.isFinite(n) ? n : 0);
          }, 0);

          return {
            ...prev,
            [partId]: {
              ...current,
              operations: nextOps,
              combined_total_unit_cost_with_misc: combined,
            },
          };
        });
      }
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

  const calculateSingleOperation = async (partId, opIndex) => {
    const partForm = costForms[partId];
    const operations = Array.isArray(partForm?.operations) ? partForm.operations : [];
    const payload = buildOperationPayload(partId, opIndex);
    const res = await calculateCostEstimation(payload);
    return { res, operationsLength: operations.length };
  };

  const buildOperationPayload = (partId, opIndex) => {
    const partForm = costForms[partId];
    const operations = Array.isArray(partForm?.operations) ? partForm.operations : [];
    const formData = operations[opIndex];
    if (!partForm || !formData) {
      throw new Error("Form data not found");
    }

    const opType = String(formData.operation_type || "").trim().toLowerCase();
    const material = String(formData.material || "").trim().toLowerCase();
    const machineName = String(formData.machine_name || "").trim();

    const normalize = (value) => {
      return value == null ? "" : String(value).trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
    };

    const toApiOpValue = (name) => {
      const v = normalize(name).replace(/\s+/g, "_");
      if (v === "boring" || v.includes("boring")) return "boring";
      return v;
    };

    const selectedOp = operationTypes.find((ot) => {
      const opName = ot?.operation_name;
      return toApiOpValue(opName) === opType || normalize(opName) === normalize(opType);
    });
    const selectedOpId = selectedOp?.id != null ? String(selectedOp.id) : "";
    const normalizeMachineName = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
    const sameNameMachines = machines.filter((m)=> normalizeMachineName(m?.name)===normalizeMachineName(machineName));
    let machineRecord = null;
    if (sameNameMachines.length===1){
      machineRecord = sameNameMachines[0];
    } else if (sameNameMachines.length>1){
      machineRecord = sameNameMachines.find((m)=>{
        const opId = m?.op_id ?? m?.operation_type_id ?? m?.operation_type?.id ?? m?.operation_types?.id;
        return selectedOpId && String(opId)===selectedOpId;
      }) || sameNameMachines[0];
    }
    if (!machineRecord) {
      throw new Error("Selected machine is not available. Please re-select the machine.");
    }
    const machineOpId = machineRecord?.op_id ?? machineRecord?.operation_type_id ?? machineRecord?.operation_type?.id ?? machineRecord?.operation_types?.id;
    const machineIsCompatible = machineOpId == null ? true : String(machineOpId) === selectedOpId;
    const appearsInFiltered = machines.some((m)=> normalizeMachineName(m?.name)===normalizeMachineName(machineName) && (m?.op_id==null || String(m?.op_id)===selectedOpId || String(m?.operation_type_id)===selectedOpId));

    if (!machineIsCompatible && !appearsInFiltered) {
      throw new Error("Selected machine does not match the operation type. Please re-select the machine.");
    }

    const manHours = Number(formData.man_hours_per_unit);
    
    // Get global miscellaneous items from part level
    const globalMiscItems = partForm?.miscellaneous_items;
    const miscAmount = Array.isArray(globalMiscItems)
      ? globalMiscItems.reduce((sum, it) => {
          const n = Number(it?.amount);
          return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
        }, 0)
      : 0;
    
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

    const roundOnlyOps = new Set(["turning", "boring"]);
    const rectangularOnlyOps = new Set(["milling", "grinding", "surface_treatment", "rubber_press"]);
    const flexibleOps = new Set(["drilling", "heat_treatment", "welding"]);

    const dimensions = { length };
    if (roundOnlyOps.has(opType)) {
      if (!Number.isFinite(diameter) || diameter <= 0) {
        throw new Error("Please enter a valid Diameter");
      }
      dimensions.diameter = diameter;
    } else if (rectangularOnlyOps.has(opType)) {
      if (!Number.isFinite(breadth) || breadth <= 0) {
        throw new Error("Please enter a valid Breadth");
      }
      if (!Number.isFinite(height) || height <= 0) {
        throw new Error("Please enter a valid Height");
      }
      dimensions.breadth = breadth;
      dimensions.height = height;
    } else if (flexibleOps.has(opType)) {
      const shape = String(formData.shape || "round").trim().toLowerCase();
      if (shape === "rectangular") {
        if (!Number.isFinite(breadth) || breadth <= 0) {
          throw new Error("Please enter a valid Breadth");
        }
        if (!Number.isFinite(height) || height <= 0) {
          throw new Error("Please enter a valid Height");
        }
        dimensions.breadth = breadth;
        dimensions.height = height;
      } else {
        if (!Number.isFinite(diameter) || diameter <= 0) {
          throw new Error("Please enter a valid Diameter");
        }
        dimensions.diameter = diameter;
      }
    } else {
      throw new Error("Invalid operation type");
    }

    const dutyCategory = String(formData?.duty_category || "").trim().toLowerCase();
    const machineSetupTime = formData?.machine_setup_time;
    const cycleTime = formData?.cycle_time;
    const needsManualDuty = opType && opType !== "turning" && opType !== "milling";
    if (needsManualDuty && !dutyCategory) {
      throw new Error("Duty Category is required for this operation type. Please select light/medium/heavy.");
    }

    return {
      dimensions,
      material,
      operation_type: opType,
      machine_name: machineName,
      man_hours_per_unit: manHours,
      ...(dutyCategory ? { duty_category: dutyCategory } : {}),
      ...(machineSetupTime ? { machine_setup_time: Number(machineSetupTime) } : {}),
      ...(cycleTime ? { cycle_time: Number(cycleTime) } : {}),
      miscellaneous_amount: Number.isFinite(miscAmount) ? miscAmount : 0,
    };
  };

  const closeFileViewer = () => {
    setFileViewer({ ...fileViewer, isOpen: false });
  };

  // --- Cost Estimation Logic ---
  const handleCostFormChange = (partId, opIndex, field, value) => {
    // Handle global miscellaneous items (opIndex === -1)
    if (opIndex === -1) {
      setCostForms((prev) => {
        const current = prev?.[partId] || {};
        return {
          ...prev,
          [partId]: {
            ...current,
            [field]: value,
          },
        };
      });
      return;
    }
    
    // Handle operation-specific fields
    setCostForms((prev) => {
      const current = prev?.[partId] || {};
      const currentOps = Array.isArray(current.operations) ? current.operations : [];
      const nextOps = currentOps.map((op, idx) => (idx === opIndex ? { ...op, [field]: value } : op));
      return {
        ...prev,
        [partId]: {
          ...current,
          operations: nextOps,
        },
      };
    });
  };

  // Autosave cost forms to backend (debounced) so refresh doesn't wipe the entered inputs.
  useEffect(() => {
    if (isHydratingCostFormsRef.current) return;

    const forms = costForms && typeof costForms === "object" ? costForms : {};
    const results = costResults && typeof costResults === "object" ? costResults : {};
    Object.keys(forms).forEach((partId) => {
      const data = forms[partId];
      if (!data || typeof data !== "object") return;

      const payload = buildSavedCostPayload(partId, data, results?.[partId]);
      const nextSerialized = JSON.stringify(payload);
      if (lastSavedCostFormsRef.current[partId] === nextSerialized) return;

      if (saveTimersRef.current[partId]) {
        clearTimeout(saveTimersRef.current[partId]);
      }

      saveTimersRef.current[partId] = setTimeout(async () => {
        try {
          await savePartCostForm(partId, payload);
          lastSavedCostFormsRef.current[partId] = nextSerialized;
        } catch (e) {
          // ignore autosave errors (backend offline etc.)
        }
      }, 600);
    });

    return () => {
      Object.keys(saveTimersRef.current || {}).forEach((k) => {
        clearTimeout(saveTimersRef.current[k]);
      });
      saveTimersRef.current = {};
    };
  }, [costForms, costResults, buildSavedCostPayload]);

  const handleCostSetActiveOperation = (partId, nextIndex) => {
    setCostForms((prev) => {
      const current = prev?.[partId] || {};
      const ops = Array.isArray(current.operations) ? current.operations : [];
      const clamped = Math.max(0, Math.min(Number(nextIndex) || 0, Math.max(0, ops.length - 1)));
      return {
        ...prev,
        [partId]: {
          ...current,
          activeOperationIndex: clamped,
        },
      };
    });
  };

  const handleCostAddOperation = (partId) => {
    setCostForms((prev) => {
      const current = prev?.[partId] || {};
      const ops = Array.isArray(current.operations) ? current.operations : [];
      const lastOp = ops[ops.length - 1];
      
      // Only carry over material from last operation, keep everything else null/empty
      const newOperation = {
        operation_type: "turning",
        material: lastOp?.material || "steel",
        machine_name: "",
        man_hours_per_unit: "",
        duty_category: "",
        machine_setup_time: "",
        cycle_time: "",
        length: "",
        diameter: "",
        breadth: "",
        height: "",
        shape: "round",
      };

      const nextOps = [...ops, newOperation];
      return {
        ...prev,
        [partId]: {
          ...current,
          operations: nextOps,
          activeOperationIndex: nextOps.length - 1,
        },
      };
    });
  };

  const handleCostRemoveOperation = (partId, opIndex) => {
    setCostForms((prev) => {
      const current = prev?.[partId] || {};
      const ops = Array.isArray(current.operations) ? current.operations : [];
      const nextOps = ops.filter((_, idx) => idx !== opIndex);
      const nextActive = Math.max(0, Math.min(current.activeOperationIndex || 0, Math.max(0, nextOps.length - 1)));
      return {
        ...prev,
        [partId]: {
          ...current,
          operations: nextOps,
          activeOperationIndex: nextActive,
        },
      };
    });

    setCostResults((prev) => {
      const current = prev?.[partId];
      if (!current || !Array.isArray(current.operations)) return prev;
      const nextOps = current.operations.filter((_, idx) => idx !== opIndex);
      const combined = nextOps.reduce((sum, r) => {
        const n = Number(r?.cost_breakdown?.total_unit_cost_with_misc);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
      return {
        ...prev,
        [partId]: {
          ...current,
          operations: nextOps,
          combined_total_unit_cost_with_misc: combined,
        },
      };
    });
  };

  const handleCostSubmit = async (e, partId, opIndex) => {
    e.preventDefault();
    setCostLoading(true);
    setCostError("");

    try {
      const { res, operationsLength } = await calculateSingleOperation(partId, opIndex);
      
      // Get the form data for this operation to include inputs in results
      const partForm = costForms[partId];
      const operations = Array.isArray(partForm?.operations) ? partForm.operations : [];
      const formData = operations[opIndex];
      
      setCostResults((prev) => {
        const current = prev?.[partId] || { operations: [] };
        const existingOps = Array.isArray(current.operations) ? current.operations : [];
        const nextOps = existingOps.slice();
        while (nextOps.length < operationsLength) nextOps.push(null);
        nextOps[opIndex] = {
          ...res.data,
          inputs: {
            machine_setup_time: formData?.machine_setup_time,
            cycle_time: formData?.cycle_time,
            ...res.data?.inputs,
          },
        };

        const combined = nextOps.reduce((sum, r) => {
          const n = Number(r?.cost_breakdown?.total_unit_cost_with_misc);
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);

        return {
          ...prev,
          [partId]: {
            ...current,
            operations: nextOps,
            combined_total_unit_cost_with_misc: combined,
          },
        };
      });
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
              onSetActiveOperation={handleCostSetActiveOperation}
              onAddOperation={handleCostAddOperation}
              onRemoveOperation={handleCostRemoveOperation}
              setCostResults={setCostResults}
              onClearCost={handleClearCost}
              onSubmitCost={handleCostSubmit}
              onSubmitAllCost={handleCostSubmitAll}
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
    </Box>
  );
}

export default ProjectDetailPage;
