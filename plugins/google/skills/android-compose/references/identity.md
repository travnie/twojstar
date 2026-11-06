# Credential Manager identity

## Restore credentials
Preserve primary authentication and `allowBackup`; restore keys are separate from user-managed passkeys.

- Verify current Credential Manager/GMS/platform requirements (reviewed baseline: API 28+, credentials 1.5+, GMS 24220000+). Reuse the relying-party server's WebAuthn registration/authentication with distinct restore-key records.
- Create a restore key after sign-in/sign-up and for already signed-in users lacking one. Track successful creation per account; reset tracking on sign-out/account changes. Try cloud backup, then retry locally only for `E2eeUnavailableException`.
- Request `GetRestoreCredentialOption` alone, expect `RestoreCredential`, and send its response to the server for verification before establishing a session.
- With `allowBackup=true`, integrate background retrieval into `BackupAgent.onRestoreFinished()` plus a first-launch foreground fallback. Complete required restore work within the callback contract with bounded operations; avoid fire-and-forget work or blocking the Activity main thread. If adding a new BackupAgent, preserve full backup with `fullBackupOnly=true`; do not overwrite an existing agent's backup strategy.
- With backup disabled, use foreground fallback only. Do not change `allowBackup` to enable this feature. Prevent overlapping tiers from signing in twice. Refresh notification registration if relevant.
- On sign-out or confirmed server-side invalidation, explicitly clear `TYPE_CLEAR_RESTORE_CREDENTIAL` and retain existing non-restore clear calls. Do not treat every transient network failure as invalidation.
- Test E2EE unavailable, missing keys, restore interruption, foreground retry, sign-out and account switching. Distinguish client completion from unavailable backend work.

## Verified email / digital credentials
Discover sign-up/recovery/reauth entry points. Verify current provider, API and Play services support (reviewed baseline API 28+, GMS 25.49.x). Keep fallback verification for unsupported accounts/devices and cancellation.

Use `GetDigitalCredentialOption` with the provider's current OpenID4VP request/DCQL schema, minimal necessary visible claims, and a fresh server-bound challenge. Hidden-only claims can cause cancellation. Check the returned credential type. Current response format uses `protocol` and `data.vp_token`; handle older wrappers only when maintaining an actual existing integration.

Client parsing is display-only, never proof of identity. Send the complete response to a server verifier that checks trusted issuer/JWKS, signature, disclosures, expiry, key binding, audience and single-use nonce/session binding. Do not sign in, create an account or enable privileged navigation before server success; never ship a TODO verifier that grants access. Do not log tokens or personal claims.

Check provider limitations and freshness: non-Gmail addresses may need an additional challenge; do not assume Workspace support. Offer passkey enrollment after verified account establishment when in scope. For WebView handoff, verify trusted origins and bridge boundaries against official Credential Manager guidance.

Source (reviewed snapshot): https://github.com/android/skills/tree/6daa53ef27fa2aa87827d183a85c06cedceca833/identity
