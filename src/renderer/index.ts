import { Electroview } from "electrobun/view";
import { type JournalRPCSchema, type Settings, type JournalEntry, type MoodType } from "../shared/types";

// 1. Initialize Electroview RPC
const rpc = Electroview.defineRPC<JournalRPCSchema>({
  handlers: {
    requests: {},
  },
});
const view = new Electroview({ rpc });

// 2. Application State
let entries: JournalEntry[] = [];
let filteredEntries: JournalEntry[] = [];
let settings: Settings = { theme: "dark", width: 1000, height: 700 };
let selectedEntryId: string | null = null;

let searchQuery = "";
let moodFilter = "All";
let dateFilter = "All";
let customDateStart = "";
let customDateEnd = "";

let selectedMoodEditor: MoodType = "Neutral";

// 3. DOM Elements
const themeToggleBtn = document.getElementById("theme-toggle")!;
const exitAppBtn = document.getElementById("exit-app-btn")!;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const clearSearchBtn = document.getElementById("clear-search")!;
const newEntryBtn = document.getElementById("new-entry-btn")!;

const filterMood = document.getElementById("filter-mood") as HTMLSelectElement;
const filterDate = document.getElementById("filter-date") as HTMLSelectElement;
const customDateFields = document.getElementById("custom-date-fields")!;
const dateStartInput = document.getElementById("date-start") as HTMLInputElement;
const dateEndInput = document.getElementById("date-end") as HTMLInputElement;

const entriesCountLabel = document.getElementById("entries-count")!;
const entryListContainer = document.getElementById("entry-list")!;

const emptyStateView = document.getElementById("empty-state-view")!;
const viewerView = document.getElementById("viewer-view")!;
const editorView = document.getElementById("editor-view")!;

// Viewer Elements
const viewTitle = document.getElementById("view-title")!;
const viewDate = document.getElementById("view-date")!;
const viewMood = document.getElementById("view-mood")!;
const viewTags = document.getElementById("view-tags")!;
const viewContent = document.getElementById("view-content")!;
const editEntryBtn = document.getElementById("edit-entry-btn")!;
const deleteEntryBtn = document.getElementById("delete-entry-btn")!;

// Editor Elements
const editorModeTitle = document.getElementById("editor-mode-title")!;
const entryIdInput = document.getElementById("entry-id") as HTMLInputElement;
const entryTitleInput = document.getElementById("entry-title") as HTMLInputElement;
const entryDateInput = document.getElementById("entry-date") as HTMLInputElement;
const entryTagsInput = document.getElementById("entry-tags") as HTMLInputElement;
const entryContentInput = document.getElementById("entry-content") as HTMLTextAreaElement;
const moodButtons = document.querySelectorAll(".mood-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn")!;
const saveEntryBtn = document.getElementById("save-entry-btn")!;

// 4. Utility Functions
function getLocalYYYYMMDD(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFriendlyDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  // Destructure the parts and provide a fallback string to satisfy strict null checks
  const [yearStr = "", monthStr = "", dayStr = ""] = parts;

  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;
  const day = parseInt(dayStr);

  const d = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const targetTime = d.getTime();
  if (targetTime === today.getTime()) {
    return "Today";
  } else if (targetTime === yesterday.getTime()) {
    return "Yesterday";
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMoodEmoji(mood: MoodType): string {
  switch (mood) {
    case "Happy": return "😊";
    case "Excited": return "🎉";
    case "Peaceful": return "🌸";
    case "Neutral": return "😐";
    case "Sad": return "😢";
    case "Angry": return "😠";
    case "Tired": return "🥱";
  }
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

function showConfirmDialog(
  title: string,
  message: string,
  confirmText: string = "Confirm",
  confirmClass: string = "btn-primary"
): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmModal = document.getElementById("confirm-modal")!;
    const modalTitle = document.getElementById("confirm-modal-title")!;
    const modalMessage = document.getElementById("confirm-modal-message")!;
    const cancelBtn = document.getElementById("confirm-modal-cancel")!;
    const confirmBtn = document.getElementById("confirm-modal-confirm")!;

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    cancelBtn.style.display = "inline-flex";
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn ${confirmClass}`;
    
    confirmModal.style.display = "flex";

    const cleanUp = (result: boolean) => {
      confirmModal.style.display = "none";
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      resolve(result);
    };

    const onCancel = () => cleanUp(false);
    const onConfirm = () => cleanUp(true);

    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
  });
}

function showAlertDialog(title: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    const confirmModal = document.getElementById("confirm-modal")!;
    const modalTitle = document.getElementById("confirm-modal-title")!;
    const modalMessage = document.getElementById("confirm-modal-message")!;
    const cancelBtn = document.getElementById("confirm-modal-cancel")!;
    const confirmBtn = document.getElementById("confirm-modal-confirm")!;

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    cancelBtn.style.display = "none";
    confirmBtn.textContent = "OK";
    confirmBtn.className = "btn btn-primary";
    
    confirmModal.style.display = "flex";

    const onConfirm = () => {
      confirmModal.style.display = "none";
      confirmBtn.removeEventListener("click", onConfirm);
      resolve();
    };

    confirmBtn.addEventListener("click", onConfirm);
  });
}

// 5. Render Functions
function renderEntryList() {
  entryListContainer.innerHTML = "";
  
  if (filteredEntries.length === 0) {
    entriesCountLabel.textContent = "No entries found";
    return;
  }

  entriesCountLabel.textContent = `${filteredEntries.length} ${filteredEntries.length === 1 ? 'entry' : 'entries'} found`;

  filteredEntries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = `entry-item ${entry.id === selectedEntryId ? "active" : ""}`;
    item.setAttribute("data-id", entry.id);

    const emoji = getMoodEmoji(entry.mood);
    const friendlyDate = formatFriendlyDate(entry.date);
    
    // Create tag badges HTML
    const tagsHTML = entry.tags.map(tag => `<span class="tag-badge">${tag}</span>`).join("");

    item.innerHTML = `
      <div class="entry-item-header">
        <span class="entry-item-title">${escapeHTML(entry.title || "Untitled")}</span>
        <span class="entry-item-date">${friendlyDate}</span>
      </div>
      <div class="entry-item-snippet">${escapeHTML(entry.content || "Empty entry...")}</div>
      <div class="entry-item-footer">
        <div class="entry-item-tags">${tagsHTML}</div>
        <span class="entry-mood-indicator" title="${entry.mood}">${emoji}</span>
      </div>
    `;

    item.addEventListener("click", () => {
      selectEntry(entry.id);
    });

    entryListContainer.appendChild(item);
  });
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function selectEntry(id: string) {
  selectedEntryId = id;
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  // Update active state in sidebar
  document.querySelectorAll(".entry-item").forEach(item => {
    if (item.getAttribute("data-id") === id) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Populate Viewer
  viewTitle.textContent = entry.title || "Untitled";
  viewDate.textContent = formatFriendlyDate(entry.date);
  
  viewMood.textContent = `${getMoodEmoji(entry.mood)} ${entry.mood}`;
  viewMood.className = `mood-badge badge-${entry.mood.toLowerCase()}`;
  
  viewTags.innerHTML = entry.tags.map(tag => `<span class="tag-badge">${escapeHTML(tag)}</span>`).join("");
  viewContent.textContent = entry.content || "";

  // Switch View
  emptyStateView.style.display = "none";
  editorView.style.display = "none";
  viewerView.style.display = "flex";
}

// 6. Search and Filter Logic
function applyFilters() {
  filteredEntries = entries.filter((entry) => {
    // 1. Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = entry.title.toLowerCase().includes(q);
      const contentMatch = entry.content.toLowerCase().includes(q);
      const tagMatch = entry.tags.some(tag => tag.toLowerCase().includes(q));
      if (!titleMatch && !contentMatch && !tagMatch) {
        return false;
      }
    }

    // 2. Mood Filter
    if (moodFilter !== "All" && entry.mood !== moodFilter) {
      return false;
    }

    // 3. Date Filter
    if (dateFilter !== "All") {
      const todayStr = getLocalYYYYMMDD();
      if (dateFilter === "Today") {
        if (entry.date !== todayStr) return false;
      } else if (dateFilter === "Week") {
        const entryTime = new Date(entry.date + "T00:00:00").getTime();
        const startOfWeek = new Date();
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(startOfWeek.getDate() - 7); // Last 7 days
        if (entryTime < startOfWeek.getTime()) return false;
      } else if (dateFilter === "Month") {
        if (entry.date.slice(0, 7) !== todayStr.slice(0, 7)) return false;
      } else if (dateFilter === "Year") {
        if (entry.date.slice(0, 4) !== todayStr.slice(0, 4)) return false;
      } else if (dateFilter === "Custom") {
        if (customDateStart && entry.date < customDateStart) return false;
        if (customDateEnd && entry.date > customDateEnd) return false;
      }
    }

    return true;
  });

  // Sort by date descending (newest first)
  filteredEntries.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  renderEntryList();
}

// 7. Actions & Event Listeners
themeToggleBtn.addEventListener("click", async () => {
  const newTheme = settings.theme === "dark" ? "light" : "dark";
  settings.theme = newTheme;
  applyTheme(newTheme);
  if (view.rpc) {
    await view.rpc.request.saveSettings(settings);
  }
});

exitAppBtn.addEventListener("click", async () => {
  const confirmExit = await showConfirmDialog(
    "Exit Application",
    "Are you sure you want to exit the application?",
    "Exit App",
    "btn-primary"
  );
  if (confirmExit) {
    if (view.rpc) {
      await view.rpc.request.exitApp();
    }
  }
});

searchInput.addEventListener("input", (e) => {
  searchQuery = (e.target as HTMLInputElement).value.trim();
  clearSearchBtn.style.display = searchQuery ? "block" : "none";
  applyFilters();
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchQuery = "";
  clearSearchBtn.style.display = "none";
  applyFilters();
  searchInput.focus();
});

newEntryBtn.addEventListener("click", () => {
  openEditor();
});

filterMood.addEventListener("change", (e) => {
  moodFilter = (e.target as HTMLSelectElement).value;
  applyFilters();
});

filterDate.addEventListener("change", (e) => {
  dateFilter = (e.target as HTMLSelectElement).value;
  if (dateFilter === "Custom") {
    customDateFields.style.display = "flex";
  } else {
    customDateFields.style.display = "none";
  }
  applyFilters();
});

dateStartInput.addEventListener("change", (e) => {
  customDateStart = (e.target as HTMLInputElement).value;
  applyFilters();
});

dateEndInput.addEventListener("change", (e) => {
  customDateEnd = (e.target as HTMLInputElement).value;
  applyFilters();
});

function openEditor(id: string | null = null) {
  if (id) {
    // Edit existing entry
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    
    editorModeTitle.textContent = "Edit Reflection";
    entryIdInput.value = entry.id;
    entryTitleInput.value = entry.title;
    entryDateInput.value = entry.date;
    entryTagsInput.value = entry.tags.join(", ");
    entryContentInput.value = entry.content;
    setEditorMood(entry.mood);
  } else {
    // Create new entry
    editorModeTitle.textContent = "New Reflection";
    entryIdInput.value = "";
    entryTitleInput.value = "";
    entryDateInput.value = getLocalYYYYMMDD();
    entryTagsInput.value = "";
    entryContentInput.value = "";
    setEditorMood("Neutral");
  }

  emptyStateView.style.display = "none";
  viewerView.style.display = "none";
  editorView.style.display = "flex";
  entryTitleInput.focus();
}

function setEditorMood(mood: MoodType) {
  selectedMoodEditor = mood;
  moodButtons.forEach(btn => {
    if (btn.getAttribute("data-mood") === mood) {
      btn.setAttribute("data-active", "true");
    } else {
      btn.removeAttribute("data-active");
    }
  });
}

// Mood selector button handlers
moodButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const mood = btn.getAttribute("data-mood") as MoodType;
    setEditorMood(mood);
  });
});

cancelEditBtn.addEventListener("click", () => {
  if (selectedEntryId) {
    selectEntry(selectedEntryId);
  } else {
    editorView.style.display = "none";
    viewerView.style.display = "none";
    emptyStateView.style.display = "flex";
  }
});

saveEntryBtn.addEventListener("click", async () => {
  const title = entryTitleInput.value.trim();
  const date = entryDateInput.value;
  const content = entryContentInput.value.trim();
  const id = entryIdInput.value;

  if (!title || !date || !content) {
    await showAlertDialog("Missing Fields", "Please fill in all required fields (Title, Date, Reflection).");
    return;
  }

  // Parse tags
  const tags = entryTagsInput.value
    .split(",")
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (id) {
    // Save edit
    const entry = entries.find(e => e.id === id);
    if (entry) {
      entry.title = title;
      entry.date = date;
      entry.content = content;
      entry.mood = selectedMoodEditor;
      entry.tags = tags;
      entry.updatedAt = new Date().toISOString();
    }
  } else {
    // Add new
    const newEntry: JournalEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      title,
      date,
      content,
      mood: selectedMoodEditor,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    entries.push(newEntry);
    selectedEntryId = newEntry.id;
  }

  // Save via RPC
  if (view.rpc) {
    await view.rpc.request.saveEntries(entries);
  }

  // Apply filters and select the saved entry
  applyFilters();
  if (selectedEntryId) {
    selectEntry(selectedEntryId);
  }
});

editEntryBtn.addEventListener("click", () => {
  if (selectedEntryId) {
    openEditor(selectedEntryId);
  }
});

deleteEntryBtn.addEventListener("click", async () => {
  if (!selectedEntryId) return;

  const confirmDelete = await showConfirmDialog(
    "Delete Entry",
    "Are you sure you want to delete this entry? This action cannot be undone.",
    "Delete",
    "btn-danger"
  );
  if (!confirmDelete) return;

// Filter out the entry
entries = entries.filter(e => e.id !== selectedEntryId);

// The ?. ensures it only attempts to invoke request if rpc is defined
if (view.rpc) {
  await view.rpc.request.saveEntries(entries);
}

  selectedEntryId = null;
  applyFilters();
  
  viewerView.style.display = "none";
  editorView.style.display = "none";
  emptyStateView.style.display = "flex";
});

// Support tab indentations in the reflection section
entryContentInput.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Tab") {
    const textarea = e.currentTarget as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    // Check if it's a multi-line selection or if Shift+Tab is pressed
    const startOfFirstLine = value.lastIndexOf("\n", start - 1) + 1;
    
    // Adjust end if selection ends exactly at the start of a line (after a newline)
    let adjustedEnd = end;
    if (end > start && value[end - 1] === "\n") {
      adjustedEnd = end - 1;
    }

    const selectedText = value.substring(startOfFirstLine, adjustedEnd);
    const isMultiLine = selectedText.includes("\n");

    if (isMultiLine || e.shiftKey) {
      e.preventDefault();
      // Indent or outdent multiple lines
      const endOfLastLine = value.indexOf("\n", adjustedEnd);
      const targetEnd = endOfLastLine === -1 ? value.length : endOfLastLine;
      const linesText = value.substring(startOfFirstLine, targetEnd);
      const lines = linesText.split("\n");

      let newLines: string[] = [];
      let startOffset = 0;
      let endOffset = 0;

      lines.forEach((line, index) => {
        if (e.shiftKey) {
          // Outdent
          if (line.startsWith("\t")) {
            newLines.push(line.substring(1));
            if (index === 0) startOffset -= 1;
            endOffset -= 1;
          } else if (line.startsWith(" ")) {
            // Remove up to 4 spaces
            const spaceCount = line.match(/^ +/)?.[0].length || 0;
            const spacesToRemove = Math.min(spaceCount, 4);
            newLines.push(line.substring(spacesToRemove));
            if (index === 0) startOffset -= spacesToRemove;
            endOffset -= spacesToRemove;
          } else {
            newLines.push(line);
          }
        } else {
          // Indent
          newLines.push("\t" + line);
          if (index === 0) startOffset += 1;
          endOffset += 1;
        }
      });

      textarea.value = value.substring(0, startOfFirstLine) + newLines.join("\n") + value.substring(targetEnd);

      // Adjust selection range
      const newStart = Math.max(startOfFirstLine, start + startOffset);
      const newEnd = Math.max(startOfFirstLine, end + endOffset);
      textarea.setSelectionRange(newStart, newEnd);
    } else {
      // Single line tab insert (no Shift key)
      e.preventDefault();
      textarea.value = value.substring(0, start) + "\t" + value.substring(end);
      textarea.setSelectionRange(start + 1, start + 1);
    }
    
    // Trigger input event to update any validation/auto-save or framework state
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
});

// 8. Keyboard Navigation & Shortcuts
window.addEventListener("keydown", (e) => {
  // Ignore keyboard shortcuts if the user is currently typing in an input or textarea
  const targetTag = (e.target as HTMLElement).tagName;
  if (targetTag === "INPUT" || targetTag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) {
    if (e.key === "Escape" && editorView.style.display === "flex") {
      cancelEditBtn.click();
    }
    return;
  }

  if (e.key === "ArrowDown" || e.key === "j") {
    e.preventDefault();
    navigateList(1);
  } else if (e.key === "ArrowUp" || e.key === "k") {
    e.preventDefault();
    navigateList(-1);
  } else if (e.key === "n") {
    e.preventDefault();
    openEditor();
  } else if (e.key === "e" && selectedEntryId) {
    e.preventDefault();
    openEditor(selectedEntryId);
  } else if (e.key === "/" || e.key === "s") {
    e.preventDefault();
    searchInput.focus();
  }
});

function navigateList(direction: number) {
  if (filteredEntries.length === 0) return;

  let nextIndex = 0;
  if (selectedEntryId) {
    const currentIndex = filteredEntries.findIndex(e => e.id === selectedEntryId);
    nextIndex = currentIndex + direction;

    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= filteredEntries.length) nextIndex = filteredEntries.length - 1;
  }

  const nextEntry = filteredEntries[nextIndex];
  if (nextEntry) {
    selectEntry(nextEntry.id);
    // Scroll selected item into view smoothly
    const element = document.querySelector(`.entry-item[data-id="${nextEntry.id}"]`);
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

// 9. App Initialization
async function initApp() {
  try {
    // Add ?. after rpc to handle potential undefined states safely
    const fetchedSettings = await view.rpc?.request.getSettings();
    const fetchedEntries = await view.rpc?.request.getEntries();
    
    // Fallback to defaults if the RPC bridge returned empty or failed
    if (fetchedSettings) settings = fetchedSettings;
    if (fetchedEntries) entries = fetchedEntries;
    
    // Apply current theme
    applyTheme(settings.theme);

    // Initial render
    applyFilters();
  } catch (err) {
    console.error("Error initializing journal app:", err);
  }
}

// Start
initApp();
