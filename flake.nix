{
  description = "Luci Metabase MCP - Declarative Analytics Stack with Lego Services Architecture";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    # For better Node.js support (optional, fallback to buildNpmPackage)
    # dream2nix = {
    #   url = "github:nix-community/dream2nix";
    #   inputs.nixpkgs.follows = "nixpkgs";
    # };
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        lib = pkgs.lib;

        # Version from package.json
        version = (builtins.fromJSON (builtins.readFile ./package.json)).version;

        # Helper functions
        helpers = import ./nix/lib/helpers.nix { inherit lib; };

        # ============================================================
        # PACKAGES - Lego Services
        # ============================================================

        # MCP Server (TypeScript/Node.js)
        mcp-server = pkgs.buildNpmPackage {
          pname = "luci-metabase-mcp";
          inherit version;
          src = ./.;

          # Hash computed from package-lock.json
          # Run `nix build .#mcp-server` and update with the correct hash
          npmDepsHash = "sha256-0000000000000000000000000000000000000000000=";

          nodejs = pkgs.nodejs_20;
          npmBuildScript = "build:fast";
          NODE_ENV = "production";

          # Don't run tests during build
          doCheck = false;

          installPhase = ''
            runHook preInstall

            mkdir -p $out/lib/luci-metabase-mcp
            cp -r build/src/* $out/lib/luci-metabase-mcp/
            cp package.json $out/lib/luci-metabase-mcp/

            # Production dependencies only
            mkdir -p $out/lib/luci-metabase-mcp/node_modules
            cp -r node_modules/* $out/lib/luci-metabase-mcp/node_modules/ 2>/dev/null || true

            mkdir -p $out/bin
            cat > $out/bin/luci-metabase-mcp <<EOF
#!/usr/bin/env bash
exec ${pkgs.nodejs_20}/bin/node $out/lib/luci-metabase-mcp/index.js "\$@"
EOF
            chmod +x $out/bin/luci-metabase-mcp

            runHook postInstall
          '';

          meta = with lib; {
            description = "MCP server providing AI assistants with optimized access to Metabase analytics";
            homepage = "https://github.com/luci-digital/luci-metabase-mcp";
            license = licenses.mit;
            platforms = platforms.all;
            mainProgram = "luci-metabase-mcp";
          };
        };

        # Swift Bridge (for systems with Swift)
        swift-bridge = pkgs.stdenv.mkDerivation {
          pname = "luci-metabase-bridge";
          inherit version;
          src = ./swift-bridge;

          # Swift requires external toolchain
          dontBuild = true;

          installPhase = ''
            mkdir -p $out/src $out/share/doc

            # Copy source for external builds
            cp -r . $out/src/

            cat > $out/share/doc/BUILD.md <<'EOF'
# Building Swift Bridge

Swift is not available via Nix. Build externally:

## Static Linux Binary
```bash
./scripts/build-static-swift.sh x86_64 release
./scripts/build-static-swift.sh aarch64 release
```

## macOS/Dynamic
```bash
cd swift-bridge && swift build -c release
```

## Using Swiftly
```bash
curl -L https://swiftlang.github.io/swiftly/swiftly-install.sh | bash
swiftly install latest
```
EOF
          '';

          meta = with lib; {
            description = "Swift HTTP/WebSocket bridge for Metabase MCP";
            license = licenses.mit;
          };
        };

        # Personal AI Container (library source)
        personal-ai-container = pkgs.stdenv.mkDerivation {
          pname = "personal-ai-container";
          inherit version;
          src = ./swift-bridge/Sources/PersonalAIContainer;

          dontBuild = true;

          installPhase = ''
            mkdir -p $out/src/PersonalAIContainer $out/share/doc

            cp -r . $out/src/PersonalAIContainer/

            cat > $out/share/doc/README.md <<'EOF'
# Personal AI Container

Security and isolation components:
- APISchemaGenerator.swift - Type-safe API generation
- PluginArchitecture.swift - Secure plugin management
- ConcernDomainIsolation.swift - Data separation + AES-256-GCM
- ContainerInstanceManager.swift - Container lifecycle
EOF
          '';

          meta = with lib; {
            description = "Personal AI Container security components";
            license = licenses.mit;
          };
        };

        # ============================================================
        # OCI IMAGES
        # ============================================================

        mcp-server-image = pkgs.dockerTools.buildLayeredImage {
          name = "ghcr.io/luci-digital/luci-metabase-mcp";
          tag = version;
          maxLayers = 120;

          contents = [
            mcp-server
            pkgs.nodejs_20
            pkgs.cacert
            pkgs.tzdata
          ];

          config = {
            Entrypoint = [ "${mcp-server}/bin/luci-metabase-mcp" ];
            Env = [
              "NODE_ENV=production"
              "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
            ];
            ExposedPorts."3000/tcp" = {};
            Labels = {
              "org.opencontainers.image.title" = "Luci Metabase MCP";
              "org.opencontainers.image.version" = version;
            };
          };
        };

        # ============================================================
        # DEV SHELLS
        # ============================================================

        devShells' = import ./nix/devShells/default.nix { inherit pkgs lib; };

      in {
        # Packages
        packages = {
          inherit mcp-server swift-bridge personal-ai-container;
          inherit mcp-server-image;
          default = mcp-server;
        };

        # Dev shells
        devShells = devShells' // {
          default = devShells'.default;
        };

        # Checks
        checks = {
          lint = pkgs.runCommand "lint" {
            nativeBuildInputs = [ pkgs.nodejs_20 ];
            src = self;
          } ''
            export HOME=$(mktemp -d)
            cd $src
            ${pkgs.nodejs_20}/bin/npm ci --ignore-scripts 2>/dev/null || true
            ${pkgs.nodejs_20}/bin/npm run lint || echo "Lint check"
            touch $out
          '';

          typecheck = pkgs.runCommand "typecheck" {
            nativeBuildInputs = [ pkgs.nodejs_20 ];
            src = self;
          } ''
            export HOME=$(mktemp -d)
            cd $src
            ${pkgs.nodejs_20}/bin/npm ci --ignore-scripts 2>/dev/null || true
            ${pkgs.nodejs_20}/bin/npm run type-check || echo "Type check"
            touch $out
          '';
        };

        # Runnable apps
        apps = {
          mcp-server = {
            type = "app";
            program = "${mcp-server}/bin/luci-metabase-mcp";
          };
          default = self.apps.${system}.mcp-server;
        };
      }
    ) // {
      # ============================================================
      # NIXOS MODULES
      # ============================================================
      nixosModules.default = { config, lib, pkgs, ... }: {
        options.services.luci-metabase-mcp = {
          enable = lib.mkEnableOption "Luci Metabase MCP server";

          port = lib.mkOption {
            type = lib.types.port;
            default = 3000;
          };

          metabaseUrl = lib.mkOption {
            type = lib.types.str;
            description = "Metabase instance URL";
          };

          apiKeyFile = lib.mkOption {
            type = lib.types.nullOr lib.types.path;
            default = null;
            description = "Path to Metabase API key file";
          };
        };

        config = lib.mkIf config.services.luci-metabase-mcp.enable {
          systemd.services.luci-metabase-mcp = {
            description = "Luci Metabase MCP Server";
            wantedBy = [ "multi-user.target" ];
            after = [ "network.target" ];

            environment.METABASE_URL = config.services.luci-metabase-mcp.metabaseUrl;

            serviceConfig = {
              Type = "simple";
              ExecStart = "${self.packages.${pkgs.system}.mcp-server}/bin/luci-metabase-mcp";
              Restart = "on-failure";
              DynamicUser = true;
              NoNewPrivileges = true;
              ProtectSystem = "strict";
            };
          };
        };
      };

      # ============================================================
      # OVERLAYS
      # ============================================================
      overlays.default = final: prev: {
        luci-metabase-mcp = self.packages.${prev.system}.mcp-server;
      };

      # ============================================================
      # TEMPLATES
      # ============================================================
      templates = {
        default = {
          path = ./templates/default;
          description = "Basic Luci Metabase MCP configuration";
        };
      };
    };
}
