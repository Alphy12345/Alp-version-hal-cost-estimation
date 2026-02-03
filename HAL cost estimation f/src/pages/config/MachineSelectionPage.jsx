import React, { useEffect, useState } from "react";
import CrudTable from "../../components/CrudTable";
import api from "../../api/client";
import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material";

function MachineSelectionPage() {
  const [machines, setMachines] = useState([]);
  const [dimensions, setDimensions] = useState([]);
  const [duties, setDuties] = useState([]);
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [machinesRes, dimensionsRes, dutiesRes, materialsRes] = await Promise.all([
          api.get("/machines/"),
          api.get("/dimensions/"),
          api.get("/duties/"),
          api.get("/materials/"),
        ]);
        setMachines(machinesRes.data || []);
        setDimensions(dimensionsRes.data || []);
        setDuties(dutiesRes.data || []);
        setMaterials(materialsRes.data || []);
      } catch (err) {
        console.error("Failed to load lookup data", err);
      }
    };
    fetchLookups();
  }, []);

  return (
    <Box sx={{ width: "100%" }}>
      <CrudTable
        title="Machine Selection"
        resourcePath="/machine-selection/"
        columns={[
          {
            key: "machine_id",
            label: "Machine",
            getValue: (item) => {
              const m = machines.find((mach) => mach.id === item.machine_id);
              return m?.name ?? item.machine_id ?? "-";
            },
            renderInput: ({ value, onChange }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Machine</InputLabel>
                <Select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  label="Machine"
                >
                  <MenuItem value="">Select Machine</MenuItem>
                  {machines.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ),
          },
          {
            key: "dimension_id",
            label: "Dimension",
            getValue: (item) => {
              const d = dimensions.find((dim) => dim.id === item.dimension_id);
              return d?.name ?? item.dimension_id ?? "-";
            },
            renderInput: ({ value, onChange }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Dimension</InputLabel>
                <Select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  label="Dimension"
                >
                  <MenuItem value="">Select Dimension</MenuItem>
                  {dimensions.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
              <FormControl fullWidth size="small">
                <InputLabel>Duty</InputLabel>
                <Select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  label="Duty"
                >
                  <MenuItem value="">Select Duty</MenuItem>
                  {duties.map((du) => (
                    <MenuItem key={du.id} value={du.id}>
                      {du.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ),
          },
          {
            key: "material_id",
            label: "Material",
            getValue: (item) => {
              const mat = materials.find((m) => m.id === item.material_id);
              return mat?.name ?? item.material_id ?? "-";
            },
            renderInput: ({ value, onChange }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Material</InputLabel>
                <Select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  label="Material"
                >
                  <MenuItem value="">Select Material</MenuItem>
                  {materials.map((mat) => (
                    <MenuItem key={mat.id} value={mat.id}>
                      {mat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ),
          },
          { key: "size", label: "Size" },
        ]}
        initialFormState={{
          machine_id: "",
          dimension_id: "",
          duty_id: "",
          material_id: "",
          size: "",
        }}
      />
    </Box>
  );
}

export default MachineSelectionPage;
