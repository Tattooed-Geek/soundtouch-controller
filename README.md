# 🎵 SoundTouch Controller

Interface web locale pour contrôler le **Bose SoundTouch 30** via l'API officielle.

## Fonctionnalités

| Fonction | Statut |
|---|---|
| Volume (slider en temps réel) | ✅ |
| Basses (si disponibles sur l'appareil) | ✅ |
| Transport : Play / Pause / Stop / Prev / Next | ✅ |
| Présets 1-6 (présets de l'appareil) | ✅ |
| Radios personnalisées (6 boutons, mémorisés) | ✅ |
| Sélection source : Bluetooth / AUX / TV-HDMI | ✅ |
| Affichage « En lecture » avec pochette | ✅ |
| Notifications temps réel (WebSocket) | ✅ |
| Thème clair / sombre | ✅ |
| IP configurable depuis l'interface | ✅ |

## Prérequis

- **Node.js** ≥ 18
- Le SoundTouch 30 et l'ordinateur sur le **même réseau Wi-Fi**

## Installation

```bash
cd soundtouch-controller
npm install
```

## Démarrage

```bash
# Passer l'IP directement (recommandé première fois)
node server.js 192.168.1.xxx

# Ou via variable d'environnement
BOSE_IP=192.168.1.xxx node server.js

# Ou sans argument (configurer depuis l'interface)
node server.js
```

Ouvrir **http://localhost:3000** dans le navigateur.

## Trouver l'IP du SoundTouch

1. Application Bose SoundTouch → Réglages de l'appareil → Réseau
2. Ou depuis votre routeur : chercher un périphérique nommé « SoundTouch »
3. Ou avec `nmap -sP 192.168.1.0/24` et chercher Bose

## Architecture

```
Navigateur (port 3000)
     │  HTTP REST  →  /api/*  →  SoundTouch:8090
     └  WebSocket  →  /ws     →  SoundTouch:8080 (protocole "gabbo")
```

Le serveur Node.js agit comme proxy pour contourner les restrictions CORS du navigateur.

## Radios personnalisées

Les 6 boutons de préset peuvent être configurés avec des URLs de flux radio.
Cliquez sur **✏ Modifier radios** dans l'interface.

> ⚠️ L'appareil peut refuser les URLs arbitraires selon le firmware.
> Dans ce cas, les boutons déclencheront les présets mémorisés sur l'appareil.

## Notes

- **Bluetooth / AirPlay 2** : l'API permet de *sélectionner* une source Bluetooth ou AirPlay 
  déjà appairée, mais ne peut pas initier un nouveau couplage.
- **Présets** : pour assigner un préset à l'appareil, faire un appui long sur le bouton physique 
  pendant la lecture — l'API ne permet que la lecture des présets, pas leur écriture.
- L'IP est sauvegardée dans `.bose-config.json` (créé automatiquement).
