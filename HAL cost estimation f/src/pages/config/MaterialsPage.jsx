import React from "react";
import CrudTable from "../../components/CrudTable";
import { Box } from "@mui/material";

function MaterialsPage() {
  return (
    <Box sx={{ width: "100%" }}>
      <CrudTable
        title="Materials"
        resourcePath="/materials/"
        columns={[{ key: "name", label: "Material" }]}
        initialFormState={{ name: "" }}
      />
    </Box>
  );
}

export default MaterialsPage;
