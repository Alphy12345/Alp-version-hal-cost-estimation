import React, { useEffect, useState } from "react";
import CrudTable from "../../components/CrudTable";
import api from "../../api/client";

function MhrPage() {
  const [operationTypes, setOperationTypes] = useState([]);
  const [duties, setDuties] = useState([]);
  const [machines, setMachines] = useState([]);

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

  return (
    <div className="space-y-6 w-full">
      <CrudTable
        title="MHR"
        resourcePath="/mhr/"
        columns={[
          {
            key: "op_type_id",
            label: "Operation Type",
            getValue: (item) => {
              const op = operationTypes.find(
                (ot) => ot.id === item.op_type_id
              );
              return op?.operation_name ?? item.op_type_id ?? "-";
            },
            renderInput: ({ value, onChange }) => (
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-slate-600 text-xs md:text-sm bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500"
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
          {
            key: "duty_id",
            label: "Duty",
            getValue: (item) => {
              const du = duties.find((duty) => duty.id === item.duty_id);
              return du?.name ?? item.duty_id ?? "-";
            },
            renderInput: ({ value, onChange }) => (
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-slate-600 text-xs md:text-sm bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500"
              >
                <option value="">Select Duty</option>
                {duties.map((du) => (
                  <option key={du.id} value={du.id}>
                    {du.name}
                  </option>
                ))}
              </select>
            ),
          },
          {
            key: "machine_id",
            label: "Machine",
            getValue: (item) => {
              const m = machines.find((mach) => mach.id === item.machine_id);
              return m?.name ?? item.machine_id ?? "-";
            },
            renderInput: ({ value, onChange }) => (
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-slate-600 text-xs md:text-sm bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500"
              >
                <option value="">Select Machine</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ),
          },
          { key: "investment_cost", label: "Investment Cost" },
          { key: "elect_power_rating", label: "Electrical Power Rating" },
          { key: "elect_power_charges", label: "Electrical Power Charges" },
          { key: "available_hrs_per_annum", label: "Available Hrs/Annum" },
          { key: "utilization_hrs_year", label: "Utilization Hrs/Year" },
          { key: "machine_hr_rate", label: "Machine Hour Rate" },
        ]}
        initialFormState={{
          op_type_id: "",
          duty_id: "",
          machine_id: "",
          investment_cost: "",
          elect_power_rating: "",
          elect_power_charges: "",
          available_hrs_per_annum: "",
          utilization_hrs_year: "",
          machine_hr_rate: "",
        }}
      />
    </div>
  );
}

export default MhrPage;
