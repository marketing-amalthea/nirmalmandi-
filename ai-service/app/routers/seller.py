"""
AI seller analytics insights — generates Claude-powered recommendations
from a seller's KPIs, funnel, and top listings.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services.provider import complete

router = APIRouter()

class SellerInsightRequest(BaseModel):
    period: str
    revenue: float
    orders: int
    avg_order_value: float
    active_listings: int
    funnel_views: int
    funnel_orders: int
    top_listing_title: Optional[str] = ""
    top_listing_views: Optional[int] = 0
    top_listing_orders: Optional[int] = 0

SYSTEM = """You are NirmalMandi's AI analyst. Given a seller's performance data,
produce 2–3 concrete, actionable insights in plain English (max 120 words total).
Focus on: what's working, what's underperforming, and one specific action to take this week.
Be direct. No preamble. Use ₹ for rupees."""

@router.post("/insights")
async def seller_insights(req: SellerInsightRequest):
    conv_rate = (req.funnel_orders / req.funnel_views * 100) if req.funnel_views > 0 else 0
    prompt = (
        f"Period: {req.period}\n"
        f"Revenue: ₹{req.revenue:,.0f} | Orders: {req.orders} | AOV: ₹{req.avg_order_value:,.0f}\n"
        f"Active listings: {req.active_listings}\n"
        f"Funnel: {req.funnel_views:,} views → {req.funnel_orders} orders ({conv_rate:.1f}% CVR)\n"
        f"Top listing: \"{req.top_listing_title}\" — {req.top_listing_views:,} views, {req.top_listing_orders} orders\n"
        f"\nGive 2–3 concise, actionable insights for this week."
    )
    try:
        text = await complete(
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
        )
        return {"success": True, "data": {"insight": text}}
    except Exception as e:
        return {"success": False, "error": str(e)}
