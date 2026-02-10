import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LogoutIcon from "@mui/icons-material/Logout";

function Sidebar({ active, onChange }) {
  const [isConfigOpen, setIsConfigOpen] = useState(
    active.startsWith("config_") || active === "configuration"
  );
  const { user, logout } = useAuth();

  const configItems = [
    { key: "config_operation_types", label: "Operation Types" },
    { key: "config_machines", label: "Machines" },
    { key: "config_dimensions", label: "Dimensions" },
    { key: "config_duties", label: "Duties" },
    { key: "config_materials", label: "Materials" },
    { key: "config_machine_selection", label: "Machine Selection" },
    { key: "config_mhr", label: "MHR" },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 280,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: 280,
          boxSizing: "border-box",
          borderRightColor: "rgba(255,255,255,0.08)",
          bgcolor: "#000000",
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ px: 3, py: 2.25 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
            HAL Cost Estimation
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Admin Panel
          </Typography>
        </Box>
        <Divider />

        <Box sx={{ flex: 1, overflowY: "auto" }}>
          <List sx={{ px: 1.25, py: 1.5 }}>
            <ListItemButton
              selected={active === "projects"}
              onClick={() => onChange("projects")}
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <ListItemText primary="Projects" primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>

            <ListItemButton
              selected={active.startsWith("config_") || active === "configuration"}
              onClick={() => {
                setIsConfigOpen(!isConfigOpen);
                if (!isConfigOpen) onChange("config_operation_types");
              }}
              sx={{ borderRadius: 2 }}
            >
              <ListItemText primary="Configuration" primaryTypographyProps={{ fontWeight: 600 }} />
              <ExpandMoreIcon
                sx={{
                  transform: isConfigOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 150ms ease",
                  opacity: 0.9,
                }}
              />
            </ListItemButton>

            <Collapse in={isConfigOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding sx={{ pl: 1.5, pt: 0.75 }}>
                {configItems.map((item) => (
                  <ListItemButton
                    key={item.key}
                    selected={active === item.key}
                    onClick={() => onChange(item.key)}
                    sx={{ borderRadius: 2, py: 0.75, mb: 0.25 }}
                  >
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </List>
        </Box>

        <Divider />
        <Box sx={{ p: 2 }}>
          <Box sx={{ mb: 1.25 }}>
            <Typography variant="caption" color="text.secondary">
              Logged in as
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {user?.full_name || user?.username}
            </Typography>
          </Box>
          <Button
            onClick={logout}
            variant="outlined"
            fullWidth
            startIcon={<LogoutIcon />}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, py: 1 }}
          >
            Logout
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
            © {new Date().getFullYear()} HAL
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
