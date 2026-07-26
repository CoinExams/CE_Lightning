# Codebase Rules

## Style & Conventions
- Use backtick template literals for all strings (no single/double quotes)
- Use `const` for all declarations; avoid `let`/`var`
- Chain all `const` declarations into a single statement with comma separators
- Export at declaration site or use `export { ... }` at bottom of file
- Keep lines short and readable; group related logic with blank lines
- Keep code narrow and readable — prefer concise patterns that fit in limited width
- Break lines aggressively so each line is readable on very narrow screens (~30 chars)
  - Split imports across lines: one name per line
  - Break long arg lists, ternaries, and method chains onto separate lines
  - Use chained const with each binding starting on a new line
  - Template literal content (shell scripts, file contents) is exempt
- Use early returns (`if (!x) return;`) over nested braces

## Naming
- `camelCase` for functions, variables, and method names
- `PascalCase` for types, interfaces, enums, and classes
- Prefix internal helpers with descriptive names; keep public API surface minimal
- Error log messages match the function name (e.g. `\`fundsWithdraw failed\``)

## Types
- Define all interfaces/types in `src/code/types.ts`
- Use `interface` over `type` for object shapes
- Use `type` for aliases and unions
- Export types in the bottom `export type { ... }` block

## JSDoc
- Every exported function/variable gets a `/** ... */` comment describing its purpose, parameters, and return value
- Method comments on `LightningClient` interface in `types.ts` serve as the canonical API docs
- Deprecated items get `/** @deprecated Use \`NewName\` instead */`

## Error Handling
- Wrap fallible logic in try/catch
- Log with `console.error(seoDt(), \`<name> failed\`, e)`
- Return `undefined` on failure; never throw
- Check for `undefined` at the call site to detect failures

## Imports
- Group imports: standard lib → third-party → internal modules
- Use named imports only; avoid default imports

## Changes
- Never rename functions under older package version entries in `changes.md`
- Always add new version entry at the top of `changes.md`
- `changes.md` entries describe only user-facing changes — never internal implementation details
- Update `README.md` examples to match current API
- Never stage changes with `git add`; keep all modifications unstaged
- Never run `npm run build` or any build command