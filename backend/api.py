import asyncio
import json
import uuid

import dotenv
from pydantic import BaseModel
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

# Initialize environment variables (handles .env file)
import os
import dotenv
from pathlib import Path

env_path = str(Path(__file__).parent / ".env")
env_dict = dotenv.dotenv_values(env_path)
if "GEMINI_API_KEY" in env_dict:
    os.environ["GEMINI_API_KEY"] = env_dict["GEMINI_API_KEY"].strip()

from google.adk.runners import InMemoryRunner
from google.genai import types
from academic_research.agent import root_agent

app = FastAPI(title="Academic Research Agent API")

# Enable CORS for React frontend (Vite's default port mapped)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the ADK runner and session state 
runner = InMemoryRunner(agent=root_agent, app_name="academic-research")
# Store active sessions in memory using unique IDs for simplicity across multiple clients
sessions = {}

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None  # Optional, auto-generated if omitted

@app.post("/api/start_session")
async def start_session():
    """Start a new ADK runner session."""
    user_id = str(uuid.uuid4())
    session = await runner.session_service.create_session(
        app_name=runner.app_name, user_id=user_id
    )
    sessions[session.id] = session
    return {"session_id": session.id, "user_id": user_id}

@app.post("/api/chat")
async def chat_endpoint(request: Request, chat_req: ChatRequest):
    """
    Endpoint that receives user input and returns a Server-Sent Events (SSE) stream 
    of the agent's response.
    """
    if not chat_req.session_id or chat_req.session_id not in sessions:
        # Create a session if not provided or valid
        user_id = str(uuid.uuid4())
        adk_session = await runner.session_service.create_session(
            app_name=runner.app_name, user_id=user_id
        )
        sessions[adk_session.id] = adk_session
        current_session_id = adk_session.id
    else:
        adk_session = sessions[chat_req.session_id]
        current_session_id = adk_session.id

    # Prepare ADK content
    content = types.Content(parts=[types.Part(text=chat_req.message)])

    async def event_generator():
        # Stream events from ADK to SSE chunks
        async for event in runner.run_async(
            user_id=adk_session.user_id,
            session_id=adk_session.id,
            new_message=content,
        ):
            if event.content and event.content.parts and event.content.parts[0].text:
                payload = {
                    "text": event.content.parts[0].text,
                    "session_id": current_session_id
                }
                # Yield SSE chunk
                yield {"event": "message", "data": json.dumps(payload)}
            
            # Allow cancellation via request disconnect
            if await request.is_disconnected():
                break

    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
