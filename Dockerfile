# Dockerfile for the FastAPI backend (Railway)
FROM python:3.11-slim

WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend source
COPY backend /app/backend

ENV PYTHONUNBUFFERED=1

# Railway injects $PORT; default to 8000 for local use. Read inside Python to avoid shell interpolation issues.
EXPOSE 8000
CMD ["python", "-m", "backend.main"]
