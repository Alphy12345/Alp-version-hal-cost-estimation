import React, { useState, useEffect } from "react";
import api from "../api/client";

function MhrForm({ 
  operationTypes, 
  duties, 
  machines, 
  onSubmit, 
  onCancel, 
  initialData = {},
  loading = false 
}) {
  const [form, setForm] = useState({
    op_type_id: "",
    duty_id: "",
    machine_id: "",
    investment_cost: "",
    elect_power_rating: "",
    elect_power_charges: "",
    available_hrs_per_annum: "",
    utilization_hrs_year: "",
    machine_hr_rate: "",
    ...initialData
  });

  const [calculatedMHR, setCalculatedMHR] = useState("");
  const [autoCalculated, setAutoCalculated] = useState({
    elect_power_charges: true,
    utilization_hrs_year: true,
  });

  // Immediate electrical power charges calculation when power rating changes
  useEffect(() => {
    const { elect_power_rating, elect_power_charges } = form;
    
    // Auto-calculate if user hasn't manually overridden it
    if (
      elect_power_rating &&
      (autoCalculated.elect_power_charges || !elect_power_charges || elect_power_charges === "")
    ) {
      const calculatedPowerCharges = parseFloat(elect_power_rating) * 5.0;
      setForm(prev => ({
        ...prev,
        elect_power_charges: calculatedPowerCharges.toString()
      }));
      setAutoCalculated(prev => ({ ...prev, elect_power_charges: true }));
    }
  }, [form.elect_power_rating, autoCalculated.elect_power_charges]);

  // Immediate utilization hours calculation when available hours or machine type changes
  useEffect(() => {
    const { available_hrs_per_annum, utilization_hrs_year, machine_id } = form;
    
    // If available hours is empty and this field is auto-calculated, clear it
    if (!available_hrs_per_annum) {
      if (autoCalculated.utilization_hrs_year && utilization_hrs_year) {
        setForm(prev => ({ ...prev, utilization_hrs_year: "" }));
      }
      return;
    }

    // Auto-calculate if user hasn't manually overridden it
    if (
      available_hrs_per_annum &&
      (autoCalculated.utilization_hrs_year || !utilization_hrs_year || utilization_hrs_year === "")
    ) {
      // Get machine type from selected machine
      let machineType = "conventional"; // default
      if (machine_id && machines) {
        const selectedMachine = machines.find(m => m.id === parseInt(machine_id));
        if (selectedMachine && selectedMachine.name) {
          machineType = selectedMachine.name.toLowerCase().includes("cnc") ? "cnc" : "conventional";
        }
      }
      
      // Calculate downtime based on machine type
      const downtimePercentage = machineType === "cnc" ? 0.15 : 0.07;
      const available = Number.parseFloat(available_hrs_per_annum);
      if (!Number.isFinite(available)) {
        if (autoCalculated.utilization_hrs_year && utilization_hrs_year) {
          setForm(prev => ({ ...prev, utilization_hrs_year: "" }));
        }
        return;
      }

      const downtimeHours = available * downtimePercentage;
      const calculatedUtilizationHours = available - downtimeHours;

      // Prefer integer display when result is effectively an integer (e.g. 3348)
      const roundedUtilization = Math.round(calculatedUtilizationHours);
      const utilizationDisplay =
        Math.abs(calculatedUtilizationHours - roundedUtilization) < 1e-9
          ? String(roundedUtilization)
          : String(Number(calculatedUtilizationHours.toFixed(2)));
      
      setForm(prev => ({
        ...prev,
        utilization_hrs_year: utilizationDisplay
      }));
      setAutoCalculated(prev => ({ ...prev, utilization_hrs_year: true }));
    }
  }, [form.available_hrs_per_annum, form.machine_id, machines, autoCalculated.utilization_hrs_year]);

  // Calculate MHR whenever relevant fields change
  useEffect(() => {
    const calculateMHR = async () => {
      const {
        investment_cost,
        elect_power_rating,
        elect_power_charges,
        available_hrs_per_annum,
        utilization_hrs_year,
        machine_id
      } = form;

      // Check if investment cost is available (minimum required field)
      if (!investment_cost) {
        setCalculatedMHR("");
        return;
      }

      try {
        // Get machine type from selected machine
        let machineType = "conventional"; // default
        if (machine_id && machines) {
          const selectedMachine = machines.find(m => m.id === parseInt(machine_id));
          if (selectedMachine && selectedMachine.name) {
            machineType = selectedMachine.name.toLowerCase().includes("cnc") ? "cnc" : "conventional";
          }
        }

        // Send to backend with auto-calculation for missing values
        const response = await api.post("/mhr/calculate", {
          investment_cost: parseFloat(investment_cost) || 0,
          elect_power_rating: parseFloat(elect_power_rating) || 0,
          // If auto-calculated, always send 0 so backend recalculates (prevents partial-input locking)
          elect_power_charges: autoCalculated.elect_power_charges
            ? 0
            : (elect_power_charges ? parseFloat(elect_power_charges) : 0),
          available_hrs_per_annum: parseFloat(available_hrs_per_annum) || 0,
          // If auto-calculated, always send 0 so backend recalculates (prevents partial-input locking)
          utilization_hrs_year: autoCalculated.utilization_hrs_year
            ? 0
            : (utilization_hrs_year ? parseFloat(utilization_hrs_year) : 0),
          machine_type: machineType
        });
        
        const finalMHR = response.data.machine_hour_rate;
        const breakdown = response.data.calculation_breakdown;
        
        setCalculatedMHR(finalMHR.toString());
        
        // Update form with calculated values - only if user hasn't manually overridden
        setForm(prev => {
          const updatedForm = { ...prev, machine_hr_rate: finalMHR.toString() };
          
          if (autoCalculated.elect_power_charges) {
            updatedForm.elect_power_charges = breakdown.electrical_power_charges.toString();
          }
          
          if (autoCalculated.utilization_hrs_year) {
            updatedForm.utilization_hrs_year = breakdown.utilization_hrs_year.toString();
          }
          
          return updatedForm;
        });
      } catch (err) {
        console.error("Failed to calculate MHR", err);
        setCalculatedMHR("");
      }
    };

    // Trigger calculation when any relevant field changes
    const relevantFields = [
      'investment_cost',
      'elect_power_rating', 
      'available_hrs_per_annum',
      'machine_id'
    ];

    const hasRelevantValues = relevantFields.some(field => form[field]);
    if (hasRelevantValues) {
      calculateMHR();
    }
  }, [form.investment_cost, form.elect_power_rating, form.elect_power_charges, form.available_hrs_per_annum, form.utilization_hrs_year, form.machine_id, machines]);

  const handleChange = (key, value) => {
    if (key === "elect_power_charges") {
      setAutoCalculated(prev => ({ ...prev, elect_power_charges: false }));
    }
    if (key === "utilization_hrs_year") {
      setAutoCalculated(prev => ({ ...prev, utilization_hrs_year: false }));
    }
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Ensure the calculated MHR is included in the submission
    const submissionData = { ...form, machine_hr_rate: calculatedMHR || form.machine_hr_rate };
    onSubmit(submissionData);
  };

  const handleReset = () => {
    setForm({
      op_type_id: "",
      duty_id: "",
      machine_id: "",
      investment_cost: "",
      elect_power_rating: "",
      elect_power_charges: "",
      available_hrs_per_annum: "",
      utilization_hrs_year: "",
      machine_hr_rate: "",
    });
    setCalculatedMHR("");
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {/* Operation Type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">Operation Type</label>
          <select
            value={form.op_type_id}
            onChange={(e) => handleChange("op_type_id", e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
          >
            <option value="">Select Operation Type</option>
            {operationTypes.map((ot) => (
              <option key={ot.id} value={ot.id}>
                {ot.operation_name}
              </option>
            ))}
          </select>
        </div>

        {/* Duty */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">Duty</label>
          <select
            value={form.duty_id}
            onChange={(e) => handleChange("duty_id", e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
          >
            <option value="">Select Duty</option>
            {duties.map((du) => (
              <option key={du.id} value={du.id}>
                {du.name}
              </option>
            ))}
          </select>
        </div>

        {/* Machine */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">Machine</label>
          <select
            value={form.machine_id}
            onChange={(e) => handleChange("machine_id", e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
          >
            <option value="">Select Machine</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Investment Cost */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">Investment Cost</label>
          <input
            type="number"
            step="0.01"
            value={form.investment_cost}
            onChange={(e) => handleChange("investment_cost", e.target.value)}
            placeholder="Enter investment cost"
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
          />
        </div>

        {/* Electrical Power Rating */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">Electrical Power Rating</label>
          <input
            type="number"
            step="0.01"
            value={form.elect_power_rating}
            onChange={(e) => handleChange("elect_power_rating", e.target.value)}
            placeholder="Enter power rating in kW"
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
          />
        </div>

        {/* Electrical Power Charges */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">
            Electrical Power Charges
            {form.elect_power_rating && (!form.elect_power_charges || form.elect_power_charges === "") && (
              <span className="text-green-600 ml-1">✓ Auto-calculated</span>
            )}
          </label>
          <input
            type="number"
            step="0.01"
            value={form.elect_power_charges}
            onChange={(e) => handleChange("elect_power_charges", e.target.value)}
            placeholder={form.elect_power_rating ? `Auto-calculated: ${form.elect_power_rating} × 5 = ${(parseFloat(form.elect_power_rating) * 5).toFixed(2)}` : "Enter power rating first"}
            readOnly={form.elect_power_rating && (!form.elect_power_charges || form.elect_power_charges === "")}
            className={`px-2.5 py-1.5 rounded-md border text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 ${
              form.elect_power_rating && (!form.elect_power_charges || form.elect_power_charges === "")
                ? "border-green-300 bg-green-50 text-slate-600 cursor-not-allowed"
                : "border-slate-300 bg-white text-slate-900"
            }`}
          />
          {form.elect_power_rating && (!form.elect_power_charges || form.elect_power_charges === "") && (
            <span className="text-xs text-green-600 mt-1">
              Formula: {form.elect_power_rating} kW × 5.0 = {(parseFloat(form.elect_power_rating) * 5).toFixed(2)}
            </span>
          )}
        </div>

        {/* Available Hrs/Annum */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">Available Hrs/Annum</label>
          <input
            type="number"
            step="0.01"
            value={form.available_hrs_per_annum}
            onChange={(e) => handleChange("available_hrs_per_annum", e.target.value)}
            placeholder="Enter available hours per annum"
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
          />
        </div>

        {/* Utilization Hrs/Year */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">
            Utilization Hrs/Year
            {form.available_hrs_per_annum && (!form.utilization_hrs_year || form.utilization_hrs_year === "") && (
              <span className="text-green-600 ml-1">✓ Auto-calculated</span>
            )}
          </label>
          <input
            type="number"
            step="0.01"
            value={form.utilization_hrs_year}
            onChange={(e) => handleChange("utilization_hrs_year", e.target.value)}
            placeholder={form.available_hrs_per_annum ? "Auto-calculated from available hours - downtime" : "Enter available hours first"}
            readOnly={form.available_hrs_per_annum && (!form.utilization_hrs_year || form.utilization_hrs_year === "")}
            className={`px-2.5 py-1.5 rounded-md border text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 ${
              form.available_hrs_per_annum && (!form.utilization_hrs_year || form.utilization_hrs_year === "")
                ? "border-green-300 bg-green-50 text-slate-600 cursor-not-allowed"
                : "border-slate-300 bg-white text-slate-900"
            }`}
          />
          {form.available_hrs_per_annum && (!form.utilization_hrs_year || form.utilization_hrs_year === "") && (() => {
            // Get machine type for display
            let machineType = "conventional";
            if (form.machine_id && machines) {
              const selectedMachine = machines.find(m => m.id === parseInt(form.machine_id));
              if (selectedMachine && selectedMachine.name) {
                machineType = selectedMachine.name.toLowerCase().includes("cnc") ? "cnc" : "conventional";
              }
            }
            const downtimePercentage = machineType === "cnc" ? 15 : 7;
            const downtimeHours = (parseFloat(form.available_hrs_per_annum) * downtimePercentage / 100).toFixed(2);
            const utilizationHours = (parseFloat(form.available_hrs_per_annum) - parseFloat(downtimeHours)).toFixed(2);
            
            return (
              <span className="text-xs text-green-600 mt-1">
                Formula: {form.available_hrs_per_annum} - {downtimeHours} ({downtimePercentage}% downtime) = {utilizationHours}
              </span>
            );
          })()}
        </div>

        {/* Machine Hour Rate (Auto-calculated) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">Machine Hour Rate</label>
          <input
            type="text"
            value={calculatedMHR || form.machine_hr_rate || ""}
            readOnly
            placeholder="Auto-calculated"
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm bg-slate-100 text-slate-600 cursor-not-allowed"
            title="Machine Hour Rate is automatically calculated based on input values"
          />
          {calculatedMHR && (
            <span className="text-xs text-green-600">✓ Auto-calculated</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        {initialData.id && (
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm text-slate-700 bg-white hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-3 py-1.5 rounded-md text-xs md:text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? "Saving..." : (initialData.id ? "Update" : "Add")}
        </button>
      </div>
    </form>
  );
}

export default MhrForm;
