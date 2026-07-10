export interface TaskStep {
  id: string;
  title: string;
  duration: number; // in minutes
  difficulty: "Easy" | "Medium" | "Hard";
  status: "todo" | "completed";
}

export interface SurvivalStep {
  id: string;
  taskTitle?: string;
  title: string;
  duration: number; // in minutes
  reason: string;
  status: "todo" | "completed";
}

export interface EmergencyPlan {
  survivalSteps: SurvivalStep[];
  triageReasoning: string;
  highYieldActions: string[];
  timeRemainingMinutes?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "todo" | "in_progress" | "completed";
  originalInput: string;
  createdAt: string;
  
  // Prioritization properties
  priority: "High" | "Medium" | "Low";
  urgencyScore: number; // 1-10
  impactScore: number; // 1-10
  priorityReasoning: string;
  
  // Execution Plan properties
  steps: TaskStep[];
  milestones: string[];
  potentialObstacles: string[];
  mitigationStrategies: string[];
  
  // Emergency Plan details (per-task survival view if applicable)
  isEmergency?: boolean;
  emergencyPlan?: EmergencyPlan | null;
}

export interface ChatMessage {
  id: string;
  taskId: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface ResearchNote {
  id: string;
  taskId: string;
  title: string;
  content: string; // Markdown supported
  createdAt: string;
}

export interface ResearchLink {
  id: string;
  taskId: string;
  title: string;
  url: string;
  summary: string; // Summarized with Gemini
  createdAt: string;
}

export interface ResearchSnippet {
  id: string;
  taskId: string;
  content: string;
  source: string;
  createdAt: string;
}

export interface MasterWorkflowOutput {
  tasks: Task[];
  ranked_tasks: Task[];
  execution_plan: Task[];
  emergency_plan: EmergencyPlan | null;
}
