# Development Shells
# Provides isolated environments for different development contexts
{ pkgs, lib }:

{
  # Full development environment with all tools
  default = pkgs.mkShell {
    name = "luci-metabase-dev";

    packages = with pkgs; [
      # Node.js ecosystem
      nodejs_20
      nodePackages.npm
      nodePackages.pnpm
      nodePackages.typescript
      nodePackages.typescript-language-server
      nodePackages.eslint
      nodePackages.prettier

      # Python (for tooling/scripts)
      python311
      python311Packages.pip
      python311Packages.virtualenv

      # Infrastructure as Code
      terraform
      opentofu
      ansible
      ansible-lint

      # Container tools
      podman
      podman-compose
      skopeo
      dive

      # Kubernetes
      kubectl
      kubernetes-helm
      k9s
      kustomize

      # Security
      trivy
      grype

      # Utilities
      jq
      yq-go
      curl
      wget
      httpie
      git
      gnumake
      direnv
      watchexec

      # Documentation
      mdbook
    ];

    shellHook = ''
      echo ""
      echo "=========================================="
      echo "  Luci Metabase MCP - Dev Environment"
      echo "=========================================="
      echo ""
      echo "Packages:"
      echo "  nix build .#mcp-server"
      echo "  nix build .#swift-bridge"
      echo "  nix build .#personal-ai-container"
      echo ""
      echo "Images:"
      echo "  nix build .#mcp-server-image"
      echo "  nix build .#swift-bridge-image"
      echo "  nix build .#combined-image"
      echo ""
      echo "DevShells:"
      echo "  nix develop .#node    - Node.js only"
      echo "  nix develop .#swift   - Swift only"
      echo "  nix develop .#ops     - Operations tools"
      echo ""
      echo "Checks:"
      echo "  nix flake check       - Run all checks"
      echo ""

      # Add local bins to PATH
      export PATH="$PWD/node_modules/.bin:$PATH"
      export PATH="$PWD/scripts:$PATH"

      # Direnv integration
      if [ -f .envrc ]; then
        eval "$(direnv export bash 2>/dev/null || true)"
      fi
    '';

    # Environment variables
    NODE_ENV = "development";
    EDITOR = "code";
  };

  # Node.js only development
  node = pkgs.mkShell {
    name = "luci-metabase-node";

    packages = with pkgs; [
      nodejs_20
      nodePackages.npm
      nodePackages.pnpm
      nodePackages.typescript
      nodePackages.typescript-language-server
      nodePackages.eslint
      nodePackages.prettier
      nodePackages.nodemon

      # Testing
      nodePackages.vitest

      # Utilities
      jq
      git
    ];

    shellHook = ''
      echo "Node.js Development Shell"
      echo "========================="
      echo ""
      echo "Commands:"
      echo "  npm run dev        - Development server"
      echo "  npm run build      - Build project"
      echo "  npm test           - Run tests"
      echo "  npm run lint       - Lint code"
      echo ""
      export PATH="$PWD/node_modules/.bin:$PATH"
    '';

    NODE_ENV = "development";
  };

  # Swift development
  swift = pkgs.mkShell {
    name = "luci-metabase-swift";

    packages = with pkgs; [
      # Note: Swift is not well-supported in nixpkgs
      # Use swiftly for Swift installation
      gnumake
      git
      curl

      # For static builds
      musl
    ];

    shellHook = ''
      echo "Swift Development Shell"
      echo "======================="
      echo ""
      echo "Swift is not available via Nix. Install via swiftly:"
      echo ""
      echo "  ./scripts/setup-toolchain.sh"
      echo ""
      echo "Or manually:"
      echo "  curl -L https://swiftlang.github.io/swiftly/swiftly-install.sh | bash"
      echo "  swiftly install latest"
      echo ""
      echo "Build commands:"
      echo "  make swift-build              - Dynamic build"
      echo "  make swift-build-static       - Static x86_64"
      echo "  make swift-build-static-arm64 - Static ARM64"
      echo ""

      # Check if swift is available
      if command -v swift &> /dev/null; then
        echo "Swift version: $(swift --version | head -1)"
      fi
    '';
  };

  # Operations tools (Terraform, Ansible, K8s)
  ops = pkgs.mkShell {
    name = "luci-metabase-ops";

    packages = with pkgs; [
      # Infrastructure as Code
      terraform
      opentofu
      terraform-docs
      tflint
      terrascan

      # Configuration Management
      ansible
      ansible-lint

      # Container
      podman
      podman-compose
      skopeo
      dive
      crane

      # Kubernetes
      kubectl
      kubernetes-helm
      k9s
      kustomize
      kubectx
      stern

      # Cloud CLIs (optional, uncomment as needed)
      # awscli2
      # google-cloud-sdk
      # azure-cli

      # Security scanning
      trivy
      grype
      syft  # SBOM generator

      # Utilities
      jq
      yq-go
      curl
      git
    ];

    shellHook = ''
      echo "Operations Shell"
      echo "================"
      echo ""
      echo "Infrastructure:"
      echo "  terraform plan/apply"
      echo "  tofu plan/apply"
      echo "  ansible-playbook"
      echo ""
      echo "Containers:"
      echo "  podman build/run"
      echo "  skopeo copy"
      echo "  dive <image>"
      echo ""
      echo "Kubernetes:"
      echo "  kubectl/k9s"
      echo "  helm install/upgrade"
      echo ""
      echo "Security:"
      echo "  trivy image <image>"
      echo "  grype <image>"
      echo "  syft <image> -o spdx-json"
      echo ""
    '';

    # Default kubeconfig location
    KUBECONFIG = "$HOME/.kube/config";
  };

  # CI environment (minimal, fast)
  ci = pkgs.mkShell {
    name = "luci-metabase-ci";

    packages = with pkgs; [
      nodejs_20
      nodePackages.npm
      git
      gnumake
    ];

    shellHook = ''
      export CI=true
      export NODE_ENV=test
    '';
  };
}
