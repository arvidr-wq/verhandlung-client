
# Verhandlungsspiel – Starter (Netlify + Firebase)

## Lokal starten
1. Node 18+ installieren.
2. `.env` aus `.env.example` kopieren und Firebase Werte einsetzen.
3. `npm i`
4. `npm run dev`

## Deploy (Netlify)
- Repo verbinden, Build Command: `npm run build`, Publish: `dist/`.
- Environment Variables (Build): `VITE_FIREBASE_*`

## Routen
- `/host` → QR-Codes für A/B (Demo-Session)
- `/summary` → Endauswertung (3 Balken) mit Demodaten
