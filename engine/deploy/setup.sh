#!/bin/bash
# ═══════════════════════════════════════════════════
#  APEX TRADER AI - VPS Setup Script
#  Sets up Python environment and dependencies
# ═══════════════════════════════════════════════════

set -euo pipefail

echo "╔══════════════════════════════════════════╗"
echo "║  APEX TRADER AI - VPS Setup             ║"
echo "╚══════════════════════════════════════════╝"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[SETUP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as appropriate user
DEPLOY_DIR="${DEPLOY_DIR:-/opt/apex-trader}"
ENGINE_USER="${ENGINE_USER:-apex}"

log "Deploy directory: $DEPLOY_DIR"

# System dependencies
log "Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq python3 python3-pip python3-venv git curl

# Create deploy directory
log "Creating deployment directory..."
sudo mkdir -p "$DEPLOY_DIR"
sudo chown "$(whoami):$(whoami)" "$DEPLOY_DIR"

# Copy engine files
log "Copying engine files..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$(dirname "$SCRIPT_DIR")"
cp -r "$ENGINE_DIR"/* "$DEPLOY_DIR/"
cp -r "$ENGINE_DIR"/.env "$DEPLOY_DIR/" 2>/dev/null || true

# Create virtual environment
log "Creating Python virtual environment..."
python3 -m venv "$DEPLOY_DIR/venv"
source "$DEPLOY_DIR/venv/bin/activate"

# Install dependencies
log "Installing Python dependencies..."
pip install --upgrade pip
pip install -r "$DEPLOY_DIR/requirements.txt"

# Create logs directory
mkdir -p "$DEPLOY_DIR/logs"

# Create .env template if not exists
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    log "Creating .env template..."
    cat > "$DEPLOY_DIR/.env" << 'ENVEOF'
# ═══════════════════════════════════════════════════
#  APEX TRADER AI - Configuration
# ═══════════════════════════════════════════════════

# OANDA API (Required for live trading)
APEX_OANDA_API_KEY=your-api-key-here
APEX_OANDA_ACCOUNT_ID=your-account-id
APEX_OANDA_PRACTICE=true

# Trading Configuration
APEX_PAIR=EUR_USD
APEX_TIMEFRAME=M5
APEX_MIN_CONFIDENCE=72
APEX_PAPER_TRADING=true
APEX_PAPER_BALANCE=10000

# Risk Management
APEX_RISK_PER_TRADE=1.0
APEX_DAILY_DRAWDOWN=5.0
APEX_MAX_CONSECUTIVE_LOSSES=5
APEX_CIRCUIT_BREAKER=true
APEX_MAX_OPEN_TRADES=3
APEX_MAX_DAILY_TRADES=20

# Telegram Notifications (Optional)
APEX_TELEGRAM_ENABLED=false
APEX_TELEGRAM_BOT_TOKEN=
APEX_TELEGRAM_CHAT_ID=

# Engine API (for dashboard connection)
APEX_API_PORT=8080
APEX_API_HOST=0.0.0.0
ENVEOF
    warn ".env template created - please edit with your actual values!"
fi

log "Setup complete! Next steps:"
echo "  1. Edit $DEPLOY_DIR/.env with your API keys"
echo "  2. Run: sudo cp $DEPLOY_DIR/deploy/apex-trader.service /etc/systemd/system/"
echo "  3. Run: sudo systemctl enable apex-trader && sudo systemctl start apex-trader"
echo "  4. Check: sudo systemctl status apex-trader"
