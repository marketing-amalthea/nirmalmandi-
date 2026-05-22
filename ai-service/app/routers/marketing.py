"""
AI Layer 2 — Marketing Content Generator
One-tap AI captions, hashtags, and branded content for resellers.
Phase A (MVP): Caption + text generation.
Phase B: Branded graphic (post-launch).
"""
import time
from typing import Literal, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic
import os

from app.services.ai_logger import log_ai_call, log_ai_error, estimate_cost

router = APIRouter()
claude = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
MODEL = "claude-3-5-sonnet-20241022"

CAPTION_SYSTEM = """You are NirmalMandi's marketing assistant for Indian resellers.
Generate social media captions for dead inventory deals.

Product: {product_title}
Sector: {sector}
Deal price: ₹{price}
Original MRP: ₹{mrp}
Discount: {discount_pct}%
Condition: Grade {grade}
Location: {city}, {state}
Language: {language} (en/hi/hinglish)
Tone: {tone} (urgent/premium/casual/bulk)
Platform: {platform} (instagram/whatsapp/facebook/telegram)

Generate:
1. Hook (first line that grabs attention — make it viral)
2. Body (2-3 lines describing the deal)
3. CTA (call to action — WhatsApp/call/link)
4. Hashtags (8-10 relevant hashtags, skip if WhatsApp)

End with: 'Sourced from NirmalMandi | nirmalmandi.com'

Keep total under 2200 characters for Instagram.
For WhatsApp: no hashtags, keep under 500 characters, use emojis.
For Hinglish: mix Hindi words naturally with English structure.

Return JSON: {{ "hook": "", "body": "", "cta": "", "hashtags": [], "full_caption": "" }}"""


class CaptionRequest(BaseModel):
    listing_id: str
    product_title: str
    sector: str
    price: float
    mrp: Optional[float] = None
    grade: str = "A"
    city: str
    state: str
    language: Literal["en", "hi", "hinglish"] = "hi"
    tone: Literal["urgent", "premium", "casual", "bulk"] = "urgent"
    platform: Literal["instagram", "whatsapp", "facebook", "telegram"] = "whatsapp"
    user_id: Optional[str] = None


@router.post("/caption")
async def generate_caption(req: CaptionRequest):
    discount_pct = round((1 - req.price / req.mrp) * 100) if req.mrp and req.mrp > req.price else 0
    system = CAPTION_SYSTEM.format(
        product_title=req.product_title,
        sector=req.sector,
        price=f"{req.price:,.0f}",
        mrp=f"{req.mrp:,.0f}" if req.mrp else "N/A",
        discount_pct=discount_pct,
        grade=req.grade,
        city=req.city,
        state=req.state,
        language=req.language,
        tone=req.tone,
        platform=req.platform,
    )
    start = time.time()
    try:
        response = claude.messages.create(
            model=MODEL,
            max_tokens=600,
            messages=[{"role": "user", "content": "Generate the caption now."}],
            system=system,
        )
        latency_ms = int((time.time() - start) * 1000)
        content = response.content[0].text if response.content else ""
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost = estimate_cost(MODEL, input_tokens, output_tokens)

        await log_ai_call(
            user_id=req.user_id,
            action_type="caption_gen",
            model=MODEL,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            metadata={"platform": req.platform, "language": req.language, "listing_id": req.listing_id},
        )

        import json, re
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        parsed = {}
        if json_match:
            try:
                parsed = json.loads(json_match.group())
            except json.JSONDecodeError:
                parsed = {"full_caption": content}

        return {"success": True, "data": {**parsed, "cost_credits": 5}}
    except Exception as e:
        await log_ai_error(req.user_id, "caption_gen", MODEL, str(e))
        raise HTTPException(status_code=500, detail=str(e))


class DealHookRequest(BaseModel):
    product_title: str
    sector: str
    discount_pct: float
    language: Literal["en", "hi", "hinglish"] = "hi"
    user_id: Optional[str] = None


@router.post("/hook")
async def generate_deal_hook(req: DealHookRequest):
    """Generate just the opening hook line — used in deal feed previews."""
    start = time.time()
    try:
        response = claude.messages.create(
            model="claude-3-haiku-20240307",  # Cheaper for simple hooks
            max_tokens=100,
            messages=[{
                "role": "user",
                "content": f"Write ONE powerful opening line in {req.language} for this dead stock deal: {req.product_title} ({req.sector}) at {req.discount_pct:.0f}% off. Max 15 words. Make it feel urgent."
            }],
        )
        latency_ms = int((time.time() - start) * 1000)
        content = response.content[0].text.strip() if response.content else ""
        await log_ai_call(
            user_id=req.user_id,
            action_type="caption_gen",
            model="claude-3-haiku-20240307",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            cost_usd=estimate_cost("claude-3-haiku-20240307", response.usage.input_tokens, response.usage.output_tokens),
            latency_ms=latency_ms,
        )
        return {"success": True, "data": {"hook": content}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
