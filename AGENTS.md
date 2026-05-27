Project workflows live in @mise.toml. Prefer `mise run ...` tasks over ad hoc package commands.

Validation commands must be non-mutating:
- Use `mise run lint:all`, `mise run format:check`, `mise run ts:check:all`, `mise run test:all`, and package-local `localci:*` tasks for checks.
- `lint` means check only. It must not rewrite files.
- `format:check` means check only. It must not rewrite files.

Mutating cleanup commands are explicit:
- Use `lint:fix`, `format:fix`, or `fix:all` only when intentionally editing code.
- Do not run mutating fix tasks merely to validate work.

packages/ contains logic
apps/ contains applications of the packages

This is a bun project. NEVER invoke node or npm.

Backward compatibility is NOT a concern. If you add any code for "backward compatibility," REMOVE IT IMMEDIATELY.

Read @design_principles.md

Use nanostore atoms to store application state over class properties where appropriate. Use re:dom component idioms rather than manual mount/unmount.
