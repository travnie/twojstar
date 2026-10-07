# Terminal, files and running processes

Select the host shell from `get_config`, not from the agent's OS. One-shot commands may finish inside `start_process`; long-running jobs return a handle for `read_process_output` and `interact_with_process`. A persistent Python/Node REPL or SSH connection retains state **within that one session**. `node:local`, if supported by the live server, runs each snippet independently; do not assume REPL persistence there.

Use `list_directory` and `get_file_info` for navigation, `start_search` for names/content, `get_more_search_results` until enough matches are seen, and bounded `read_file`/`read_multiple_files` for context. Search before a broad rename or edit; use exact `old_string` plus `expected_replacements` for `edit_block`. Inspect the changed region and re-search old names when a refactor spans files.

For a dev server: start it once, keep its returned handle, edit code, inspect reload output, run focused checks, and close the session at the end when it should not remain active. For an occupied port, identify the owning process before stopping it. `kill_process` addresses an arbitrary OS PID; `force_terminate` closes a Desktop Commander session.

For structured documents, follow the exposed `read_file`/`edit_block`/`write_pdf` schemas. Excel uses sheet/range data; Word may require an outline read followed by an XML slice for exact edits; PDF operations can produce a new output file. Do not pretend a simple string rewrite preserves document layout. Render or preview the result when layout matters.

For large CSV/JSON, prefer a persistent REPL to load the file once, then run several queries without re-reading it. Bound outputs and avoid printing full datasets. For remote SSH, identify the host and environment before altering it; keep secrets out of command text and logs.

If the user asks to continue an earlier Desktop Commander session, inspect bounded recent tool calls and existing sessions, then confirm the file/process state before making assumptions. When a tool rejects a path or command, report the real restriction; do not sidestep it with a different tool.
