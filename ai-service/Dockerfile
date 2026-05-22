FROM python:3.11-slim AS base

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY ai-service/app ./app

EXPOSE 8000
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
