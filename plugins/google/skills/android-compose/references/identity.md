# Credential Manager identity

## Restore credentials
Preserve primary authentication and `allowBackup`; restore keys are separate from user-managed passkeys.

- Verify current [Restore Credentials requirements](https://developer.android.com/identity/sign-in/restore-credentials); handle missing/outdated GMS provider configuration errors with standard sign-in. Reuse the relying-party server's WebAuthn registration/authentication with distinct restore-key records.
- Create a restore key after sign-in/sign-up and for already signed-in users lacking one. Track server-verified creation per account in non-backed-up storage (or exclude the marker from backup); reset on sign-out/account changes. Otherwise restore may copy a stale flag and prevent key rotation. Try cloud backup, then retry locally only for `E2eeUnavailableException`.
- Request `GetRestoreCredentialOption` alone, expect `RestoreCredential`, and send its response to the server for verification before establishing a session.
- With `allowBackup=true`, integrate background retrieval into `BackupAgent.onRestoreFinished()` plus a first-launch foreground fallback. Complete required restore work within the callback contract with bounded operations; avoid fire-and-forget work or blocking the Activity main thread. If adding a new BackupAgent, preserve full backup with `fullBackupOnly=true`; do not overwrite an existing agent's backup strategy.
- Key transfer is independent of `allowBackup`; with backup disabled use foreground sign-in fallback only. Do not change `allowBackup` to enable this feature. Prevent overlapping tiers from signing in twice. Refresh notification registration if relevant.
- On sign-out or confirmed server-side invalidation, explicitly clear `TYPE_CLEAR_RESTORE_CREDENTIAL` and retain existing non-restore clear calls. Do not treat every transient network failure as invalidation.
- Test E2EE unavailable, missing keys, restore interruption, foreground retry, sign-out and account switching. Use the current [restore testing guide](https://developer.android.com/identity/sign-in/test-restore-credentials); cover cloud backup and device-to-device transfer separately. Distinguish client completion from unavailable backend work.

## Verified email / digital credentials
Discover sign-up/recovery/reauth entry points. Verify current provider, API and Play services support (reviewed baseline API 28+, GMS 25.49.x). Keep fallback verification for unsupported accounts/devices and cancellation.

Follow the current [Digital Credentials Verifier API recipe](https://github.com/android/skills/tree/5815d27fda564aa9f07ebdcb5e57ed3e8d904e0d/identity/verified-email). Use `GetDigitalCredentialOption` with the provider's current OpenID4VP request/DCQL schema, minimal necessary visible claims, and a fresh server-bound challenge. Hidden-only claims can cause cancellation. Check the returned credential type. Current response format uses `protocol` and `data.vp_token`; handle older wrappers only when maintaining an actual existing integration.

Client parsing is display-only, never proof of identity. Send the complete response to a server verifier that checks trusted issuer/JWKS, signature, disclosures, expiry, key binding, audience and single-use nonce/session binding. Do not sign in, create an account or enable privileged navigation before server success; never ship a TODO verifier that grants access. Do not log tokens or personal claims.

Check provider limitations and freshness: non-Gmail addresses may need an additional challenge; do not assume Workspace support. Offer passkey enrollment after verified account establishment when in scope. For WebView handoff, verify trusted origins and bridge boundaries against official Credential Manager guidance.

Source (selectively refreshed): https://github.com/android/skills/tree/5815d27fda564aa9f07ebdcb5e57ed3e8d904e0d/identity
