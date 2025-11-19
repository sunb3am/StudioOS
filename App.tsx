
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ModuleView } from './components/ModuleView';
import { MODULES, PROMPTS, CORE_SYSTEM_INSTRUCTION, APP_NAME } from './constants';
import { ProjectState, ModuleStatus, ModuleData, GlobalState } from './types';
import { generateGeminiResponse } from './services/geminiService';
import { Settings, Key, ToggleLeft, ToggleRight, Download } from 'lucide-react';

// Initial factory for a fresh project
const createNewProject = (name: string = 'New Venture Concept'): ProjectState => {
  const initialModules: Record<string, ModuleData> = {};
  MODULES.forEach(m => {
    initialModules[m.id] = {
      status: m.id === 'mod-1' ? ModuleStatus.READY : ModuleStatus.LOCKED,
      output: null,
      sources: [],
      feedback: null,
      timestamp: 0,
      versions: []
    };
  });
  
  return {
    id: 'proj-' + Date.now(),
    name,
    theme: '',
    modules: initialModules,
    currentModuleId: 'mod-1',
    autoRun: false,
    lastModified: Date.now()
  };
};

// Ensure no modules are stuck in RUNNING state on load
const sanitizeState = (state: GlobalState): GlobalState => {
  const newState = { ...state };
  Object.keys(newState.projects).forEach(pid => {
    const project = newState.projects[pid];
    let changed = false;
    Object.keys(project.modules).forEach(mid => {
      const mod = project.modules[mid];
      if (mod.status === ModuleStatus.RUNNING) {
        mod.status = ModuleStatus.INTERRUPTED; // Set to interrupted so user knows what happened
        changed = true;
      }
    });
    if (changed) {
      project.lastModified = Date.now();
    }
  });
  return newState;
};

const App: React.FC = () => {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  // Load initial state
  const loadState = (): GlobalState => {
    const saved = localStorage.getItem('studio_os_global_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return sanitizeState(parsed);
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    }
    
    // Fallback or first load
    const firstProject = createNewProject();
    return {
      projects: { [firstProject.id]: firstProject },
      activeProjectId: firstProject.id,
      apiKey: null
    };
  };

  const [globalState, setGlobalState] = useState<GlobalState>(loadState());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('studio_os_global_v1', JSON.stringify(globalState));
  }, [globalState]);

  // API Key Check
  useEffect(() => {
    const envKey = process.env.API_KEY;
    if (envKey && !globalState.apiKey) {
      setGlobalState(prev => ({ ...prev, apiKey: envKey }));
    } else if (!globalState.apiKey) {
      const storedKey = localStorage.getItem('studio_os_api_key');
      if (storedKey) {
        setGlobalState(prev => ({ ...prev, apiKey: storedKey }));
      } else {
        setShowApiKeyModal(true);
      }
    }
  }, []);

  // --- Continuous Mode Waterfall Logic ---
  // Triggers when a module completes, checking if autoRun is enabled and the next module is ready.
  useEffect(() => {
    const activeProject = globalState.projects[globalState.activeProjectId];
    if (!activeProject || !activeProject.autoRun) return;

    const currentModuleDef = MODULES.find(m => m.id === activeProject.currentModuleId);
    if (!currentModuleDef) return;

    const currentModuleData = activeProject.modules[activeProject.currentModuleId];

    // Only proceed if current is finished
    if (currentModuleData.status === ModuleStatus.COMPLETED) {
       const currentIndex = MODULES.findIndex(m => m.id === activeProject.currentModuleId);
       const nextModule = MODULES[currentIndex + 1];
       
       // Check if next module exists and isn't already running or completed (to prevent loops)
       if (nextModule) {
         const nextModuleData = activeProject.modules[nextModule.id];
         if (nextModuleData.status === ModuleStatus.READY) {
           // Move selection to next module and run it
           setTimeout(() => {
             updateProjectState(activeProject.id, (p) => ({ ...p, currentModuleId: nextModule.id }));
             runModule(activeProject.id, nextModule.id);
           }, 1500); // Slight delay for visual clarity
         }
       } else {
         // End of pipeline, turn off autoRun
         updateProjectState(activeProject.id, (p) => ({ ...p, autoRun: false }));
       }
    }
  }, [globalState.projects, globalState.activeProjectId]);


  // Helper to update a specific project's state
  const updateProjectState = (projectId: string, updater: (p: ProjectState) => ProjectState) => {
    setGlobalState(prev => ({
      ...prev,
      projects: {
        ...prev.projects,
        [projectId]: updater(prev.projects[projectId])
      }
    }));
  };

  const handleCreateProject = () => {
    const newProj = createNewProject(`Venture Analysis ${Object.keys(globalState.projects).length + 1}`);
    setGlobalState(prev => ({
      ...prev,
      projects: { ...prev.projects, [newProj.id]: newProj },
      activeProjectId: newProj.id
    }));
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (Object.keys(globalState.projects).length <= 1) return; // Prevent deleting last project
    
    setGlobalState(prev => {
      const newProjects = { ...prev.projects };
      delete newProjects[id];
      // If we deleted the active one, switch to another
      const newActiveId = prev.activeProjectId === id ? Object.keys(newProjects)[0] : prev.activeProjectId;
      return {
        ...prev,
        projects: newProjects,
        activeProjectId: newActiveId
      };
    });
  };

  const handleSwitchProject = (id: string) => {
    setGlobalState(prev => ({ ...prev, activeProjectId: id }));
  };

  const handleSelectModule = (id: string) => {
    updateProjectState(globalState.activeProjectId, (p) => ({ ...p, currentModuleId: id }));
  };

  const toggleAutoRun = () => {
    updateProjectState(globalState.activeProjectId, (p) => ({ ...p, autoRun: !p.autoRun }));
  };

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem('studio_os_api_key', key);
    setGlobalState(prev => ({ ...prev, apiKey: key }));
    setShowApiKeyModal(false);
  };

  const buildContextHistory = (project: ProjectState, currentModuleIndex: number): string => {
    let history = `PROJECT THEME: ${project.theme}\n\n`;
    
    for (let i = 0; i < currentModuleIndex; i++) {
      const modDef = MODULES[i];
      const modData = project.modules[modDef.id];
      if (modData.output) {
        history += `--- START OUTPUT FROM MODULE ${modDef.id} (${modDef.title}) ---\n`;
        history += modData.output;
        history += `\n--- END OUTPUT FROM MODULE ${modDef.id} ---\n\n`;
      }
    }
    return history;
  };

  const handleStopModule = (projectId: string, moduleId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    updateProjectState(projectId, (p) => {
      const mod = p.modules[moduleId];
      return {
        ...p,
        autoRun: false, // Disable auto run on stop
        modules: {
          ...p.modules,
          [moduleId]: {
            ...mod,
            status: ModuleStatus.INTERRUPTED // Or ready? Interrupted is clearer
          }
        }
      }
    });
  };

  const runModule = async (projectId: string, moduleId: string, manualInput?: string) => {
    if (!globalState.apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    // Abort any previous running request if forced
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const project = globalState.projects[projectId];
    const moduleIndex = MODULES.findIndex(m => m.id === moduleId);
    const moduleDef = MODULES[moduleIndex];

    // Archive previous version if exists
    updateProjectState(projectId, (prevProj) => {
      const currentMod = prevProj.modules[moduleId];
      const newVersions = [...currentMod.versions];
      
      if (currentMod.status === ModuleStatus.COMPLETED && currentMod.output) {
        newVersions.push({
          output: currentMod.output,
          sources: currentMod.sources,
          timestamp: currentMod.timestamp
        });
      }

      const updatedProj = { ...prevProj };
      if (manualInput) updatedProj.theme = manualInput;
      if (manualInput && prevProj.name.startsWith("Venture Analysis")) updatedProj.name = manualInput.substring(0, 30) + "...";
      
      updatedProj.lastModified = Date.now();
      updatedProj.modules[moduleId] = {
        ...currentMod,
        status: ModuleStatus.RUNNING,
        output: null, // Clear visible output while running
        versions: newVersions
      };

      return updatedProj;
    });

    try {
      const promptTemplate = PROMPTS[moduleDef.systemPromptKey] || `Analyze the previous context and generate the output for ${moduleDef.title}.`;
      const fullSystemInstruction = `${CORE_SYSTEM_INSTRUCTION}\n\nSPECIFIC MODULE INSTRUCTION:\n${promptTemplate}`;
      // Re-fetch project state to ensure we have latest manualInput/theme
      const currentProjectState = globalState.projects[projectId]; // Note: this might be slightly stale inside async closure if not careful, but we rely on passed args or pre-update
      // Actually we need the updated theme if manualInput was just set.
      const effectiveTheme = manualInput || project.theme;
      
      // Build context based on effective state
      let history = `PROJECT THEME: ${effectiveTheme}\n\n`;
      for (let i = 0; i < moduleIndex; i++) {
        const modDef = MODULES[i];
        const modData = project.modules[modDef.id];
        if (modData.output) {
          history += `--- START OUTPUT FROM MODULE ${modDef.id} (${modDef.title}) ---\n`;
          history += modData.output;
          history += `\n--- END OUTPUT FROM MODULE ${modDef.id} ---\n\n`;
        }
      }

      const dynamicPrompt = manualInput 
        ? `The user has provided the following theme/problem focus: "${manualInput}". Perform the analysis.`
        : `Based on the provided history of the venture research, execute the analysis for Module: ${moduleDef.title}.`;

      const { text, sources } = await generateGeminiResponse(globalState.apiKey, {
        systemInstruction: fullSystemInstruction,
        prompt: dynamicPrompt,
        history: history,
        useThinking: !!moduleDef.useThinking,
        useGrounding: !!moduleDef.useGrounding
      });

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) return;

      // Success Update
      updateProjectState(projectId, (prev) => {
        const next = { ...prev };
        next.modules[moduleId] = {
          ...next.modules[moduleId],
          status: ModuleStatus.COMPLETED,
          output: text,
          sources: sources,
          timestamp: Date.now()
        };

        // Unlock next module
        const nextModuleDef = MODULES[moduleIndex + 1];
        if (nextModuleDef) {
          next.modules[nextModuleDef.id].status = ModuleStatus.READY;
        }
        
        return next;
      });

    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) return;
      
      updateProjectState(projectId, (prev) => {
        const next = { ...prev };
        next.modules[moduleId].status = ModuleStatus.ERROR;
        next.modules[moduleId].output = `Error: ${(error as Error).message}`;
        next.autoRun = false; 
        return next;
      });
    } finally {
      abortControllerRef.current = null;
    }
  };
  
  const handlePrintReport = () => {
    const project = globalState.projects[globalState.activeProjectId];
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const completedModules = MODULES.filter(m => project.modules[m.id].status === ModuleStatus.COMPLETED);
    
    let htmlContent = `
      <html>
      <head>
        <title>${project.name || APP_NAME} - Report</title>
        <style>
          body { font-family: 'Inter', sans-serif; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }
          h1 { font-size: 24px; color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; }
          h2 { font-size: 20px; color: #333; margin-top: 30px; }
          h3 { font-size: 18px; color: #555; }
          .module-section { margin-bottom: 50px; page-break-after: always; }
          .meta { color: #888; font-size: 12px; margin-bottom: 30px; }
          .source-link { color: #2563eb; text-decoration: none; font-size: 11px; display: block; }
          blockquote { border-left: 3px solid #ddd; padding-left: 15px; color: #666; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>${project.name || "Venture Research Report"}</h1>
        <div class="meta">Generated by StudioOS v1 on ${new Date().toLocaleDateString()}</div>
        <div class="meta">Theme: ${project.theme}</div>
    `;

    completedModules.forEach(mod => {
      const data = project.modules[mod.id];
      let formattedOutput = data.output || '';
      
      formattedOutput = formattedOutput
        .replace(/^# (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h4>$1</h4>')
        .replace(/^### (.*$)/gim, '<h5>$1</h5>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\n/gim, '<br/>');

      htmlContent += `
        <div class="module-section">
          <h2>${mod.title}</h2>
          <div>${formattedOutput}</div>
          ${data.sources && data.sources.length > 0 ? `
            <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee;">
              <strong>Sources:</strong>
              ${data.sources.map(s => `<a href="${s.uri}" class="source-link" target="_blank">${s.title}</a>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });

    htmlContent += `
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const activeProject = globalState.projects[globalState.activeProjectId];
  const currentModuleDef = MODULES.find(m => m.id === activeProject.currentModuleId)!;
  const currentModuleData = activeProject.modules[activeProject.currentModuleId];

  const canRunCurrent = currentModuleDef.inputs.every(inputId => {
    if (inputId === 'theme') return true; 
    return activeProject.modules[inputId]?.status === ModuleStatus.COMPLETED;
  });

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      <Sidebar 
        modules={MODULES} 
        globalState={globalState}
        onSelectModule={handleSelectModule} 
        onCreateProject={handleCreateProject}
        onSwitchProject={handleSwitchProject}
        onDeleteProject={handleDeleteProject}
      />
      
      <main className="flex-1 p-6 overflow-hidden flex flex-col">
        <header className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center space-x-4">
            <h3 className="text-sm font-medium text-gray-500">Workspace</h3>
            {/* Auto-Run Toggle */}
            <div className="flex items-center bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
              <span className="text-xs font-medium text-gray-600 mr-2">Continuous Mode</span>
              <button onClick={toggleAutoRun} className={`text-studio-600 focus:outline-none`}>
                {activeProject.autoRun ? <ToggleRight className="w-8 h-8 fill-studio-100" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
             <button 
              onClick={handlePrintReport}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              title="Print / Save as PDF"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </button>
            <button 
              onClick={() => setShowApiKeyModal(true)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="API Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <ModuleView 
            definition={currentModuleDef}
            data={currentModuleData}
            projectTheme={activeProject.theme}
            onRun={(input) => runModule(activeProject.id, currentModuleDef.id, input)}
            onStop={() => handleStopModule(activeProject.id, currentModuleDef.id)}
            canRun={canRunCurrent}
          />
        </div>
      </main>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-studio-100 mb-4 mx-auto">
              <Key className="w-6 h-6 text-studio-600" />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Enter Gemini API Key</h3>
            <p className="text-sm text-center text-gray-500 mb-6">
              To orchestrate the StudioOS agents, you need a valid Google Gemini API key. This is stored locally in your browser.
            </p>
            <input 
              type="password" 
              placeholder="AIzaSy..." 
              className="w-full border border-gray-300 rounded-md px-4 py-2 mb-4 focus:ring-studio-500 focus:border-studio-500"
              onChange={(e) => setGlobalState(prev => ({...prev, apiKey: e.target.value}))}
              value={globalState.apiKey || ''}
            />
            <div className="flex space-x-3">
              <button 
                onClick={() => handleSaveApiKey(globalState.apiKey || '')}
                className="flex-1 bg-studio-600 text-white px-4 py-2 rounded-md hover:bg-studio-700 font-medium"
              >
                Save & Continue
              </button>
              {globalState.apiKey && (
                <button 
                  onClick={() => setShowApiKeyModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
            <p className="text-xs text-center text-gray-400 mt-4">
              Get a key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-studio-600">Google AI Studio</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
