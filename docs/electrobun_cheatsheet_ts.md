# ⚡ Electrobun Cheatsheet (TypeScript / Typed Edition)

A step-by-step developer guide to building a modular, type-safe desktop application using **Electrobun** and **Bun**. This cheatsheet follows the clean, modular structure of the `personal_journal` application.

---

## 📁 1. Project Folder Structure
For a clean separation of concerns between your Main process (running in the Node/Bun environment with native system capabilities) and the Renderer process (running in the secure Webview), structure your project as follows:

```text
my-electrobun-app/
├── src/
│   ├── index.ts               # Main Process (Bun runtime: Window, native FFI, RPC)
│   ├── shared/
│   │   └── types.ts           # Shared TypeScript schemas and RPC definitions
│   └── renderer/
│       ├── index.html         # Frontend view layout
│       ├── index.css          # Styling (Vanilla CSS, variables, themes)
│       └── index.ts           # Frontend view script (Electroview client)
├── electrobun.config.ts       # Electrobun compiler configurations
├── package.json               # Dependencies and custom runner scripts
└── tsconfig.json              # TypeScript compiler settings
```

---

## ⚙️ 2. Configuration (`electrobun.config.ts`)
The root configuration file dictates the metadata of the compiled application and points Electrobun to the entrypoints for both the Bun runtime (main process) and the views.

```typescript
// electrobun.config.ts
export default {
  app: {
    name: "My App Name",
    identifier: "com.example.myapp",
    version: "0.0.1",
  },
  build: {
    bun: {
      entrypoint: "src/index.ts",
      minify: true,
    },
    views: {
      main: {
        entrypoint: "src/renderer/index.html",
        minify: true,
      },
    },
  },
};
```

---

## 🔗 3. Shared Definitions (`src/shared/types.ts`)
Establish a strongly-typed contract for two-way communications between the main Bun process and the webview renderer.

```typescript
// src/shared/types.ts
import { type RPCSchema } from "electrobun/bun";

// Your custom data structures
export type ThemeType = "light" | "dark";

export type AppSettings = {
  theme: ThemeType;
  width: number;
  height: number;
};

// RPC Contract defining requests between contexts
export type AppRPCSchema = {
  bun: RPCSchema<{
    requests: {
      getSettings: {
        params: undefined;
        response: AppSettings;
      };
      saveSettings: {
        params: AppSettings;
        response: void;
      };
      exitApp: {
        params: undefined;
        response: void;
      };
    };
  }>;
  webview: RPCSchema<{
    requests: {};
  }>;
};
```

---

## 🖥️ 4. Main Process (`src/index.ts`)
The main process runs under Bun. It handles system paths, file persistence, registers RPC responders, creates browser windows, handles native resizing, and registers application menus.

```typescript
// src/index.ts
import { BrowserWindow, BrowserView, ApplicationMenu, app } from "electrobun/bun";
import { type AppRPCSchema, type AppSettings } from "./shared/types";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";

console.log("[MAIN] Initializing Bun main process...");

// 1. Manage file storage paths dynamically
const APP_DIR = join(homedir(), ".my_app_directory");
const SETTINGS_PATH = join(APP_DIR, "settings.json");

// Ensure data folder exists
const dirFile = Bun.file(APP_DIR);
if (!(await dirFile.exists())) {
  await mkdir(APP_DIR, { recursive: true });
}

// 2. Default state initialization
let settings: AppSettings = {
  theme: "dark",
  width: 1000,
  height: 700,
};

// Load data asynchronously using optimized Bun APIs
try {
  const file = Bun.file(SETTINGS_PATH);
  if (await file.exists()) {
    settings = await file.json();
  } else {
    await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  }
} catch (e) {
  console.error("[MAIN] File system error: ", e);
}

// 3. Define RPC Handlers matching AppRPCSchema
const rpc = BrowserView.defineRPC<AppRPCSchema>({
  handlers: {
    requests: {
      getSettings: async () => {
        return settings;
      },
      saveSettings: async (newSettings) => {
        settings = newSettings;
        await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
      },
      exitApp: async () => {
        app.quit();
      },
    },
  },
});

// 4. Create the BrowserWindow with customized geometry & macOS chrome
const win = new BrowserWindow({
  title: "My App Title",
  url: "views://main/index.html", // Resolves src/renderer/index.html
  html: null,                     // Set to custom HTML string if url is null
  preload: null,                  // Absolute path to a preload script if needed
  viewsRoot: null,                // Custom base path resolution folder
  renderer: "native",             // Options: "native" (WebKit) or "cef" (Chromium)

  // Window Geometry
  frame: {
    width: settings.width,
    height: settings.height,
    x: 100,
    y: 100,
  },

  // macOS Titlebar customizations
  titleBarStyle: "hiddenInset",   // Options: "default" | "hidden" | "hiddenInset"
  trafficLightOffset: {
    x: 12,                        // Offset native red/yellow/green circles
    y: 12,
  },

  // Visibility layer
  transparent: false,
  passthrough: false,
  hidden: false,
  activate: true,                 // Focus window immediately on load

  // Security
  sandbox: false,
  navigationRules: null,          // Restrict domain names

  // RPC Bridge
  rpc: rpc as any,

  // Lower-level native macOS Masks
  styleMask: {
    Borderless: false,
    Titled: true,
    Closable: true,
    Miniaturizable: true,
    Resizable: true,
    UnifiedTitleAndToolbar: false,
    FullScreen: false,
    FullSizeContentView: false,   // Note: Keep false when using "default" title bars
    UtilityWindow: false,
    DocModalWindow: false,
    NonactivatingPanel: false,
    HUDWindow: false,
  },
});

// 5. Native Events
win.on("resize", (event: any) => {
  if (!event?.data) return;
  const { width, height } = event.data;
  settings.width = width;
  settings.height = height;
  Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2)).catch(console.error);
});

// Explicitly show & activate (macOS safety)
win.show();
win.activate();

// 6. Native macOS menus (keyboard copy/paste safety)
try {
  ApplicationMenu.setApplicationMenu([
    {
      label: "My App",
      submenu: [
        { role: "about" },
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
  ]);

  ApplicationMenu.on("application-menu-clicked", (event: any) => {
    if (event.data?.action === "quit-app") {
      app.quit();
    }
  });
} catch (e) {
  console.error("[MAIN] Application menu registration failed: ", e);
}
```

---

## 🎨 5. Renderer Layout (`src/renderer/index.html`)
The view layer defines your layouts. If your `titleBarStyle` in the main process is configured as `hidden` or `hiddenInset`, you must design a top header component that functions as a draggable window region using custom CSS styling (`-webkit-app-region: drag;`).

```html
<!-- src/renderer/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desktop Application</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div class="app-container">
    <!-- Window Header Toolbar (Draggable area for hiddenInset titlebar) -->
    <header class="window-header">
      <div class="window-controls-spacer"></div> <!-- Placeholder for traffic lights -->
      <div class="header-title">My Application</div>
      <button id="theme-toggle">🌙 Toggle Theme</button>
    </header>

    <main class="content">
      <h1>Hello Electrobun!</h1>
      <button id="exit-btn">Exit Application</button>
    </main>
  </div>

  <script type="module" src="index.ts"></script>
</body>
</html>
```

For header dragging alignment, configure your layout in CSS:
```css
/* src/renderer/index.css */
.window-header {
  -webkit-app-region: drag; /* Allows users to drag the window by the header */
  user-select: none;
  display: flex;
  align-items: center;
  height: 48px;
}
.window-header button {
  -webkit-app-region: no-drag; /* Buttons inside the header must be clickable */
}
```

---

## 🧠 6. Renderer Script (`src/renderer/index.ts`)
The renderer scripts manage DOM elements, register user events, listen to global hotkeys, and communicate with the main process using Electrobun's `Electroview`.

```typescript
// src/renderer/index.ts
import { Electroview } from "electrobun/view";
import { type AppRPCSchema, type AppSettings } from "../shared/types";

// 1. Connect the Electroview client RPC bridge
const rpc = Electroview.defineRPC<AppRPCSchema>({
  handlers: {
    requests: {},
  },
});
const view = new Electroview({ rpc });

// 2. Local View State
let settings: AppSettings = { theme: "dark", width: 1000, height: 700 };

// 3. Select DOM Elements
const themeToggleBtn = document.getElementById("theme-toggle")!;
const exitBtn = document.getElementById("exit-btn")!;

// 4. Update Theme State
function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

// 5. Attach Element Actions with RPC support
themeToggleBtn.addEventListener("click", async () => {
  const newTheme = settings.theme === "dark" ? "light" : "dark";
  settings.theme = newTheme;
  applyTheme(newTheme);
  
  // Call main process to persist settings
  await view.rpc?.request.saveSettings(settings);
});

exitBtn.addEventListener("click", async () => {
  await view.rpc?.request.exitApp();
});

// 6. Native Keyboard Shortcuts & Navigation
window.addEventListener("keydown", (e: KeyboardEvent) => {
  // Ignore hotkeys when typing in forms
  const targetTag = (e.target as HTMLElement).tagName;
  if (targetTag === "INPUT" || targetTag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) {
    return;
  }

  // Example: Cmd+R or Esc
  if (e.key === "Escape") {
    console.log("Escape key detected.");
  }
});

// 7. Initialize Application View
async function initApp() {
  try {
    const fetchedSettings = await view.rpc?.request.getSettings();
    if (fetchedSettings) {
      settings = fetchedSettings;
      applyTheme(settings.theme);
    }
  } catch (err) {
    console.error("Initialization failed: ", err);
  }
}

initApp();
```

---

## 🏃 7. Build Configurations (`package.json`)
Manage dependencies, set compiler scripts, and launch the built executable.

```json
{
  "name": "my-electrobun-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "electrobun build --env=stable && ./build/stable-macos-$(uname -m | sed 's/x86_64/x64/')/My\\ App\\ Name.app/Contents/MacOS/launcher",
    "build": "electrobun build --env=stable"
  },
  "dependencies": {
    "electrobun": "^1.18.1"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```
