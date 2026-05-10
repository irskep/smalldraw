Read @mise.toml to understand basic project workflows.

packages/ contains logic
apps/ contains applications of the packages

This is a bun project. NEVER invoke node or npm.

Backward compatibility is NOT a concern. If you add any code for "backward compatibility," REMOVE IT IMMEDIATELY.

Read @design_principles.md

Use nanostore atoms to store application state over class properties where appropriate. Use re:dom component idioms rather than manual mount/unmount.