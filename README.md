# NOVA ID — Bot de cartes d'identité pour la Cité-État de Nova

Bot Discord qui génère des cartes d'identité RP dans le style d'une carte
nationale d'identité, thème **CITÉ-ÉTAT DE NOVA**, avec intégration
automatique de l'avatar Roblox du joueur.

**Ce bot n'utilise PAS les commandes slash `/`.** Il fonctionne avec deux
mots déclencheurs tapés dans un salon :
- `nova.id` → crée une carte d'identité
- `nova.getid` → recherche la carte d'un joueur (réservé à certains rôles)

Taper l'un de ces mots affiche un **embed avec un bouton**. Cliquer sur le
bouton ouvre un **vrai formulaire Discord** (toutes les questions posées
d'un coup, pas de conversation question par question), et **tout le
résultat est envoyé en privé** (réponse "éphémère", visible uniquement par
la personne qui a cliqué — personne d'autre dans le salon ne peut la voir).

> Pourquoi un bouton et pas juste le mot tapé directement ? Discord n'autorise
> les formulaires (modals) qu'en réponse à une interaction (bouton, menu,
> commande slash) — jamais depuis un simple message. Le bouton est donc
> l'étape technique obligatoire entre le mot déclencheur et le formulaire.

## ✨ Fonctionnalités

- `nova.id` → embed avec le visuel de Nova + bouton "Remplir le
  formulaire". Le clic ouvre un formulaire unique avec 5 champs (pseudo
  Roblox, nom, prénoms, date/lieu de naissance, sexe). Le skin Roblox est
  récupéré automatiquement.
- Limite configurable de cartes par membre (**2 par défaut**).
- À la création d'une carte : un rôle est automatiquement **retiré** et un
  autre **ajouté** au membre (configurable), et son pseudo sur le serveur
  est automatiquement changé en `[C]〃<pseudo Discord>` pour marquer
  visuellement les citoyens enregistrés.
- Chaque carte créée est archivée (en embed) dans un **salon de logs**
  configuré via `LOG_CHANNEL_ID` — utile pour le staff, indépendant de la
  réponse privée envoyée au joueur.
- La carte générée n'est **jamais visible publiquement** : elle n'apparaît
  que dans la réponse éphémère du joueur qui l'a créée, et dans le salon
  de logs (visible uniquement par les rôles ayant accès à ce salon côté
  Discord).
- `nova.getid` → embed + bouton "Rechercher un joueur", réservé aux membres
  ayant un des rôles listés dans `VIEWER_ROLE_IDS`. Sans le bon rôle, le
  clic répond simplement **"⛔ Accès refusé."** (en privé). Avec accès, un
  formulaire à un champ demande le pseudo Roblox, et le résultat (une carte
  par embed) est envoyé en privé au demandeur.
- L'avatar affiché sur `nova.getid` est récupéré **en direct** (à jour même
  si le joueur a changé de skin depuis la création de la carte).
- Format de carte plus réaliste : coins arrondis, bande "holographique",
  code-barres décoratif, emblème en forme de palmier (dans l'esprit du
  logo de Nova) à la place d'une étoile générique.

## ⚠️ Étape OBLIGATOIRE — activer "Message Content Intent"

Ce bot lit le contenu des messages pour reconnaître `nova.id` et
`nova.getid`. Il faut donc activer un intent privilégié :

1. Va sur https://discord.com/developers/applications
2. Sélectionne ton application → onglet **Bot**
3. Descends jusqu'à **Privileged Gateway Intents**
4. Active **MESSAGE CONTENT INTENT**
5. Sauvegarde

**Sans cette étape, le bot se connecte normalement mais ne réagit à aucun
mot déclencheur** (ça ressemble à un bug alors que c'est juste cette case à
cocher qui manque).

## ⚠️ Limitation — stockage des données

Les cartes sont stockées dans un fichier JSON local (`data/cards.json`).
**Sur Railway, le système de fichiers est éphémère par défaut** : ce fichier
est réinitialisé à chaque redéploiement du bot.

Pour une persistance garantie entre les redéploiements :
1. Va dans ton service Railway → onglet **Volumes**
2. Crée un volume monté sur `/app/data`
3. Les cartes créées survivront alors aux redéploiements

## 📁 Structure du projet

```
nova-id-bot/
├── index.js                  # Point d'entrée : messages, boutons, formulaires
├── package.json
├── Procfile                   # Pour Railway
├── .env.example
├── assets/
│   ├── fonts/                  # Polices utilisées pour le rendu de la carte
│   └── branding/
│       └── nova-banner.png      # Visuel Nova utilisé dans les embeds
├── config/
│   └── cardTheme.js            # <-- Textes, couleurs, dimensions de la carte (modifiable)
├── commands/
│   ├── createId.js             # Logique de "nova.id" (bouton + formulaire + embed privé)
│   └── getId.js                 # Logique de "nova.getid" (bouton + formulaire + embed privé)
├── utils/
│   ├── roblox.js                # Résolution pseudo Roblox -> avatar
│   ├── storage.js               # Stockage JSON des cartes + limite par membre
│   ├── cardRenderer.js          # Génération de l'image de la carte (Canvas)
│   └── branding.js              # Attache le visuel Nova aux embeds
└── data/
    └── cards.json               # Base de données des cartes (créé automatiquement)
```

## 🛠️ Étape 1 — Créer l'application Discord

1. Va sur https://discord.com/developers/applications
2. "New Application" → nomme-la **NOVA ID** (ou autre)
3. Onglet **Bot** → "Reset Token" → copie le token (➡️ `DISCORD_TOKEN`)
4. Active **MESSAGE CONTENT INTENT** (voir section dédiée ci-dessus)
5. Onglet **OAuth2 > URL Generator** :
   - Scopes : `bot` uniquement
   - Permissions : `Send Messages`, `Manage Roles`, `Manage Nicknames`,
     `Attach Files`, `Embed Links`, `Read Message History`
   - Ouvre l'URL générée pour inviter le bot sur ton serveur

**Important sur la hiérarchie des rôles** : dans les paramètres du serveur
(Rôles), place le rôle du bot **au-dessus** des rôles `ROLE_TO_REMOVE_ID` et
`ROLE_TO_ADD_ID`, et au-dessus du rôle le plus haut des membres qui
utiliseront `nova.id`, sinon le bot n'aura pas la permission de gérer leurs
rôles ni de les renommer (limitation Discord, pas un bug). Note : Discord
ne permet jamais de renommer le **propriétaire du serveur**, quels que
soient les rôles — c'est une restriction native, pas une erreur du bot.

## 🛠️ Étape 2 — Récupérer les IDs nécessaires

Active le mode développeur dans Discord (Paramètres > Avancés > Mode
développeur), puis clic droit pour copier :
- L'ID de chaque rôle autorisé à utiliser `nova.getid` (➡️ `VIEWER_ROLE_IDS`,
  séparés par des virgules)
- L'ID du rôle à retirer à la création d'une carte (➡️ `ROLE_TO_REMOVE_ID`)
- L'ID du rôle à ajouter à la création d'une carte (➡️ `ROLE_TO_ADD_ID`)
- L'ID du salon d'archives (➡️ `LOG_CHANNEL_ID`)

## 🛠️ Étape 3 — Configurer les variables d'environnement

Sur Railway : onglet **Variables** de ton service → ajoute toutes les
valeurs listées dans `.env.example`.

## 🚀 Étape 4 — Déployer sur Railway

1. Crée un repo GitHub avec ce projet (le `.gitignore` empêche d'y inclure
   `.env` et `data/cards.json`)
2. Sur [Railway](https://railway.app) : "New Project" → "Deploy from GitHub repo"
3. Vérifie que `package.json` est bien à la racine du repo
4. Ajoute les variables d'environnement (étape 3 ci-dessus)
5. (Recommandé) Ajoute un **Volume** monté sur `/app/data` pour la
   persistance des cartes entre redéploiements
6. Railway utilise le `Procfile` pour exécuter `node index.js`

**Aucun script à lancer en plus** : dès que le bot affiche "Connectée en
tant que..." dans les logs Railway, `nova.id` et `nova.getid` fonctionnent
immédiatement.

## ✏️ Personnaliser le style de la carte

Tout se passe dans `config/cardTheme.js` : nom de l'État, sous-titres,
couleurs, durée de validité, dimensions de l'image. Pour des changements de
mise en page plus poussés, la logique se trouve dans `utils/cardRenderer.js`.
Le visuel utilisé dans les embeds se change en remplaçant
`assets/branding/nova-banner.png` par une autre image (même nom de fichier).

## 💬 Utilisation

- `nova.id` → affiche le bouton de création (formulaire unique, résultat
  privé)
- `nova.getid` → affiche le bouton de recherche (réservé aux rôles listés
  dans `VIEWER_ROLE_IDS`, résultat privé)

## 🔧 Notes techniques

- Le rendu d'image utilise `@napi-rs/canvas` (aucune dépendance système à
  installer), compatible directement avec Railway.
- L'intégration Roblox utilise les endpoints publics `users.roblox.com` et
  `thumbnails.roblox.com` — aucune clé API n'est nécessaire.
- Les réponses "privées" utilisent le mécanisme natif Discord des messages
  éphémères (`ephemeral: true`), plus fiable qu'un message privé (DM) : ça
  fonctionne même si la personne a désactivé la réception de MP depuis le
  serveur, et Discord garantit que seul l'auteur de l'interaction voit le
  contenu.
- Le format `JJ/MM/AAAA - Ville` du champ "Naissance" n'est pas validé de
  façon stricte (pas de vérification que la date existe réellement) : choix
  volontaire pour rester simple.
