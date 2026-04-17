![github-banner](https://github.com/swiyu-admin-ch/swiyu-admin-ch.github.io/blob/main/assets/images/github-banner.jpg)

# swiyu Generic Test Wallet

The swiyu Generic Test Wallet is a web application that simulates a wallet to test credential issuance and verification flows based on OIDC4VCI and OIDC4VP.

It is primarily intended to validate your own deployment of the swiyu Generic [Issuer](https://github.com/swiyu-admin-ch/swiyu-issuer) and [Verifier](https://github.com/swiyu-admin-ch/swiyu-verifier) components. During integration or configuration phases, it allows developers to execute real issuance and verification flows end-to-end, starting from a deeplink and following the complete protocol exchange.

Because it behaves like a minimal wallet frontend, it makes the different protocol steps visible and reproducible. This helps quickly identify whether a failure is caused by configuration issues, endpoint exposure, trust setup, metadata problems, or protocol-level errors without needing a real mobile wallet.

The Test Wallet is therefore a practical diagnostic and integration tool for developers deploying and configuring the swiyu Generic components.

## Table of Contents

- [Demo](#demo)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Supported Features](#supported-features)
- [Usage Guide](#usage-guide)
- [Contributing](#contributing)
- [License](#license)

## Demo

A public deployment of the swiyu Generic Test Wallet is available at:

[https://swiyu-admin-ch.github.io/swiyu-generic-test-wallet/](https://swiyu-admin-ch.github.io/swiyu-generic-test-wallet/)

You can use this online version to test your own swiyu Generic Issuer and Verifier deployments without running the Generic Test Wallet locally.

**Important:** To use the demo against locally deployed backend services, you may need to disable browser CORS security.

*⚠️ Security Warning: Disabling CORS should only be done on a separate browser profile used exclusively for development and testing. Never disable CORS on your main browser profile.*

## Prerequisites

Before starting the development server or building the application, ensure you have the following:

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 20.x or 22.x | JavaScript runtime |
| **npm** | 9.x or higher | Package manager |

## Getting Started

### Installation

1. **Set the correct Node.js version**:

```bash
nvm use 22
```

2. **Install dependencies**:

```bash
npm install
```

3. **Generate API client classes** (required once, and after API spec updates):

```bash
npm run generate:apis
```

This command generates TypeScript Angular service classes from the OpenAPI specifications for both issuer and verifier APIs.

### Development Server

Start the development server:

```bash
npm start
```

The application will be available at `http://localhost:4200`.

### Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

### Linting

```bash
npm run lint
```

## Supported Features

### Credential Issuance (OIDC4VCI)

Supported:

- Issuance V1
    Single `vc+sd-jwt` credential
- Issuance V2
    Batch credential endpoint with support for multiple credentials
- Holder binding
    Via `proof_type: jwt` (ES256)
- Credential request encryption 
    (wallet --> issuer)
- Credential response encryption 
    (issuer --> wallet)

Not yet supported (will be available in the future):

- Credential renewal flow
- DPoP (Demonstrating Proof of Possession)
### Credential Verification (OIDC4VP)

Supported:

- Verification V1
    DIF Presentation Exchange, builds a selective-disclosure VP token with a `kb+jwt`.
- Verification V2
    DCQL (Digital Credentials Query Language) same flow using a DCQL query.
- Selective disclosure
    Only the claims required by the verifier query are included in the VP token.
- Key binding JWT (`kb+jwt`)
    Appended to every VP token, bound to the holder key and the verifier nonce.
- Response payload encryption (`direct_post.jwt`)
    VP token is JWE-encrypted before submission.

Not yet supported (will be available in the future):

- DPoP (Demonstrating Proof of Possession)

### Credential Storage and Session Management

The wallet stores Verifiable Credentials (VCs) and their corresponding holder key pairs in the browser session memory. These credentials and keys are available only during the current session and are not persisted to disk or local storage.

**Important:** When you refresh the page, all stored Verifiable Credentials and their associated holder key pairs are lost. The wallet generates new key pairs upon reloading. Previously issued VCs become unusable for verification because the original holder key pairs are no longer available.

To complete a full issuance and verification flow, maintain a single browser session without refreshing the page until you have finished all operations.

## Usage Guide

For detailed step-by-step instructions on testing credential issuance and verification flows, please refer to the [Usage Guide](./GUIDE.md).

The guide covers:
- Browser CORS Configuration
- Understanding Deeplinks
- Part 1: Issuance
- Part 2: Verification
- Extracting Deeplinks from QR Codes

## Contributing

We welcome any feedback on the code regarding both the implementation and security aspects.
Please follow the guidelines for contributing found in [CONTRIBUTING.md](/CONTRIBUTING.md).

## License

This project is licensed under the terms of the MIT license. See the [LICENSE](/LICENSE) file for details.

