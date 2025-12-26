import React, { useEffect, useMemo, useState } from "react";
import api from "../api/client";

function flattenObject(obj, prefix = "") {
  if (obj == null) return [];

  if (typeof obj !== "object") {
    return [[prefix, obj]];
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return [[prefix, "[]"]];
    return obj.flatMap((item, idx) =>
      flattenObject(item, prefix ? `${prefix}[${idx}]` : `[${idx}]`)
    );
  }

  const entries = Object.entries(obj);
  if (entries.length === 0) return [[prefix, "{}"]];

  return entries.flatMap(([k, v]) => {
    const nextPrefix = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === "object") {
      return flattenObject(v, nextPrefix);
    }
    return [[nextPrefix, v]];
  });
}

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

function CostEstimationPage() {
  const [form, setForm] = useState({
    operation_type: "milling",
    diameter: 50,
    length: 200,
    breadth: 50,
    height: 50,
    material: "aluminium",
    machine_name: "",
    man_hours_per_unit: 2,
  });

  const [machines, setMachines] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(false);
  const [machinesError, setMachinesError] = useState("");

  const [operationTypes, setOperationTypes] = useState([]);
  const [operationTypesLoading, setOperationTypesLoading] = useState(false);
  const [operationTypesError, setOperationTypesError] = useState("");

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setMachinesLoading(true);
        setMachinesError("");
        const res = await api.get("/machines/");
        const list = Array.isArray(res.data) ? res.data : [];
        setMachines(list);
      } catch (err) {
        console.error(err);
        setMachinesError("Failed to load machines");
      } finally {
        setMachinesLoading(false);
      }
    };

    fetchMachines();
  }, []);

  useEffect(() => {
    const fetchOperationTypes = async () => {
      try {
        setOperationTypesLoading(true);
        setOperationTypesError("");
        const res = await api.get("/operation-type/");
        const list = Array.isArray(res.data) ? res.data : [];
        setOperationTypes(list);
      } catch (err) {
        console.error(err);
        setOperationTypesError("Failed to load operation types");
      } finally {
        setOperationTypesLoading(false);
      }
    };

    fetchOperationTypes();
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const totalCost = result?.cost_breakdown?.unit_cost;

  const filteredMachines = useMemo(() => {
    const normalize = (value) => {
      if (value == null) return "";
      return String(value)
        .trim()
        .toLowerCase()
        .replace(/[_-]/g, " ")
        .replace(/\s+/g, " ");
    };

    const opType = normalize(form.operation_type);
    if (!opType) return machines;

    const selectedOp = operationTypes.find(
      (ot) => normalize(ot?.operation_name) === opType
    );
    const selectedOpId = selectedOp?.id != null ? String(selectedOp.id) : "";

    const getMachineOpName = (m) => {
      const fromNested =
        m?.operation_type?.operation_name ?? m?.operation_types?.operation_name;
      if (fromNested) return normalize(fromNested);
      const opId =
        m?.op_id ??
        m?.operation_type_id ??
        m?.operation_type?.id ??
        m?.operation_types?.id;
      if (opId == null) return "";
      const lookup = operationTypes.find((ot) => String(ot.id) === String(opId));
      return normalize(lookup?.operation_name);
    };

    const getMachineOpId = (m) => {
      const opId =
        m?.op_id ??
        m?.operation_type_id ??
        m?.operation_type?.id ??
        m?.operation_types?.id;
      return opId == null ? "" : String(opId);
    };

    return machines.filter((m) => {
      if (selectedOpId) {
        return getMachineOpId(m) === selectedOpId;
      }
      return getMachineOpName(m) === opType;
    });
  }, [form.operation_type, machines, operationTypes]);

  useEffect(() => {
    setForm((prev) => {
      if (!filteredMachines || filteredMachines.length === 0) {
        return prev.machine_name ? { ...prev, machine_name: "" } : prev;
      }

      const stillValid = filteredMachines.some((m) => m.name === prev.machine_name);
      if (stillValid) return prev;

      const nextName = filteredMachines[0]?.name;
      return nextName ? { ...prev, machine_name: nextName } : prev;
    });
  }, [filteredMachines]);

  const rows = useMemo(() => {
    if (!result) return [];
    return flattenObject(result).filter(([k]) => {
      if (!k) return false;
      if (k === "calculation_steps" || k.startsWith("calculation_steps.")) {
        return false;
      }

      if (
        k === "shape" ||
        k === "volume" ||
        k === "material" ||
        k === "operation_type" ||
        k === "selected_machine.id" ||
        k === "selected_machine.operation_type_id" ||
        k === "dimensions.length" ||
        k === "dimensions.breadth" ||
        k === "dimensions.height"
      ) {
        return false;
      }
      return true;
    });
  }, [result]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const opType = String(form.operation_type || "").toLowerCase();
    const length = Number(form.length);
    const diameter = Number(form.diameter);
    const breadth = Number(form.breadth);
    const height = Number(form.height);
    const manHours = Number(form.man_hours_per_unit);

    if (!opType) {
      setError("Operation Type is required");
      return;
    }

    if (!Number.isFinite(length) || length <= 0) {
      setError("Length must be a positive number");
      return;
    }

    if (opType === "turning") {
      if (!Number.isFinite(diameter) || diameter <= 0) {
        setError("Diameter must be a positive number");
        return;
      }
    }

    if (opType === "milling") {
      if (!Number.isFinite(breadth) || breadth <= 0) {
        setError("Breadth must be a positive number");
        return;
      }
      if (!Number.isFinite(height) || height <= 0) {
        setError("Height must be a positive number");
        return;
      }
    }

    if (!Number.isFinite(manHours) || manHours < 0) {
      setError("Man Hours / Unit must be a valid number");
      return;
    }

    const dimensions = { length };
    if (opType === "turning") {
      dimensions.diameter = diameter;
    }
    if (opType === "milling") {
      dimensions.breadth = breadth;
      dimensions.height = height;
    }

    const payload = {
      dimensions,
      material: String(form.material || ""),
      operation_type: String(form.operation_type || ""),
      machine_name: String(form.machine_name || ""),
      man_hours_per_unit: manHours,
    };

    try {
      setLoading(true);
      setError("");
      const res = await api.post("/cost-estimation/calculate", payload);
      setResult(res.data);
    } catch (err) {
      console.error(err);
      const serverMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to calculate cost";
      setError(String(serverMessage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
              Cost Estimation
            </h1>
            <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-2xl">
              Enter inputs and calculate the unit cost.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {loading && (
              <span className="text-xs text-slate-500 animate-pulse">Calculating...</span>
            )}
          </div>
        </div>
      </header>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between gap-3">
          <h2 className="text-sm md:text-base font-semibold text-slate-800">
            Calculate
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
              {String(form.operation_type || "").toLowerCase() || "-"}
            </span>
            <span className="text-[11px] px-2 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
              {String(form.material || "").toLowerCase() || "-"}
            </span>
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-4">

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Operation Type</label>
              <select
                value={form.operation_type}
                onChange={(e) => handleChange("operation_type", e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 shadow-sm"
              >
                <option value="milling">milling</option>
                <option value="turning">turning</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Material Type</label>
              <select
                value={form.material}
                onChange={(e) => handleChange("material", e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 shadow-sm"
              >
                <option value="steel">steel</option>
                <option value="aluminium">aluminium</option>
                <option value="titanium">titanium</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Machine Name</label>
              <select
                value={form.machine_name}
                onChange={(e) => handleChange("machine_name", e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 shadow-sm"
                disabled={machinesLoading || operationTypesLoading || filteredMachines.length === 0}
              >
                {filteredMachines.length === 0 && (
                  <option value="">
                    {machinesLoading || operationTypesLoading ? "Loading..." : "No machines for this operation"}
                  </option>
                )}
                {filteredMachines.map((m) => (
                  <option key={m.id ?? m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
              {machinesError && (
                <span className="text-[11px] text-red-600">{machinesError}</span>
              )}
              {operationTypesError && (
                <span className="text-[11px] text-red-600">{operationTypesError}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Man Hours / Unit</label>
              <input
                type="number"
                step="0.01"
                value={form.man_hours_per_unit}
                onChange={(e) => handleChange("man_hours_per_unit", e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 shadow-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Length</label>
              <input
                type="number"
                value={form.length}
                onChange={(e) => handleChange("length", e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 shadow-sm"
              />
            </div>

            {String(form.operation_type || "").toLowerCase() === "turning" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Diameter</label>
                <input
                  type="number"
                  value={form.diameter}
                  onChange={(e) => handleChange("diameter", e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 shadow-sm"
                />
              </div>
            )}

            {String(form.operation_type || "").toLowerCase() === "milling" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">Breadth</label>
                  <input
                    type="number"
                    value={form.breadth}
                    onChange={(e) => handleChange("breadth", e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 shadow-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">Height</label>
                  <input
                    type="number"
                    value={form.height}
                    onChange={(e) => handleChange("height", e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs md:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 shadow-sm"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-500">
              Machine list: {filteredMachines.length} available
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Calculate
            </button>
          </div>
        </form>
        </div>
      </section>

      {result && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 md:px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between gap-3">
            <h2 className="text-sm md:text-base font-semibold text-slate-800">
              Result
            </h2>
            <div className="text-[11px] text-slate-500">{rows.length} fields</div>
          </div>

          <div className="p-4 md:p-5 space-y-4">
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-700 border-b border-slate-100">
                    Field
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-700 border-b border-slate-100">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {totalCost != null && (
                  <tr className="bg-gradient-to-r from-sky-50 to-white">
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-900 whitespace-nowrap font-semibold">
                      Total Cost
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-900 font-semibold">
                      {formatValue("total_cost", totalCost)}
                    </td>
                  </tr>
                )}
                {rows.map(([k, v]) => (
                  <tr key={k} className="odd:bg-white even:bg-slate-50/40">
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-700 whitespace-nowrap font-medium">
                      {k}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-700">
                      {formatValue(k, v)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-4 text-center text-slate-400 text-xs"
                    >
                      No result data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default CostEstimationPage;
