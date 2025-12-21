# Combined Full-Stack OCI Image
# Contains both MCP server and Swift bridge
{ pkgs, lib, mcp-server, swift-bridge, version ? "1.0.1" }:

pkgs.dockerTools.buildLayeredImage {
  name = "ghcr.io/luci-digital/luci-metabase-mcp-full";
  tag = version;

  maxLayers = 125;

  contents = [
    mcp-server
    swift-bridge
    pkgs.nodejs_20
    pkgs.cacert
    pkgs.tzdata
    pkgs.bash
    pkgs.coreutils
    pkgs.procps      # For process management
    pkgs.su-exec     # For user switching
  ];

  fakeRootCommands = ''
    mkdir -p /tmp /var/log /data /run
    chmod 1777 /tmp
  '';

  config = {
    # Default to MCP server, can be overridden
    Entrypoint = [ "${pkgs.bash}/bin/bash" "-c" ];
    Cmd = [ "${mcp-server}/bin/luci-metabase-mcp" ];

    Env = [
      "NODE_ENV=production"
      "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
      "TZDIR=${pkgs.tzdata}/share/zoneinfo"
      "TZ=UTC"
      "MCP_SERVER_BIN=${mcp-server}/bin/luci-metabase-mcp"
      "SWIFT_BRIDGE_BIN=${swift-bridge}/bin/luci-metabase-bridge"
    ];

    ExposedPorts = {
      "3000/tcp" = {};  # MCP server
      "8001/tcp" = {};  # Swift bridge
    };

    Labels = {
      "org.opencontainers.image.title" = "Luci Metabase MCP Full Stack";
      "org.opencontainers.image.description" = "Complete Metabase MCP with TypeScript server and Swift bridge";
      "org.opencontainers.image.version" = version;
      "org.opencontainers.image.source" = "https://github.com/luci-digital/luci-metabase-mcp";
      "org.opencontainers.image.licenses" = "MIT";
    };

    WorkingDir = "/data";

    Volumes = {
      "/data" = {};
      "/var/log" = {};
    };
  };
}
