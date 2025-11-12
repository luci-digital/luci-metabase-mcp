#!/usr/bin/env bash
# Setup Lighthouse CI

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Lighthouse CI Setup ===${NC}\n"

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

MISSING=()

if ! command -v node &> /dev/null; then
    MISSING+=("Node.js")
fi

if ! command -v npm &> /dev/null; then
    MISSING+=("npm")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing required tools: ${MISSING[*]}${NC}\n"
    echo -e "Install Node.js from: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites installed${NC}\n"

# Install Lighthouse CI
echo -e "${BLUE}Installing Lighthouse CI...${NC}"

if npm list -g @lhci/cli &> /dev/null; then
    echo -e "${YELLOW}⊘ Lighthouse CI already installed${NC}"
else
    npm install -g @lhci/cli@0.13.x
    echo -e "${GREEN}✓ Lighthouse CI installed${NC}"
fi

# Install local dependencies if needed
if [ -f "package.json" ]; then
    echo -e "\n${BLUE}Installing project dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# Create Lighthouse directories
echo -e "\n${BLUE}Creating directories...${NC}"
mkdir -p .lighthouse .lighthouseci
echo -e "${GREEN}✓ Directories created${NC}"

# Make scripts executable
chmod +x scripts/lighthouse/secret-detector.js
chmod +x scripts/lighthouse/*.sh
echo -e "${GREEN}✓ Scripts made executable${NC}"

# Test installation
echo -e "\n${BLUE}Testing Lighthouse CI installation...${NC}"

if lhci --version &> /dev/null; then
    VERSION=$(lhci --version)
    echo -e "${GREEN}✓ Lighthouse CI ${VERSION} ready${NC}"
else
    echo -e "${RED}✗ Lighthouse CI installation failed${NC}"
    exit 1
fi

# GitHub configuration
echo -e "\n${BLUE}GitHub Configuration:${NC}\n"

echo -e "Add these secrets to your GitHub repository:\n"

echo -e "${YELLOW}1. LHCI_GITHUB_APP_TOKEN${NC} (optional)"
echo -e "   Create a GitHub token with repo scope:"
echo -e "   https://github.com/settings/tokens/new?scopes=repo&description=Lighthouse%20CI\n"

echo -e "${YELLOW}2. OP_SERVICE_ACCOUNT_TOKEN${NC} (already configured if using 1Password integration)\n"

if command -v gh &> /dev/null; then
    read -p "Add LHCI_GITHUB_APP_TOKEN to GitHub now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "\n${BLUE}Creating GitHub token...${NC}"
        echo -e "Visit: https://github.com/settings/tokens/new?scopes=repo&description=Lighthouse%20CI"
        echo -e "\nPaste your token:"
        read -s LHCI_TOKEN
        echo "$LHCI_TOKEN" | gh secret set LHCI_GITHUB_APP_TOKEN
        echo -e "${GREEN}✓ Token added${NC}"
    fi
fi

# Test configuration
echo -e "\n${BLUE}Testing configuration...${NC}"

if [ -f "lighthouserc.js" ]; then
    echo -e "${GREEN}✓ lighthouserc.js found${NC}"

    # Validate configuration
    node -e "require('./lighthouserc.js')" && \
        echo -e "${GREEN}✓ Configuration is valid${NC}" || \
        echo -e "${RED}✗ Configuration has errors${NC}"
else
    echo -e "${RED}✗ lighthouserc.js not found${NC}"
fi

# Summary
echo -e "\n${GREEN}=== Setup Complete ===${NC}\n"

echo -e "${BLUE}Next Steps:${NC}\n"

echo -e "1. ${YELLOW}Run Lighthouse CI locally:${NC}"
echo -e "   npm run build"
echo -e "   lhci autorun\n"

echo -e "2. ${YELLOW}Run secret detection:${NC}"
echo -e "   node scripts/lighthouse/secret-detector.js\n"

echo -e "3. ${YELLOW}Test full workflow:${NC}"
echo -e "   bash scripts/lighthouse/test.sh\n"

echo -e "4. ${YELLOW}Commit and push to trigger GitHub Actions:${NC}"
echo -e "   git add ."
echo -e "   git commit -m 'Add Lighthouse CI'"
echo -e "   git push\n"

echo -e "${GREEN}Lighthouse CI is ready!${NC}"
