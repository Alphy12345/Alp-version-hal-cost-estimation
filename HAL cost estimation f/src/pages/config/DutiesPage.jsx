import React from "react";
import CrudTable from "../../components/CrudTable";
import { Box } from "@mui/material";

function DutiesPage() {
  return (
    <Box sx={{ width: "100%" }}>
      <CrudTable
        title="Duties"
        resourcePath="/duties/"
        columns={[{ key: "name", label: "Duty" }]}
        initialFormState={{ name: "" }}
      />
    </Box>
  );
}

export default DutiesPage;
