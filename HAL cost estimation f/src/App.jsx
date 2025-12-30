import React, { useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ConfigurationPage from "./pages/ConfigurationPage.jsx";
import CostEstimationPage from "./pages/CostEstimationPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import CreateProjectPage from "./pages/CreateProjectPage.jsx";
import ProjectDetailPage from "./pages/ProjectDetailPage.jsx";
import EditProjectPage from "./pages/EditProjectPage.jsx";

function App() {
  const [activeSection, setActiveSection] = useState("configuration");
  const [createdProject, setCreatedProject] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [editProjectId, setEditProjectId] = useState(null);

  const handleSectionChange = (section, data) => {
    if (section === "project_detail" && data?.projectId) {
      setCurrentProjectId(data.projectId);
    } else if (section === "edit_project" && data?.projectId) {
      setEditProjectId(data.projectId);
    }
    setActiveSection(section);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <Sidebar active={activeSection} onChange={handleSectionChange} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {activeSection === "configuration" && <ConfigurationPage />}
          {activeSection === "cost_estimation" && <CostEstimationPage />}
          {activeSection === "projects" && <ProjectsPage onChange={handleSectionChange} />}
          {activeSection === "create_project" && <CreateProjectPage onChange={handleSectionChange} onCreate={setCreatedProject} />}
          {activeSection === "project_detail" && <ProjectDetailPage onChange={handleSectionChange} projectId={currentProjectId} />}
          {activeSection === "edit_project" && <EditProjectPage onChange={handleSectionChange} projectId={editProjectId} />}
        </main>
      </div>
    </div>
  );
}

export default App;
