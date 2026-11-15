---
name: research-first
description: >-
  Always trigger this skill before executing any new feature development, page creation, or system override.
  It forces a mandatory architectural audit of existing components to prevent destructive overwrites.
---

# Pre-Development Research Protocol

Before writing any new code, you must execute the following checklist to ensure you are integrating with the system rather than destroying existing work:

1. **Check for Existing Files**: 
   Use `grep_search` and `list_dir` to look for existing files matching the target feature. For example, if asked to build an Admin Fonts page, first check if `src/app/admin/fonts` already exists.

2. **Read Before You Write**:
   If a file already exists at your target path, you MUST use `view_file` to read the entire file before modifying it. Do not use `write_to_file` to overwrite an existing file with a basic placeholder implementation.

3. **Identify Integration Points**:
   Check if the project uses established services (e.g., `FontRegistryService`) or specific UI patterns (e.g., `StitchUI` guidelines). Your new code must adapt to these existing structures.

4. **Confirm with the User**:
   If the user's prompt asks you to build a generic version of a feature that already has a complex, bespoke implementation, you must ask for clarification before proceeding to overwrite it.
