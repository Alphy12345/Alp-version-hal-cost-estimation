import React from "react";
import CrudTable from "../../components/CrudTable";

function DutiesPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Duties
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl">
            Manage duty classifications.
          </p>
        </div>
      </header>

      <CrudTable
        title="Duties"
        resourcePath="/duties/"
        columns={[{ key: "name", label: "Duty" }]}
        initialFormState={{ name: "" }}
      />
    </div>
  );
}

export default DutiesPage;
