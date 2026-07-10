import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore,
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { Task, ChatMessage, ResearchNote, ResearchLink, ResearchSnippet } from "./types";

// Firebase App Configuration loaded from our provisioned file
const firebaseConfig = {
  projectId: "amazing-voice-r2fsp",
  appId: "1:520509528676:web:f16f42730aa91142805d71",
  apiKey: "AIzaSyB5sxX8P0pZBnP2rQSVCGf2IYqQRfDJuLo",
  authDomain: "amazing-voice-r2fsp.firebaseapp.com",
  storageBucket: "amazing-voice-r2fsp.firebasestorage.app",
  messagingSenderId: "520509528676"
};

const customDatabaseId = "ai-studio-4add792a-5160-425e-a0c0-2d8c110e4829";

let db: any = null;
let useFallback = false;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app, customDatabaseId);
  console.log("Firestore successfully initialized with database ID:", customDatabaseId);
} catch (error) {
  console.error("Firestore initialization failed. Using LocalStorage fallback:", error);
  useFallback = true;
}

// Helper: Local Storage Key Names
const LS_KEYS = {
  TASKS: "saveme_tasks",
  CHATS: "saveme_chats",
  NOTES: "saveme_notes",
  LINKS: "saveme_links",
  SNIPPETS: "saveme_snippets"
};

// --- CORE UTILS FOR LOCALSTORAGE FALLBACK ---
function getLS<T>(key: string): T[] {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

function saveLS<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("LS save error:", e);
  }
}

// --- TASK PERSISTENCE ---
export async function getTasks(): Promise<Task[]> {
  if (useFallback || !db) {
    return getLS<Task>(LS_KEYS.TASKS);
  }
  try {
    const colRef = collection(db, "tasks");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const tasks: Task[] = [];
    snapshot.forEach((docSnap) => {
      tasks.push(docSnap.data() as Task);
    });
    // Sync to LS for backup
    saveLS(LS_KEYS.TASKS, tasks);
    return tasks;
  } catch (err) {
    console.warn("Firestore getTasks failed, using LS fallback:", err);
    return getLS<Task>(LS_KEYS.TASKS);
  }
}

export async function saveTask(task: Task): Promise<void> {
  // Always update LS first
  const current = getLS<Task>(LS_KEYS.TASKS);
  const existsIdx = current.findIndex(t => t.id === task.id);
  if (existsIdx !== -1) {
    current[existsIdx] = task;
  } else {
    current.unshift(task);
  }
  saveLS(LS_KEYS.TASKS, current);

  if (useFallback || !db) return;
  try {
    const docRef = doc(db, "tasks", task.id);
    await setDoc(docRef, task);
  } catch (err) {
    console.warn("Firestore saveTask failed:", err);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  // Update LS for tasks, chats, notes, links, and snippets
  let currentTasks = getLS<Task>(LS_KEYS.TASKS);
  currentTasks = currentTasks.filter(t => t.id !== taskId);
  saveLS(LS_KEYS.TASKS, currentTasks);

  let currentChats = getLS<ChatMessage>(LS_KEYS.CHATS);
  currentChats = currentChats.filter(m => m.taskId !== taskId);
  saveLS(LS_KEYS.CHATS, currentChats);

  let currentNotes = getLS<ResearchNote>(LS_KEYS.NOTES);
  currentNotes = currentNotes.filter(n => n.taskId !== taskId);
  saveLS(LS_KEYS.NOTES, currentNotes);

  let currentLinks = getLS<ResearchLink>(LS_KEYS.LINKS);
  currentLinks = currentLinks.filter(l => l.taskId !== taskId);
  saveLS(LS_KEYS.LINKS, currentLinks);

  let currentSnippets = getLS<ResearchSnippet>(LS_KEYS.SNIPPETS);
  currentSnippets = currentSnippets.filter(s => s.taskId !== taskId);
  saveLS(LS_KEYS.SNIPPETS, currentSnippets);

  if (useFallback || !db) return;
  try {
    // 1. Delete the task document itself
    const docRef = doc(db, "tasks", taskId);
    await deleteDoc(docRef);

    // 2. Delete associated chats
    const chatsCol = collection(db, "chats");
    const chatsSnap = await getDocs(query(chatsCol, where("taskId", "==", taskId)));
    chatsSnap.forEach(async (d) => {
      await deleteDoc(doc(db, "chats", d.id));
    });

    // 3. Delete associated notes
    const notesCol = collection(db, "notes");
    const notesSnap = await getDocs(query(notesCol, where("taskId", "==", taskId)));
    notesSnap.forEach(async (d) => {
      await deleteDoc(doc(db, "notes", d.id));
    });

    // 4. Delete associated links
    const linksCol = collection(db, "links");
    const linksSnap = await getDocs(query(linksCol, where("taskId", "==", taskId)));
    linksSnap.forEach(async (d) => {
      await deleteDoc(doc(db, "links", d.id));
    });

    // 5. Delete associated snippets
    const snippetsCol = collection(db, "snippets");
    const snippetsSnap = await getDocs(query(snippetsCol, where("taskId", "==", taskId)));
    snippetsSnap.forEach(async (d) => {
      await deleteDoc(doc(db, "snippets", d.id));
    });
  } catch (err) {
    console.warn("Firestore cascade deleteTask failed:", err);
  }
}

// --- TASK CHAT PERSISTENCE (Isolated per Task) ---
export async function getChatMessages(taskId: string): Promise<ChatMessage[]> {
  if (useFallback || !db) {
    return getLS<ChatMessage>(LS_KEYS.CHATS).filter(m => m.taskId === taskId);
  }
  try {
    const colRef = collection(db, "chats");
    const q = query(colRef, where("taskId", "==", taskId), orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);
    const messages: ChatMessage[] = [];
    snapshot.forEach((docSnap) => {
      messages.push(docSnap.data() as ChatMessage);
    });
    return messages;
  } catch (err) {
    console.warn("Firestore getChatMessages failed, using LS fallback:", err);
    return getLS<ChatMessage>(LS_KEYS.CHATS).filter(m => m.taskId === taskId);
  }
}

export async function saveChatMessage(msg: ChatMessage): Promise<void> {
  // Update LS
  const current = getLS<ChatMessage>(LS_KEYS.CHATS);
  current.push(msg);
  saveLS(LS_KEYS.CHATS, current);

  if (useFallback || !db) return;
  try {
    const docRef = doc(db, "chats", msg.id);
    await setDoc(docRef, msg);
  } catch (err) {
    console.warn("Firestore saveChatMessage failed:", err);
  }
}

// --- RESEARCH NOTE PERSISTENCE ---
export async function getResearchNotes(taskId: string): Promise<ResearchNote[]> {
  if (useFallback || !db) {
    return getLS<ResearchNote>(LS_KEYS.NOTES).filter(n => n.taskId === taskId);
  }
  try {
    const colRef = collection(db, "notes");
    const q = query(colRef, where("taskId", "==", taskId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const notes: ResearchNote[] = [];
    snapshot.forEach((docSnap) => {
      notes.push(docSnap.data() as ResearchNote);
    });
    return notes;
  } catch (err) {
    console.warn("Firestore getResearchNotes failed, using LS fallback:", err);
    return getLS<ResearchNote>(LS_KEYS.NOTES).filter(n => n.taskId === taskId);
  }
}

export async function saveResearchNote(note: ResearchNote): Promise<void> {
  const current = getLS<ResearchNote>(LS_KEYS.NOTES);
  current.unshift(note);
  saveLS(LS_KEYS.NOTES, current);

  if (useFallback || !db) return;
  try {
    const docRef = doc(db, "notes", note.id);
    await setDoc(docRef, note);
  } catch (err) {
    console.warn("Firestore saveResearchNote failed:", err);
  }
}

// --- RESEARCH LINK PERSISTENCE ---
export async function getResearchLinks(taskId: string): Promise<ResearchLink[]> {
  if (useFallback || !db) {
    return getLS<ResearchLink>(LS_KEYS.LINKS).filter(l => l.taskId === taskId);
  }
  try {
    const colRef = collection(db, "links");
    const q = query(colRef, where("taskId", "==", taskId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const links: ResearchLink[] = [];
    snapshot.forEach((docSnap) => {
      links.push(docSnap.data() as ResearchLink);
    });
    return links;
  } catch (err) {
    console.warn("Firestore getResearchLinks failed, using LS fallback:", err);
    return getLS<ResearchLink>(LS_KEYS.LINKS).filter(l => l.taskId === taskId);
  }
}

export async function saveResearchLink(link: ResearchLink): Promise<void> {
  const current = getLS<ResearchLink>(LS_KEYS.LINKS);
  current.unshift(link);
  saveLS(LS_KEYS.LINKS, current);

  if (useFallback || !db) return;
  try {
    const docRef = doc(db, "links", link.id);
    await setDoc(docRef, link);
  } catch (err) {
    console.warn("Firestore saveResearchLink failed:", err);
  }
}

// --- RESEARCH SNIPPET PERSISTENCE ---
export async function getResearchSnippets(taskId: string): Promise<ResearchSnippet[]> {
  if (useFallback || !db) {
    return getLS<ResearchSnippet>(LS_KEYS.SNIPPETS).filter(s => s.taskId === taskId);
  }
  try {
    const colRef = collection(db, "snippets");
    const q = query(colRef, where("taskId", "==", taskId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const snippets: ResearchSnippet[] = [];
    snapshot.forEach((docSnap) => {
      snippets.push(docSnap.data() as ResearchSnippet);
    });
    return snippets;
  } catch (err) {
    console.warn("Firestore getResearchSnippets failed, using LS fallback:", err);
    return getLS<ResearchSnippet>(LS_KEYS.SNIPPETS).filter(s => s.taskId === taskId);
  }
}

export async function saveResearchSnippet(snippet: ResearchSnippet): Promise<void> {
  const current = getLS<ResearchSnippet>(LS_KEYS.SNIPPETS);
  current.unshift(snippet);
  saveLS(LS_KEYS.SNIPPETS, current);

  if (useFallback || !db) return;
  try {
    const docRef = doc(db, "snippets", snippet.id);
    await setDoc(docRef, snippet);
  } catch (err) {
    console.warn("Firestore saveResearchSnippet failed:", err);
  }
}
