import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle, 
  Circle, 
  Play, 
  Flame, 
  Sparkles, 
  BookOpen, 
  MessageSquare, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  Link as LinkIcon, 
  FileText, 
  Send, 
  RefreshCw, 
  Sliders, 
  X, 
  ArrowLeft, 
  ExternalLink, 
  Check, 
  Info,
  Layers,
  HelpCircle,
  FileDown
} from "lucide-react";
import Markdown from "react-markdown";

import { 
  Task, 
  ChatMessage, 
  ResearchNote, 
  ResearchLink, 
  ResearchSnippet, 
  EmergencyPlan,
  TaskStep,
  SurvivalStep
} from "./types";

import {
  getTasks,
  saveTask,
  deleteTask,
  getChatMessages,
  saveChatMessage,
  getResearchNotes,
  saveResearchNote,
  getResearchLinks,
  saveResearchLink,
  getResearchSnippets,
  saveResearchSnippet
} from "./firebase";

function SaveMeLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Off-white background fill inside the logo with deep violet-black border (#0b0010) */}
      <rect x="6" y="6" width="88" height="88" rx="22" fill="#FAFAF7" stroke="#0b0010" strokeWidth="6" />
      
      {/* Row 1 Checklist: Checkbox + Checkmark + Line */}
      <rect x="20" y="24" width="16" height="16" rx="4" stroke="#0b0010" strokeWidth="4.5" fill="none" />
      <path d="M23 31.5L27.5 36L33 27.5" stroke="#5A7DFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 32H80" stroke="#0b0010" strokeWidth="5.5" strokeLinecap="round" />

      {/* Row 2 Checklist: Checkbox + Checkmark + Line */}
      <rect x="20" y="46" width="16" height="16" rx="4" stroke="#0b0010" strokeWidth="4.5" fill="none" />
      <path d="M23 53.5L27.5 58L33 49.5" stroke="#5A7DFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 54H80" stroke="#0b0010" strokeWidth="5.5" strokeLinecap="round" />

      {/* Row 3 Checklist: Unchecked Box + Line */}
      <rect x="20" y="68" width="16" height="16" rx="4" stroke="#0b0010" strokeWidth="4.5" fill="none" />
      <path d="M46 76H80" stroke="#0b0010" strokeWidth="5.5" strokeLinecap="round" />

      {/* Gold Sparkle in the top right corner */}
      <path d="M78 12C78 16.5 76 18.5 71.5 18.5C76 18.5 78 20.5 78 25C78 20.5 80 18.5 84.5 18.5C80 18.5 78 16.5 78 12Z" fill="#E6B54A" />
    </svg>
  );
}

export default function App() {
  // --- STATE DECLARATIONS ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  
  // Planner configurations
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [timeRemainingHours, setTimeRemainingHours] = useState(2);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  
  // Workspace tabs
  const [activeTab, setActiveTab] = useState<"steps" | "chat" | "notebook" | "emergency">("steps");
  
  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  
  // Notebook state
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [links, setLinks] = useState<ResearchLink[]>([]);
  const [snippets, setSnippets] = useState<ResearchSnippet[]>([]);
  
  // New notebook items inputs
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [snippetContent, setSnippetContent] = useState("");
  const [snippetSource, setSnippetSource] = useState("");
  const [isExtractingResearch, setIsExtractingResearch] = useState(false);
  
  // Expanded research item view (for reading summaries in detail)
  const [expandedResearchItem, setExpandedResearchItem] = useState<{
    id: string;
    type: "note" | "link" | "snippet";
    title: string;
    content: string;
  } | null>(null);

  // Overall emergency plan (persisted via LocalStorage)
  const [overallEmergencyPlan, setOverallEmergencyPlan] = useState<EmergencyPlan | null>(null);
  
  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  function requestConfirmation(title: string, message: string, onConfirm: () => void | Promise<void>) {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  }

  // Screen/View mode: 'dashboard' or 'planner_screen'
  const [viewMode, setViewMode] = useState<"dashboard" | "planner_screen">("planner_screen");
  
  // Quick Chat Prompts list
  const quickPrompts = [
    "Break down the first step into even simpler details.",
    "Draft a quick outline or template for this task.",
    "Give me 3 strict strategies to avoid procrastinating on this.",
    "What are some reference sources or keywords I should search for?"
  ];

  // Ref to chat message scroll bottom
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- INITIAL LOAD & SYNCHRONIZATION ---
  useEffect(() => {
    async function loadData() {
      const dbTasks = await getTasks();
      const initializedTasks = dbTasks.map(t => ({
        ...t,
        steps: (t.steps || []).map(s => ({
          ...s,
          status: s.status || "todo"
        }))
      }));
      setTasks(initializedTasks);
      
      // Load overall emergency plan if exists in LS
      try {
        const storedEmergency = localStorage.getItem("saveme_overall_emergency");
        if (storedEmergency) {
          setOverallEmergencyPlan(JSON.parse(storedEmergency));
        }
      } catch (err) {
        console.error("Error loading stored overall emergency plan:", err);
      }
      
      // If tasks exist, direct user straight to the execution dashboard!
      if (initializedTasks.length > 0) {
        setViewMode("dashboard");
        const storedActiveId = localStorage.getItem("saveme_active_task_id");
        if (storedActiveId && initializedTasks.some(t => t.id === storedActiveId)) {
          setActiveTaskId(storedActiveId);
        } else {
          setActiveTaskId(initializedTasks[0].id);
        }
      }
    }
    loadData();
  }, []);

  // Sync active task's sub-data (chat, notes, etc.) when selection shifts
  useEffect(() => {
    if (!activeTaskId) return;
    
    async function loadTaskSubData() {
      const messages = await getChatMessages(activeTaskId);
      setChatHistory(messages);
      
      const taskNotes = await getResearchNotes(activeTaskId);
      setNotes(taskNotes);
      
      const taskLinks = await getResearchLinks(activeTaskId);
      setLinks(taskLinks);
      
      const taskSnippets = await getResearchSnippets(activeTaskId);
      setSnippets(taskSnippets);
      
      // Default to steps tab on task switch
      setActiveTab("steps");
      setExpandedResearchItem(null);
    }
    loadTaskSubData();
  }, [activeTaskId]);

  // Scroll chat history to bottom on updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const activeTask = tasks.find(t => t.id === activeTaskId) || null;

  // --- HANDLERS ---
  
  // MODULE 1: AI Planner Sequential Pipeline Run
  async function handlePlanExtraction(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsGenerating(true);
    setGenerationStep("Analyzing messy thoughts & extracting tasks...");

    try {
      // 1. Extract, Prioritize, Plan on backend
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inputText,
          isEmergency: isEmergencyMode,
          timeRemainingHours: isEmergencyMode ? timeRemainingHours : undefined
        })
      });

      if (!response.ok) {
        throw new Error("Pipeline compilation error. Please verify server connection.");
      }

      const data = await response.json();
      
      // Destructure structured output
      const generatedTasks: Task[] = data.execution_plan || [];
      const emergencyResult: EmergencyPlan | null = data.emergency_plan || null;

      // Update local state and persist each task to DB
      if (generatedTasks.length > 0) {
        setGenerationStep("Synchronizing execution blueprints with Cloud database...");
        for (const task of generatedTasks) {
          // If emergency result exists, parse and attach specific survival steps to each task if relevant
          if (emergencyResult && emergencyResult.survivalSteps) {
            const taskSurvivalSteps = emergencyResult.survivalSteps.filter(
              (s) => s.taskTitle?.toLowerCase() === task.title.toLowerCase() || s.id.startsWith("es")
            );
            if (taskSurvivalSteps.length > 0) {
              task.emergencyPlan = {
                survivalSteps: taskSurvivalSteps,
                triageReasoning: emergencyResult.triageReasoning,
                highYieldActions: emergencyResult.highYieldActions
              };
            }
          }
          await saveTask(task);
        }

        const freshTasks = await getTasks();
        setTasks(freshTasks);
        setActiveTaskId(generatedTasks[0].id);
      }

      if (emergencyResult) {
        localStorage.setItem("saveme_overall_emergency", JSON.stringify(emergencyResult));
        setOverallEmergencyPlan(emergencyResult);
      } else {
        localStorage.removeItem("saveme_overall_emergency");
        setOverallEmergencyPlan(null);
      }

      // Cleanup & redirect to execution dashboard
      setInputText("");
      setViewMode("dashboard");
      
    } catch (err: any) {
      console.error("Pipeline failure:", err);
      alert("Error: " + (err.message || "An error occurred during workflow compilation."));
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  }

  // Toggle step status inside execution plan
  async function handleToggleStep(taskId: string, stepId: string) {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const updatedSteps = taskToUpdate.steps.map(s => {
      if (s.id === stepId) {
        return { ...s, status: s.status === "completed" ? "todo" : "completed" } as TaskStep;
      }
      return s;
    });

    // Compute progress
    const completedCount = updatedSteps.filter(s => s.status === "completed").length;
    const totalCount = updatedSteps.length;
    let finalStatus: "todo" | "in_progress" | "completed" = "todo";
    
    if (completedCount === totalCount) {
      finalStatus = "completed";
    } else if (completedCount > 0) {
      finalStatus = "in_progress";
    }

    const updatedTask: Task = {
      ...taskToUpdate,
      steps: updatedSteps,
      status: finalStatus
    };

    // Save and update state optimistically for instant speed
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
    saveTask(updatedTask).catch(err => console.error("Failed to save task step toggle:", err));
  }

  // Toggle survival step status inside Emergency Mode
  async function handleToggleSurvivalStep(stepId: string) {
    if (!activeTask || !activeTask.emergencyPlan) return;

    const activeUpdatedSteps = activeTask.emergencyPlan.survivalSteps.map(s => {
      if (s.id === stepId) {
        return { ...s, status: s.status === "completed" ? "todo" : "completed" } as SurvivalStep;
      }
      return s;
    });

    const updatedTask: Task = {
      ...activeTask,
      emergencyPlan: {
        ...activeTask.emergencyPlan,
        survivalSteps: activeUpdatedSteps
      }
    };
    // Save and update state optimistically for instant speed
    setTasks(prev => prev.map(t => t.id === activeTask.id ? updatedTask : t));
    saveTask(updatedTask).catch(err => console.error("Failed to save task survival step:", err));

    // Also sync to overall emergency plan for safety/fallback if needed
    const updatedPlan = {
      ...activeTask.emergencyPlan,
      survivalSteps: activeUpdatedSteps
    };
    localStorage.setItem("saveme_overall_emergency", JSON.stringify(updatedPlan));
    setOverallEmergencyPlan(updatedPlan);
  }

  // Task deletion with cascade cleanups (using custom confirm modal to work reliably inside iframe)
  function handleDeleteTask(taskId: string) {
    requestConfirmation(
      "Delete Task?",
      "Are you sure you want to delete this task permanently? This will also remove all associated chat history and research files.",
      async () => {
        await deleteTask(taskId);
        const remaining = tasks.filter(t => t.id !== taskId);
        setTasks(remaining);
        if (activeTaskId === taskId) {
          const nextActiveId = remaining.length > 0 ? remaining[0].id : null;
          setActiveTaskId(nextActiveId);
          if (nextActiveId) {
            localStorage.setItem("saveme_active_task_id", nextActiveId);
          } else {
            localStorage.removeItem("saveme_active_task_id");
          }
        }
      }
    );
  }

  // Clear all tasks & reset workspace (using custom confirm modal to work reliably inside iframe)
  function handleResetWorkspace() {
    requestConfirmation(
      "Reset Workspace?",
      "Are you sure you want to wipe the current workspace? This will permanently erase all planning records and data.",
      async () => {
        for (const t of tasks) {
          await deleteTask(t.id);
        }
        setTasks([]);
        setActiveTaskId(null);
        setOverallEmergencyPlan(null);
        localStorage.removeItem("saveme_overall_emergency");
        localStorage.removeItem("saveme_active_task_id");
        setViewMode("planner_screen");
      }
    );
  }

  // Toggle active task Emergency Mode state (Enter/Exit Emergency Mode)
  async function handleToggleEmergencyMode(taskId: string) {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const currentlyEmergency = !!targetTask.isEmergency;

    if (!currentlyEmergency) {
      // Enter Emergency Mode
      if (!targetTask.emergencyPlan) {
        setIsGenerating(true);
        setGenerationStep("Compiling Emergency Survival steps...");
        try {
          const response = await aiOrchestrationRequest(`You are the Emergency Response Agent for SaveMe.
Given this specific task blueprint, generate a condensed 1-hour survival plan with minimum viable actions.

Task: "${targetTask.title}"
Blueprint: ${JSON.stringify(targetTask.steps)}
Time budget: 60 minutes

Generate a JSON object containing:
- 'survivalSteps': list of critical steps (summing to <= 60 mins)
- 'triageReasoning': what was cut and why
- 'highYieldActions': 2 high-level focus strategies
`);
          const emergencyPlan: EmergencyPlan = cleanAndParseJSON(response);
          if (emergencyPlan && emergencyPlan.survivalSteps) {
            emergencyPlan.survivalSteps = emergencyPlan.survivalSteps.map(s => ({
              ...s,
              status: s.status || "todo"
            }));
          }
          const updatedTask: Task = {
            ...targetTask,
            isEmergency: true,
            emergencyPlan
          };
          await saveTask(updatedTask);
          setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        } catch (err: any) {
          alert("Could not synthesize emergency plan: " + err.message);
        } finally {
          setIsGenerating(false);
          setGenerationStep("");
        }
      } else {
        const updatedTask: Task = {
          ...targetTask,
          isEmergency: true
        };
        // Optimistic state update
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        saveTask(updatedTask).catch(err => console.error("Failed to enter emergency mode:", err));
      }
    } else {
      // Exit Emergency Mode
      const updatedTask: Task = {
        ...targetTask,
        isEmergency: false
      };
      // Optimistic state update
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      saveTask(updatedTask).catch(err => console.error("Failed to exit emergency mode:", err));
    }
  }

  // Save specific assistant chat message to the notebook as a research note
  async function handleSaveMessageToNotebook(msgId: string, text: string) {
    if (!activeTaskId) return;
    const title = `Insight from Chat (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
    const newNote: ResearchNote = {
      id: `note_${Date.now()}`,
      taskId: activeTaskId,
      title: title,
      content: text,
      createdAt: new Date().toISOString()
    };
    // Optimistic state update
    setNotes(prev => [newNote, ...prev]);
    saveResearchNote(newNote).catch(err => console.error("Failed to save research note:", err));

    const btn = document.getElementById(`btn_save_notebook_${msgId}`);
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = "✓ Saved!";
      btn.classList.add("text-emerald-600", "border-emerald-600");
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove("text-emerald-600", "border-emerald-600");
      }, 2000);
    }
  }

  // Pin specific assistant chat message to the checklist execution blueprint
  async function handlePinMessageToTask(msgId: string, text: string) {
    if (!activeTask) return;
    const cleanText = text.length > 55 ? text.substring(0, 52) + "..." : text;
    const newStep: TaskStep = {
      id: `step_${Date.now()}`,
      title: cleanText,
      duration: 15,
      difficulty: "Medium",
      status: "todo"
    };

    const updatedTask: Task = {
      ...activeTask,
      steps: [...(activeTask.steps || []), newStep]
    };

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === activeTask.id ? updatedTask : t));
    saveTask(updatedTask).catch(err => console.error("Failed to pin task step:", err));

    const btn = document.getElementById(`btn_pin_task_${msgId}`);
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = "✓ Pinned!";
      btn.classList.add("text-emerald-600", "border-emerald-600");
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove("text-emerald-600", "border-emerald-600");
      }, 2000);
    }
  }

  // MODULE 2: Dedicated isolated task chat send
  async function handleSendChatMessage(textToSend?: string) {
    const rawMsg = textToSend || chatInput;
    if (!rawMsg.trim() || !activeTask) return;

    const userMsgText = rawMsg.trim();
    setChatInput("");
    setIsChatSending(true);

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      taskId: activeTask.id,
      sender: "user",
      text: userMsgText,
      timestamp: new Date().toISOString()
    };

    // Append user message instantly to UI & Save
    const updatedHistory = [...chatHistory, userMessage];
    setChatHistory(updatedHistory);
    await saveChatMessage(userMessage);

    try {
      // Prompt Gemini on Server proxy
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: activeTask,
          messages: updatedHistory
        })
      });

      if (!response.ok) {
        throw new Error("Chat engine timed out. Try again.");
      }

      const data = await response.json();
      const botMsgText = data.text || "I'm having difficulty connecting to my systems, let's keep focusing on the plan!";

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        taskId: activeTask.id,
        sender: "assistant",
        text: botMsgText,
        timestamp: new Date().toISOString()
      };

      setChatHistory(prev => [...prev, assistantMessage]);
      await saveChatMessage(assistantMessage);

    } catch (err: any) {
      console.error("Chat failure:", err);
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_a_err`,
        taskId: activeTask.id,
        sender: "assistant",
        text: "Error connecting to AI chat channel. Check your network or project settings.",
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsChatSending(false);
    }
  }

  // MODULE 3: Research Note addition
  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim() || !activeTask) return;

    const newNote: ResearchNote = {
      id: `note_${Date.now()}`,
      taskId: activeTask.id,
      title: noteTitle.trim(),
      content: noteContent.trim(),
      createdAt: new Date().toISOString()
    };

    // Optimistic update
    setNotes(prev => [newNote, ...prev]);
    saveResearchNote(newNote).catch(err => console.error("Failed to save research note:", err));
    setNoteTitle("");
    setNoteContent("");
  }

  // MODULE 3: Web Link research and summarization
  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim() || !activeTask) return;

    setIsExtractingResearch(true);
    const targetUrl = linkUrl.trim();
    setLinkUrl("");

    try {
      // Query server for text scraping and synthesis summary
      const response = await fetch("/api/research-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: activeTask.title,
          type: "link",
          input: targetUrl
        })
      });

      if (!response.ok) {
        throw new Error("Summarizer server errored out.");
      }

      const data = await response.json();
      const summaryMarkdown = data.summary || "Unable to extract summary from link.";

      const newLink: ResearchLink = {
        id: `link_${Date.now()}`,
        taskId: activeTask.id,
        title: linkTitle.trim() || targetUrl,
        url: targetUrl,
        summary: summaryMarkdown,
        createdAt: new Date().toISOString()
      };

      // Optimistic update
      setLinks(prev => [newLink, ...prev]);
      saveResearchLink(newLink).catch(err => console.error("Failed to save research link:", err));
      setLinkTitle("");
      
      // Instantly open expanded summary for reading
      setExpandedResearchItem({
        id: newLink.id,
        type: "link",
        title: newLink.title,
        content: newLink.summary
      });

    } catch (err) {
      console.error("Link summary failure:", err);
      alert("Could not automatically extract summaries. Saved link directly.");
      const fallbackLink: ResearchLink = {
        id: `link_${Date.now()}`,
        taskId: activeTask.id,
        title: linkTitle.trim() || targetUrl,
        url: targetUrl,
        summary: "### Direct Web Resource\nSaved directly. Could not reach server for real-time text parsing.",
        createdAt: new Date().toISOString()
      };
      // Optimistic update
      setLinks(prev => [fallbackLink, ...prev]);
      saveResearchLink(fallbackLink).catch(err => console.error("Failed to save fallback research link:", err));
      setLinkTitle("");
    } finally {
      setIsExtractingResearch(false);
    }
  }

  // MODULE 3: Quick text snippet capture
  async function handleAddSnippet(e: React.FormEvent) {
    e.preventDefault();
    if (!snippetContent.trim() || !activeTask) return;

    const newSnippet: ResearchSnippet = {
      id: `snippet_${Date.now()}`,
      taskId: activeTask.id,
      content: snippetContent.trim(),
      source: snippetSource.trim() || "Pasted Snippet",
      createdAt: new Date().toISOString()
    };

    // Optimistic update
    setSnippets(prev => [newSnippet, ...prev]);
    saveResearchSnippet(newSnippet).catch(err => console.error("Failed to save research snippet:", err));
    setSnippetContent("");
    setSnippetSource("");
  }

  // Trigger instant local task-specific Emergency Recovery (if not ran globally)
  async function handleActivateLocalEmergency(taskId: string, hours: number) {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    setIsGenerating(true);
    setGenerationStep(`Compiling Emergency Survival steps for ${hours}h countdown...`);

    try {
      const response = await aiOrchestrationRequest(`You are the Emergency Response Agent for SaveMe.
Given this specific task blueprint, generate a condensed 1-hour survival plan with minimum viable actions.

Task: "${targetTask.title}"
Blueprint: ${JSON.stringify(targetTask.steps)}
Time budget: ${hours * 60} minutes

Generate a JSON object containing:
- 'survivalSteps': list of critical steps (summing to <= ${hours * 60} mins)
- 'triageReasoning': what was cut and why
- 'highYieldActions': 2 high-level focus strategies
`);

      const emergencyPlan: EmergencyPlan = cleanAndParseJSON(response);

      const updatedTask: Task = {
        ...targetTask,
        emergencyPlan
      };

      await saveTask(updatedTask);
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      
      // Sync also to overall emergency plan for display
      setOverallEmergencyPlan(emergencyPlan);
      localStorage.setItem("saveme_overall_emergency", JSON.stringify(emergencyPlan));
      
      setActiveTab("emergency");

    } catch (err: any) {
      alert("Could not synthesize emergency plan: " + err.message);
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  }

  // Server call wrapper helper for generic AI asks
  async function aiOrchestrationRequest(promptText: string): Promise<string> {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: { title: "Emergency Engine", description: "Calculating survival parameters", steps: [] },
        messages: [{ sender: "user", text: promptText }]
      })
    });
    if (!response.ok) throw new Error("Server communication fault");
    const data = await response.json();
    return data.text;
  }

  // Same JSON clean utility as server-side to handle custom triage
  function cleanAndParseJSON(text: string) {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "");
      cleaned = cleaned.replace(/\n?```$/, "");
    }
    cleaned = cleaned.trim();
    return JSON.parse(cleaned);
  }

  // --- FILTERS AND COUNTERS ---
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (task.priority && task.priority.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = filterCategory === "All" || task.category === filterCategory;
    const matchesStatus = filterStatus === "All" || task.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  }).sort((a, b) => {
    const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
    const weightA = priorityWeight[a.priority] || 0;
    const weightB = priorityWeight[b.priority] || 0;
    return weightB - weightA;
  });

  const uniqueCategories = ["All", ...Array.from(new Set(tasks.map(t => t.category)))];

  const totalStepsCount = activeTask && activeTask.steps ? activeTask.steps.length : 0;

  const completedStepsCount = activeTask && activeTask.steps ? activeTask.steps.filter(s => s.status === "completed").length : 0;

  const totalMinutesInPlan = activeTask 
    ? activeTask.steps.reduce((acc, s) => acc + s.duration, 0)
    : 0;

  const progressPercentage = totalStepsCount > 0
    ? Math.round((completedStepsCount / totalStepsCount) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased">
      
      {/* HEADER BAR */}
      <header className="border-b-2 border-slate-800 bg-white sticky top-0 z-40 px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="shrink-0">
            <SaveMeLogo className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#430088] flex items-center gap-1">
              SaveMe <span className="text-[#872a9e] font-normal">Orchestrator</span>
              <span className="text-[10px] text-black font-mono border border-slate-200 rounded-md py-0.5 px-2 ml-1 font-bold bg-white">v2.4.0</span>
            </h1>
            <p className="text-[10px] text-black uppercase font-bold tracking-[0.18em]">Turn messy thoughts into action</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {viewMode === "dashboard" && (
            <button
              onClick={() => setViewMode("planner_screen")}
              className="bg-slate-900 border-2 border-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider text-xs py-2 px-4 rounded-lg shadow-[2px_2px_0px_0px_#1e293b] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#1e293b] transition flex items-center space-x-2 cursor-pointer"
              id="btn_open_planner"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New AI Plan</span>
            </button>
          )}
          {tasks.length > 0 && (
            <button
              onClick={handleResetWorkspace}
              className="text-xs text-rose-600 hover:text-rose-800 font-black uppercase tracking-wider py-2 px-3 hover:bg-rose-50 rounded-lg transition border-2 border-transparent hover:border-slate-800"
              title="Reset Workspace"
              id="btn_reset_workspace"
            >
              Reset Data
            </button>
          )}
        </div>
      </header>

      {/* CORE WORKFLOW LOADING SCREEN */}
      {isGenerating && (
        <div className="fixed inset-0 bg-slate-50/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in text-slate-900">
          <div className="bg-white border-2 border-slate-800 p-8 rounded-lg shadow-[6px_6px_0px_0px_#1e293b] max-w-md w-full flex flex-col items-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-slate-800 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-slate-800 animate-bounce" />
              </div>
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">Compiling Workflow</h2>
            <p className="text-xs text-blue-800 font-mono bg-blue-50 px-4 py-2 rounded border-2 border-slate-800 max-w-lg mb-6 leading-relaxed">
              {generationStep}
            </p>
            <div className="text-left w-full text-[10px] font-mono text-slate-600 space-y-2 border-t-2 border-slate-150 pt-4">
              <p className="flex items-center gap-1.5"><span className="done-dot inline-block w-2.5 h-2.5 rounded-full border border-slate-800 bg-emerald-500"></span> Step 1: Parsing messy parameters to isolate task blocks</p>
              <p className="flex items-center gap-1.5"><span className="done-dot inline-block w-2.5 h-2.5 rounded-full border border-slate-800 bg-emerald-500"></span> Step 2: Scoring high-yield priority profiles via intelligence matrices</p>
              <p className="flex items-center gap-1.5"><span className="active-dot inline-block w-2.5 h-2.5 rounded-full border border-slate-800 bg-blue-500"></span> Step 3: Unraveling sequential execution blueprints & safety nets</p>
              <p className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full border border-slate-800 bg-slate-200"></span> Step 4: Compressing survival paths for active time locks</p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PANEL 1: AI PLANNER SCREEN */}
      {viewMode === "planner_screen" && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-4xl mx-auto w-full animate-fade-in">
          <div className="text-center max-w-xl mb-10">
            <div className="inline-flex items-center space-x-2 bg-blue-50 border-2 border-slate-850 rounded-full px-3 py-1 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs text-blue-800 font-bold uppercase tracking-wider font-mono">Unify planning & execution</span>
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-4">
              Turn messy thoughts into an actionable survival blueprint.
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed font-medium">
              Don't stress about where to start. Just dump everything on your mind—notes, deadlines, messy thoughts, anxiety. SaveMe will isolate the tasks, rank their urgency, build step-by-step blueprints, and lock in focus workspaces.
            </p>
          </div>

          <div className="w-full bento-card p-6 sm:p-8">
            <form onSubmit={handlePlanExtraction} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Messy Mind Dump / Tasks List
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Example: I'm completely overwhelmed. I have an algorithm exam tomorrow morning and haven't finished studying graph theory. Also, I need to buy groceries, send slides for the presentation to the team by 6 PM, and clean my room..."
                  className="w-full h-44 bg-white border-2 border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-slate-800 resize-none font-sans leading-relaxed"
                  required
                  id="textarea_mind_dump"
                />
              </div>

              {/* EMERGENCY TRIGGER BLOCK */}
              <div className="p-4 rounded-lg bg-rose-50 border-2 border-slate-800 space-y-4 shadow-[2px_2px_0px_0px_#1e293b]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded bg-rose-100 border border-rose-300 text-rose-800">
                      <Flame className="w-5 h-5 text-rose-600 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-rose-850">Activate Emergency Survival Mode</h3>
                      <p className="text-xs text-slate-600">Reduce ideal planning into immediate minimal viable survival steps.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isEmergencyMode} 
                      onChange={(e) => setIsEmergencyMode(e.target.checked)} 
                      className="sr-only peer"
                      id="checkbox_emergency"
                    />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-slate-850 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600 border border-slate-400"></div>
                  </label>
                </div>

                {isEmergencyMode && (
                  <div className="pt-2 border-t-2 border-slate-200 animate-fade-in space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-slate-600">Time Lock Budget:</span>
                      <span className="text-xs font-mono font-bold text-rose-800">{timeRemainingHours} Hours Remaining</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="12" 
                      step="1"
                      value={timeRemainingHours} 
                      onChange={(e) => setTimeRemainingHours(Number(e.target.value))} 
                      className="w-full accent-rose-600 bg-slate-200 h-2 border border-slate-400 rounded-lg appearance-none cursor-pointer"
                      id="range_hours"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>1h (Triage)</span>
                      <span>4h</span>
                      <span>8h</span>
                      <span>12h (Deep work survival)</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-600 flex items-center gap-1.5 font-semibold">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sequentially orchestrating Prompts 1-4</span>
                </div>
                <div className="flex space-x-3">
                  {tasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewMode("dashboard")}
                      className="bg-white border-2 border-slate-800 hover:bg-slate-50 text-slate-800 font-bold uppercase tracking-wider text-xs py-2.5 px-5 rounded-lg transition shadow-[2px_2px_0px_0px_#1e293b]"
                    >
                      Back to Workspace
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-slate-900 border-2 border-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider text-xs py-2.5 px-6 rounded-lg shadow-[3px_3px_0px_0px_#1e293b] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_#1e293b] transition flex items-center space-x-2 cursor-pointer"
                    id="btn_submit_mind_dump"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Compile Blueprint</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      )}

      {/* VIEW PANEL 2: MAIN EXECUTION DASHBOARD */}
      {viewMode === "dashboard" && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-6 gap-6">
          
          {/* LEFT COLUMN: ACTIVE TASKS LIST */}
          <aside className="w-full md:w-80 shrink-0 bento-card flex flex-col h-auto md:h-full overflow-hidden bg-slate-50">
            
            {/* SEARCH AND FILTERS */}
            <div className="p-4 border-b-2 border-slate-800 space-y-3 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-2 border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400 font-medium"
                  id="input_search_tasks"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-white border-2 border-slate-800 rounded-lg text-[11px] text-slate-800 p-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    id="select_status_filter"
                  >
                    <option value="All">All Statuses</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full bg-white border-2 border-slate-800 rounded-lg text-[11px] text-slate-800 p-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    id="select_category_filter"
                  >
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* OVERALL EMERGENCY PLAN ACCORDION / QUICK LINK */}
            {overallEmergencyPlan && (
              <div className="p-3 mx-4 mt-4 rounded-lg border-2 border-slate-800 bg-rose-50 animate-pulse shadow-[2px_2px_0px_0px_#1e293b]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-rose-800 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 animate-bounce text-rose-600" /> Emergency Plan Active
                  </span>
                  <button
                    onClick={() => {
                      // Switch to emergency tab instantly
                      if (activeTask) {
                        setActiveTab("emergency");
                      }
                    }}
                    className="text-[10px] font-black uppercase bg-slate-900 text-white px-2 py-0.5 rounded border-2 border-slate-800 hover:bg-slate-700 shadow-[1px_1px_0px_0px_#1e293b]"
                  >
                    View
                  </button>
                </div>
                <p className="text-[10px] text-slate-700 mt-1 leading-relaxed font-medium">
                  Consolidated triage plan synthesized to survive {overallEmergencyPlan.timeRemainingMinutes || 120} minutes countdown.
                </p>
              </div>
            )}

            {/* TASKS LIST HEADER */}
            <div className="px-4 pt-4 pb-2 flex justify-between items-center bg-slate-50">
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Active Task Blueprints ({filteredTasks.length})</span>
            </div>

            {/* TASKS SCROLLER */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5 bg-slate-50">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs font-semibold">
                  No tasks matches criteria.
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isActive = task.id === activeTaskId;
                  const isCompleted = task.status === "completed";
                  const priorityColors = {
                    High: "bg-rose-100 text-rose-800 border-rose-300",
                    Medium: "bg-amber-100 text-amber-800 border-amber-300",
                    Low: "bg-slate-100 text-slate-800 border-slate-300"
                  };

                  const taskTotalSteps = task.steps ? task.steps.length : 0;
                  const taskCompletedSteps = task.steps ? task.steps.filter(s => s.status === "completed").length : 0;
                  const taskProgress = taskTotalSteps > 0 ? Math.round((taskCompletedSteps / taskTotalSteps) * 100) : 0;

                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setActiveTaskId(task.id);
                        localStorage.setItem("saveme_active_task_id", task.id);
                      }}
                      className={`group p-3.5 rounded-lg border-2 border-slate-800 text-left cursor-pointer transition flex flex-col justify-between ${
                        isActive 
                          ? "bg-blue-50 shadow-[3px_3px_0px_0px_#1e293b] translate-x-1" 
                          : "bg-white hover:bg-slate-50 shadow-[2px_2px_0px_0px_#1e293b] hover:shadow-[3px_3px_0px_0px_#1e293b] hover:-translate-y-0.5"
                      }`}
                      id={`task_card_${task.id}`}
                    >
                      <div className="flex items-start justify-between space-x-2">
                        <div className="flex items-start space-x-2.5">
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <h4 className={`text-xs font-black uppercase tracking-tight leading-tight ${isCompleted ? "text-slate-400 line-through font-medium" : "text-slate-900"}`}>
                              {task.title}
                            </h4>
                            <div className="mt-1 flex items-center space-x-1">
                              <span className="text-[10px] font-bold text-slate-500">
                                {task.category}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">•</span>
                              <span className="text-[10px] font-extrabold text-blue-600">
                                {taskProgress}% ({taskCompletedSteps}/{taskTotalSteps} steps)
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          id={`btn_delete_task_${task.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTask(task.id);
                          }}
                          className="opacity-100 md:opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition shrink-0 cursor-pointer"
                          title="Delete blueprint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* STAT BADGES */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-800 uppercase ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </span>
                          {task.isEmergency && (
                            <span className="text-[9px] font-extrabold bg-rose-600 text-white border border-slate-800 py-0.5 px-1.5 rounded uppercase shrink-0">
                              ⚡ Emergency
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-1.5 text-[9px] font-bold text-slate-600">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>
                            {task.steps.filter(s => s.status === "todo").reduce((acc, s) => acc + s.duration, 0)} mins
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* MAIN COLUMN: TASK DETAIL WORKSPACE */}
          <main className="flex-1 bento-card flex flex-col h-full overflow-hidden bg-white">
            {activeTask ? (
              <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                
                {/* ACTIVE TASK HERO HEADLINE */}
                <div className="p-6 border-b-2 border-slate-800 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <div className="flex items-center space-x-2.5 mb-1.5">
                      <span className="text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 py-0.5 px-2.5 rounded-full border border-indigo-300">
                        {activeTask.category}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        Synthesized on {new Date(activeTask.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">{activeTask.title}</h2>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl font-medium">{activeTask.description}</p>
                  </div>

                  {/* MINI FOCUS BAR */}
                  <div className="shrink-0 flex items-center space-x-4 bg-white border-2 border-slate-800 px-4 py-2.5 rounded-lg shadow-[3px_3px_0px_0px_#1e293b]">
                    <div className="text-left">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Progress</div>
                      <div className="text-xs font-black text-blue-600">{progressPercentage}% Complete</div>
                    </div>
                    <div className="w-24 bg-slate-100 border border-slate-300 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
                {/* WORKSPACE NAVIGATION TABS */}
                <div className="px-6 border-b-2 border-slate-800 bg-slate-100/50 flex space-x-2 overflow-x-auto py-3">
                  <button
                    onClick={() => setActiveTab("steps")}
                    className={`py-2 px-4 font-bold uppercase tracking-wider text-xs border-2 border-slate-800 rounded-lg transition flex items-center space-x-2 shrink-0 ${
                      activeTab === "steps" 
                        ? "bg-slate-900 text-white shadow-[2px_2px_0px_0px_#1e293b]" 
                        : "bg-white text-slate-700 hover:bg-slate-50 hover:translate-y-[-0.5px] transition cursor-pointer"
                    }`}
                    id="tab_steps"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Execution Blueprint</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("chat")}
                    className={`py-2 px-4 font-bold uppercase tracking-wider text-xs border-2 border-slate-800 rounded-lg transition flex items-center space-x-2 shrink-0 ${
                      activeTab === "chat" 
                        ? "bg-slate-900 text-white shadow-[2px_2px_0px_0px_#1e293b]" 
                        : "bg-white text-slate-700 hover:bg-slate-50 hover:translate-y-[-0.5px] transition cursor-pointer"
                    }`}
                    id="tab_chat"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Dedicated Chat</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("notebook")}
                    className={`py-2 px-4 font-bold uppercase tracking-wider text-xs border-2 border-slate-800 rounded-lg transition flex items-center space-x-2 shrink-0 ${
                      activeTab === "notebook" 
                        ? "bg-slate-900 text-white shadow-[2px_2px_0px_0px_#1e293b]" 
                        : "bg-white text-slate-700 hover:bg-slate-50 hover:translate-y-[-0.5px] transition cursor-pointer"
                    }`}
                    id="tab_notebook"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Research Notebook</span>
                  </button>
                </div>

                {/* ACTIVE TAB FRAME */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-white">
                  
                  {/* TAB 1: EXECUTION STEPS & MITIGATIONS */}
                  {activeTab === "steps" && (
                    <div className="space-y-6 max-w-4xl animate-fade-in text-slate-900">
                      
                      {/* EMERGENCY MODE CONTROL BAR */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-2 border-slate-800 p-4 rounded-lg bg-slate-50 shadow-[2px_2px_0px_0px_#1e293b] gap-3">
                        <div className="space-y-1 text-left">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            {activeTask.isEmergency ? (
                              <>
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                                <span>Execution Mode: ⚡ Emergency Survival</span>
                              </>
                            ) : (
                              <>
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
                                <span>Execution Mode: ⚙️ Standard Blueprint</span>
                              </>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                            {activeTask.isEmergency 
                              ? "Executing minimized high-yield survival plan to hit your deadline."
                              : "Executing full step-by-step roadmap optimized for deliberate progress."
                            }
                          </p>
                        </div>
                        <div>
                          <button
                            onClick={() => handleToggleEmergencyMode(activeTask.id)}
                            className={`font-black uppercase tracking-wider text-xs border-2 border-slate-800 py-2 px-4 rounded-lg transition shadow-[2px_2px_0px_0px_#1e293b] cursor-pointer hover:shadow-[3px_3px_0px_0px_#1e293b] hover:-translate-y-0.5 active:translate-y-0 ${
                              activeTask.isEmergency 
                                ? "bg-slate-900 text-white hover:bg-slate-700" 
                                : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-800"
                            }`}
                            id="btn_toggle_emergency_mode"
                          >
                            {activeTask.isEmergency ? "⚡ Exit Emergency Mode" : "⚡ Activate Emergency Mode"}
                          </button>
                        </div>
                      </div>

                      {activeTask.isEmergency ? (
                        /* RENDER COMPRESSED RECOVERY PLAN */
                        <div className="space-y-6">
                          {/* EMERGENCY WARNING CALLOUT */}
                          <div className="p-4 rounded-lg bg-rose-50 border-2 border-slate-800 flex items-start space-x-4 shadow-[2px_2px_0px_0px_#1e293b]">
                            <div className="bg-rose-100 border border-rose-300 p-2.5 rounded-lg shrink-0 mt-0.5 animate-pulse">
                              <AlertTriangle className="w-5 h-5 text-rose-600" />
                            </div>
                            <div className="space-y-1 text-left">
                              <h4 className="text-sm font-black uppercase text-rose-800">Emergency Survival Mode is Active</h4>
                              <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                                Our Triage and Recovery agents analyzed your remaining budget and stripped the ideal plans of any lower-impact sub-tasks. Below is your optimized zero-fluff focus blueprint.
                              </p>
                            </div>
                          </div>

                          {/* GRID */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* SURVIVAL PLAN STEPS */}
                            <div className="lg:col-span-2 space-y-4 text-left">
                              <h3 className="text-xs font-black uppercase tracking-wider text-slate-750">Critical Survival Steps</h3>
                              <div className="space-y-2.5">
                                {(activeTask.emergencyPlan?.survivalSteps || []).length > 0 ? (
                                  (activeTask.emergencyPlan?.survivalSteps || []).map((step) => {
                                    const isStepCompleted = step.status === "completed";
                                    return (
                                      <div
                                        key={step.id}
                                        onClick={() => handleToggleSurvivalStep(step.id)}
                                        className={`p-4 rounded-lg border-2 border-slate-800 transition cursor-pointer flex items-start justify-between space-x-4 shadow-[2px_2px_0px_0px_#1e293b] hover:shadow-[3px_3px_0px_0px_#1e293b] hover:translate-y-[-0.5px] ${
                                          isStepCompleted 
                                            ? "bg-slate-100 border-dashed opacity-50" 
                                            : "bg-gradient-to-r from-rose-50 to-white"
                                        }`}
                                      >
                                        <div className="flex items-start space-x-3">
                                          {isStepCompleted ? (
                                            <CheckCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                          ) : (
                                            <Circle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                                          )}
                                          <div className="text-left">
                                            <span className={`text-xs font-bold block ${isStepCompleted ? "text-slate-500 line-through font-medium" : "text-slate-900"}`}>
                                              {step.title}
                                            </span>
                                            <p className="text-[11px] text-slate-600 leading-relaxed mt-1 font-medium">
                                              {step.reason}
                                            </p>
                                          </div>
                                        </div>

                                        <span className="text-[10px] font-bold text-rose-850 bg-rose-100 border-2 border-slate-800 py-0.5 px-2 rounded shrink-0">
                                          {step.duration} mins
                                        </span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="p-4 rounded-lg bg-slate-50 border-2 border-dashed border-slate-400 text-center text-xs text-slate-500 font-semibold">
                                    No survival steps compiled yet. Try activating emergency mode to generate one!
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ELITE COGNITIVE TIPS */}
                            <div className="space-y-6 text-left">
                              
                              {/* TRIAGE REASONING */}
                              <div className="p-4 rounded-lg bg-slate-50 border-2 border-slate-800 space-y-3 shadow-[2px_2px_0px_0px_#1e293b]">
                                <h4 className="text-xs font-bold uppercase text-slate-750 tracking-wider">Triage Diagnosis</h4>
                                <p className="text-xs text-slate-700 leading-relaxed italic font-medium">
                                  "{activeTask.emergencyPlan?.triageReasoning || "Cut down non-critical detailing and formatted template steps to keep your execution cycle focused purely on high-yield output elements."}"
                                </p>
                              </div>

                              {/* ELITE TIPS PANEL */}
                              <div className="p-4 rounded-lg bg-rose-50 border-2 border-slate-800 space-y-3 shadow-[3px_3px_0px_0px_#1e293b]">
                                <h4 className="text-xs font-black uppercase text-rose-800 tracking-wider flex items-center gap-1.5">
                                  <Flame className="w-3.5 h-3.5 text-rose-700" /> High-Yield Actions
                                </h4>
                                <ul className="space-y-2.5 text-xs text-slate-700 font-semibold">
                                  {(activeTask.emergencyPlan?.highYieldActions || [
                                    "Isolate yourself from communications. Kill browser tabs.",
                                    "Split remaining minutes into 25-minute sprints with 3-minute check-ins.",
                                    "Do not rewrite existing parameters. Ship immediate drafts first."
                                  ]).map((tip, idx) => (
                                    <li key={idx} className="flex items-start space-x-2">
                                      <Check className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                            </div>

                          </div>
                        </div>
                      ) : (
                        /* RENDER STANDARD BLUEPRINT */
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          
                          {/* STEPS COLUMN */}
                          <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
                              <span>Interactive Milestones</span>
                              <span className="text-xs font-bold text-slate-500">({activeTask.steps.length} total)</span>
                            </h3>
                            <div className="space-y-2.5">
                              {activeTask.steps.map((step) => {
                                const isStepCompleted = step.status === "completed";
                                return (
                                  <div
                                    key={step.id}
                                    onClick={() => handleToggleStep(activeTask.id, step.id)}
                                    className={`p-3.5 rounded-lg border-2 border-slate-800 transition cursor-pointer flex items-center justify-between shadow-[2px_2px_0px_0px_#1e293b] hover:shadow-[3px_3px_0px_0px_#1e293b] hover:translate-y-[-0.5px] ${
                                      isStepCompleted 
                                        ? "bg-slate-50 border-dashed opacity-60" 
                                        : "bg-white"
                                    }`}
                                  >
                                    <div className="flex items-center space-x-3 text-left">
                                      {isStepCompleted ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-slate-400 shrink-0" />
                                      )}
                                      <span className={`text-xs font-bold ${isStepCompleted ? "text-slate-400 line-through" : "text-slate-900"}`}>
                                        {step.title}
                                      </span>
                                    </div>

                                    <div className="flex items-center space-x-2.5 shrink-0">
                                      <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border-2 border-slate-800 py-0.5 px-2 rounded">
                                        {step.difficulty}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-600 flex items-center space-x-1">
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        <span>{step.duration}m</span>
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* MILESTONES REVIEW */}
                            <div className="pt-4 space-y-3 text-left">
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Core Milestones</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {activeTask.milestones.map((m, idx) => (
                                  <div key={idx} className="bg-white border-2 border-slate-800 p-3 rounded-lg flex items-start space-x-2.5 shadow-[2px_2px_0px_0px_#1e293b]">
                                    <div className="text-[10px] font-bold text-slate-900 bg-amber-100 h-5 w-5 rounded border-2 border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                                      {idx + 1}
                                    </div>
                                    <p className="text-xs text-slate-700 font-semibold leading-relaxed">{m}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* ANXIETY MITIGATOR SIDEBAR */}
                          <div className="space-y-6 text-left">
                            
                            {/* PRIORITY REASONING */}
                            <div className="p-4 rounded-lg bg-slate-50 border-2 border-slate-800 space-y-3 shadow-[2px_2px_0px_0px_#1e293b]">
                              <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">Priority Breakdown</h4>
                              <div className="flex items-center space-x-3 pt-1">
                                <div>
                                  <div className="text-[9px] font-bold uppercase text-slate-500">IMPACT</div>
                                  <div className="text-sm font-black text-slate-900">{activeTask.impactScore}/10</div>
                                </div>
                                <div className="h-6 border-l-2 border-slate-800" />
                                <div>
                                  <div className="text-[9px] font-bold uppercase text-slate-500">URGENCY</div>
                                  <div className="text-sm font-black text-rose-700">{activeTask.urgencyScore}/10</div>
                                </div>
                                <div className="h-6 border-l-2 border-slate-800" />
                                <div>
                                  <div className="text-[9px] font-bold uppercase text-slate-500">TOTAL COST</div>
                                  <div className="text-sm font-black text-slate-900">{totalMinutesInPlan}m</div>
                                </div>
                              </div>
                              <p className="text-xs text-slate-700 italic leading-relaxed pt-1.5 border-t-2 border-slate-200 font-medium">
                                "{activeTask.priorityReasoning}"
                              </p>
                            </div>

                            {/* SAFETY NETS / MITIGATIONS */}
                            <div className="p-4 rounded-lg bg-rose-50 border-2 border-slate-800 space-y-4 shadow-[3px_3px_0px_0px_#1e293b]">
                              <h4 className="text-xs font-black uppercase text-rose-800 tracking-wider flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-rose-750" /> Safety Nets
                              </h4>
                              
                              {activeTask.potentialObstacles.map((obstacle, idx) => (
                                <div key={idx} className="space-y-2 border-b-2 border-rose-100 pb-3 last:border-0 last:pb-0">
                                  <div className="text-[10px] text-rose-800 font-bold uppercase flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-700" /> Obstacle:
                                  </div>
                                  <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                                    {obstacle}
                                  </p>
                                  <div className="text-[10px] text-emerald-800 font-bold uppercase pt-1">
                                    Mitigation Strategy:
                                  </div>
                                  <p className="text-xs text-slate-800 font-medium leading-relaxed bg-white p-2.5 rounded border-2 border-slate-800 shadow-[1px_1px_0px_0px_#1e293b]">
                                    {activeTask.mitigationStrategies[idx] || "Draft a strict template first to secure visual parameters."}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      )}

                    </div>
                  )}                  {/* TAB 2: DEDICATED CHAT (ISOLATED) */}
                  {activeTab === "chat" && (
                    <div className="flex flex-col h-[500px] max-w-4xl mx-auto border-2 border-slate-800 rounded-lg bg-slate-50 overflow-hidden animate-fade-in shadow-[3px_3px_0px_0px_#1e293b]">
                      
                      {/* CHAT MESSAGES PANEL */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {chatHistory.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-3">
                            <MessageSquare className="w-8 h-8 text-blue-500 animate-pulse" />
                            <h4 className="text-sm font-black uppercase text-slate-900">Dedicated Chat Workspace</h4>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                              This chat channel is completely isolated to help you execute the task: <span className="text-slate-900 font-bold">"{activeTask.title}"</span>. Ask questions, brainstorm copy, write drafts, or analyze steps. No context leaks to other tasks.
                            </p>
                          </div>
                        ) : (
                          chatHistory.map((m) => {
                            const isUser = m.sender === "user";
                            return (
                              <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-fade-in`}>
                                <div className={`max-w-[85%] border-2 border-slate-800 rounded-lg px-4 py-3 text-xs leading-relaxed shadow-[2px_2px_0px_0px_#1e293b] ${
                                  isUser 
                                    ? "bg-slate-900 text-white rounded-tr-none" 
                                    : "bg-white text-slate-800 rounded-tl-none whitespace-pre-wrap font-medium"
                                }`}>
                                  {m.text}
                                </div>
                                {!isUser && (
                                  <div className="flex items-center space-x-2 mt-1.5 mb-2">
                                    <button
                                      id={`btn_save_notebook_${m.id}`}
                                      onClick={() => handleSaveMessageToNotebook(m.id, m.text)}
                                      className="text-[10px] font-extrabold uppercase bg-white hover:bg-slate-50 text-slate-750 border border-slate-800 rounded px-2 py-0.5 shadow-[1px_1px_0px_0px_#1e293b] cursor-pointer transition flex items-center gap-1 shrink-0"
                                    >
                                      <BookOpen className="w-2.5 h-2.5" /> Save to Notebook
                                    </button>
                                    <button
                                      id={`btn_pin_task_${m.id}`}
                                      onClick={() => handlePinMessageToTask(m.id, m.text)}
                                      className="text-[10px] font-extrabold uppercase bg-white hover:bg-slate-50 text-slate-750 border border-slate-800 rounded px-2 py-0.5 shadow-[1px_1px_0px_0px_#1e293b] cursor-pointer transition flex items-center gap-1 shrink-0"
                                    >
                                      <Plus className="w-2.5 h-2.5" /> Pin to Task
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        {isChatSending && (
                          <div className="flex justify-start">
                            <div className="bg-white border-2 border-slate-800 rounded-lg rounded-tl-none px-4 py-3 text-xs text-slate-600 flex items-center space-x-2 font-bold shadow-[2px_2px_0px_0px_#1e293b]">
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                              <span>AI Partner is typing...</span>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* QUICK ACTION PROMPTS */}
                      {chatHistory.length === 0 && (
                        <div className="px-4 py-3 border-t-2 border-slate-800 bg-slate-100/50">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Suggested focuses:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {quickPrompts.map((p, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSendChatMessage(p)}
                                className="text-left text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border-2 border-slate-800 rounded-lg p-2 text-[11px] font-bold uppercase transition line-clamp-1 cursor-pointer"
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CHAT INPUT BAR */}
                      <div className="p-3 border-t-2 border-slate-800 bg-slate-100 flex space-x-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                          placeholder={`Ask about ${activeTask.title}...`}
                          className="flex-1 bg-white border-2 border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          disabled={isChatSending}
                          id="input_chat_box"
                        />
                        <button
                          onClick={() => handleSendChatMessage()}
                          className="bg-slate-900 border-2 border-slate-800 text-white p-2.5 rounded-lg hover:bg-slate-700 transition shrink-0 cursor-pointer disabled:opacity-50"
                          disabled={isChatSending || !chatInput.trim()}
                          id="btn_send_chat"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  )}                  {/* TAB 3: RESEARCH WORKSPACE (NotebookLM Style) */}
                  {activeTab === "notebook" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto animate-fade-in">
                      
                      {/* ADD RESEARCH SOURCE CONTROLS */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Add Research Source</h3>
                        
                        {/* URL SUMMARIZER PANEL */}
                        <div className="bg-slate-50 border-2 border-slate-800 p-4 rounded-lg space-y-3 shadow-[2px_2px_0px_0px_#1e293b]">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Web Page / Reference Link</span>
                          <form onSubmit={handleAddLink} className="space-y-2">
                            <input
                              type="text"
                              placeholder="Source Title (Optional)"
                              value={linkTitle}
                              onChange={(e) => setLinkTitle(e.target.value)}
                              className="w-full bg-white border-2 border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                              id="input_link_title"
                            />
                            <input
                              type="url"
                              placeholder="https://example.com/source-text"
                              value={linkUrl}
                              onChange={(e) => setLinkUrl(e.target.value)}
                              className="w-full bg-white border-2 border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                              required
                              id="input_link_url"
                            />
                            <button
                              type="submit"
                              disabled={isExtractingResearch}
                              className="w-full bg-slate-900 hover:bg-slate-700 border-2 border-slate-800 text-white text-xs font-bold py-2 rounded-lg transition uppercase flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-[1px_1px_0px_0px_#1e293b]"
                              id="btn_extract_link"
                            >
                              {isExtractingResearch ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Summarizing with AI...</span>
                                </>
                              ) : (
                                <>
                                  <LinkIcon className="w-3 h-3" />
                                  <span>Extract AI Notebook Summary</span>
                                </>
                              )}
                            </button>
                          </form>
                        </div>

                        {/* TEXT SNIPPET CAPTURE */}
                        <div className="bg-slate-50 border-2 border-slate-800 p-4 rounded-lg space-y-3 shadow-[2px_2px_0px_0px_#1e293b]">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Reference Text Snippet</span>
                          <form onSubmit={handleAddSnippet} className="space-y-2">
                            <textarea
                              placeholder="Paste key notes, paragraphs, raw draft lines or quotes here to link with task..."
                              value={snippetContent}
                              onChange={(e) => setSnippetContent(e.target.value)}
                              className="w-full h-24 bg-white border-2 border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
                              required
                              id="textarea_snippet_content"
                            />
                            <input
                              type="text"
                              placeholder="Source details (e.g. Textbook chapter 3)"
                              value={snippetSource}
                              onChange={(e) => setSnippetSource(e.target.value)}
                              className="w-full bg-white border-2 border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                              id="input_snippet_source"
                            />
                            <button
                              type="submit"
                              className="w-full bg-slate-900 hover:bg-slate-700 border-2 border-slate-800 text-white text-xs font-bold py-2 rounded-lg transition uppercase flex items-center justify-center space-x-1.5 cursor-pointer shadow-[1px_1px_0px_0px_#1e293b]"
                              id="btn_add_snippet"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Save Snippet</span>
                            </button>
                          </form>
                        </div>

                        {/* CUSTOM NOTE PAD */}
                        <div className="bg-slate-50 border-2 border-slate-800 p-4 rounded-lg space-y-3 shadow-[2px_2px_0px_0px_#1e293b]">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Custom Scratch Note</span>
                          <form onSubmit={handleAddNote} className="space-y-2">
                            <input
                              type="text"
                              placeholder="Note Title"
                              value={noteTitle}
                              onChange={(e) => setNoteTitle(e.target.value)}
                              className="w-full bg-white border-2 border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                              required
                              id="input_note_title"
                            />
                            <textarea
                              placeholder="Brainstorm details, todo checkpoints..."
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                              className="w-full h-24 bg-white border-2 border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
                              required
                              id="textarea_note_content"
                            />
                            <button
                              type="submit"
                              className="w-full bg-slate-900 hover:bg-slate-700 border-2 border-slate-800 text-white text-xs font-bold py-2 rounded-lg transition uppercase flex items-center justify-center space-x-1.5 cursor-pointer shadow-[1px_1px_0px_0px_#1e293b]"
                              id="btn_add_note"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Add Custom Note</span>
                            </button>
                          </form>
                        </div>

                      </div>

                      {/* DISPLAY SOURCE NOTEBOOK */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Notebook References</h3>
                          <span className="text-[10px] font-bold text-slate-500">
                            {notes.length + links.length + snippets.length} elements attached
                          </span>
                        </div>

                        {/* EXPANDED DETAILED SOURCE VIEW */}
                        {expandedResearchItem && (
                          <div className="bg-amber-50 border-2 border-slate-800 p-4 rounded-lg relative animate-fade-in space-y-3 shadow-[3px_3px_0px_0px_#1e293b]">
                            <button
                              onClick={() => setExpandedResearchItem(null)}
                              className="absolute top-3 right-3 text-slate-500 hover:text-slate-900 cursor-pointer"
                            >
                              <X className="w-4 h-4 font-bold" />
                            </button>
                            <span className="text-[9px] font-bold bg-slate-900 text-white border-2 border-slate-800 py-0.5 px-2.5 rounded-full uppercase">
                              Active: {expandedResearchItem.type}
                            </span>
                            <h4 className="text-sm font-black uppercase text-slate-900 pr-6">{expandedResearchItem.title}</h4>
                            <div className="text-xs text-slate-800 leading-relaxed max-h-72 overflow-y-auto pr-2 pt-2 border-t-2 border-slate-200 prose prose-xs font-medium">
                              <Markdown>{expandedResearchItem.content}</Markdown>
                            </div>
                          </div>
                        )}

                        {/* GRID OF ELEMENTS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* LIST NOTES */}
                          {notes.map(note => (
                            <div
                              key={note.id}
                              onClick={() => setExpandedResearchItem({
                                id: note.id,
                                type: "note",
                                title: note.title,
                                content: note.content
                              })}
                              className="bg-white hover:bg-slate-50 border-2 border-slate-800 p-4 rounded-lg cursor-pointer transition flex flex-col justify-between space-y-3 shadow-[2px_2px_0px_0px_#1e293b] hover:shadow-[3px_3px_0px_0px_#1e293b] hover:-translate-y-0.5"
                            >
                              <div>
                                <div className="flex items-center space-x-1.5 text-slate-600 mb-1">
                                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Scratch Note</span>
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 line-clamp-1">{note.title}</h4>
                                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed mt-1 font-medium">
                                  {note.content}
                                </p>
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 block pt-1">
                                {new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          ))}

                          {/* LIST SUMMARIZED LINKS */}
                          {links.map(link => (
                            <div
                              key={link.id}
                              onClick={() => setExpandedResearchItem({
                                id: link.id,
                                type: "link",
                                title: link.title,
                                content: link.summary
                              })}
                              className="bg-white hover:bg-slate-50 border-2 border-slate-800 p-4 rounded-lg cursor-pointer transition flex flex-col justify-between space-y-3 shadow-[2px_2px_0px_0px_#1e293b] hover:shadow-[3px_3px_0px_0px_#1e293b] hover:-translate-y-0.5"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-1.5 text-slate-600">
                                    <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Scraped Summary</span>
                                  </div>
                                  <a 
                                    href={link.url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-slate-405 hover:text-blue-600 p-0.5"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 line-clamp-1">{link.title}</h4>
                                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed mt-1 font-medium">
                                  Click to view structured takeaways.
                                </p>
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 block pt-1">
                                {new Date(link.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          ))}

                          {/* LIST SNIPPETS */}
                          {snippets.map(snippet => (
                            <div
                              key={snippet.id}
                              onClick={() => setExpandedResearchItem({
                                id: snippet.id,
                                type: "snippet",
                                title: `Snippet from ${snippet.source}`,
                                content: `### Captured Snippet Source\nSource details: *${snippet.source}*\n\n---\n\n${snippet.content}`
                              })}
                              className="bg-white hover:bg-slate-50 border-2 border-slate-800 p-4 rounded-lg cursor-pointer transition flex flex-col justify-between space-y-3 shadow-[2px_2px_0px_0px_#1e293b] hover:shadow-[3px_3px_0px_0px_#1e293b] hover:-translate-y-0.5"
                            >
                              <div>
                                <div className="flex items-center space-x-1.5 text-slate-600 mb-1">
                                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Pasted Block</span>
                                </div>
                                <p className="text-[11px] text-slate-700 line-clamp-3 leading-relaxed font-semibold">
                                  "{snippet.content}"
                                </p>
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 block pt-1">
                                Source: {snippet.source}
                              </span>
                            </div>
                          ))}

                          {notes.length === 0 && links.length === 0 && snippets.length === 0 && (
                            <div className="col-span-2 text-center py-12 text-slate-500 text-xs font-semibold">
                              Your Research Notebook is currently empty. Use the Left column to save links, copy-paste passages or scribble notes.
                            </div>
                          )}

                        </div>
                      </div>

                    </div>
                  )}



                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-4 bg-slate-50">
                <BookOpen className="w-12 h-12 text-slate-400 animate-pulse" />
                <h3 className="text-sm font-black uppercase text-slate-850">No Task Selected</h3>
                <p className="text-xs text-slate-600 max-w-sm font-semibold leading-relaxed">
                  Select an active blueprint from the left sidebar to unlock its dedicated steps, chat, and notebook resources.
                </p>
              </div>
            )}
          </main>

        </div>
      )}

      {/* BEAUTIFUL CUSTOM CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-lg max-w-sm w-full p-6 shadow-[6px_6px_0px_0px_#1e293b] animate-scale-in text-slate-900">
            <h3 className="text-base font-black uppercase tracking-tight text-slate-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              {confirmModal.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold mb-6">
              {confirmModal.message}
            </p>
            <div className="flex space-x-3">
              <button
                id="btn_confirm_cancel"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-xs py-2.5 px-4 rounded-lg border-2 border-slate-800 shadow-[2px_2px_0px_0px_#1e293b] active:translate-y-[1px] transition cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                id="btn_confirm_action"
                onClick={async () => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  await confirmModal.onConfirm();
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase tracking-wider text-xs py-2.5 px-4 rounded-lg border-2 border-slate-800 shadow-[2px_2px_0px_0px_#1e293b] active:translate-y-[1px] transition cursor-pointer text-center"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
