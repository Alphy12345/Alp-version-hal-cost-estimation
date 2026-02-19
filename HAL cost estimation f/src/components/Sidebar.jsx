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
import halLogo from "../assets/download.jpg";

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
          borderRightColor: "#1E293B",
          bgcolor: "#0F172A",
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ px: 3, py: 2.25, bgcolor: "#0F172A" }}>
          <Box
            component="img"
            src={halLogo}
            alt="HAL Logo"
            sx={{
              width: "100%",
              maxWidth: 200,
              height: "auto",
              display: "block",
            }}
          />
        </Box>
        <Divider sx={{ borderColor: "#1E293B" }} />

        <Box sx={{ flex: 1, overflowY: "auto" }}>
          <List sx={{ px: 1.25, py: 1.5 }}>
            <ListItemButton
              selected={active === "projects"}
              onClick={() => onChange("projects")}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: active === "projects" ? "#FFFFFF" : "#94A3B8",
                bgcolor: active === "projects" ? "#1E293B" : "transparent",
                borderLeft: active === "projects" ? "3px solid #6366F1" : "3px solid transparent",
                "&:hover": { bgcolor: "#1E293B" },
              }}
            >
              <ListItemText
                primary="Projects"
                primaryTypographyProps={{
                  fontWeight: 600,
                  color: active === "projects" ? "#FFFFFF" : "#94A3B8",
                }}
              />
            </ListItemButton>

            <ListItemButton
              selected={active.startsWith("config_") || active === "configuration"}
              onClick={() => {
                setIsConfigOpen(!isConfigOpen);
                if (!isConfigOpen) onChange("config_operation_types");
              }}
              sx={{
                borderRadius: 2,
                color: (active.startsWith("config_") || active === "configuration") ? "#FFFFFF" : "#94A3B8",
                bgcolor: (active.startsWith("config_") || active === "configuration") ? "#1E293B" : "transparent",
                borderLeft: (active.startsWith("config_") || active === "configuration") ? "3px solid #6366F1" : "3px solid transparent",
                "&:hover": { bgcolor: "#1E293B" },
              }}
            >
              <ListItemText
                primary="Configuration"
                primaryTypographyProps={{
                  fontWeight: 600,
                  color: (active.startsWith("config_") || active === "configuration") ? "#FFFFFF" : "#94A3B8",
                }}
              />
              <ExpandMoreIcon
                sx={{
                  transform: isConfigOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 150ms ease",
                  opacity: 0.9,
                  color: (active.startsWith("config_") || active === "configuration") ? "#FFFFFF" : "#94A3B8",
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
                    sx={{
                      borderRadius: 2,
                      py: 0.75,
                      mb: 0.25,
                      color: active === item.key ? "#FFFFFF" : "#94A3B8",
                      bgcolor: active === item.key ? "#1E293B" : "transparent",
                      borderLeft: active === item.key ? "3px solid #6366F1" : "3px solid transparent",
                      "&:hover": { bgcolor: "#1E293B" },
                    }}
                  >
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: active === item.key ? "#FFFFFF" : "#94A3B8",
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </List>
        </Box>

        <Divider sx={{ borderColor: "#1E293B" }} />
        <Box sx={{ p: 2 }}>
          <Box sx={{ mb: 1.25 }}>
            <Typography variant="caption" sx={{ color: "#94A3B8" }}>
              Logged in as
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#FFFFFF" }} noWrap>
              {user?.full_name || user?.username}
            </Typography>
          </Box>
          <Button
            onClick={logout}
            variant="outlined"
            fullWidth
            startIcon={<LogoutIcon />}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              py: 1,
              color: "#94A3B8",
              borderColor: "#334155",
              "&:hover": { borderColor: "#475569", bgcolor: "#1E293B", color: "#FFFFFF" },
            }}
          >
            Logout
          </Button>
          <Typography variant="caption" sx={{ display: "block", mt: 1.25, color: "#64748B" }}>
            © {new Date().getFullYear()} Cost Estimation
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
