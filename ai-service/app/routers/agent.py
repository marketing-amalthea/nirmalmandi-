"""
AI Layer 3 — NirmalMandi Agent
Stateful conversational AI with function calling. Runs in persistent side panel.
Voice-to-voice Hindi support. Navigates and transacts on behalf of the user.
"""
import time
import os
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import anthropic
import httpx

from app.services.ai_logger import log_ai_call, log_ai_error, estimate_cost

router = APIRouter()
claude = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
openai_key = os.environ.get("OPENAI_API_KEY", "")
MODEL = "claude-3-5-sonnet-20241022"

AGENT_SYSTEM = """You are the NirmalMandi assistant — a helpful AI for India's dead inventory liquidation marketplace.
You help buyers find deals, sellers manage listings, and admins monitor the platform.

Current user: {user_name} | Role: {user_role} | Language: {user_language}
Current screen: {current_route}

You can execute actions using the provided tools.
Always confirm before executing destructive actions (suspend, delist, etc.)
Respond in the user's preferred language ({user_language}).
Be concise — this is a business context, not casual chat.

When executing an action, briefly explain what you did.
For voice inputs: respond in natural spoken sentences, not lists.
For text inputs: use minimal formatting appropriate for a chat interface.

Common Hindi phrases you should understand:
- "Mujhe aaj ke best deals dikhao" → show today's best deals
- "Mera order kahan hai" → show order tracking
- "Market karo is product ko" → generate marketing content
- "Meri listing band karo" → pause listing
- "Naya listing banana hai" → create new listing"""

# Agent tools (function calling)
AGENT_TOOLS = [
    {
        "name": "search_listings",
        "description": "Search the NirmalMandi marketplace for listings",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "sector": {"type": "string", "description": "Filter by sector slug"},
                "city": {"type": "string"},
                "max_price": {"type": "number"},
                "condition_grade": {"type": "string", "enum": ["A", "B", "C", "D"]},
                "limit": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_order_status",
        "description": "Get the status and tracking info of a specific order",
        "input_schema": {
            "type": "object",
            "properties": {"order_id": {"type": "string"}, "order_number": {"type": "string"}},
        },
    },
    {
        "name": "get_my_listings",
        "description": "Get the seller's active listings",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["live", "paused", "sold", "all"], "default": "live"},
                "limit": {"type": "integer", "default": 10},
            },
        },
    },
    {
        "name": "pause_listing",
        "description": "Pause a seller's live listing (requires confirmation)",
        "input_schema": {
            "type": "object",
            "properties": {"listing_id": {"type": "string"}},
            "required": ["listing_id"],
        },
    },
    {
        "name": "generate_marketing_content",
        "description": "Generate AI marketing caption for a product",
        "input_schema": {
            "type": "object",
            "properties": {
                "listing_id": {"type": "string"},
                "platform": {"type": "string", "enum": ["whatsapp", "instagram", "facebook"]},
                "language": {"type": "string", "enum": ["hi", "en", "hinglish"]},
            },
            "required": ["listing_id"],
        },
    },
    {
        "name": "raise_dispute",
        "description": "Raise a dispute on an order",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string"},
                "reason": {"type": "string"},
                "description": {"type": "string"},
            },
            "required": ["order_id", "reason", "description"],
        },
    },
    {
        "name": "add_to_cart",
        "description": "Add a listing to the buyer's cart",
        "input_schema": {
            "type": "object",
            "properties": {
                "listing_id": {"type": "string"},
                "quantity": {"type": "integer", "default": 1},
            },
            "required": ["listing_id"],
        },
    },
    {
        "name": "get_platform_stats",
        "description": "Get platform KPIs (admin only)",
        "input_schema": {"type": "object", "properties": {"period": {"type": "string", "enum": ["today", "week", "month"]}}},
    },
    {
        "name": "navigate_to",
        "description": "Navigate the user to a specific screen in the app",
        "input_schema": {
            "type": "object",
            "properties": {"screen": {"type": "string", "description": "Screen name or route"}},
            "required": ["screen"],
        },
    },
    {
        "name": "explain_document",
        "description": "Explain an invoice, escrow status, or compliance document in plain language",
        "input_schema": {
            "type": "object",
            "properties": {
                "document_type": {"type": "string", "enum": ["invoice", "escrow", "compliance", "payout"]},
                "document_id": {"type": "string"},
            },
            "required": ["document_type"],
        },
    },
]


class AgentMessageRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []
    user_id: str
    user_name: str
    user_role: Literal["buyer", "seller", "admin"] = "buyer"
    user_language: Literal["en", "hi"] = "hi"
    current_route: str = "home"


class AgentVoiceRequest(BaseModel):
    user_id: str
    user_name: str
    user_role: Literal["buyer", "seller", "admin"] = "buyer"
    user_language: Literal["en", "hi"] = "hi"
    current_route: str = "home"
    conversation_history: list[dict] = []


@router.post("/message")
async def agent_message(req: AgentMessageRequest):
    start = time.time()
    system = AGENT_SYSTEM.format(
        user_name=req.user_name,
        user_role=req.user_role,
        user_language=req.user_language,
        current_route=req.current_route,
    )
    messages = req.conversation_history + [{"role": "user", "content": req.message}]

    try:
        response = claude.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system,
            tools=AGENT_TOOLS,
            messages=messages,
        )
        latency_ms = int((time.time() - start) * 1000)
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens

        await log_ai_call(
            user_id=req.user_id,
            action_type="agent_message",
            model=MODEL,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=estimate_cost(MODEL, input_tokens, output_tokens),
            latency_ms=latency_ms,
            metadata={"route": req.current_route, "role": req.user_role},
        )

        # Extract text response and any tool calls
        text_response = ""
        tool_calls = []
        for block in response.content:
            if block.type == "text":
                text_response = block.text
            elif block.type == "tool_use":
                tool_calls.append({"tool": block.name, "input": block.input, "id": block.id})

        updated_history = messages + [{"role": "assistant", "content": response.content}]

        return {
            "success": True,
            "data": {
                "response": text_response,
                "tool_calls": tool_calls,
                "conversation_history": updated_history,
                "stop_reason": response.stop_reason,
            },
        }
    except Exception as e:
        await log_ai_error(req.user_id, "agent_message", MODEL, str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice")
async def agent_voice(
    audio: UploadFile = File(...),
    user_id: str = "",
    user_name: str = "User",
    user_role: str = "buyer",
    user_language: str = "hi",
    current_route: str = "home",
):
    """
    Voice input → Whisper transcription → Agent → Google TTS response.
    """
    # Step 1: Transcribe with Whisper
    audio_bytes = await audio.read()
    transcription = ""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {openai_key}"},
                files={"file": (audio.filename or "audio.webm", audio_bytes, audio.content_type or "audio/webm")},
                data={"model": "whisper-1", "language": user_language},
                timeout=30,
            )
            resp.raise_for_status()
            transcription = resp.json().get("text", "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    if not transcription:
        raise HTTPException(status_code=400, detail="Could not transcribe audio")

    # Step 2: Run through agent
    agent_req = AgentMessageRequest(
        message=transcription,
        user_id=user_id,
        user_name=user_name,
        user_role=user_role,  # type: ignore
        user_language=user_language,  # type: ignore
        current_route=current_route,
    )
    agent_response = await agent_message(agent_req)
    text_reply = agent_response["data"]["response"]

    # Step 3: TTS (Google Cloud) — return audio URL or base64
    # In prod: call Google TTS API and cache the result
    # For MVP: return text only, TTS implemented in mobile client
    return {
        "success": True,
        "data": {
            "transcription": transcription,
            "response": text_reply,
            "tool_calls": agent_response["data"]["tool_calls"],
            "tts_text": text_reply,  # Mobile client handles TTS
        },
    }
