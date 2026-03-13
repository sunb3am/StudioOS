import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ModuleView } from './components/ModuleView';
import { WelcomeModal } from './components/WelcomeModal';
import { MODULES, PROMPTS, CORE_SYSTEM_INSTRUCTION, APP_NAME, APP_VERSION, MODELS, MODEL_OPTIONS } from './constants';
import { ProjectState, ModuleStatus, ModuleData, GlobalState, ChatMessage } from './types';
import { generateGeminiResponse, generateChatResponse } from './services/geminiService';
import { Settings, Key, Download, Info, ChevronDown, Check, AlertTriangle, X } from 'lucide-react';

// The built-in API key is injected from env at build time (GEMINI_API_KEY).
// It is never stored in localStorage or the git repo.
const BUILTIN_API_KEY = process.env.API_KEY as string | undefined;

const createNewProject = (name: string = 'New Venture Concept'): ProjectState => {
  const initialModules: Record<string, ModuleData> = {};
  MODULES.forEach(m => {
    initialModules[m.id] = {
      status: m.id === 'mod-1' ? ModuleStatus.READY : ModuleStatus.LOCKED,
      output: null,
      sources: [],
      chatHistory: [],
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
    autoRun: true,
    lastModified: Date.now()
  };
};

const sanitizeState = (state: GlobalState): GlobalState => {
  const newState = { ...state };
  // Ensure selectedModel exists (migration from older saves)
  if (!newState.selectedModel) {
    newState.selectedModel = MODELS.FLASH;
  }
  Object.keys(newState.projects).forEach(pid => {
    const project = newState.projects[pid];
    let changed = false;
    Object.keys(project.modules).forEach(mid => {
      const mod = project.modules[mid];
      if (mod.status === ModuleStatus.RUNNING) {
        mod.status = ModuleStatus.INTERRUPTED;
        changed = true;
      }
      if (!mod.chatHistory) {
        mod.chatHistory = [];
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
  const [showWelcome, setShowWelcome] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  
  const loadState = (): GlobalState => {
    const saved = localStorage.getItem('ventureforge_global_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return sanitizeState(parsed);
      } catch (e) {
        console.error("Failed to load saved state", e);
      }
    }
    
    // Migrate from old storage key
    const oldSaved = localStorage.getItem('studio_os_global_v1');
    if (oldSaved) {
      try {
        const parsed = JSON.parse(oldSaved);
        return sanitizeState(parsed);
      } catch (e) {}
    }
    
    const firstProject = createNewProject();
    return {
      projects: { [firstProject.id]: firstProject },
      activeProjectId: firstProject.id,
      apiKey: null,
      selectedModel: MODELS.FLASH,
      hasSeenWelcome: false
    };
  };

  const [globalState, setGlobalState] = useState<GlobalState>(loadState());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('ventureforge_global_v1', JSON.stringify(globalState));
  }, [globalState]);

  // Determine the effective API key and model to use
  const effectiveApiKey = globalState.apiKey || BUILTIN_API_KEY || '';
  const isUsingBuiltinKey = !globalState.apiKey && !!BUILTIN_API_KEY;
  const effectiveModel = globalState.apiKey
    ? (globalState.selectedModel || MODELS.FLASH)
    : MODELS.FLASH;

  // Welcome & API Key modal check
  useEffect(() => {
    if (!globalState.hasSeenWelcome) {
      setShowWelcome(true);
    }
    // Only show API key modal if there's no built-in key AND no user key
    if (!effectiveApiKey) {
      setShowApiKeyModal(true);
    }
    // Sync the input with the current user key
    setApiKeyInput(globalState.apiKey || '');
  }, []);

  const closeWelcome = () => {
    setShowWelcome(false);
    setGlobalState(prev => ({ ...prev, hasSeenWelcome: true }));
  };

  // --- Fixed Continuous Mode Waterfall Logic ---
  // This version does NOT depend on currentModuleId, fixing the bug where
  // viewing an earlier module while a later one runs would stall the pipeline.
  useEffect(() => {
    const activeProject = globalState.projects[globalState.activeProjectId];
    if (!activeProject || !activeProject.autoRun) return;

    // Don't trigger a new run if something is already running
    const isAnyRunning = MODULES.some(m => activeProject.modules[m.id]?.status === ModuleStatus.RUNNING);
    if (isAnyRunning) return;

    // Find the first READY module whose all prerequisite inputs are completed
    const nextToRun = MODULES.find(mod => {
      const modData = activeProject.modules[mod.id];
      if (modData?.status !== ModuleStatus.READY) return false;
      return mod.inputs.every(inputId => {
        if (inputId === 'theme') return !!activeProject.theme;
        return activeProject.modules[inputId]?.status === ModuleStatus.COMPLETED;
      });
    });

    if (!nextToRun) return;

    const timer = setTimeout(() => {
      updateProjectState(activeProject.id, (p) => ({ ...p, currentModuleId: nextToRun.id }));
      runModule(activeProject.id, nextToRun.id);
    }, 1500);

    return () => clearTimeout(timer);
  }, [globalState.projects, globalState.activeProjectId]);

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
    if (Object.keys(globalState.projects).length <= 1) return;
    
    setGlobalState(prev => {
      const newProjects = { ...prev.projects };
      delete newProjects[id];
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

  const handleRenameProject = (id: string, name: string) => {
    updateProjectState(id, (p) => ({ ...p, name, lastModified: Date.now() }));
  };

  const handleSelectModule = (id: string) => {
    updateProjectState(globalState.activeProjectId, (p) => ({ ...p, currentModuleId: id }));
  };

  const toggleAutoRun = () => {
    updateProjectState(globalState.activeProjectId, (p) => ({ ...p, autoRun: !p.autoRun }));
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    localStorage.setItem('ventureforge_user_api_key', trimmed || '');
    setGlobalState(prev => ({ ...prev, apiKey: trimmed || null }));
    setShowApiKeyModal(false);
  };

  const handleClearApiKey = () => {
    setApiKeyInput('');
    localStorage.removeItem('ventureforge_user_api_key');
    setGlobalState(prev => ({ ...prev, apiKey: null }));
  };

  const handleSelectModel = (model: string) => {
    setGlobalState(prev => ({ ...prev, selectedModel: model }));
    setModelDropdownOpen(false);
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
        autoRun: false,
        modules: {
          ...p.modules,
          [moduleId]: {
            ...mod,
            status: ModuleStatus.INTERRUPTED
          }
        }
      }
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error("Failed to convert file"));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleChat = async (message: string, files: File[] = []) => {
    const projectId = globalState.activeProjectId;
    const activeProject = globalState.projects[projectId];
    const moduleId = activeProject.currentModuleId;
    
    if (!effectiveApiKey) {
      setShowApiKeyModal(true);
      return;
    }

    const attachments = await Promise.all(files.map(async f => ({
      mimeType: f.type,
      data: await fileToBase64(f)
    })));

    const userMsg: ChatMessage = {
      role: 'user',
      text: message,
      timestamp: Date.now(),
      attachments
    };

    updateProjectState(projectId, (p) => ({
      ...p,
      modules: {
        ...p.modules,
        [moduleId]: {
          ...p.modules[moduleId],
          chatHistory: [...(p.modules[moduleId].chatHistory || []), userMsg]
        }
      }
    }));

    try {
      const moduleIndex = MODULES.findIndex(m => m.id === moduleId);
      let history = `PROJECT THEME: ${activeProject.theme}\n\n`;
      for (let i = 0; i < moduleIndex; i++) {
        const modDef = MODULES[i];
        const modData = activeProject.modules[modDef.id];
        if (modData.output) {
          history += `--- START OUTPUT FROM MODULE ${modDef.id} (${modDef.title}) ---\n`;
          history += modData.output;
          history += `\n--- END OUTPUT FROM MODULE ${modDef.id} ---\n\n`;
        }
      }

      const modData = activeProject.modules[moduleId];
      
      const responseText = await generateChatResponse(effectiveApiKey, effectiveModel, {
        systemInstruction: CORE_SYSTEM_INSTRUCTION,
        prompt: message,
        history: history,
        currentOutput: modData.output || "No output available yet.",
        chatHistory: modData.chatHistory || [],
        newAttachments: attachments,
        useThinking: false,
        useGrounding: true
      });

      const botMsg: ChatMessage = {
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };

      updateProjectState(projectId, (p) => ({
        ...p,
        modules: {
          ...p.modules,
          [moduleId]: {
            ...p.modules[moduleId],
            chatHistory: [...p.modules[moduleId].chatHistory, botMsg]
          }
        }
      }));

    } catch (error) {
      const errorMsg: ChatMessage = {
        role: 'model',
        text: `Error: ${(error as Error).message}`,
        timestamp: Date.now()
      };
      updateProjectState(projectId, (p) => ({
        ...p,
        modules: {
          ...p.modules,
          [moduleId]: {
            ...p.modules[moduleId],
            chatHistory: [...p.modules[moduleId].chatHistory, errorMsg]
          }
        }
      }));
    }
  };

  const runModule = async (projectId: string, moduleId: string, manualInput?: string) => {
    if (!effectiveApiKey) {
      setShowApiKeyModal(true);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const project = globalState.projects[projectId];
    const moduleIndex = MODULES.findIndex(m => m.id === moduleId);
    const moduleDef = MODULES[moduleIndex];

    updateProjectState(projectId, (prevProj) => {
      const currentMod = prevProj.modules[moduleId];
      const newVersions = [...currentMod.versions];
      
      if (currentMod.status === ModuleStatus.COMPLETED && currentMod.output) {
        newVersions.push({
          output: currentMod.output,
          sources: currentMod.sources,
          chatHistory: currentMod.chatHistory || [],
          timestamp: currentMod.timestamp
        });
      }

      const updatedProj = { ...prevProj };
      if (manualInput) updatedProj.theme = manualInput;
      if (manualInput && (prevProj.name === 'New Venture Concept' || prevProj.name.startsWith("Venture Analysis"))) {
        const trimmed = manualInput.length > 50 ? manualInput.substring(0, 50) + '...' : manualInput;
        updatedProj.name = trimmed;
      }
      
      updatedProj.lastModified = Date.now();
      updatedProj.modules[moduleId] = {
        ...currentMod,
        status: ModuleStatus.RUNNING,
        output: null,
        chatHistory: [],
        versions: newVersions
      };

      return updatedProj;
    });

    try {
      const promptTemplate = PROMPTS[moduleDef.systemPromptKey] || `Analyze the previous context and generate the output for ${moduleDef.title}.`;
      const fullSystemInstruction = `${CORE_SYSTEM_INSTRUCTION}\n\nSPECIFIC MODULE INSTRUCTION:\n${promptTemplate}`;
      const effectiveTheme = manualInput || project.theme;
      
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

      const { text, sources } = await generateGeminiResponse(effectiveApiKey, effectiveModel, {
        systemInstruction: fullSystemInstruction,
        prompt: dynamicPrompt,
        history: history,
        useThinking: !!moduleDef.useThinking,
        useGrounding: !!moduleDef.useGrounding
      });

      if (abortControllerRef.current?.signal.aborted) return;

      updateProjectState(projectId, (prev) => {
        const next = { ...prev };
        next.modules[moduleId] = {
          ...next.modules[moduleId],
          status: ModuleStatus.COMPLETED,
          output: text,
          sources: sources,
          timestamp: Date.now()
        };

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
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${project.name || APP_NAME} - Venture Research Report</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <style>
          @media print {
            @page { margin: 2cm; }
            body { -webkit-print-color-adjust: exact; }
          }
          body { 
            font-family: 'Inter', sans-serif; 
            color: #1f2937; 
            line-height: 1.7; 
            background: #fff;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
          }
          .cover-page {
            height: 90vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 50px;
            page-break-after: always;
          }
          .brand {
            font-family: 'Inter', sans-serif;
            font-weight: 700;
            letter-spacing: 0.1em;
            color: #059669;
            text-transform: uppercase;
            font-size: 14px;
            margin-bottom: 20px;
          }
          .report-title {
            font-family: 'Playfair Display', serif;
            font-size: 48px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 10px;
            line-height: 1.2;
          }
          .report-theme {
            font-size: 20px;
            color: #6b7280;
            font-weight: 300;
            margin-bottom: 40px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            max-width: 400px;
            margin: 0 auto;
            text-align: left;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }
          .meta-label { font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; }
          .meta-value { font-size: 14px; font-weight: 500; color: #374151; }
          h1 { font-size: 24px; color: #111; border-bottom: 2px solid #059669; padding-bottom: 10px; margin-top: 0; }
          h2 { font-size: 20px; color: #374151; margin-top: 30px; font-weight: 600; }
          h3 { font-size: 18px; color: #4b5563; font-weight: 600; }
          p { margin-bottom: 1.2em; }
          ul, ol { margin-bottom: 1.2em; padding-left: 1.5em; }
          li { margin-bottom: 0.5em; }
          blockquote { border-left: 4px solid #059669; padding-left: 15px; color: #4b5563; font-style: italic; margin: 20px 0; background: #f9fafb; padding: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; font-size: 0.9em; }
          th { background-color: #f3f4f6; font-weight: 600; text-align: left; padding: 8px; border: 1px solid #e5e7eb; }
          td { padding: 8px; border: 1px solid #e5e7eb; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .module-section { margin-bottom: 60px; page-break-after: always; }
          .source-box { background: #f3f4f6; border-radius: 8px; padding: 15px; margin-top: 30px; font-size: 12px; }
          .source-link { color: #2563eb; text-decoration: none; display: block; margin-bottom: 4px; }
          .chat-transcript {
            margin-top: 30px;
            border-top: 1px dashed #d1d5db;
            padding-top: 20px;
          }
          .chat-header { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 15px; }
          .chat-msg { margin-bottom: 15px; font-size: 13px; }
          .chat-role { font-weight: 700; font-size: 11px; text-transform: uppercase; margin-bottom: 2px; }
          .role-user { color: #059669; }
          .role-model { color: #4b5563; }
          .chat-text { background: #f9fafb; padding: 8px 12px; border-radius: 6px; display: inline-block; max-width: 100%; }
          .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 30px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            padding: 10px 40px;
            font-size: 10px;
            color: #9ca3af;
            background: white;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="cover-page">
            <div class="brand">${APP_NAME} ${APP_VERSION}</div>
            <div class="report-title">${project.name || "Venture Research Report"}</div>
            <div class="report-theme">${project.theme}</div>
            <div class="meta-grid">
              <div>
                <div class="meta-label">Date Generated</div>
                <div class="meta-value">${new Date().toLocaleDateString()}</div>
              </div>
              <div>
                <div class="meta-label">Modules Completed</div>
                <div class="meta-value">${completedModules.length} / ${MODULES.length}</div>
              </div>
            </div>
          </div>
    `;

    completedModules.forEach(mod => {
      const data = project.modules[mod.id];

      htmlContent += `
        <div class="module-section">
          <h1>${mod.title}</h1>
          <div id="content-${mod.id}" class="content"></div>
          <script>
            document.getElementById('content-${mod.id}').innerHTML = marked.parse(${JSON.stringify(data.output || '')});
          </script>
          
          ${data.sources && data.sources.length > 0 ? `
            <div class="source-box">
              <strong>Verified Sources:</strong>
              ${data.sources.map(s => `<a href="${s.uri}" class="source-link" target="_blank">${s.title || s.uri}</a>`).join('')}
            </div>
          ` : ''}

          ${data.chatHistory && data.chatHistory.length > 0 ? `
            <div class="chat-transcript">
              <div class="chat-header">Analyst Discussion Log</div>
              ${data.chatHistory.map(msg => `
                <div class="chat-msg">
                  <div class="chat-role ${msg.role === 'user' ? 'role-user' : 'role-model'}">${msg.role === 'user' ? 'Analyst' : 'VentureForge Agent'}</div>
                  <div class="chat-text">${msg.text}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });

    htmlContent += `
        </div>
        <div class="footer">
          <span>Generated by ${APP_NAME} ${APP_VERSION}</span>
          <span>${new Date().toLocaleDateString()}</span>
        </div>
        <script>
          setTimeout(() => {
             window.print();
          }, 500);
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

  const selectedModelOption = MODEL_OPTIONS.find(m => m.id === (globalState.selectedModel || MODELS.FLASH));

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      <Sidebar 
        modules={MODULES} 
        globalState={globalState}
        effectiveModel={effectiveModel}
        isUsingBuiltinKey={isUsingBuiltinKey}
        onSelectModule={handleSelectModule} 
        onCreateProject={handleCreateProject}
        onSwitchProject={handleSwitchProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
      />
      
      <main className="flex-1 p-6 overflow-hidden flex flex-col min-w-0">
        <header className="flex justify-between items-center mb-6 shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-400">Workspace</span>
            {/* Continuous Mode Toggle */}
            <div className="flex items-center bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm gap-2.5">
              <span className="text-xs font-medium text-gray-600">Continuous Mode</span>
              <button
                onClick={toggleAutoRun}
                role="switch"
                aria-checked={activeProject.autoRun}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-studio-500 focus:ring-offset-1 ${
                  activeProject.autoRun ? 'bg-studio-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    activeProject.autoRun ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWelcome(true)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              title="About VentureForge"
            >
              <Info className="w-4 h-4" />
            </button>
            <button 
              onClick={handlePrintReport}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm transition-colors gap-1.5"
              title="Export as PDF"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <button 
              onClick={() => { setApiKeyInput(globalState.apiKey || ''); setShowApiKeyModal(true); }}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              title="API & Model Settings"
            >
              <Settings className="w-4 h-4" />
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
            onChat={handleChat}
            canRun={canRunCurrent}
          />
        </div>
      </main>

      {showWelcome && <WelcomeModal onClose={closeWelcome} />}

      {/* API Key & Model Settings Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-visible">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-studio-100 flex items-center justify-center">
                  <Key className="w-4 h-4 text-studio-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">API & Model Settings</h3>
                  <p className="text-xs text-gray-500">Configure your Gemini API key and model</p>
                </div>
              </div>
              <button onClick={() => setShowApiKeyModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Built-in key notice */}
              {BUILTIN_API_KEY && (
                <div className="flex items-start gap-3 p-3.5 bg-studio-50 border border-studio-100 rounded-lg">
                  <div className="w-5 h-5 rounded-full bg-studio-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-studio-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-studio-900">Built-in API key active</p>
                    <p className="text-xs text-studio-700 mt-0.5">
                      VentureForge includes a shared key using <strong>Gemini 2.5 Flash</strong>. It may be rate-limited under heavy use. Add your own key below for higher limits and access to Gemini 3 models.
                    </p>
                  </div>
                </div>
              )}

              {!BUILTIN_API_KEY && !globalState.apiKey && (
                <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">No API key configured. Please add your Gemini API key to get started.</p>
                </div>
              )}

              {/* User API Key input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Your Gemini API Key <span className="text-gray-400 font-normal">(optional if built-in key is active)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-studio-500 focus:border-studio-500 outline-none"
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    value={apiKeyInput}
                  />
                  {globalState.apiKey && (
                    <button
                      onClick={handleClearApiKey}
                      className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Get a free key at{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-studio-600">
                    Google AI Studio
                  </a>. Stored locally in your browser.
                </p>
              </div>

              {/* Model selector — only relevant when using your own key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Model <span className="text-gray-400 font-normal">(applies when using your own key)</span>
                </label>
                <div className="relative">
                  <button
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left">
                      <span className="font-medium text-gray-800">{selectedModelOption?.label}</span>
                      <span className="text-gray-400 ml-2 text-xs">{selectedModelOption?.description}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {modelDropdownOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
                      {MODEL_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectModel(opt.id)}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between transition-colors ${
                            globalState.selectedModel === opt.id ? 'bg-studio-50' : ''
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{opt.label}</span>
                              {opt.requiresPaid && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                                  Paid key
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                          </div>
                          {globalState.selectedModel === opt.id && (
                            <Check className="w-4 h-4 text-studio-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {isUsingBuiltinKey && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    The built-in key uses Gemini 2.5 Flash. Add your own key to switch models. Gemini 3 models require a paid-tier key to use grounding.
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 text-sm font-medium text-white bg-studio-600 rounded-lg hover:bg-studio-700 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
