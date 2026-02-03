import React from "react";
import CrudTable from "../../components/CrudTable";
import api from "../../api/client";
import { Box } from "@mui/material";

function OperationTypesPage() {
  return (
    <Box sx={{ width: "100%" }}>
      <CrudTable
        title="Operation Type"
        resourcePath="/operation-type/"
        columns={[
          { key: "operation_name", label: "Operation Name" },
        ]}
        initialFormState={{ operation_name: "" }}
      />
    </Box>
  );
}

export default OperationTypesPage;
