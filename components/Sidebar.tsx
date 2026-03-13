import React, { useState, useRef, useEffect } from 'react';
import { ModuleDefinition, ProjectState, ModuleStatus, GlobalState } from '../types';
import { CheckCircle, Lock, CircleDashed, AlertCircle, PlayCircle, Plus, History, Trash2, ChevronRight, ChevronDown, Pencil } from 'lucide-react';
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
  onRenameProject: (id: string, name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  modules, 
  globalState,
  effectiveModel,
  isUsingBuiltinKey,
  onSelectModule, 
  onCreateProject, 
  onSwitchProject,
  onDeleteProject,
  onRenameProject
}) => {
  const [showProjects, setShowProjects] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showSocialPopover, setShowSocialPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  
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

  const modelLabel = MODEL_OPTIONS.find(m => m.id === effectiveModel)?.label || 'Gemini 2.5 Flash';

  useEffect(() => {
    if (editingProjectId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingProjectId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSocialPopover(false);
      }
    };
    if (showSocialPopover) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSocialPopover]);

  const handleRenameSubmit = (id: string) => {
    if (editName.trim()) {
      onRenameProject(id, editName.trim());
    }
    setEditingProjectId(null);
  };

  const startEditing = (p: ProjectState, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(p.id);
    setEditName(p.name);
  };

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 overflow-hidden shrink-0">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-1">
          <img src="/assets/ventureforge_logo_icon.png" alt="VentureForge" className="w-8 h-8 rounded-lg shadow-sm" />
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">
            VentureForge
            <span className="text-studio-600 text-xs font-semibold align-top ml-0.5">v1</span>
          </h1>
        </div>
        <p className="text-[11px] text-gray-400 font-medium uppercase tracking-widest pl-0.5">AI Venture Research</p>
        <div className="relative inline-block mt-1" ref={popoverRef}>
          <p className="text-[10px] text-gray-300 pl-0.5">
            Built with love by{' '}
            <button
              onClick={() => setShowSocialPopover(!showSocialPopover)}
              className="text-gray-400 hover:text-studio-600 border-b border-dotted border-gray-300 hover:border-studio-500 transition-colors cursor-pointer"
            >
              Shubham Srivastava
            </button>
          </p>
          {showSocialPopover && (
            <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex items-center gap-1 p-1.5">
              <a href="https://x.com/shubvastav" target="_blank" rel="noreferrer" className="p-1.5 rounded-md hover:bg-gray-100 transition-colors" title="Twitter / X">
                <img src="/assets/twitter.png" alt="Twitter" className="w-5 h-5" />
              </a>
              <a href="https://www.linkedin.com/in/shubham67" target="_blank" rel="noreferrer" className="p-1.5 rounded-md hover:bg-gray-100 transition-colors" title="LinkedIn">
                <img src="/assets/linkedin.png" alt="LinkedIn" className="w-5 h-5" />
              </a>
              <a href="mailto:shubvast@gmail.com" className="p-1.5 rounded-md hover:bg-gray-100 transition-colors" title="Email">
                <img src="/assets/gmail.png" alt="Email" className="w-5 h-5" />
              </a>
            </div>
          )}
        </div>
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
                onClick={() => { if (!editingProjectId) { onSwitchProject(p.id); setShowProjects(false); } }}
                className={`group w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                  p.id === activeProject.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {editingProjectId === p.id ? (
                  <input
                    ref={editInputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRenameSubmit(p.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(p.id); if (e.key === 'Escape') setEditingProjectId(null); }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-sm bg-white border border-studio-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-studio-500"
                  />
                ) : (
                  <span className="truncate flex-1">{p.name}</span>
                )}
                <div className="flex items-center gap-0.5">
                  {editingProjectId !== p.id && (
                    <button
                      onClick={(e) => startEditing(p, e)}
                      className="p-1 text-gray-300 hover:text-studio-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {sortedProjects.length > 1 && editingProjectId !== p.id && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id, e); }}
                      className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
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
