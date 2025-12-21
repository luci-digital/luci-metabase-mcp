# Swift Bridge OCI Image
# Minimal container for the Swift HTTP/WebSocket bridge
{ pkgs, lib, swift-bridge, version ? "1.0.1" }:

pkgs.dockerTools.buildLayeredImage {
  name = "ghcr.io/luci-digital/luci-metabase-bridge";
  tag = version;

  maxLayers = 80;

  contents = [
    swift-bridge
    pkgs.cacert
    pkgs.tzdata
  ];

  fakeRootCommands = ''
    mkdir -p /tmp /var/log /data
    chmod 1777 /tmp
  '';

  config = {
    Entrypoint = [ "${swift-bridge}/bin/luci-metabase-bridge" ];
    Cmd = [ "--host" "0.0.0.0" "--port" "8001" ];

    Env = [
      "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
      "TZDIR=${pkgs.tzdata}/share/zoneinfo"
      "TZ=UTC"
    ];

    ExposedPorts = {
      "8001/tcp" = {};
    };

    Labels = {
      "org.opencontainers.image.title" = "Luci Metabase Bridge";
      "org.opencontainers.image.description" = "Swift HTTP/WebSocket bridge for Metabase MCP";
      "org.opencontainers.image.version" = version;
      "org.opencontainers.image.source" = "https://github.com/luci-digital/luci-metabase-mcp";
      "org.opencontainers.image.licenses" = "MIT";
    };

    User = "nobody:nogroup";
    WorkingDir = "/data";

    Volumes = {
      "/data" = {};
    };
  };
}
