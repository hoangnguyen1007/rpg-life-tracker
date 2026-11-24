# THE SYSTEM (`SYS.OS // SOVEREIGN`)
### Product Vision, Game Design & Multi-Agent Architecture

## 1. Product Vision: Not a Gamified Todo List — A Real-Life Operating System
Most "gamified habit trackers" fail within 2 weeks because they slap arbitrary XP and badges onto static checklists. Real personal development requires:
1. **Context Awareness**: Knowing your exact timetable, sleep schedule, commute, classes/work, and current cognitive energy.
2. **Proactive Intelligence**: Not just breaking down what you type, but discovering *missing prerequisite skills*, choosing *superior learning methods* (Active Recall, Feynman, Deliberate Practice), and protecting you from burnout.
3. **Meaningful Progression**: Separating **Effort** (XP & Level from daily execution) from **Verified Mastery** (Hunter Rank `E -> S` & Skill Tiers unlocked strictly through proof-of-work and Boss Milestones).

---

## 2. Core Game Mechanics (Solo Leveling Adapted for Real Life)

| Solo Leveling Concept | Real-Life Personal Growth Mechanic |
| :--- | :--- |
| **Player Level & XP** | **Consistency & Effort Engine**: Earned from Daily Quests, Side Quests, and Dungeon Focus sessions. |
| **Hunter Rank (`E` to `National`)** | **Verified Mastery Gate**: Cannot be farmed by repeating easy tasks. Only rises via **Verified Mastery Points** from Boss Raid stages & Skill Assessments. |
| **6 Core Attributes** | `INT` (Coding/Study), `PER` (Languages/Research/System Design), `STR` (Strength/Fitness), `VIT` (Sleep/Recovery), `AGI` (Deep Work Speed/Timeboxing), `CHA` (Interviews/Networking/Soft Skills). |
| **Daily Quests** | Non-negotiable baseline growth & health loop calibrated to today's available free time. |
| **Main / Side / Hidden Quests** | Goal-linked Deep Work (`Main`), Free-day expansion opportunities (`Side`), and unexpected high-leverage challenges (`Hidden`). |
| **Boss Missions** | Multi-stage major life goals (e.g., *IELTS 7.5 Sovereign Gate*, *SWE Internship Raid*) with HP bars damaged only by concrete Proof-of-Work. |
| **Instance Dungeon (Focus Mode)** | Distraction-free holographic timer gate where completing subtasks deals real-time damage to Dungeon HP. |
| **Shadow Extraction ("ARISE")** | Once you master a routine or defeat a Boss stage, extract it into a **Shadow Soldier** (e.g., *Igris — Deep Code Protocol*) that grants passive buffs and 1-click daily deployment. |
| **Burnout Shield (Penalty Inversion)** | Unlike toxic apps that punish sick/exhausted days, if Energy <= 45% or Fatigue >= 70%, `[VITALITY GUARDIAN]` replaces heavy quests with a restorative `RECOVERY QUEST`. |

---

## 3. System Architecture (Local-First)
- **Storage (`server/db.ts`)**: Native Node 26 `node:sqlite` (`DatabaseSync`) persisted locally at `data/the_system.sqlite`, with full JSON export/import backup.
- **Deterministic Scheduler (`server/scheduler.ts`)**: Computes exact free cognitive windows from the Mon–Sun timetable (`DEEP_WORK_PRIME`, `STANDARD_FOCUS`, `MICRO_SPRINT`), guarantees zero collisions with sleep, classes, meals, or ad-hoc events, and preserves a 20% rest buffer.
- **5-Agent AI Council (`server/ai-orchestrator.ts`)**:
  1. `STRATEGIST`: Goal decomposition & missing-skill detection.
  2. `CHRONOS`: Slot matching & Free-Day Expansion Protocol.
  3. `SCHOLAR`: Evidence-based methodology injection.
  4. `VITALITY`: Energy/fatigue guardrail & Recovery Protocol.
  5. `ARCHITECT`: Final conflict-free synthesis, memory adaptation from rejected/completed quests, and OpenAI-compatible LLM integration (OpenAI, Gemini OpenAI endpoint, Ollama, LM Studio, Groq, DeepSeek, OpenRouter) + zero-config Smart Heuristic fallback.
