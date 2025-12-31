# Test Wallet Frontend

This module contains a minimal Angular application used for development and testing.

Files created

- pom.xml — Maven module that uses frontend-maven-plugin to run npm install and build during the package phase.
- package.json, angular.json, tsconfig.json — minimal Angular config.
- src/ — Angular sources (main.ts, index.html, app module/component, styles).

How to add this module to the root multi-module build

1. Open the root `pom.xml` at the repository root.
2. Add the following line inside the `<modules>` section:

   <module>test-wallet-frontend</module>

How to build only this module with Maven (no changes to root POM required):

mvn -f test-wallet-frontend/pom.xml package

This will install Node/npm (via frontend-maven-plugin), run `npm install` and then run the `npm run build` script (if
present).

How to run the dev server locally (for development):

cd test-wallet-frontend
npm install
npm start

Notes

- Node/npm are installed locally by the frontend-maven-plugin when running the Maven package phase.
- This is a minimal scaffold; you can expand the Angular app as needed.

# Start

Run chrome without cors (only for testing):

```bash
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev_session"
```
