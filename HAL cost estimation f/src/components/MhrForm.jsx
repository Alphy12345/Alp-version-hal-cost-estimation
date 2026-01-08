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

  // Calculate MHR whenever relevant fields change
  useEffect(() => {
    const calculateMHR = async () => {
      const {
        investment_cost,
        elect_power_rating,
        elect_power_charges,
        available_hrs_per_annum,
        utilization_hrs_year
      } = form;

      // Check if all required fields have values
      if (!investment_cost || !elect_power_charges || !utilization_hrs_year) {
        setCalculatedMHR("");
        return;
      }

      try {
        const response = await api.post("/mhr/calculate", {
          investment_cost: parseFloat(investment_cost) || 0,
          elect_power_rating: parseFloat(elect_power_rating) || 0,
          elect_power_charges: parseFloat(elect_power_charges) || 0,
          available_hrs_per_annum: parseFloat(available_hrs_per_annum) || 0,
          utilization_hrs_year: parseFloat(utilization_hrs_year) || 0,
        });
        
        setCalculatedMHR(response.data.machine_hour_rate.toString());
        // Update form with calculated MHR
        setForm(prev => ({ ...prev, machine_hr_rate: response.data.machine_hour_rate.toString() }));
      } catch (err) {
        console.error("Failed to calculate MHR", err);
        setCalculatedMHR("");
      }
    };

    const relevantFields = [
      'investment_cost',
      'elect_power_rating', 
      'elect_power_charges',
      'available_hrs_per_annum',
      'utilization_hrs_year'
    ];

    const hasRelevantValues = relevantFields.some(field => form[field]);
    if (hasRelevantValues) {
      calculateMHR();
    }
  }, [
    form.investment_cost,
    form.elect_power_rating,
    form.elect_power_charges,
    form.available_hrs_per_annum,
    form.utilization_hrs_year
  ]);

  const handleChange = (key, value) => {
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
          <label className="text-xs font-medium text-slate-700">Electrical Power Charges</label>
          <input
            type="number"
            step="0.01"
            value={form.elect_power_charges}
            onChange={(e) => handleChange("elect_power_charges", e.target.value)}
            placeholder="Enter power charges"
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
          />
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
          <label className="text-xs font-medium text-slate-700">Utilization Hrs/Year</label>
          <input
            type="number"
            step="0.01"
            value={form.utilization_hrs_year}
            onChange={(e) => handleChange("utilization_hrs_year", e.target.value)}
            placeholder="Enter utilization hours per year"
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
          />
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
