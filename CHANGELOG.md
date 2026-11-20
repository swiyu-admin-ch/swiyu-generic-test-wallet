# Changelog

This changelog documents notable changes to the hosted test wallet.

The wallet is continuously deployed to [GitHub Pages](https://swiyu-admin-ch.github.io/swiyu-generic-test-wallet/) and targets manual issuance and verification testing with the swiyu Generic Issuer and Generic Verifier 5.x.x.

Changes are grouped by deployment date rather than version number.

## 2026-11-20

### Added
- Accept transaction codes (`tx_code`) for pre-authorized credential offers and prompt for another code when the issuer returns `invalid_tx_code`. [#114](https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet/pull/114)

### Changed
- Apply the DPoP setting to the entire issuance and reuse the same key for the token and credential requests when enabled. Older wallet settings without a DPoP preference default to enabled. [#121](https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet/pull/121)
- Use the configured trust-data registry and show Trust Protocol 2.0 credential-type protection, issuer authorization and trust-check errors in the issuance view. [#115](https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet/pull/115)

### Fixed
- Resolve the current DID document when `did.jsonl` contains multiple versions. [#115](https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet/pull/115)
- Use the issuer's `DPoP-Nonce` header for token and credential proofs. Retry the token request once when the issuer requests a fresh nonce and provides one. [#116](https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet/pull/116)
- Resolve verifier DID logs when the request object's `iss` uses the `decentralized_identifier:` prefix. Include the request object's `state` in OID4VP `direct_post` responses. [#110](https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet/pull/110)