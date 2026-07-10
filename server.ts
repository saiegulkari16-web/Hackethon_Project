import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK lazily to prevent crashes if key is missing
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but was not found.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// Robust JSON parsing helper to strip markdown code fences
function cleanAndParseJSON(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "");
    cleaned = cleaned.replace(/\n?```$/, "");
  }
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt to extract the first JSON array or object
    const firstBracket = cleaned.indexOf("[");
    const firstCurly = cleaned.indexOf("{");
    let startIndex = -1;
    let endIndex = -1;
    
    if (firstBracket !== -1 && (firstCurly === -1 || firstBracket < firstCurly)) {
      startIndex = firstBracket;
      endIndex = cleaned.lastIndexOf("]");
    } else if (firstCurly !== -1) {
      startIndex = firstCurly;
      endIndex = cleaned.lastIndexOf("}");
    }
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonCandidate = cleaned.substring(startIndex, endIndex + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch (innerErr) {
        console.error("Failed to parse extracted JSON candidate:", jsonCandidate);
        throw new Error("Unable to parse structured response from AI: " + innerErr);
      }
    }
    throw new Error("Invalid JSON format from AI response: " + err);
  }
}

// API Route: Pipeline Orchestrator (Steps 1 to 4)
app.post("/api/pipeline", async (req, res) => {
  try {
    const { message, isEmergency, timeRemainingHours } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Missing or invalid 'message' in request body." });
      return;
    }

    const ai = getAIClient();
    const cleanMessage = message.trim();

    // Check if the user is in an emergency state (from keywords or toggle)
    const emergencyKeywords = ["urgent", "emergency", "exam", "interview", "presentation", "deadline", "last minute", "last-minute", "few hours"];
    const hasEmergencyKeywords = emergencyKeywords.some(keyword => cleanMessage.toLowerCase().includes(keyword));
    const finalIsEmergency = isEmergency || hasEmergencyKeywords;
    const finalTimeRemaining = timeRemainingHours ? Number(timeRemainingHours) * 60 : 120; // default 2 hours if not specified

    console.log(`[SaveMe Pipeline] Running with isEmergency=${finalIsEmergency}, timeRemainingMinutes=${finalTimeRemaining}`);

    // --- STEP 1: Task Extraction Agent ---
    const prompt1 = `You are the Task Extraction Agent for SaveMe.
Given a user's natural language input, extract a clean list of concrete, actionable tasks.
For each task, extract:
- 'title' (short, concise name of the task)
- 'description' (clear statement of what needs to be done)
- 'category' (e.g., 'Work', 'Study', 'Personal', 'Health', 'Finance', 'Other')

Input message:
"${cleanMessage}"`;

    const responseSchema1 = {
      type: Type.ARRAY,
      description: "Array of extracted tasks",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Concise title of the task."
          },
          description: {
            type: Type.STRING,
            description: "Detailed description of the task."
          },
          category: {
            type: Type.STRING,
            description: "Category category, strictly one of: Work, Study, Personal, Health, Finance, Other."
          }
        },
        required: ["title", "description", "category"]
      }
    };

    const response1 = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt1,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema1
      }
    });

    const tasks = cleanAndParseJSON(response1.text || "[]");
    if (!Array.isArray(tasks) || tasks.length === 0) {
      res.json({
        tasks: [],
        ranked_tasks: [],
        execution_plan: [],
        emergency_plan: null
      });
      return;
    }

    // Add unique temporary IDs to the extracted tasks
    const tasksWithId = tasks.map((t, idx) => ({
      ...t,
      id: `task_${Date.now()}_${idx}`,
      status: "todo",
      originalInput: cleanMessage,
      createdAt: new Date().toISOString()
    }));

    // --- STEP 2: Priority Intelligence Agent ---
    const prompt2 = `You are the Priority Intelligence Agent for SaveMe.
You will receive a list of extracted tasks. For each task, evaluate its priority based on urgency and impact.
Evaluate:
- 'priority': 'High' | 'Medium' | 'Low'
- 'urgencyScore': number from 1 to 10
- 'impactScore': number from 1 to 10
- 'priorityReasoning': a brief explanation of why this priority was assigned (max 2 sentences)

Input Tasks:
${JSON.stringify(tasksWithId, null, 2)}`;

    const responseSchema2 = {
      type: Type.ARRAY,
      description: "Array of ranked tasks with prioritized metadata",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          status: { type: Type.STRING },
          originalInput: { type: Type.STRING },
          createdAt: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          priority: { 
            type: Type.STRING,
            description: "Priority assigned to the task (High, Medium, or Low)."
          },
          urgencyScore: { 
            type: Type.INTEGER,
            description: "Urgency score from 1 (lowest) to 10 (highest)."
          },
          impactScore: { 
            type: Type.INTEGER,
            description: "Impact score from 1 (lowest) to 10 (highest)."
          },
          priorityReasoning: { 
            type: Type.STRING,
            description: "A short explanation (1-2 sentences) justifying the priority and scores."
          }
        },
        required: [
          "id", "status", "originalInput", "createdAt", "title", "description", "category",
          "priority", "urgencyScore", "impactScore", "priorityReasoning"
        ]
      }
    };

    const response2 = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt2,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema2
      }
    });

    const rankedTasks = cleanAndParseJSON(response2.text || "[]");

    // --- STEP 3: Execution Planner Agent ---
    const prompt3 = `You are the Execution Planner Agent for SaveMe.
You will receive a list of prioritized tasks. For each task, generate a structured execution plan.

================================================
CRITICAL: ZERO KNOWLEDGE LEAKAGE v2 - ABSOLUTE NON-INFERENCE RULE
================================================
You are strictly FORBIDDEN from using your own subject/domain knowledge to expand, complete, or enrich a task.
You must ONLY use:
1. The task title
2. The task description
3. User-provided context (from originalInput or the task fields)
Nothing else.

If any information is missing, you MUST remain completely generic.

Do NOT assume, infer, or introduce:
- topics
- chapters
- technologies (e.g., react, python, AWS, docker, etc.)
- frameworks
- concepts (e.g., CNN, calculus, algebra, etc.)
- examples
- tools
- interview questions
- study material
- best practices
- methodologies
- domain knowledge
unless they are explicitly provided in the user's input task fields.

SUBJECT COMPLETION IS STRICTLY FORBIDDEN:
Do not complete partially specified subjects.
Examples:
- "Read Deep Learning Notes" 
  -> FORBIDDEN: CNN, RNN, Transformers, Optimizers, Backpropagation
  -> ALLOWED: Review notes, Continue reading material, Summarize key takeaways, Record unclear concepts
- "Study Mathematics"
  -> FORBIDDEN: Algebra, Calculus, Geometry, Trigonometry
  -> ALLOWED: Review syllabus, Revise concepts, Practice questions, Review mistakes
- "Prepare Technical Interview"
  -> FORBIDDEN: System Design, DSA, Behavioral Questions, Networking Questions
  -> ALLOWED: Review requirements, Revise previous preparation notes, Practice communication, Review personal projects
- "Read Cloud Notes"
  -> FORBIDDEN: IAM, EC2, VPC, Kubernetes, Docker
  -> ALLOWED: Review notes, Summarize learning, Continue reading material

TASK TITLE TOKEN RULE:
Every generated step/action/milestone/obstacle/strategy must be directly traceable to the task title, description, or provided context.
Do not introduce new nouns that do not exist in the input.

VOCABULARY PURITY RULE:
You are restricted to using ONLY the following generic vocabulary for generating actions (steps):
Generic Verbs:
- Review
- Identify
- Revise
- Read
- Continue
- Practice
- Summarize
- Implement
- Test
- Verify
- Prepare
- Record
- Complete
- Organize

Generic Nouns:
- Notes
- Material
- Concepts
- Questions
- Requirements
- Deliverables
- Learning
- Mistakes
- Progress
- Tasks

Any newly introduced domain-specific or subject-specific noun (not present in the input task title/description) is a hallucination and is STRICTLY FORBIDDEN.

SEPARATION OF RESPONSIBILITIES RULE:
You are responsible ONLY for workflow decomposition and execution planning. You must NEVER provide:
- educational content
- subject explanations
- specific study topics
- technologies
- frameworks
- recommendations based on domain expertise
Remain completely generic at all times. If there is uncertainty between generating a specific action and a generic action, always choose the generic action.

FINAL SELF VALIDATION:
Before outputting, perform this self-validation:
"Did I introduce any subject knowledge or domain-specific terms that were not explicitly provided in the input?"
If YES, you must regenerate using only the generic vocabulary and approved tokens.

================================================

Evaluate:
- 'steps': A list of concrete actionable steps to execute this task. Each step has:
  - 'id': a unique short string ID (e.g. 'step1', 'step2')
  - 'title': concise step title
  - 'duration': estimated minutes (number)
  - 'difficulty': 'Easy' | 'Medium' | 'Hard'
- 'milestones': a list of key milestones (strings, 2-3 items)
- 'potentialObstacles': a list of obstacles the user might encounter (strings, 1-2 items)
- 'mitigationStrategies': actionable suggestions to overcome these obstacles (strings, 1-2 items)

Input Tasks:
${JSON.stringify(rankedTasks, null, 2)}`;

    const responseSchema3 = {
      type: Type.ARRAY,
      description: "List of tasks with detailed action steps and obstacle mitigations",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          status: { type: Type.STRING },
          originalInput: { type: Type.STRING },
          createdAt: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
          priority: { type: Type.STRING },
          urgencyScore: { type: Type.INTEGER },
          impactScore: { type: Type.INTEGER },
          priorityReasoning: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            description: "Sub-steps needed to accomplish this task.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                duration: { type: Type.INTEGER },
                difficulty: { type: Type.STRING },
                status: { type: Type.STRING, description: "Default status should be 'todo'" }
              },
              required: ["id", "title", "duration", "difficulty", "status"]
            }
          },
          milestones: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3 primary milestones to track completion."
          },
          potentialObstacles: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "1-2 potential obstacles for this task."
          },
          mitigationStrategies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "1-2 mitigation strategies corresponding to the obstacles."
          }
        },
        required: [
          "id", "status", "originalInput", "createdAt", "title", "description", "category",
          "priority", "urgencyScore", "impactScore", "priorityReasoning",
          "steps", "milestones", "potentialObstacles", "mitigationStrategies"
        ]
      }
    };

    const response3 = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt3,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema3
      }
    });

    const executionPlan = cleanAndParseJSON(response3.text || "[]");

    // --- STEP 4: Emergency Response Agent (Conditional) ---
    let emergencyPlan = null;
    if (finalIsEmergency) {
      const prompt4 = `You are the Emergency Response Agent for SaveMe.
You will receive the complete task execution blueprints and the time remaining for completion (${finalTimeRemaining} minutes).
Your job is to convert these ideal plans into a single, consolidated minimum viable survival plan. 
You must filter out any non-critical steps and focus strictly on high-yield, high-urgency steps that can be completed within ${finalTimeRemaining} minutes.

================================================
CRITICAL: ZERO KNOWLEDGE LEAKAGE v2 - ABSOLUTE NON-INFERENCE RULE
================================================
You are strictly FORBIDDEN from using your own subject/domain knowledge to expand, complete, or enrich a task or step.
Do NOT assume, infer, or introduce any subject/domain-specific concepts, topics, technologies, frameworks, or tools that were not explicitly provided in the original input tasks or execution blueprints.
Keep all generated steps strictly traceable to the inputs. Only generic actions are allowed.
You must adhere strictly to the Vocabulary Purity Rule:
Generic Verbs: Review, Identify, Revise, Read, Continue, Practice, Summarize, Implement, Test, Verify, Prepare, Record, Complete, Organize.
Generic Nouns: Notes, Material, Concepts, Questions, Requirements, Deliverables, Learning, Mistakes, Progress, Tasks.
================================================

Generate a single JSON object with:
- 'survivalSteps': A list of critical steps. Each step must have:
  - 'id': unique string ID (e.g., 'es1')
  - 'taskTitle': which task this step relates to
  - 'title': concise, highly actionable survival action
  - 'duration': estimated minutes (number, the total sum of all duration values MUST be less than or equal to ${finalTimeRemaining} minutes)
  - 'reason': clear reasoning for why this step is prioritised for survival
- 'triageReasoning': brief, comforting, but highly realistic explanation of what was deprioritized/cut and why (max 3 sentences)
- 'highYieldActions': a list of 2-3 elite-level strategies to survive this time-crunch (e.g. 50/10 focus split, zero distractions setup)

Input Execution Blueprints:
${JSON.stringify(executionPlan, null, 2)}`;

      const responseSchema4 = {
        type: Type.OBJECT,
        properties: {
          survivalSteps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                taskTitle: { type: Type.STRING },
                title: { type: Type.STRING },
                duration: { type: Type.INTEGER },
                reason: { type: Type.STRING },
                status: { type: Type.STRING, description: "Default status should be 'todo'" }
              },
              required: ["id", "taskTitle", "title", "duration", "reason", "status"]
            }
          },
          triageReasoning: {
            type: Type.STRING,
            description: "A short, comforting, but highly realistic explanation of what was deprioritized or cut and why."
          },
          highYieldActions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of 2-3 elite-level survival strategies."
          }
        },
        required: ["survivalSteps", "triageReasoning", "highYieldActions"]
      };

      const response4 = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt4,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema4
        }
      });

      emergencyPlan = cleanAndParseJSON(response4.text || "{}");
    }

    res.json({
      tasks: tasksWithId,
      ranked_tasks: rankedTasks,
      execution_plan: executionPlan,
      emergency_plan: emergencyPlan
    });

  } catch (error: any) {
    console.error("[SaveMe Pipeline Error]:", error);
    res.status(500).json({ error: error.message || "An error occurred during pipeline execution." });
  }
});

// API Route: Task-Specific isolated Chat (Module 2)
app.post("/api/chat", async (req, res) => {
  try {
    const { task, messages } = req.body;
    if (!task || !Array.isArray(messages)) {
      res.status(400).json({ error: "Missing task details or message history array." });
      return;
    }

    const ai = getAIClient();
    
    // Construct isolated chat context for Gemini
    const systemInstruction = `You are the Task Workspace AI Assistant for SaveMe.
You are helping the user work on a specific task: "${task.title}".
Task description: "${task.description}"
Task category: "${task.category}"
Task priority: "${task.priority || "Not rated"}"
Task steps: ${JSON.stringify(task.steps || [])}

Rules:
1. Your conversation is strictly isolated to this specific task.
2. DO NOT share or mention any details about other tasks.
3. Keep your replies concise, practical, direct, and actionable.
4. Provide immediate, relevant feedback to user questions, brainstorming, draft writing, or technical debugging related to this task.
5. Avoid generic productivity fluff or greetings. Be an execution partner.`;

    // Map the message history into standard Gemini content roles
    const contents = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction
      }
    });

    res.json({ text: response.text || "I'm on it! Let's focus on getting this done." });

  } catch (error: any) {
    console.error("[SaveMe Chat Error]:", error);
    res.status(500).json({ error: error.message || "An error occurred in task chat." });
  }
});

// API Route: Research Extraction and Summary helper (Module 3)
app.post("/api/research-extract", async (req, res) => {
  try {
    const { taskTitle, type, input } = req.body;
    if (!input || !type) {
      res.status(400).json({ error: "Missing input or type." });
      return;
    }

    const ai = getAIClient();
    let textToAnalyze = input;

    // If input is a link, try to fetch it first, otherwise let Gemini summarize the link
    if (type === "link") {
      try {
        console.log(`[SaveMe Research] Attempting to fetch content from ${input}`);
        const response = await fetch(input, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const rawText = await response.text();
          // Simple HTML strip to avoid massive token count
          textToAnalyze = rawText
            .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
            .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .substring(0, 15000); // truncate to keep it efficient
        }
      } catch (err) {
        console.warn(`Could not fetch link natively, fallback to direct description summary:`, err);
      }
    }

    const prompt = `You are a high-fidelity Notebook Research Summarizer for SaveMe.
The user is researching for their task: "${taskTitle || "General Task"}".
Type of research: "${type}"
Content:
"${textToAnalyze}"

Please analyze this research and extract a beautiful, highly actionable, structured research note.
Include:
1. A concise 1-sentence summary of the source/content.
2. A bulleted list of 3-5 high-value takeaways, insights, or concrete pieces of data.
3. Actionable Next Steps specifically tailored to the task "${taskTitle || "General Task"}".

Your response MUST be beautifully formatted in clean, professional markdown. Avoid any meta-intro or outro. Start immediately with the title.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    res.json({ summary: response.text || "No insights could be extracted." });

  } catch (error: any) {
    console.error("[SaveMe Research Error]:", error);
    res.status(500).json({ error: error.message || "An error occurred during research extraction." });
  }
});

// Start server initialization
async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SaveMe App running on port ${PORT} (http://localhost:${PORT})`);
  });
}

startServer();
