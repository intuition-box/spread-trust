# Spread Trust

A simple PWA burner wallet for the [Intuition](https://intuition.systems) chain (ID 1155) that lets you distribute TRUST tokens by scanning QR codes.

## Why?

You're at a conference demoing your dApp built on Intuition. People want to try it, but they don't have any TRUST tokens yet — and without gas, they can't do anything.

**Spread Trust** solves this. Load up a burner wallet with TRUST, pull out your phone, scan attendees' wallet QR codes, and send them tokens on the spot. No friction, no forms, no faucet links to explain.

### How it works

1. **Open the app** — a burner wallet is generated automatically and stored in your browser
2. **Fund it** — send TRUST tokens to your burner wallet address (tap to copy)
3. **Scan & send** — hit "Scan QR Code", point at someone's wallet address, pick an amount, done

### Settings

- **Default amount** — pre-fill how much TRUST to send per scan
- **Auto send** — skip the confirmation step entirely; scan a QR and it sends immediately

Perfect for working a booth or running a workshop where you need to onboard dozens of people quickly.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run build
```

The `dist/` folder is a static site — deploy it anywhere (Coolify, Vercel, Netlify, etc.).

> **Note:** QR scanning requires HTTPS (localhost is exempt). Make sure your deployment uses a valid SSL certificate.

## Tech

- [Vite](https://vite.dev) — build tool
- [viem](https://viem.sh) — lightweight Ethereum client
- [jsQR](https://github.com/cozmo/jsQR) — QR code decoding fallback for iOS
- Native [BarcodeDetector API](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) on supported browsers
