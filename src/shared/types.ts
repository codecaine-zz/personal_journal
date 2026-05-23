import { type RPCSchema } from "electrobun/bun";

export type ThemeType = "light" | "dark";

export type Settings = {
  theme: ThemeType;
  width: number;
  height: number;
};

export type MoodType = "Happy" | "Excited" | "Peaceful" | "Neutral" | "Sad" | "Angry" | "Tired";

export type JournalEntry = {
  id: string;
  title: string;
  content: string;
  date: string; // YYYY-MM-DD
  mood: MoodType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type JournalRPCSchema = {
  bun: RPCSchema<{
    requests: {
      getSettings: {
        params: undefined;
        response: Settings;
      };
      saveSettings: {
        params: Settings;
        response: void;
      };
      getEntries: {
        params: undefined;
        response: JournalEntry[];
      };
      saveEntries: {
        params: JournalEntry[];
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
