![github-banner](https://github.com/swiyu-admin-ch/swiyu-admin-ch.github.io/blob/main/assets/images/github-banner.jpg)

# swiyu Generic Test Wallet

The swiyu Generic Test Wallet is a web application that simulates a wallet to test credential issuance and verification flows based on OID4VCI and OID4VP.

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

The hosted wallet targets manual issuance and verification testing with swiyu Generic Issuer and Generic Verifier 5.x. You can use it to test your own deployments directly from GitHub Pages. For recent changes, see the [changelog](./CHANGELOG.md).

**Important:** To use the demo against locally deployed backend services, you may need to disable browser CORS security.

_⚠️ Security Warning: Disabling CORS should only be done on a separate browser profile used exclusively for development and testing. Never disable CORS on your main browser profile._

## Prerequisites

Before starting the development server or building the application, ensure you have the following:

### Required Software

| Tool        | Version                | Purpose                     |
| ----------- | ---------------------- | --------------------------- |
| **Node.js** | 22.13+ (22.x) or 24.x   | JavaScript runtime          |
| **npm**     | 9.x or higher          | Package manager             |
| **Java**    | 11 or higher           | Run OpenAPI Generator       |

## Getting Started

### Installation

1. **Set the correct Node.js version**:

```bash
nvm use 24
```

2. **Install dependencies**:

```bash
npm ci
```

3. **Generate API client classes** (required once, and after API spec updates):

```bash
npm run generate:apis
```

This command generates Angular clients from the OpenAPI specifications for the issuer, verifier and trust APIs.

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

### Unit Tests and Linting

```bash
npm test
npm run lint
```

## Supported Features

### Credential Issuance

- Credential offer links
- Signed and unsigned metadata
- Pre-authorized code flow
- Transaction code
- Single and batch issuance
- SD-JWT credentials
- Holder binding
- Configurable proof count
- Request and response encryption
- DPoP

### Credential Verification

- Verification links and request URLs
- DCQL queries
- Selective disclosure
- Holder binding
- Encrypted and unencrypted responses

### Troubleshooting

- Step-by-step results and errors
- Issuer and verifier response inspection
- DID resolution
- Trust Protocol 2.0 diagnostics

### Browser Session

- In-memory credential and key storage
- Credential copying and reuse in the same tab
- Saved wallet settings

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
