
export enum ModuleStatus {
  LOCKED = 'LOCKED',
  READY = 'READY',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  INTERRUPTED = 'INTERRUPTED' // New status for crash recovery
}

export interface ModuleDefinition {
  id: string;
  title: string;
  description: string;
  inputs: string[]; // Keys of data needed from previous steps
  systemPromptKey: string; // Key to look up specific instructions
  isManualInput?: boolean; // If true, requires user input before running
  useThinking?: boolean; // Enable Gemini Thinking features
  useGrounding?: boolean; // Enable Google Search
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ModuleVersion {
  timestamp: number;
  output: string;
  sources: GroundingSource[];
}

export interface ModuleData {
  status: ModuleStatus;
  output: string | null; // The current Markdown output
  sources: GroundingSource[]; // Sources for the current output
  feedback: string | null; // User notes/override
  timestamp: number;
  versions: ModuleVersion[]; // History of previous runs
}

export interface ProjectState {
  id: string;
  name: string;
  theme: string; // The initial user input
  modules: Record<string, ModuleData>;
  currentModuleId: string;
  autoRun: boolean;
  lastModified: number;
}

export interface GlobalState {
  projects: Record<string, ProjectState>;
  activeProjectId: string;
  apiKey: string | null;
}

export interface GeneratePayload {
  systemInstruction: string;
  prompt: string;
  history: string; // Condensed context of previous modules
  useThinking: boolean;
  useGrounding: boolean;
}
