"""
Log all AI model calls to ai_logs table for cost tracking and quality review.
Every AI call in NirmalMandi must go through this logger — non-negotiable.
"""
import asyncio
import time
from typing import Optional
import asyncpg
import os
import logging

logger = logging.getLogger("nirmalmandi.ai.logger")

_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.environ["DATABASE_URL"], min_size=2, max_size=10)
    return _pool

async def log_ai_call(
    user_id: Optional[str],
    action_type: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    latency_ms: int,
    success: bool = True,
    error_message: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    try:
        pool = await get_pool()
        await pool.execute(
            """
            INSERT INTO ai_logs
              (user_id, action_type, model, input_tokens, output_tokens, cost_usd,
               latency_ms, success, error_message, metadata)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            """,
            user_id, action_type, model, input_tokens, output_tokens, cost_usd,
            latency_ms, success, error_message, metadata or {},
        )
    except Exception as e:
        logger.error(f"Failed to write ai_log: {e}")

async def log_ai_error(user_id: Optional[str], action_type: str, model: str, error: str) -> None:
    await log_ai_call(
        user_id=user_id,
        action_type=action_type,
        model=model,
        input_tokens=0,
        output_tokens=0,
        cost_usd=0.0,
        latency_ms=0,
        success=False,
        error_message=error,
    )

def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Rough cost estimate in USD — update rates as Anthropic pricing changes."""
    RATES = {
        "claude-3-5-sonnet-20241022": (0.000003, 0.000015),  # per token in/out
        "claude-3-haiku-20240307": (0.00000025, 0.00000125),
        "whisper-1": (0.000006, 0),  # per token (audio min)
    }
    in_rate, out_rate = RATES.get(model, (0.000003, 0.000015))
    return round(input_tokens * in_rate + output_tokens * out_rate, 8)
