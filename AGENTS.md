Project workflows live in @mise.toml. Prefer `mise run ...` tasks over ad hoc package commands.

If you do not commit a set of changes, use 'localci wait --no-clone' to run all tests and static analysis.

Run 'mise tasks lint' to see all tasks. Tasks with :fix suffixes will write fixes.

packages/ contains logic
apps/ contains applications of the packages

This is a bun project. NEVER invoke node or npm.

Backward compatibility is NOT a concern. If you add any code for "backward compatibility," REMOVE IT IMMEDIATELY.

Read @design_principles.md

Use nanostore atoms to store application state over class properties where appropriate. Use re:dom component idioms rather than manual mount/unmount.
