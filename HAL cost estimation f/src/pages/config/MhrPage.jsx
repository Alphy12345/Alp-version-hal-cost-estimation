import React, { useEffect, useState } from "react";
import MhrForm from "../../components/MhrForm";
import api from "../../api/client";

function MhrPage() {
  const [operationTypes, setOperationTypes] = useState([]);
  const [duties, setDuties] = useState([]);
  const [machines, setMachines] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [opTypesRes, dutiesRes, machinesRes] = await Promise.all([
          api.get("/operation-type/"),
          api.get("/duties/"),
          api.get("/machines/"),
        ]);
        setOperationTypes(opTypesRes.data || []);
        setDuties(dutiesRes.data || []);
        setMachines(machinesRes.data || []);
      } catch (err) {
        console.error("Failed to load lookup data", err);
      }
    };
    fetchLookups();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/mhr/");
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);
      setError("");
      
      if (editingItem) {
        await api.put(`/mhr/${editingItem.id}`, formData);
      } else {
        await api.post("/mhr/", formData);
      }
      
      setEditingItem(null);
      fetchItems();
    } catch (err) {
      console.error(err);
      setError("Failed to save data");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      setError("");
      await api.delete(`/mhr/${id}`);
      fetchItems();
    } catch (err) {
      console.error(err);
      setError("Failed to delete data");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingItem(null);
  };

  const getOperationTypeName = (opTypeId) => {
    const op = operationTypes.find(ot => ot.id === opTypeId);
    return op?.operation_name ?? opTypeId ?? "-";
  };

  const getDutyName = (dutyId) => {
    const du = duties.find(duty => duty.id === dutyId);
    return du?.name ?? dutyId ?? "-";
  };

  const getMachineName = (machineId) => {
    const m = machines.find(mach => mach.id === machineId);
    return m?.name ?? machineId ?? "-";
  };

  return (
    <div className="space-y-6 w-full">
      {/* Form Section */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-sm md:text-base font-semibold text-slate-900">
            MHR {editingItem ? "Edit" : "Add"}
          </h2>
          {loading && (
            <span className="text-xs text-slate-500 animate-pulse">Loading...</span>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <MhrForm
          operationTypes={operationTypes}
          duties={duties}
          machines={machines}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          initialData={editingItem || {}}
          loading={loading}
        />
      </section>

      {/* Table Section */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-sm md:text-base font-semibold text-slate-900">MHR Records</h2>
          {loading && (
            <span className="text-xs text-slate-500 animate-pulse">Loading...</span>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-xs md:text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Operation Type</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Duty</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Machine</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Investment Cost</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Power Rating</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Power Charges</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Available Hrs</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Utilization Hrs</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">MHR</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700 border-b border-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-center text-slate-500 text-xs">
                    No data available
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-2 border-b border-slate-200 text-slate-700">
                    {getOperationTypeName(item.op_type_id)}
                  </td>
                  <td className="px-3 py-2 border-b border-slate-200 text-slate-700">
                    {getDutyName(item.duty_id)}
                  </td>
                  <td className="px-3 py-2 border-b border-slate-200 text-slate-700">
                    {getMachineName(item.machine_id)}
                  </td>
                  <td className="px-3 py-2 border-b border-slate-200 text-slate-700">
                    {item.investment_cost || "-"}
                  </td>
                  <td className="px-3 py-2 border-b border-slate-200 text-slate-700">
                    {item.elect_power_rating || "-"}
                  </td>
                  <td className="px-3 py-2 border-b border-slate-200 text-slate-700">
                    {item.elect_power_charges || "-"}
                  </td>
                  <td className="px-3 py-2 border-b border-slate-200 text-slate-700">
                    {item.available_hrs_per_annum || "-"}
                  </td>
                  <td className="px-3 py-2 border-b border-slate-200 text-slate-700">
                    {item.utilization_hrs_year || "-"}
                  </td>
                  <td className="px-3 py-2 border-b border-slate-200 text-slate-700 font-medium">
                    {item.machine_hr_rate || "-"}
                  </td>
                  <td className="px-3 py-2 border-b border-slate-200 text-right space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="inline-flex items-center px-2 py-1 rounded-md border border-slate-300 text-[11px] text-slate-700 bg-white hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="inline-flex items-center px-2 py-1 rounded-md border border-red-300 text-[11px] text-red-700 bg-red-50 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default MhrPage;
