Read @mise.toml to understand basic project workflows.

packages/ contains logic
apps/ contains applications of the packages

This is a bun project. NEVER invoke node or npm.

Backward compatibility is NOT a concern. If you add any code for "backward compatibility," REMOVE IT IMMEDIATELY.

Always run tests from the package/app directory, not the repo root. Each package has its own `bunfig.toml` with loader configs and test preloads that only apply when `bun test` runs from that directory. Use `mise run //packages/<name>:test` from any directory, or `bun run test` from within the package.

Read @design_principles.md