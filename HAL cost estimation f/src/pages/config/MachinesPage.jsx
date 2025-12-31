import React, { useEffect, useState } from "react";
import CrudTable from "../../components/CrudTable";
import api from "../../api/client";

function MachinesPage() {
  const [operationTypes, setOperationTypes] = useState([]);

  useEffect(() => {
    const fetchOperationTypes = async () => {
      try {
        const res = await api.get("/operation-type/");
        setOperationTypes(res.data || []);
      } catch (err) {
        console.error("Failed to load operation types", err);
      }
    };
    fetchOperationTypes();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Machines
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl">
            Manage machines and assign operation types.
          </p>
        </div>
      </header>

      <CrudTable
        title="Machines"
        resourcePath="/machines/"
        columns={[
          { key: "name", label: "Machine Name" },
          {
            key: "op_id",
            label: "Operation Type",
            getValue: (item) => {
              const opFromLookup = operationTypes.find(
                (ot) => ot.id === item.op_id
              );
              return (
                item.operation_types?.operation_name ??
                opFromLookup?.operation_name ??
                item.op_id ??
                "-"
              );
            },
            renderInput: ({ value, onChange }) => (
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-slate-200 text-xs md:text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500"
              >
                <option value="">Select Operation Type</option>
                {operationTypes.map((ot) => (
                  <option key={ot.id} value={ot.id}>
                    {ot.operation_name}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
        initialFormState={{ name: "", op_id: "" }}
      />
    </div>
  );
}

export default MachinesPage;
