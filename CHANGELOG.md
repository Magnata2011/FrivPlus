# Changelog

## Unreleased

- Added a maintenance poster that the designated site administrator can turn on or off.
- Stored the maintenance state in Supabase so it persists across visits and deployments.
- Restricted maintenance controls to the email configured in `MAINTENANCE_ADMIN_EMAIL`.
- Added `vercelREADME.md` with deployment and Supabase setup instructions.
- Added private Supabase-backed user profiles with verified account email, editable display names, unique usernames, and biographies.
- Automatically create profile records for new and existing authenticated accounts, with row-level security.
