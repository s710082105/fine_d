# sync-publish

Publish local changes to runtime targets by current sync profile.

## Required Behavior

- Respect `protocol`, `delete_propagation`, and `auto_sync_on_change`.
- Apply source-to-target mappings exactly.
- Expose sync errors without fallback.
