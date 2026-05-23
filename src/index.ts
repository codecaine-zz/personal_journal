import { BrowserWindow, BrowserView, ApplicationMenu, app } from "electrobun/bun";
import { type JournalRPCSchema, type Settings, type JournalEntry } from "./shared/types";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";

console.log("[MAIN] Starting Personal Journal main process...");

// 1. Resolve paths dynamically to the current user's Home directory
const JOURNAL_DIR = join(homedir(), ".personal_journal");
const SETTINGS_PATH = join(JOURNAL_DIR, "settings.json");
const ENTRIES_PATH = join(JOURNAL_DIR, "entries.json");

// 2. Initialize the folder asynchronously using Bun's file system metrics
const dirFile = Bun.file(JOURNAL_DIR);

// Bun.file().exists() is fully async and optimized for the Bun runtime
if (!(await dirFile.exists())) {
  // Use node:fs/promises mkdir for a non-blocking folder creation
  await mkdir(JOURNAL_DIR, { recursive: true });
}

const defaultSettings: Settings = {
  theme: "dark",
  width: 1000,
  height: 700,
};

// 1. Load settings and entries from local JSON files
let settings: Settings = { ...defaultSettings };
try {
  console.log(`[MAIN] Loading settings from ${SETTINGS_PATH}...`);
  const file = Bun.file(SETTINGS_PATH);
  if (await file.exists()) {
    const data = await file.json();
    settings = { ...defaultSettings, ...data };
    console.log("[MAIN] Loaded settings:", settings);
  } else {
    console.log("[MAIN] Settings file not found, writing defaults...");
    await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  }
} catch (e) {
  console.error("[MAIN] Failed to load settings, using defaults.", e);
}

let entries: JournalEntry[] = [];
try {
  console.log(`[MAIN] Loading entries from ${ENTRIES_PATH}...`);
  const file = Bun.file(ENTRIES_PATH);
  if (await file.exists()) {
    entries = await file.json();
    console.log(`[MAIN] Loaded ${entries.length} entries.`);
  } else {
    console.log("[MAIN] Entries file not found, initializing empty list...");
    await Bun.write(ENTRIES_PATH, JSON.stringify([], null, 2));
  }
} catch (e) {
  console.error("[MAIN] Failed to load entries, initializing empty array.", e);
}

// 2. Define the RPC handlers
console.log("[MAIN] Defining RPC handlers...");
const rpc = BrowserView.defineRPC<JournalRPCSchema>({
  handlers: {
    requests: {
      getSettings: async () => {
        console.log("[RPC] getSettings called");
        return settings;
      },
      saveSettings: async (newSettings) => {
        console.log("[RPC] saveSettings called", newSettings);
        settings = newSettings;
        try {
          await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
        } catch (e) {
          console.error("[MAIN] Failed to save settings:", e);
        }
      },
      getEntries: async () => {
        console.log("[RPC] getEntries called");
        return entries;
      },
      saveEntries: async (newEntries) => {
        console.log(`[RPC] saveEntries called with ${newEntries.length} entries`);
        entries = newEntries;
        try {
          await Bun.write(ENTRIES_PATH, JSON.stringify(entries, null, 2));
        } catch (e) {
          console.error("[MAIN] Failed to save entries:", e);
        }
      },
      exitApp: async () => {
        console.log("[RPC] exitApp called");
        app.quit();
      },
    },
  },
});

// 3. Create the main application window
console.log("[MAIN] Creating BrowserWindow...");

const win = new BrowserWindow({
  // --- Core Metadata & Navigation ---
  title: "Personal Journal",
  url: "views://main/index.html", // Change to null if using raw HTML string below
  html: null,                     // "<h1>Hello World</h1>" (used if url is null)
  preload: null,                  // "/absolute/path/to/preload.js" script
  viewsRoot: null,                // Custom baseline path for views:// scheme resolution
  renderer: "native",             // Options: "native" (Webkit on Mac) or "cef" (Chromium)
  
  // --- Window Geometry & Alignment ---
  frame: {
    width: settings.width,
    height: settings.height,
    x: 100, 
    y: 100,
  },
  
  // --- macOS Window Chrome & Controls ---
  titleBarStyle: "default",       // Options: 
                                  //  - "default": Visible native title bar & controls
                                  //  - "hidden": Completely custom chrome (no native header/traffic lights)
                                  //  - "hiddenInset": Hidden native header but preserves inset native traffic lights
  
  // Offset the traffic light window controls (X, Y) relative to the top-left corner
  // (Mostly useful when titleBarStyle is "hiddenInset" or "hidden")
  trafficLightOffset: {
    x: 0,
    y: 0,
  },

  // --- Visual Layer Configurations ---
  transparent: false,             // true turns the window background transparent (see-through)
  passthrough: false,             // true passes all mouse events straight through transparent regions
  hidden: false,                  // true creates the window in the background without focusing it on startup
  activate: true,                 // true focuses the window immediately when created

  // --- Security & Process Isolation ---
  sandbox: false,                 // true isolates the webview, disabling direct RPC access for untrusted URLs
  navigationRules: null,          // JSON string defining which domains the webview is allowed to navigate to

  // --- Process Bridges ---
  rpc: rpc as any,                // Binds your Bun backend communications to the frontend view

  // --- Low-Level Native OS Hooks ---
  styleMask: {
    Borderless: false,
    Titled: true,
    Closable: true,
    Miniaturizable: true,
    Resizable: true,
    UnifiedTitleAndToolbar: false,
    FullScreen: false,
    FullSizeContentView: false,   // Note: Leave false for "default" title bars. Setting to true 
                                  // pushes your web content *under* the native title bar, 
                                  // which breaks standard dragging on ARM architecture.
    UtilityWindow: false,
    DocModalWindow: false,
    NonactivatingPanel: false,
    HUDWindow: false,
  },
});

console.log("[MAIN] BrowserWindow created with ID:", win.id);

// 4. Save window size changes to settings.json
win.on("resize", (event: any) => {
  if (!event || !event.data) return;
  const { width, height } = event.data;
  console.log(`[MAIN] Window resized to ${width}x${height}`);
  settings.width = width;
  settings.height = height;
  Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2)).catch((err) => {
    console.error("[MAIN] Failed to update window dimensions in settings:", err);
  });
});

// 5. Explicitly show and activate the window to ensure it is visible on macOS
try {
  console.log("[MAIN] Showing window...");
  win.show();
  console.log("[MAIN] Activating window...");
  win.activate();
} catch (e) {
  console.error("[MAIN] Failed to explicitly show/activate window:", e);
}

// 6. Set native macOS application menu for keyboard shortcuts (Cmd+Q, Cmd+C, Cmd+V)
try {
  console.log("[MAIN] Registering macOS Application Menu...");
  ApplicationMenu.setApplicationMenu([
    {
      label: "Personal Journal",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { label: "Quit", accelerator: "cmd+q", action: "quit-app" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { role: "close" },
        { role: "toggleFullScreen" },
      ],
    },
  ]);

  // Listen for the custom quit-app action
  ApplicationMenu.on("application-menu-clicked", (event: any) => {
    if (event.data && event.data.action === "quit-app") {
      console.log("[MAIN] Quit menu clicked, exiting...");
      app.quit();
    }
  });
} catch (e) {
  console.error("[MAIN] Failed to register application menu:", e);
}

console.log("[MAIN] Initialization complete!");
