

# Caching Mechanism for Pass Image OCR

## Problem
Every time a user uploads a monthly pass image, the system calls the `enhance-pass` edge function (Gemini AI) for OCR extraction -- even if the user re-uploads the exact same image. This wastes AI credits and makes the user wait unnecessarily.

## Solution
Add a file fingerprint (hash) based caching system. Before calling the AI, compare the new file's hash with the previously processed file's hash. If they match, reuse the already-extracted pass ID and expiry date from the database.

## How It Works

1. When a user selects a monthly pass image, compute a SHA-256 hash of the file contents on the client side.
2. Store the hash in the `passes` table (new column: `file_hash`).
3. Before invoking the `enhance-pass` edge function, check if the existing pass record has a matching `file_hash`.
4. If the hash matches, skip the AI call entirely and show the previously extracted data.
5. If the hash differs (new/different image), proceed with upload and AI extraction as normal.

## Technical Details

### 1. Database Migration
Add a `file_hash` column to the `passes` table:
```sql
ALTER TABLE public.passes ADD COLUMN file_hash text;
```

### 2. Client-Side Changes (src/pages/EPass.tsx)

**New helper function** -- `computeFileHash`:
- Reads the file as an ArrayBuffer
- Uses the browser's `crypto.subtle.digest('SHA-256', ...)` API to compute a hash
- Returns the hash as a hex string

**Modified `handleMonthlyPassUpload` flow**:
1. Compute hash of the selected file (after HEIC conversion if applicable)
2. Compare against `pass?.file_hash`
3. If match: skip upload and AI call, populate verification dialog with existing `pass.buss_pass_id` and `pass.expiry_date`, show toast "Using cached data"
4. If no match: proceed with normal upload + AI extraction flow
5. After successful extraction, save the hash to the `passes` table alongside other data

**Modified `handleVerificationConfirm`**:
- Include the computed `file_hash` in the pass data saved to the database

### 3. Edge Function (No Changes Needed)
The `enhance-pass` function remains unchanged -- the caching is handled entirely on the client side before the function is ever called.

## User Experience
- If uploading the same image again: instant result (under 1 second), no AI credits used
- If uploading a different image: normal flow with AI extraction
- A toast message will indicate when cached data is being used vs. fresh extraction
