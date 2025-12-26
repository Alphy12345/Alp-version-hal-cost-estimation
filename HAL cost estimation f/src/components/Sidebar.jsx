import React from "react";

function Sidebar({ active, onChange }) {
  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0">
      <div className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-lg font-semibold tracking-wide">HAL Cost Estimation</h1>
        <p className="text-xs text-slate-400 mt-1">Admin Panel</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange("configuration")}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors border
            ${
              active === "configuration"
                ? "bg-slate-100 text-slate-900 border-slate-300"
                : "bg-transparent text-slate-200 border-transparent hover:bg-slate-800 hover:border-slate-700"
            }`}
        >
          <span>Configuration</span>
        </button>

        <button
          type="button"
          onClick={() => onChange("cost_estimation")}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors border
            ${
              active === "cost_estimation"
                ? "bg-slate-100 text-slate-900 border-slate-300"
                : "bg-transparent text-slate-200 border-transparent hover:bg-slate-800 hover:border-slate-700"
            }`}
        >
          <span>Cost Estimation</span>
        </button>
      </nav>

      <div className="px-4 py-3 border-t border-slate-800 text-[11px] text-slate-500">
        <p>© {new Date().getFullYear()} HAL</p>
      </div>
    </aside>
  );
}

export default Sidebar;
