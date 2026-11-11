# Changelog

## Unreleased

- Added a maintenance poster that the designated site administrator can turn on or off.
- Stored the maintenance state in Supabase so it persists across visits and deployments.
- Restricted maintenance controls to the email configured in `MAINTENANCE_ADMIN_EMAIL`.
- Added `vercelREADME.md` with deployment and Supabase setup instructions.
- Added private Supabase-backed user profiles with verified account email, editable display names, unique usernames, and biographies.
- Automatically create profile records for new and existing authenticated accounts, with row-level security.
- Added an administrator dashboard that organizes maintenance controls and account shortcuts.
- Allowed visitors to continue to the public game catalog without disabling the maintenance notice for other visitors.
- Kept account creation and sign-in optional for browsing and playing games; session-check errors now offer sign-in instead of blocking navigation.
- Added optional Google OAuth sign-in, configured through Supabase and Google Cloud.
- Added public profile avatars with authenticated owner-only uploads and image type/size validation.
- Prepared local game-progress storage with localStorage for small saves, IndexedDB for larger saves, and a debounced autosave helper for future per-game integration.
