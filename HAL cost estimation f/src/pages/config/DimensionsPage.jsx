import React from "react";
import CrudTable from "../../components/CrudTable";

function DimensionsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Dimensions
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl">
            Manage dimension types used for cost estimation.
          </p>
        </div>
      </header>

      <CrudTable
        title="Dimensions"
        resourcePath="/dimensions/"
        columns={[{ key: "name", label: "Dimension" }]}
        initialFormState={{ name: "" }}
      />
    </div>
  );
}

export default DimensionsPage;
