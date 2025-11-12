#!/usr/bin/env bash
# Setup and interact with 1Password Kubernetes Operator

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== 1Password Kubernetes Operator Helper ===${NC}\n"

# Check for kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}✗ kubectl not found${NC}"
    echo -e "Install from: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

echo -e "${GREEN}✓ kubectl detected${NC}"

# Check for helm
if ! command -v helm &> /dev/null; then
    echo -e "${YELLOW}⚠ helm not found (optional for installation)${NC}"
else
    echo -e "${GREEN}✓ helm detected${NC}"
fi

# Get project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OPERATOR_REPO="$PROJECT_ROOT/luci_onepass_repos/repos/luci-onepassword-operator"

# Check if operator repo is cloned
if [ ! -d "$OPERATOR_REPO" ]; then
    echo -e "${RED}✗ Operator repository not found${NC}"
    echo -e "Run: bash scripts/onepass/clone-repos.sh"
    exit 1
fi

echo -e "${GREEN}✓ Operator repository found${NC}\n"

# Function to show usage
show_usage() {
    echo -e "${BLUE}Usage:${NC}"
    echo -e "  $0 [command]"
    echo -e "\n${BLUE}Commands:${NC}"
    echo -e "  status      - Check operator deployment status"
    echo -e "  install     - Install operator using Helm"
    echo -e "  uninstall   - Uninstall operator"
    echo -e "  logs        - Show operator logs"
    echo -e "  create      - Create a sample OnePasswordItem"
    echo -e "  list        - List all OnePasswordItems"
    echo -e "  help        - Show this help"
}

# Parse command
COMMAND=${1:-help}

case "$COMMAND" in
    status)
        echo -e "${BLUE}Checking operator status...${NC}\n"

        # Check namespace
        if kubectl get namespace 1password &> /dev/null; then
            echo -e "${GREEN}✓ Namespace '1password' exists${NC}"
        else
            echo -e "${YELLOW}⊘ Namespace '1password' not found${NC}"
        fi

        # Check operator deployment
        if kubectl get deployment -n 1password onepassword-operator &> /dev/null; then
            echo -e "${GREEN}✓ Operator deployment exists${NC}"
            kubectl get deployment -n 1password onepassword-operator
        else
            echo -e "${YELLOW}⊘ Operator deployment not found${NC}"
        fi

        # Check CRD
        if kubectl get crd onepassworditems.onepassword.com &> /dev/null; then
            echo -e "${GREEN}✓ OnePasswordItem CRD installed${NC}"
        else
            echo -e "${YELLOW}⊘ OnePasswordItem CRD not found${NC}"
        fi
        ;;

    install)
        echo -e "${BLUE}Installing 1Password Operator...${NC}\n"

        if ! command -v helm &> /dev/null; then
            echo -e "${RED}✗ Helm is required for installation${NC}"
            exit 1
        fi

        # Add Helm repo
        echo -e "${BLUE}Adding 1Password Helm repository...${NC}"
        helm repo add 1password https://1password.github.io/connect-helm-charts
        helm repo update

        # Install
        echo -e "${BLUE}Installing operator...${NC}"
        helm install onepassword-operator 1password/connect \
            --namespace 1password \
            --create-namespace \
            --set operator.create=true

        echo -e "${GREEN}✓ Operator installed${NC}"
        ;;

    uninstall)
        echo -e "${BLUE}Uninstalling 1Password Operator...${NC}\n"

        helm uninstall onepassword-operator --namespace 1password

        echo -e "${GREEN}✓ Operator uninstalled${NC}"
        ;;

    logs)
        echo -e "${BLUE}Fetching operator logs...${NC}\n"

        kubectl logs -n 1password -l app=onepassword-operator --tail=100 -f
        ;;

    create)
        echo -e "${BLUE}Creating sample OnePasswordItem...${NC}\n"

        cat << EOF | kubectl apply -f -
apiVersion: onepassword.com/v1
kind: OnePasswordItem
metadata:
  name: metabase-secret
  namespace: default
spec:
  itemPath: "vaults/Development/items/Metabase"
EOF

        echo -e "${GREEN}✓ OnePasswordItem created${NC}"
        echo -e "View with: kubectl get onepassworditems"
        ;;

    list)
        echo -e "${BLUE}Listing OnePasswordItems...${NC}\n"

        kubectl get onepassworditems --all-namespaces
        ;;

    help|*)
        show_usage
        ;;
esac
