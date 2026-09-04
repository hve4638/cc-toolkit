---
name: env_var_guard
---
When a shell command references an environment variable, expand it as `${VAR:?}` (or `${VAR:?message}`) so the command fails instead of silently running with an empty string. This protects against the case where an earlier `export` failed or never ran.
