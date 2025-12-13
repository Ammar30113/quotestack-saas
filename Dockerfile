# Dockerfile for the FastAPI backend (Railway)
FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

ENV PYTHONUNBUFFERED=1

# Railway injects $PORT; default to 8000 for local use. Read inside Python to avoid shell interpolation issues.
CMD ["python", "-c", "import os, uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=int(os.environ.get('PORT', '8000')))"]
