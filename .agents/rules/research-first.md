# Mandatory Research Before Development

**CRITICAL RULE:** Before creating any new features, pages, or overriding existing systems (especially Admin UIs or core components), the Agent MUST aggressively research the existing codebase.

1. **Check for Existing Implementations**: Use `grep_search`, `list_dir`, and `view_file` to search for similar filenames, existing API routes, or related keywords before writing new files.
2. **Never Blindly Overwrite**: If asked to create a new page or feature, verify if that route or component already exists. If it exists, read the entire file first and *integrate* with it rather than overwriting it with a basic implementation.
3. **Respect Existing Architecture**: The project has complex UI components (e.g. `FontRegistryService`, dual-action Gallery flows). Do not replace complex implementations with simple HTML tables or generic solutions unless explicitly asked.
4. **When in doubt, Ask**: If you find an existing implementation that conflicts with the user's prompt, clarify with the user before proceeding.
