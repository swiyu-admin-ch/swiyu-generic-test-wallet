# Test Wallet Frontend

Small frontend to resolve deeplinks and show which steps of the credential issuance process work.

# Start

Set correct node version:

```bash
nvm use 22
```

Install dependencies

```bash
npm i
```

Start application

```bash
npm start
```

Run chrome without cors (only for testing):

```bash
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev_session"
```

Navigate to localhost:4200
