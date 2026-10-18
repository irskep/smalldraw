Project workflows live in @mise.toml. Prefer `mise run ...` tasks over ad hoc package commands.

Local dev is orchestrated with Tilt. Assume `tilt up` may already be running; use `tilt logs` and inspect @Tiltfile before making assumptions about which services run or which ports they use.

If you do not commit a set of changes, use 'localci wait --no-clone' to run all tests and static analysis.

Run 'mise tasks lint' to see all tasks. Tasks with :fix suffixes will write fixes.

packages/ contains logic
apps/ contains applications of the packages

This is a bun project. NEVER invoke node or npm.

Backward compatibility is NOT a concern. If you add any code for "backward compatibility," REMOVE IT IMMEDIATELY.

Read @design_principles.md

Use nanostore atoms to store application state over class properties where appropriate. Use re:dom component idioms rather than manual mount/unmount.

Commit frequently, because the postcommit hook makes localci run comprehensive checks asynchronously. The postcommit hook will print basic instructions for seeing results, or you can run localci --help to see more options.

## Visual design and styling

Splatterboard should feel like a welcoming art table for kids and families. Use warm paper surfaces, clear dark ink, and a small number of lively accents. Let drawings and useful tool previews supply most of the personality. Keep the drawing canvas visually quiet and the controls easy to recognize.

- Explain the product through a clear headline, a short description, and an authentic example made with the app. Give the landing page one prominent start-drawing action. Place parent-facing storage and sharing details after the introduction; keep existing drawings easy to reach for returning users.
- Use the shared components and tokens in `packages/design-system`. Keep reusable control styling there and page-specific composition in the app. Define reusable visual decisions as tokens instead of accumulating local overrides or hard-coded values.
- Use a fixed UI palette: warm neutrals, dark ink, one primary action accent, and at most two supporting accents. Preserve distinct semantic colors for errors and other status feedback. Artwork and drawing color pickers are exempt from this palette limit. Choose exact colors together when implementing a visual direction and reuse them consistently.
- Keep the existing handwritten Shantell Sans for the brand and occasional short display headings; use the shared sans-serif for body copy and controls. Use the existing type and spacing scales. Establish hierarchy with size, weight, and spacing rather than adding fonts.
- Use one consistent control shape and treatment across buttons, pickers, and menus, with variants for function and size. Keep borders and shadows restrained and purposeful: distinguish controls, paper, and overlays. Avoid one-off pill shapes, heavy shadows, gradients, glass effects, and decorative card wrappers.
- Concentrate illustration and doodles in deliberate areas such as the landing-page example or an empty state. Favor cheerful, imperfect artwork that demonstrates actual app capabilities. Keep decoration out of text, interactive hit areas, and the drawing canvas. Do not add mascots, textures, or ornamental flourishes without a task that calls for them.
- Make tools understandable through recognizable icons, short labels, and actual color or stroke previews where useful. Keep selected, hover, focus, and disabled states distinct; never rely on color alone. Preserve visible keyboard focus, readable contrast, and generous touch targets (aim for at least 44 by 44 CSS pixels for primary drawing controls).
- Use motion only for interaction feedback or an intentional product demonstration. Respect reduced-motion preferences. Avoid idle bouncing, looping decoration, confetti, and animated backgrounds.
- Keep copy short, concrete, and welcoming. Avoid baby talk, forced enthusiasm, and technical implementation details in the drawing flow.
- Keep visual changes within the requested scope. A landing-page redesign does not imply an editor redesign or a global theme change. Extend these rules deliberately when a task requires a new pattern rather than inventing a separate visual system for each screen.
- For visual changes, inspect the running app through Tilt and Rodney at desktop and narrow/mobile sizes. Check the relevant empty and populated states, text wrapping, focus visibility, and touch usability. Review the actual rendered result before calling the change complete.
