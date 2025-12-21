# CI/CD Checks
# Validation checks for linting, testing, security, and SBOM generation
{ pkgs, lib, self }:

{
  # ESLint check
  lint = pkgs.runCommand "lint-check" {
    nativeBuildInputs = [ pkgs.nodejs_20 pkgs.nodePackages.npm ];
    src = self;
  } ''
    export HOME=$(mktemp -d)
    cd $src
    npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
    npm run lint
    touch $out
  '';

  # TypeScript type checking
  typecheck = pkgs.runCommand "typecheck" {
    nativeBuildInputs = [ pkgs.nodejs_20 pkgs.nodePackages.npm ];
    src = self;
  } ''
    export HOME=$(mktemp -d)
    cd $src
    npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
    npm run type-check
    touch $out
  '';

  # Prettier format check
  format = pkgs.runCommand "format-check" {
    nativeBuildInputs = [ pkgs.nodejs_20 pkgs.nodePackages.npm ];
    src = self;
  } ''
    export HOME=$(mktemp -d)
    cd $src
    npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
    npm run format:check
    touch $out
  '';

  # Unit tests
  test = pkgs.runCommand "test" {
    nativeBuildInputs = [ pkgs.nodejs_20 pkgs.nodePackages.npm ];
    src = self;
  } ''
    export HOME=$(mktemp -d)
    cd $src
    npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
    npm test
    touch $out
  '';

  # Test coverage (80% threshold)
  test-coverage = pkgs.runCommand "test-coverage" {
    nativeBuildInputs = [ pkgs.nodejs_20 pkgs.nodePackages.npm ];
    src = self;
  } ''
    export HOME=$(mktemp -d)
    cd $src
    npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
    npm run test:coverage
    touch $out
  '';

  # Build validation
  build = pkgs.runCommand "build-check" {
    nativeBuildInputs = [ pkgs.nodejs_20 pkgs.nodePackages.npm ];
    src = self;
  } ''
    export HOME=$(mktemp -d)
    cd $src
    npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
    npm run build
    touch $out
  '';

  # Security audit (npm)
  security-audit = pkgs.runCommand "security-audit" {
    nativeBuildInputs = [ pkgs.nodejs_20 pkgs.nodePackages.npm ];
    src = self;
  } ''
    export HOME=$(mktemp -d)
    cd $src
    npm audit --audit-level=high || echo "Audit warnings (non-blocking)"
    touch $out
  '';

  # SBOM generation check
  sbom = pkgs.runCommand "sbom-check" {
    nativeBuildInputs = [ pkgs.syft ];
    src = self;
  } ''
    mkdir -p $out
    cd $src

    # Generate SBOM in multiple formats
    syft dir:. -o spdx-json > $out/sbom-spdx.json
    syft dir:. -o cyclonedx-json > $out/sbom-cyclonedx.json
    syft dir:. -o table > $out/sbom-table.txt

    echo "SBOM generated successfully"
    echo "Files:"
    ls -la $out/
  '';

  # Terraform validation (if terraform files exist)
  terraform-validate = pkgs.runCommand "terraform-validate" {
    nativeBuildInputs = [ pkgs.terraform ];
    src = self;
  } ''
    cd $src
    if [ -d terraform ]; then
      cd terraform
      terraform init -backend=false
      terraform validate
    fi
    touch $out
  '';

  # Ansible syntax check (if ansible files exist)
  ansible-syntax = pkgs.runCommand "ansible-syntax" {
    nativeBuildInputs = [ pkgs.ansible pkgs.ansible-lint ];
    src = self;
  } ''
    cd $src
    if [ -d ansible ]; then
      cd ansible
      ansible-lint . || echo "Ansible lint warnings (non-blocking)"
    fi
    touch $out
  '';

  # Dockerfile/Containerfile lint
  container-lint = pkgs.runCommand "container-lint" {
    nativeBuildInputs = [ pkgs.hadolint ];
    src = self;
  } ''
    cd $src
    find . -name "Dockerfile*" -o -name "Containerfile*" | while read f; do
      echo "Linting: $f"
      hadolint "$f" || echo "Warning in $f (non-blocking)"
    done
    touch $out
  '';
}
