#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 ColabCode Setup Verification"
echo "================================"
echo ""

# Check Node.js
echo -n "✓ Node.js: "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}$NODE_VERSION${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
fi

# Check pnpm
echo -n "✓ pnpm: "
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo -e "${GREEN}$PNPM_VERSION${NC}"
else
    echo -e "${RED}NOT FOUND${NC}"
fi

# Check PostgreSQL
echo -n "✓ PostgreSQL: "
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version)
    echo -e "${GREEN}$PSQL_VERSION${NC}"
else
    echo -e "${YELLOW}NOT IN PATH (may still work)${NC}"
fi

# Check monorepo structure
echo ""
echo "📁 Monorepo Structure:"

DIRS=(
    "apps/web"
    "apps/realtime"
    "packages/db"
    "packages/shared"
    "packages/validation"
    "packages/ui"
)

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "  ${GREEN}✓${NC} $dir"
    else
        echo -e "  ${RED}✗${NC} $dir"
    fi
done

# Check key files
echo ""
echo "📄 Configuration Files:"

FILES=(
    ".env.example"
    ".env.local"
    "turbo.json"
    "tsconfig.json"
    ".eslintrc.json"
    ".prettierrc"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing - may need to be created)"
    fi
done

# Check node_modules
echo ""
echo -n "📦 Dependencies installed: "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}YES${NC}"
else
    echo -e "${RED}NO${NC} (run: pnpm install)"
fi

# Check Prisma setup
echo ""
echo -n "🗄️  Prisma schema: "
if [ -f "packages/db/prisma/schema.prisma" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}MISSING${NC}"
fi

# Check database
echo ""
echo -n "🔗 Database connection: "
if [ -f ".env.local" ]; then
    if grep -q "DATABASE_URL" .env.local; then
        echo -e "${GREEN}Configured${NC}"
    else
        echo -e "${YELLOW}Not in .env.local${NC}"
    fi
else
    echo -e "${YELLOW}No .env.local found${NC}"
fi

# Check Next.js setup
echo ""
echo "🎨 Frontend Setup:"
echo -n "  Next.js config: "
[ -f "apps/web/next.config.js" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}"

echo -n "  Tailwind config: "
[ -f "apps/web/tailwind.config.ts" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}"

echo -n "  PostCSS config: "
[ -f "apps/web/postcss.config.js" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}"

# Check realtime setup
echo ""
echo "⚡ Realtime Server Setup:"
echo -n "  TypeScript config: "
[ -f "apps/realtime/tsconfig.json" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}"

echo -n "  Package.json: "
[ -f "apps/realtime/package.json" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}"

# Documentation
echo ""
echo "📚 Documentation:"
DOCS=(
    "README.md"
    "SETUP.md"
    "ARCHITECTURE.md"
    "IMPLEMENTATION_SUMMARY.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "  ${GREEN}✓${NC} $doc"
    else
        echo -e "  ${YELLOW}○${NC} $doc"
    fi
done

echo ""
echo "================================"
echo "✅ Verification Complete!"
echo ""
echo "Next Steps:"
echo "1. Copy .env.example to .env.local and configure"
echo "2. Run: pnpm install (if not done)"
echo "3. Run: createdb colab_code"
echo "4. Run: pnpm db:migrate"
echo "5. Run: pnpm db:seed"
echo "6. Run: pnpm dev (in separate terminals)"
echo ""
