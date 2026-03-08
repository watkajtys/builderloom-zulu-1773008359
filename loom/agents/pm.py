"""
Product Manager (PM) Agent Module for BuilderLoom.
Translates high-level product roadmaps into actionable Kanban backlog tasks.
"""

import json
import logging
import uuid
from typing import List

import google.generativeai as genai
from google.api_core import exceptions
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from loom.agents.base import AgentProxy
from loom.core.state import BacklogTask, TaskType, TaskPriority

logger = logging.getLogger("loom")

class PMAgent(AgentProxy): # pylint: disable=too-few-public-methods
    """
    An agent that acts as a Product Manager. It reads the overall project roadmap
    and generates specific, micro-level execution tasks for the Backlog.
    """

    def __init__(self, model_name: str = 'gemini-3.1-pro-preview'):
        self.model = genai.GenerativeModel(model_name)

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=(
            retry_if_exception_type(exceptions.DeadlineExceeded) |
            retry_if_exception_type(exceptions.ServiceUnavailable) |
            retry_if_exception_type(exceptions.InternalServerError) |
            retry_if_exception_type(exceptions.ResourceExhausted)
        ),
        reraise=True
    )
    def _generate_content_with_retry(self, content):
        try:
            logger.info("Sending request to PM Agent (%s)...", self.model.model_name)
            return self.model.generate_content(content, request_options={"timeout": 360})
        except Exception as e:
            logger.warning("PM Agent Gemini call failed (attempting retry): %s", e)
            raise

    def breakdown_task_if_needed(self, task: BacklogTask) -> dict:
        """
        Evaluates a single task. If it's too large, breaks it down into smaller BacklogTasks.
        """
        logger.info(f"PM Agent scoping task: {task.id}")

        prompt = """
You are an elite Engineering Manager. Review this pending task:

TASK DESCRIPTION:
[TASK_DESCRIPTION]

YOUR OBJECTIVE:
1. Determine if this task is too large to be completed in a SINGLE, focused pull request by an AI coder (touching <3 files). ONLY break it down if absolutely necessary. Do not artificially break down tasks that are manageable.
2. Validate if the task is technically sound and relevant to the product. If it is non-sensical, non-technical (e.g. "make me a sandwich"), or completely out of scope, you should DISCARD it.
3. Determine a best guess complexity for the task(s) (e.g., "small", "medium", "large").

- If it is small, atomic, or manageable in a single PR, return:
{ "action": "proceed", "complexity": "small | medium | large" }

- ONLY if it is too large, complex, or multi-step, break it down into 2-4 sequential sub-tasks:
{ "action": "breakdown", "tasks": [...] }

- If it is invalid, non-technical, or redundant, return:
{ "action": "discard", "reason": "Explanation of why this task is invalid" }

Output MUST be a valid JSON object matching this exact schema:
{
  "action": "proceed" | "breakdown" | "discard",
  "reason": "Optional reason for discard",
  "complexity": "small | medium | large",
  "tasks": [
    {
      "type": "feature" | "refactor" | "bugfix",
      "priority": 1 | 2,
      "complexity": "small | medium | large",
      "description": "Sub-task description",
      "requires_design": boolean,
      "requires_data_change": boolean,
      "context": "Context for the engineer"
    }
  ]
}

Return ONLY the JSON.
"""
        prompt = prompt.replace("[TASK_DESCRIPTION]", task.description)
        try:
            response = self._generate_content_with_retry(prompt)
            text = response.text.strip()

            result = self._parse_json(text)
            
            if result.get("action") == "breakdown":
                subtasks = []
                for t_data in result.get("tasks", []):
                    task_id = f"TASK-{uuid.uuid4().hex[:6].upper()}"
                    
                    # Only pass the data_model to subtasks that actually need it
                    # If the subtask doesn't explicitly mention needing a data model change, 
                    # we prefer null to reduce noise.
                    inherited_model = task.data_model if t_data.get("requires_data_change") else None
                    
                    subtask = BacklogTask(
                        id=task_id,
                        type=t_data.get("type", TaskType.FEATURE),
                        priority=task.priority,
                        complexity=t_data.get("complexity", "unknown"),
                        description=t_data.get("description", ""),
                        target_route=task.target_route,
                        data_model=inherited_model,
                        requires_design=t_data.get("requires_design", False),
                        context=t_data.get("context", "")
                    )
                    subtasks.append(subtask)
                return {"action": "breakdown", "tasks": subtasks}
                
            return {"action": "proceed"}

        except Exception as e:
            import traceback
            logger.error(f"PM Agent failed to scope task: {e}\n{traceback.format_exc()}")
            return {"action": "proceed"}

    # pylint: disable=too-many-locals
    def plan_next_sprint(
        self, app_meta: str, roadmap: str, past_learnings: str = "", history: str = ""
    ) -> List[BacklogTask]:
        """
        Translates the high-level roadmap into a complete Kanban queue for the active phase.
        If the active phase is fully complete based on history, it returns a signal to advance.
        """
        logger.info("PM Agent is evaluating the roadmap and planning the next execution queue...")

        prompt = """
You are the elite Product Manager for BuilderLoom.
Your job is to read the macro-level ROADMAP, evaluate the completed HISTORY, and either generate the next execution queue OR advance the phase.

APP IDENTITY:
[APP_META]

ROADMAP:
[ROADMAP]

COMPLETED TASK HISTORY (What is already done):
[HISTORY]

PAST LEARNINGS (Context):
[PAST_LEARNINGS]

CRITICAL DIRECTIVES:
1. Identify the *current* active phase of the roadmap.
2. Evaluate the COMPLETED TASK HISTORY. Have all the requirements for the *current* active phase already been fulfilled by past tasks?
3. IF THE CURRENT PHASE IS COMPLETE: Do not generate tasks. Instead, output a JSON object instructing the system to advance to the next phase:
   { "action": "advance_phase", "new_phase_name": "Exact string of the NEXT phase header from the roadmap" }
4. IF THE CURRENT PHASE IS NOT COMPLETE: Generate ALL sequential engineering tasks required to fully complete this phase. Do NOT artificially limit yourself to 3-5 tasks. If a phase requires 10 distinct scripts, generate 10 tasks.
5. Keep the scope of EACH task manageable for a single pull request.
6. If a task requires a visual layout/UI, set `requires_design` to true. If it is purely state management, backend python scripts, or API logic, set it to false.
7. DATA MODEL SELECTION: Set `data_model` to the relevant JSON schema ONLY if the task requires creating new database tables or modifying existing ones. If the task is purely UI refinement, logic, or using existing tables, set `data_model` to null.

Output MUST be strictly valid JSON. 
EITHER the advance phase object:
{
  "action": "advance_phase",
  "new_phase_name": "Phase 3: The Outbound Scout"
}

OR an array of task objects matching this schema:
[
  {
    "type": "feature",
    "priority": 1,
    "complexity": "small | medium | large",
    "description": "Short description of the task",
    "target_route": "/login",
    "data_model": "Optional JSON schema if this requires a new database table, else null",
    "requires_design": true,
    "test_scenario": "User fills out form and clicks submit, verifying state updates",
    "context": "Any extra notes for the Engineer"
  }
]

Return ONLY the JSON.
"""
        prompt = prompt.replace("[APP_META]", app_meta)
        prompt = prompt.replace("[ROADMAP]", roadmap)
        prompt = prompt.replace("[PAST_LEARNINGS]", past_learnings)
        prompt = prompt.replace("[HISTORY]", history)

        try:
            response = self._generate_content_with_retry(prompt)
            text = response.text.strip()

            tasks_data = self._parse_json(text)
            
            # Handle auto-phase advancement
            if isinstance(tasks_data, dict) and tasks_data.get("action") == "advance_phase":
                new_phase = tasks_data.get("new_phase_name")
                logger.info(f"PM Agent detected phase completion. Advancing to: {new_phase}")
                # We return a special "Dummy Task" that the Overseer catches to update the phase
                return [BacklogTask(id="PHASE_ADVANCE", description=new_phase, type=TaskType.FEATURE, priority=TaskPriority.P0_CRITICAL)]

            backlog_tasks = []

            for t_data in tasks_data:
                # Generate a unique ID
                task_id = f"TASK-{uuid.uuid4().hex[:6].upper()}"

                # Map integer priorities to the Enum
                priority_int = t_data.get("priority", 1)
                priority = TaskPriority.P1_HIGH
                if priority_int == 2:
                    priority = TaskPriority.P2_NORMAL
                elif priority_int == 0:
                    priority = TaskPriority.P0_CRITICAL

                # Validate type
                task_type_str = t_data.get("type", "feature").lower()
                if task_type_str == "refactor":
                    task_type = TaskType.REFACTOR
                elif task_type_str == "bugfix":
                    task_type = TaskType.BUGFIX
                else:
                    task_type = TaskType.FEATURE

                # Handle data_model properly if LLM returned an object/list instead of a string
                raw_data_model = t_data.get("data_model")
                if isinstance(raw_data_model, (dict, list)):
                    data_model_str = json.dumps(raw_data_model)
                else:
                    data_model_str = raw_data_model

                task = BacklogTask(
                    id=task_id,
                    type=task_type,
                    priority=priority,
                    complexity=t_data.get("complexity", "unknown"),
                    description=t_data.get("description", "Unknown task"),
                    target_route=t_data.get("target_route", "/"),
                    data_model=data_model_str,
                    requires_design=t_data.get("requires_design", True),
                    test_scenario=t_data.get("test_scenario", ""),
                    context=t_data.get("context", ""),
                    status="todo"
                )
                backlog_tasks.append(task)

            logger.info("PM Agent generated %d new tasks.", len(backlog_tasks))
            return backlog_tasks

        except Exception as e: # pylint: disable=broad-exception-caught
            logger.error("PM Agent failed to generate sprint plan: %s", e)
            return []
