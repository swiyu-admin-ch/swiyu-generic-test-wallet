<!--
SPDX-FileCopyrightText: 2025 Swiss Confederation

SPDX-License-Identifier: MIT
-->

![github-banner](https://github.com/swiyu-admin-ch/swiyu-admin-ch.github.io/blob/main/assets/images/github-banner.jpg)

# SWIYU Generic Test Wallet

The SWIYU Generic Test Wallet is a lightweight web application that simulates a wallet to test credential issuance and verification flows based on OIDC4VCI and OIDC4VP.

It is primarily intended to validate your own deployment of the SWIYU Generic [Issuer](https://github.com/swiyu-admin-ch/swiyu-issuer) and [Verifier](https://github.com/swiyu-admin-ch/swiyu-verifier) components. During integration or configuration phases, it allows developers to execute real issuance and verification flows end-to-end, starting from a deeplink and following the complete protocol exchange.

Because it behaves like a minimal wallet frontend, it makes the different protocol steps visible and reproducible. This helps quickly identify whether a failure is caused by configuration issues, endpoint exposure, trust setup, metadata problems, or protocol-level errors without needing a real mobile wallet.

The Test Wallet is therefore a practical diagnostic and integration tool for developers deploying and configuring the SWIYU Generic components.

## Table of Contents

- [Demo](#demo)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
  - [Part 1: Beta ID Issuance](#part-1-beta-id-issuance)
  - [Part 2: Beta ID Verification](#part-2-beta-id-verification)
  - [Extracting Deeplinks from QR Codes](#extracting-deeplinks-from-qr-codes)
- [Browser CORS Configuration](#browser-cors-configuration)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Demo

A public deployment of the SWIYU Generic Test Wallet is available at:

[https://swiyu-admin-ch.github.io/swiyu-generic-test-wallet/](https://swiyu-admin-ch.github.io/swiyu-generic-test-wallet/)

You can use this online version to test your own SWIYU Generic Issuer and Verifier deployments without running the application locally.

**Important:** To use the demo against locally deployed backend services, you may need to disable browser CORS security. This must be done **only for development and testing purposes**, and preferably in a dedicated browser profile. Refer to the [Browser CORS Configuration](#browser-cors-configuration) section.


For detailed step-by-step instructions on how to perform issuance and verification flows, please refer to the [Usage Guide](#usage-guide) section below.

## Prerequisites

Before starting the development server or building the application, ensure you have the following:

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 20.x or 22.x | JavaScript runtime |
| **npm** | 9.x or higher | Package manager |

### Browser Requirements

- **Modern browser** (Chrome, Firefox, Edge, Safari) with ES2020+ support
- **Developer Tools** (F12) for extracting deeplinks from QR codes and network requests

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


## Contributions and feedback

We welcome any feedback on the code regarding both the implementation and security aspects.
Please follow the guidelines for contributing found in [CONTRIBUTING.md](/CONTRIBUTING.md).

## License

This project is licensed under the terms of the MIT license. See the [LICENSE](/LICENSE) file for details.