#!/usr/bin/env bash
# Upload the SOTC disc image to Cloudflare R2.
#
# Prerequisites:
#   - Cloudflare account + R2 enabled
#   - wrangler CLI:  npm i -g wrangler  (or use npx)
#   - wrangler login
#
# Usage:
#   R2_BUCKET=my-bucket ./upload-iso-r2.sh
#   # optional: R2_KEY=shadow-of-the-colossus/disc.iso
set -euo pipefail

BUCKET="${R2_BUCKET:?set R2_BUCKET to your R2 bucket name}"
KEY="${R2_KEY:-shadow-of-the-colossus/disc.iso}"
FILE="${1:-disc.iso}"

if [ ! -f "$FILE" ]; then
  echo "disc image not found: $FILE" >&2
  exit 1
fi

echo "Uploading $FILE -> r2://$BUCKET/$KEY"
npx wrangler r2 object put "$BUCKET/$KEY" --file="$FILE"
echo "Done. Public URL (r2.dev): https://pub-<ACCOUNT>.r2.dev/$KEY"
echo "Set SOTC_DISC_URL in Vercel to that public URL."
