"""
AI Layer 4 — Pricing Intelligence
Recommends optimal liquidation prices per listing.
"""
import time
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic
import os

from app.services.ai_logger import log_ai_call, estimate_cost

router = APIRouter()
claude = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
MODEL = "claude-3-haiku-20240307"  # Cheaper model for pricing — high volume

PRICING_PROMPT = """You are a pricing expert for NirmalMandi, India's dead inventory marketplace.
Recommend an optimal liquidation price for this listing.

Listing details:
- Sector: {sector}
- Product: {product_title}
- Condition Grade: {condition_grade}
- Quantity: {quantity} {unit}
- State/City: {state}, {city}
- Dead stock type: {dead_stock_type}
- Urgency: Must sell in {urgency_days} days
- Seller's asking price: ₹{asking_price}
- Original MRP: ₹{mrp}

Based on typical liquidation pricing for this sector and condition:
Return JSON only:
{{
  "recommended_price": 0,
  "confidence": 0.0,
  "range_low": 0,
  "range_high": 0,
  "rationale": "",
  "velocity_at_price": {{
    "7_days": 0.0,
    "14_days": 0.0,
    "30_days": 0.0
  }},
  "pricing_tips": []
}}"""


class PricingRequest(BaseModel):
    sector: str
    product_title: str
    condition_grade: str
    quantity: int
    unit: str
    state: str
    city: str
    dead_stock_type: str
    urgency_days: Optional[int] = 30
    asking_price: float
    mrp: Optional[float] = None
    user_id: Optional[str] = None


@router.post("/recommend")
async def pricing_recommendation(req: PricingRequest):
    prompt = PRICING_PROMPT.format(
        sector=req.sector,
        product_title=req.product_title,
        condition_grade=req.condition_grade,
        quantity=req.quantity,
        unit=req.unit,
        state=req.state,
        city=req.city,
        dead_stock_type=req.dead_stock_type,
        urgency_days=req.urgency_days or 30,
        asking_price=f"{req.asking_price:,.0f}",
        mrp=f"{req.mrp:,.0f}" if req.mrp else "Unknown",
    )
    start = time.time()
    try:
        response = claude.messages.create(
            model=MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        latency_ms = int((time.time() - start) * 1000)
        content = response.content[0].text if response.content else ""
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens

        await log_ai_call(
            user_id=req.user_id,
            action_type="pricing_rec",
            model=MODEL,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=estimate_cost(MODEL, input_tokens, output_tokens),
            latency_ms=latency_ms,
        )

        import json, re
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        parsed = json.loads(json_match.group()) if json_match else {}
        return {"success": True, "data": parsed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fair-offer")
async def fair_offer_suggestion(body: dict):
    """Suggest a fair counter-offer price during negotiation."""
    asking = body.get("asking_price", 0)
    buyer_offer = body.get("buyer_offer", 0)
    sector = body.get("sector", "")
    start = time.time()
    try:
        response = claude.messages.create(
            model=MODEL,
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": f"In {sector} dead inventory market, seller asks ₹{asking:,.0f}, buyer offers ₹{buyer_offer:,.0f}. Suggest a fair deal price. Return JSON: {{\"fair_price\": 0, \"rationale\": \"\"}}"
            }],
        )
        content = response.content[0].text if response.content else ""
        import json, re
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        parsed = json.loads(json_match.group()) if json_match else {"fair_price": (asking + buyer_offer) / 2}
        await log_ai_call(
            user_id=body.get("user_id"),
            action_type="pricing_rec",
            model=MODEL,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            cost_usd=estimate_cost(MODEL, response.usage.input_tokens, response.usage.output_tokens),
            latency_ms=int((time.time() - start) * 1000),
        )
        return {"success": True, "data": parsed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
