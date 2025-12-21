# Helper functions for the Nix flake
{ lib }:

{
  # Read version from package.json
  readVersion = src:
    let
      packageJson = builtins.fromJSON (builtins.readFile "${src}/package.json");
    in
      packageJson.version or "0.0.0";

  # Create a script that runs multiple services
  makeServiceRunner = { pkgs, services }:
    pkgs.writeShellScriptBin "run-services" ''
      #!/usr/bin/env bash
      set -euo pipefail

      trap 'kill $(jobs -p) 2>/dev/null' EXIT

      ${lib.concatMapStringsSep "\n" (svc: ''
        echo "Starting ${svc.name}..."
        ${svc.command} &
      '') services}

      echo "All services started. Press Ctrl+C to stop."
      wait
    '';

  # Generate environment file from Nix attrset
  makeEnvFile = { name, vars }:
    let
      content = lib.concatMapStringsSep "\n"
        (k: "${k}=${builtins.toString vars.${k}}")
        (builtins.attrNames vars);
    in
      pkgs.writeTextFile {
        inherit name;
        text = content;
      };

  # Create a wrapper that sets environment variables
  wrapWithEnv = { pkgs, drv, env }:
    pkgs.runCommand "${drv.name}-wrapped" {
      nativeBuildInputs = [ pkgs.makeWrapper ];
    } ''
      mkdir -p $out/bin
      for bin in ${drv}/bin/*; do
        makeWrapper "$bin" "$out/bin/$(basename $bin)" \
          ${lib.concatMapStringsSep " " (k: ''--set ${k} "${builtins.toString env.${k}}"'') (builtins.attrNames env)}
      done
    '';

  # Merge multiple dev shells
  mergeShells = shells:
    lib.foldl' (acc: shell: {
      packages = (acc.packages or []) ++ (shell.packages or []);
      shellHook = (acc.shellHook or "") + "\n" + (shell.shellHook or "");
      inputsFrom = (acc.inputsFrom or []) ++ (shell.inputsFrom or []);
    }) {} shells;
}
