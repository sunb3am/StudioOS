import React, { useState } from 'react';
import { ModuleDefinition, ProjectState, ModuleStatus, GlobalState } from '../types';
import { CheckCircle, Lock, CircleDashed, AlertCircle, PlayCircle, Zap, Plus, History, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { MODEL_OPTIONS, MODELS } from '../constants';

interface SidebarProps {
  modules: ModuleDefinition[];
  globalState: GlobalState;
  effectiveModel: string;
  isUsingBuiltinKey: boolean;
  onSelectModule: (id: string) => void;
  onCreateProject: () => void;
  onSwitchProject: (id: string) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  modules, 
  globalState,
  effectiveModel,
  isUsingBuiltinKey,
  onSelectModule, 
  onCreateProject, 
  onSwitchProject,
  onDeleteProject
}) => {
  const [showProjects, setShowProjects] = useState(false);
  
  const activeProject = globalState.projects[globalState.activeProjectId];
  const sortedProjects = (Object.values(globalState.projects) as ProjectState[]).sort((a, b) => b.lastModified - a.lastModified);

  const getStatusIcon = (status: ModuleStatus) => {
    switch (status) {
      case ModuleStatus.COMPLETED: return <CheckCircle className="w-4 h-4 text-studio-500" />;
      case ModuleStatus.RUNNING: return <CircleDashed className="w-4 h-4 text-blue-500 animate-spin" />;
      case ModuleStatus.ERROR: return <AlertCircle className="w-4 h-4 text-red-500" />;
      case ModuleStatus.INTERRUPTED: return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case ModuleStatus.READY: return <PlayCircle className="w-4 h-4 text-studio-400" />;
      case ModuleStatus.LOCKED: default: return <Lock className="w-4 h-4 text-gray-300" />;
    }
  };

  const modelLabel = MODEL_OPTIONS.find(m => m.id === effectiveModel)?.label || 'Gemini 3 Flash';

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 overflow-hidden shrink-0">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 bg-studio-600 rounded-lg flex items-center justify-center shadow-sm">
            <Zap className="text-white w-4 h-4" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">
            VentureForge
            <span className="text-studio-600 text-xs font-semibold align-top ml-0.5">v1</span>
          </h1>
        </div>
        <p className="text-[11px] text-gray-400 font-medium uppercase tracking-widest pl-0.5">AI Venture Research</p>
      </div>

      {/* Project Switcher */}
      <div className="px-3 py-3 border-b border-gray-100">
        <button 
          onClick={() => setShowProjects(!showProjects)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 group"
        >
          <div className="flex items-center overflow-hidden gap-2">
            <History className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Current Project</span>
              <span className="text-sm font-medium text-gray-800 truncate w-full text-left max-w-[160px]">
                {activeProject?.name || "Untitled"}
              </span>
            </div>
          </div>
          {showProjects ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
        </button>

        {showProjects && (
          <div className="mt-2 space-y-0.5 max-h-44 overflow-y-auto">
            <button
              onClick={() => { onCreateProject(); setShowProjects(false); }}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-studio-700 bg-studio-50 hover:bg-studio-100 rounded-lg mb-1.5 gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Venture Analysis
            </button>
            {sortedProjects.map(p => (
              <div 
                key={p.id} 
                onClick={() => { onSwitchProject(p.id); setShowProjects(false); }}
                className={`group w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                  p.id === activeProject.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="truncate flex-1">{p.name}</span>
                {sortedProjects.length > 1 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id, e); }}
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Module Pipeline */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-5 mb-2">
          <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Research Pipeline</h2>
        </div>
        <nav className="space-y-0.5 px-2">
          {modules.map((module) => {
            const status = activeProject?.modules[module.id]?.status || ModuleStatus.LOCKED;
            const isActive = activeProject?.currentModuleId === module.id;
            const isLocked = status === ModuleStatus.LOCKED;

            return (
              <button
                key={module.id}
                onClick={() => !isLocked && onSelectModule(module.id)}
                disabled={isLocked}
                className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-studio-100 text-studio-900 font-medium' 
                    : isLocked 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="mr-2.5 shrink-0">{getStatusIcon(status)}</span>
                <span className="truncate text-left text-[13px]">{module.title}</span>
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isUsingBuiltinKey ? 'bg-amber-400' : 'bg-studio-500'}`} />
          <p className="text-[11px] text-gray-400">
            {isUsingBuiltinKey ? 'Built-in key · ' : 'Custom key · '}{modelLabel}
          </p>
        </div>
      </div>
    </div>
  );
};
