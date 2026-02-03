import React from "react";
import CrudTable from "../../components/CrudTable";
import { Box } from "@mui/material";

function DimensionsPage() {
  return (
    <Box sx={{ width: "100%" }}>
      <CrudTable
        title="Dimensions"
        resourcePath="/dimensions/"
        columns={[{ key: "name", label: "Dimension" }]}
        initialFormState={{ name: "" }}
      />
    </Box>
  );
}

export default DimensionsPage;
