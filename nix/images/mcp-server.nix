# MCP Server OCI Image
# Minimal container for the TypeScript MCP server
{ pkgs, lib, mcp-server, version ? "1.0.1" }:

pkgs.dockerTools.buildLayeredImage {
  name = "ghcr.io/luci-digital/luci-metabase-mcp";
  tag = version;

  # Layer optimization
  maxLayers = 120;

  contents = [
    mcp-server
    pkgs.nodejs_20
    pkgs.cacert
    pkgs.tzdata
  ];

  # Extra commands to run in fakeRootCommands
  fakeRootCommands = ''
    mkdir -p /tmp /var/log /data
    chmod 1777 /tmp
  '';

  config = {
    Entrypoint = [ "${mcp-server}/bin/luci-metabase-mcp" ];

    Env = [
      "NODE_ENV=production"
      "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
      "TZDIR=${pkgs.tzdata}/share/zoneinfo"
      "TZ=UTC"
    ];

    ExposedPorts = {
      "3000/tcp" = {};
    };

    Labels = {
      "org.opencontainers.image.title" = "Luci Metabase MCP";
      "org.opencontainers.image.description" = "MCP server for Metabase analytics";
      "org.opencontainers.image.version" = version;
      "org.opencontainers.image.source" = "https://github.com/luci-digital/luci-metabase-mcp";
      "org.opencontainers.image.licenses" = "MIT";
    };

    # Health check
    Healthcheck = {
      Test = [ "CMD" "node" "-e" "process.exit(0)" ];
      Interval = 30000000000;  # 30s in nanoseconds
      Timeout = 5000000000;    # 5s
      Retries = 3;
    };

    # Security
    User = "nobody:nogroup";

    WorkingDir = "/data";

    Volumes = {
      "/data" = {};
    };
  };
}
