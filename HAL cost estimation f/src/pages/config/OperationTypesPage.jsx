import React from "react";
import CrudTable from "../../components/CrudTable";
import api from "../../api/client";

function OperationTypesPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Operation Types
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl">
            Manage operation types used for cost estimation.
          </p>
        </div>
      </header>

      <CrudTable
        title="Operation Type"
        resourcePath="/operation-type/"
        columns={[
          { key: "operation_name", label: "Operation Name" },
        ]}
        initialFormState={{ operation_name: "" }}
      />
    </div>
  );
}

export default OperationTypesPage;
