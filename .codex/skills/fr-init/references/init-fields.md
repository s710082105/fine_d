# Init Fields

`fr-init` only collects and validates user-provided fields. It does not perform local or remote investigation during initialization.

## Dialogue Rule

- Collect information through natural-language dialogue.
- Do not require confirmation after every answer or every round.
- Collect the required inputs first, then do one final summary confirmation.
- Do not ask the user to manually fill JSON, Python dicts, or code snippets.
- After the final summary is confirmed, run the validator on the confirmed values.
- If validation fails, explain the failed fields and re-ask only those fields in natural language.

## Required Input

- `designer_root`
  - Meaning: FineReport Designer installation root
  - Validation: non-empty, path exists
- `decision_url`
  - Meaning: Decision service base URL
  - Validation: non-empty, must look like `http://` or `https://`
- `username`
  - Meaning: Decision login username
  - Validation: non-empty
- `password`
  - Meaning: Decision login password
  - Validation: non-empty
- `workspace_root`
  - Meaning: local project root for the current task
  - Validation: non-empty, path exists

## Derived Or Defaulted Fields

- `project_name`
  - Source: derive from `workspace_root` directory name by default
  - Override: user may provide it explicitly
- `remote_root`
  - Source: default to `reportlets`
  - Override: user may provide it explicitly, but it must stay under `reportlets`
- `task_type`
  - Source: default to `未指定`
  - Override: user may provide it explicitly

## Existing Config Rule

- If `.codex/fr-config.json` already exists, ask whether it should be regenerated.
- User answers `否`: stop and keep the existing config.
- User answers `是`: continue and overwrite the init outputs.

## Output Rule

Each field must be marked as `passed`, `failed`, or `pending review`.

## Post-confirmation Validation

After the user confirms all fields, test the accuracy of the filled information with these checks:

- `designer_root`: local path exists
- `decision_url`: URL format is valid
- `username`: non-empty
- `password`: non-empty
- `workspace_root`: local path exists
- `project_name`: use explicit value or derive from `workspace_root`
- `remote_root`: use explicit value or default to `reportlets`, and the final path must stay under `reportlets`
- `task_type`: use explicit value or default to `未指定`

These checks validate user-provided values after confirmation. They do not replace later environment probing.

After all required fields pass:

- Write or update `.codex/fr-config.json`
- Refresh the init artifacts under `.codex/`
- Route the next step to `fr-status-check`

The following items are explicitly out of scope for `fr-init` and must be deferred to `fr-status-check` or later skills:

- Decision login and token acquisition
- datasource / dataset / SQL probing
- remote `reportlets` listing
- local template inspection
- bridge runtime verification
