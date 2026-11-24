# RPG Life Tracker (`THE SYSTEM // SYS.OS`)

Local-first 2D Pixel RPG personal growth & discipline operating system with AI-assisted scheduling, flexible time-tracked tasks, an infinite 5-branch skill tree, and SQLite persistence.

## Features

- **Daily Quest Tracker & Flexible Stopwatch**: Quick-add tasks, AI stat/XP estimation, live start/pause/complete timer, HP stakes, and daily settlement.
- **Weekly Hourly Timetable**: Google-Calendar-style 2D pixel grid, `.ics`/`.csv` & natural-language import, AI day planner, and bidirectional quest sync.
- **Infinite 5-Branch Skill Tree**: Dual-gate SP unlock/ascension + Gold/Runestones upgrades, passive bonuses, and automatic skill XP from completed tasks.
- **Campaign & Progress Analytics**: Fog-of-War chapters/bosses, 6-stat radar (`INT/PER/AGI/STR/VIT/CHA`), 14-day XP/focus chart, 28-day discipline heatmap, and custom shop rewards.
- **Multi-Context AI Advisor**: Persistent SQLite chat threads by context (`Tổng hợp`, `Lịch`, `Mục tiêu`, `Kĩ năng`, `Phản tư`), clean Markdown rendering, and background processing across tabs.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons
- **Backend & Storage**: Node.js (`>= 22.5`), Express, built-in `node:sqlite` (WAL mode)
- **AI**: Any OpenAI-compatible LLM API (OpenAI, Gemini, DeepSeek, OpenRouter, Ollama/LM Studio) or built-in Offline Heuristic mode

## Quick Start

> Requires **Node.js `>= 22.5.0`** (uses built-in `node:sqlite`).

```bash
npm install

# Development (UI on http://localhost:5173 + API on http://localhost:3001)
npm run dev

# Production build & run (served at http://localhost:3001)
npm run build
npm start
```

## Data & Privacy

All profile data, timetables, chat history, and AI API keys stay locally inside `data/the_system.sqlite` (ignored by Git). The app supports disk backups, JSON export/import, and **Progress Reset** (keeps profile & timetable) or **Clean Reset** directly from the UI.
