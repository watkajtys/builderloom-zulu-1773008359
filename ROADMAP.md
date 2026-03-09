# BuilderLoom Zulu: Self-Improvement Roadmap

## Core Objective
Evolve BuilderLoom Zulu from a brittle, monolithic script into a robust, observable, and self-healing autonomous engineering system capable of safely testing and refining its own architecture.

---

### Phase 1: Telemetry & Observability
**Goal:** Give the Overseer and Agents visibility into their own execution and failures.
- **Task:** Implement structured JSON logging across all Python agents (overseer.py, jules.py, etc.). Replace generic logger.info with structured events.
- **Task:** Update the React Viewer UI to consume and display these structured logs dynamically, allowing a human observer to easily filter agent thought processes vs system errors.

### Phase 2: Agent Refinement & Strictness
**Goal:** Enhance the Architect's ability to catch logic errors before they compound and give agents object permanence.
- **Task:** Implement "Prompt Decomposition & Sub-Agents". Refactor massive, monolithic prompts into smaller, specialized sub-agents. Favor chaining multiple, tightly scoped API calls over overloading a single agent's context window.
- **Task:** Refactor the ArchitectAgent to run static analysis tools (like pylint and mypy for Python, eslint for React) and parse their output, penalizing the score for violations.
- **Task:** Update the React UI to display the Architect's findings in a dedicated "System Health" or "Code Quality" tab.
- **Task:** Implement "Temporal Vibe Context". Modify the Vision/Vibe agents to analyze a timeline of screenshots (e.g., T-5, T-1, Current) rather than a single frame. This establishes object permanence and prevents the "Bulldozer Problem" where agents delete working UI because they lack historical context.

### Phase 3: Robust State Management & Memory Compression
**Goal:** Move away from brittle JSON files for core factory state and prevent context window exhaustion from unbounded memory growth.
- **Task:** Migrate the core ConductorState load/save mechanisms in state.py to use PocketBase instead of session_state.json. 
- **Task:** Update the React Viewer UI to fetch state directly from PocketBase collections instead of the static API endpoints.
- **Task:** Implement "Repo Memory Compression". Create a summarization sub-agent that periodically condenses the `repo_memory` (learnings, rules, and history) into a dense, prioritized context block, preventing context window bloat and immediate amnesia caused by an ever-growing linear list of learnings.

### Phase 4: Human-in-the-Loop Interactivity (Steering)
**Goal:** Allow human operators to easily course-correct the factory without SSHing into the VPS.
- **Task:** Add a "Steering" command box to the React Viewer UI that submits text directives (e.g., "Stop working on UI and fix the DB first") to the backend API.
- **Task:** Make the Kanban board fully interactive: users must be able to drag-and-drop to reorder tasks, click to edit task descriptions/prompts, delete hallucinated tasks, and manually inject custom P0_CRITICAL tasks directly from the UI.
- **Task:** Add an editable "Roadmap" tab to the Viewer UI so the overarching product vision can be updated on the fly.
- **Task:** Implement "Approval Gates" in overseer.py and the UI. Allow users to toggle a mode where the factory pauses after the Design and Validation phases to wait for a human "Approve" or "Reject" click.
- **Task:** Add "Abort" and "Retry" buttons to the active task view. "Abort" immediately kills the process and reverts the branch. "Retry" clears the iteration history and forces Jules to start over from attempt 1.

### Phase 5: The "Two-Brain" Architecture (Anti-Ouroboros)
**Goal:** Physically prevent the agent from modifying the code required to run its own basic loops. Never rely on reactive watchdogs; use proactive isolation to prevent self-destruction.
- **Task:** Refactor the monolith into a "Static Orchestrator" and a "Dynamic Engine". The Orchestrator is a read-only, immutable bootloader that manages Git, handles the system prompt state, and spins up the Engine. The Engine contains all LLM/Agent logic and can be safely modified.
- **Task:** Implement a hard auto-rollback feature in the Orchestrator. If the Engine fails to boot (syntax error, bad import) or a task fails 10 attempts, the Orchestrator automatically git reverts the branch, tears down the Engine, and restarts it from the last known good state, generating a retrospective learning.

### Phase 6: CI/CD Ephemeral Sandboxing
**Goal:** Achieve zero-trust validation. The live, running factory must never execute unverified code in its own environment.
- **Task:** Introduce a StackAdapter interface and Docker SDK integration to spin up ephemeral sub-containers for all validation (e.g. abstracting away `npm build` and `npm test` into disposable environments).
- **Task:** Require a "Dry Run Sandbox Boot" before merging any Python refactoring back to `main`. If the agent modifies its own code, it must successfully boot a mock version of itself inside an ephemeral container and pass unit tests before the merge is approved. This prevents a bad update from corrupting the Zulu instance itself.

### Phase 7: Test-Driven Generation (TDD)
**Goal:** Ensure the AI factory writes verifiable code by enforcing test creation *before* implementation.
- **Task:** Update the PMAgent to not just write task descriptions, but to generate explicit, failing Playwright test snippets in the `test_scenario` field of the backlog.
- **Task:** Update the Jules prompt logic so that if a `test_scenario` exists, it is strictly instructed to implement the code necessary to make that specific test pass, creating a closed-loop validation cycle.

### Phase 8: Deterministic Caching & Cost Control
**Goal:** Prevent redundant LLM calls for code that hasn't changed.
- **Task:** Implement AST hashing in the ArchitectAgent. If the dependency graph hash hasn't changed since the last run, skip the LLM call and return the cached score.
- **Task:** Implement visual hashing in the VisionAgent. If the Playwright screenshot matches the previous screenshot by 99% structural similarity (SSIM), skip the LLM visual critique.

### Phase 9: Hybrid Knowledge Graph (GraphRAG)
**Goal:** Fix the "amnesia" problem where Jules forgets architectural lessons after 3 iterations because the prompt sliding window pushes them out. Provide context-aware memory.
- **Task:** Implement a Graph Database (or simulate one in PocketBase) to store architectural constraints and past learnings as connected nodes (e.g., [Learning: Don't mutate state] -> [Concept: React State]).
- **Task:** Refactor overseer.py to query this Knowledge Graph based on the files touched in the current task, retrieving semantically and structurally relevant past learnings to inject into the Jules prompt.
