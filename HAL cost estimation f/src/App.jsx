import React, { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import { Box, CircularProgress, Typography } from "@mui/material";
import ConfigurationPage from "./pages/ConfigurationPage.jsx";
import CostEstimationPage from "./pages/CostEstimationPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import CreateProjectPage from "./pages/CreateProjectPage.jsx";
import ProjectDetailPage from "./pages/ProjectDetailPage.jsx";
import EditProjectPage from "./pages/EditProjectPage.jsx";
import PartCostEstimationPage from "./pages/PartCostEstimationPage.jsx";
import OperationTypesPage from "./pages/config/OperationTypesPage.jsx";
import MachinesPage from "./pages/config/MachinesPage.jsx";
import DimensionsPage from "./pages/config/DimensionsPage.jsx";
import DutiesPage from "./pages/config/DutiesPage.jsx";
import MaterialsPage from "./pages/config/MaterialsPage.jsx";
import MachineSelectionPage from "./pages/config/MachineSelectionPage.jsx";
import MhrPage from "./pages/config/MhrPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

function AppContent() {
  const [activeSection, setActiveSection] = useState("configuration");
  const [createdProject, setCreatedProject] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [editProjectId, setEditProjectId] = useState(null);
  const [currentPartId, setCurrentPartId] = useState(null);
  const { isAuthenticated, isLoading, user } = useAuth();

  const handleSectionChange = (section, data) => {
    if (section === "project_detail" && data?.projectId) {
      setCurrentProjectId(data.projectId);
    } else if (section === "edit_project" && data?.projectId) {
      setEditProjectId(data.projectId);
    } else if (section === "part_cost_estimation" && data?.projectId && data?.partId) {
      setCurrentProjectId(data.projectId);
      setCurrentPartId(data.partId);
    }
    setActiveSection(section);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress size={44} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Box sx={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
      <Box sx={{ display: "flex", height: "100%" }}>
        <Sidebar active={activeSection} onChange={handleSectionChange} />
        <Box
          component="main"
          sx={{
            flex: 1,
            overflowY: "auto",
            p: { xs: 2.5, md: 3.5 },
            bgcolor: "background.default",
          }}
        >
          {activeSection === "configuration" && <ConfigurationPage />}
          {activeSection === "cost_estimation" && <CostEstimationPage />}
          {activeSection === "projects" && <ProjectsPage onChange={handleSectionChange} />}
          {activeSection === "create_project" && <CreateProjectPage onChange={handleSectionChange} onCreate={setCreatedProject} />}
          {activeSection === "project_detail" && <ProjectDetailPage onChange={handleSectionChange} projectId={currentProjectId} />}
          {activeSection === "part_cost_estimation" && (
            <PartCostEstimationPage onChange={handleSectionChange} projectId={currentProjectId} partId={currentPartId} />
          )}
          {activeSection === "edit_project" && <EditProjectPage onChange={handleSectionChange} projectId={editProjectId} />}
          {activeSection === "config_operation_types" && <OperationTypesPage />}
          {activeSection === "config_machines" && <MachinesPage />}
          {activeSection === "config_dimensions" && <DimensionsPage />}
          {activeSection === "config_duties" && <DutiesPage />}
          {activeSection === "config_materials" && <MaterialsPage />}
          {activeSection === "config_machine_selection" && <MachineSelectionPage />}
          {activeSection === "config_mhr" && <MhrPage />}
        </Box>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
