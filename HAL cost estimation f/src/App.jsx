import React, { useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ConfigurationPage from "./pages/ConfigurationPage.jsx";
import CostEstimationPage from "./pages/CostEstimationPage.jsx";

function App() {
  const [activeSection, setActiveSection] = useState("configuration");

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-full">
        <Sidebar active={activeSection} onChange={setActiveSection} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {activeSection === "configuration" && <ConfigurationPage />}
          {activeSection === "cost_estimation" && <CostEstimationPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
