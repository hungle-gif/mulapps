#!/bin/bash
# ============================================
# STITCH — Chạy 1 lệnh, tự setup, tự generate
# ============================================
#
# CÁCH DÙNG:
#   bash scripts/stitch.sh "Mô tả trang" ten-trang
#   bash scripts/stitch.sh batch                        ← generate từ screens.json
#   bash scripts/stitch.sh setup                        ← chỉ setup (không generate)
#
# VÍ DỤ:
#   bash scripts/stitch.sh "Login page, email password, Vietnamese, dark theme, indigo" login
#   bash scripts/stitch.sh "Dashboard with stats cards, charts, sidebar. Vietnamese." dashboard
#   bash scripts/stitch.sh batch
#
# OUTPUT:
#   screenshots/stitch/[name].html    ← HTML + Tailwind (nguồn sự thật)
#   screenshots/stitch/[name].jpg     ← Screenshot preview
#   screenshots/stitch/[name]-design.md ← Design system (nếu có)
#
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# Check .env exists
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env không tồn tại. Tạo .env với STITCH_API_KEY=your_key"
  exit 1
fi

# Check STITCH_API_KEY
if ! grep -q "STITCH_API_KEY=.\+" "$ENV_FILE"; then
  echo "❌ STITCH_API_KEY chưa set trong .env"
  echo "   Thêm: STITCH_API_KEY=your_api_key_here"
  exit 1
fi

# Auto install dependencies nếu chưa có
if [ ! -d "$SCRIPT_DIR/node_modules/@google/stitch-sdk" ]; then
  echo "📦 Cài đặt Stitch SDK..."
  cd "$SCRIPT_DIR" && npm install --silent 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "❌ npm install fail. Check internet connection."
    exit 1
  fi
  echo "✅ Stitch SDK đã cài"
fi

cd "$PROJECT_DIR"

# Mode: setup only
if [ "$1" = "setup" ]; then
  echo "✅ Stitch đã sẵn sàng. Dùng:"
  echo "   bash scripts/stitch.sh \"Mô tả trang\" ten-trang"
  echo "   bash scripts/stitch.sh batch"
  exit 0
fi

# Mode: batch (từ screens.json)
if [ "$1" = "batch" ]; then
  if [ ! -f "$SCRIPT_DIR/screens.json" ]; then
    echo "❌ scripts/screens.json chưa tồn tại"
    echo "   Tạo file scripts/screens.json:"
    echo '   [{"name":"home","prompt":"Homepage..."},{"name":"login","prompt":"Login page..."}]'
    exit 1
  fi
  echo "🎨 Generating từ screens.json..."
  cd "$SCRIPT_DIR" && node generate-ui.mjs
  exit $?
fi

# Mode: single screen
PROMPT="$1"
NAME="$2"

if [ -z "$PROMPT" ]; then
  echo "============================================"
  echo "  STITCH — Google AI UI Designer"
  echo "============================================"
  echo ""
  echo "  Cách dùng:"
  echo "    bash scripts/stitch.sh \"Mô tả trang\" ten-trang"
  echo "    bash scripts/stitch.sh batch"
  echo "    bash scripts/stitch.sh setup"
  echo ""
  echo "  Ví dụ:"
  echo "    bash scripts/stitch.sh \"Login page with email, password. Vietnamese. Dark theme. Primary indigo.\" login"
  echo "    bash scripts/stitch.sh \"Product list with cards, filters, search. Vietnamese.\" products"
  echo ""
  echo "  Output: screenshots/stitch/"
  echo "============================================"
  exit 0
fi

if [ -z "$NAME" ]; then
  NAME="screen"
fi

echo "🎨 Generating: $NAME"
cd "$SCRIPT_DIR" && node generate-ui.mjs --prompt "$PROMPT" --name "$NAME" --project "$(basename "$PROJECT_DIR")"
