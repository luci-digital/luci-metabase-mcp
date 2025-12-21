{
  description = "My Luci Metabase MCP Configuration";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    luci-metabase-mcp.url = "github:luci-digital/luci-metabase-mcp";
  };

  outputs = { self, nixpkgs, luci-metabase-mcp, ... }:
    let
      system = "x86_64-linux";  # Change for your system
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      # Development shell with all tools
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          luci-metabase-mcp.packages.${system}.mcp-server
        ];
      };

      # NixOS configuration (if using NixOS)
      nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          luci-metabase-mcp.nixosModules.default
          {
            services.luci-metabase-mcp = {
              enable = true;
              metabaseUrl = "http://localhost:3000";
              # apiKeyFile = /run/secrets/metabase-api-key;
            };
          }
        ];
      };
    };
}
