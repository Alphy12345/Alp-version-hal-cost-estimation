import React, { useEffect, useState } from "react";
import CrudTable from "../../components/CrudTable";
import api from "../../api/client";
import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material";

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
    <Box sx={{ width: "100%" }}>
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
              <FormControl fullWidth size="small">
                <InputLabel>Operation Type</InputLabel>
                <Select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  label="Operation Type"
                >
                  <MenuItem value="">Select Operation Type</MenuItem>
                  {operationTypes.map((ot) => (
                    <MenuItem key={ot.id} value={ot.id}>
                      {ot.operation_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ),
          },
        ]}
        initialFormState={{ name: "", op_id: "" }}
      />
    </Box>
  );
}

export default MachinesPage;
