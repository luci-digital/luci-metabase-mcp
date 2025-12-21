# Personal AI Container Package
# Security, isolation, and container management components
{ pkgs, lib, version ? "1.0.1", src }:

pkgs.stdenv.mkDerivation {
  pname = "personal-ai-container";
  inherit version;
  src = "${src}/swift-bridge/Sources/PersonalAIContainer";

  # This is a Swift library, not a standalone executable
  # It's compiled as part of swift-bridge

  dontBuild = true;

  installPhase = ''
    mkdir -p $out/src/PersonalAIContainer
    mkdir -p $out/share/doc

    # Copy Swift source files
    cp -r . $out/src/PersonalAIContainer/

    # Generate documentation
    cat > $out/share/doc/README.md <<'EOF'
# Personal AI Container

Security and isolation components for the Luci Metabase MCP system.

## Components

### APISchemaGenerator.swift
Type-safe API schema generation for secure, validated endpoints.

### PluginArchitecture.swift
Secure plugin management with validation and sandboxing.

### ConcernDomainIsolation.swift
Data separation and AES-256-GCM encryption for privacy boundaries.

### ContainerInstanceManager.swift
Container lifecycle management with resource controls.

## Security Features

- Carbon-based security model (biometric auth support)
- Agent domain management with capability isolation
- Concern domain isolation with encryption
- Secure plugin validation

## Integration

This library is compiled into the swift-bridge executable.
Import in Swift:

```swift
import PersonalAIContainer
```
EOF

    # Create component manifest
    cat > $out/share/doc/COMPONENTS.json <<'EOF'
{
  "name": "personal-ai-container",
  "version": "${version}",
  "components": [
    {
      "name": "APISchemaGenerator",
      "type": "library",
      "purpose": "Type-safe API schema generation"
    },
    {
      "name": "PluginArchitecture",
      "type": "library",
      "purpose": "Secure plugin management"
    },
    {
      "name": "ConcernDomainIsolation",
      "type": "library",
      "purpose": "Data separation and encryption"
    },
    {
      "name": "ContainerInstanceManager",
      "type": "library",
      "purpose": "Container lifecycle management"
    }
  ],
  "security": {
    "encryption": "AES-256-GCM",
    "authentication": "carbon-based",
    "isolation": "concern-domain"
  }
}
EOF
  '';

  # Metadata
  meta = with lib; {
    description = "Personal AI Container security and isolation components";
    homepage = "https://github.com/luci-digital/luci-metabase-mcp";
    license = licenses.mit;
    platforms = platforms.all;
  };
}
