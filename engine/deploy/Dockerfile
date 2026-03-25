# ═══════════════════════════════════════════════════
#  APEX TRADER AI - Docker Container
# ═══════════════════════════════════════════════════
FROM python:3.11-slim

LABEL maintainer="Apex Trader AI"
LABEL description="Forex Trading Execution Engine"

WORKDIR /app

# Install dependencies first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy engine code
COPY . .

# Create logs directory
RUN mkdir -p /app/logs

# Expose API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

# Run engine
CMD ["python", "-m", "engine.main"]
