# 🃏 Bust & Chill

Un jeu de Blackjack multijoueur en temps réel construit avec Next.js, Socket.IO et Prisma.

![Bust & Chill](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-black?style=for-the-badge&logo=socket.io)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma)

## Fonctionnalités

- 🎮 **Blackjack Multijoueur** - Jouez avec 2 à 5 joueurs
- ⚡ **Mises à jour en temps réel** - Synchronisation instantanée de l'état du jeu via WebSockets
- 🔐 **Authentification** - Inscription sécurisée avec vérification par email
- 📧 **Emails personnalisés** - Templates MJML pour de beaux emails
- 🏆 **Classement** - Suivez l'historique des parties et les scores
- 🌙 **Mode sombre** - Basculez entre les thèmes clair et sombre
- 📱 **Responsive** - Fonctionne sur ordinateur et mobile

## Prérequis

- **Node.js** 18+
- **PostgreSQL** (local ou Docker)
- **MailHog** (optionnel, pour tester les emails)

## Démarrage Rapide

### 1. Cloner et Installer

```bash
cd bust-and-chill
npm install
```

### 2. Configurer l'Environnement

Créez un fichier `.env` à la racine du projet :

```env
# Base de données
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bustandchill?schema=public"

# Secret JWT (changez cela !)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# URL de l'application
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Configuration SMTP (MailHog)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@bustandchill.local"
```

### 3. Configurer la Base de Données

#### Option A : Utiliser Docker (Recommandé)

```bash
# Démarrer PostgreSQL avec Docker
docker run --name bustandchill-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bustandchill -p 5432:5432 -d postgres:15

# Attendez quelques secondes, puis exécutez les migrations
npm run db:push
npm run db:generate
```

#### Option B : Utiliser PostgreSQL Local

1. Créez une base de données nommée `bustandchill`
2. Mettez à jour `DATABASE_URL` dans `.env` avec vos identifiants
3. Exécutez les migrations :

```bash
npm run db:push
npm run db:generate
```

### 4. Configurer les Emails (Optionnel)

Pour tester la vérification par email, utilisez MailHog :

```bash
# Avec Docker
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Accédez à l'interface MailHog à http://localhost:8025
```

Si MailHog n'est pas disponible, les URLs de vérification seront affichées dans la console.

### 5. Démarrer le Serveur

```bash
npm run dev
```

L'application sera disponible sur **http://localhost:3000**

## Tester le Multijoueur

Pour tester le multijoueur en local :

1. Ouvrez **http://localhost:3000** dans Chrome
2. Ouvrez **http://localhost:3000** dans Firefox (ou Chrome en mode navigation privée)
3. Créez des comptes différents dans chaque navigateur
4. Vérifiez les emails (consultez MailHog à http://localhost:8025 ou les logs de la console)
5. Connectez-vous dans les deux navigateurs
6. Dans le Navigateur 1 : Créez une partie et copiez le Game ID
7. Dans le Navigateur 2 : Rejoignez avec le Game ID
8. Lancez la partie et jouez !

## Règles du Jeu

### Bases du Blackjack

- Chaque joueur reçoit 2 cartes
- Objectif : Se rapprocher le plus possible de 21 sans dépasser
- **Tirer** : Piocher une autre carte
- **Rester** : Garder votre main actuelle
- Les figures (J, Q, K) = 10 points
- Les As = 1 ou 11 points (automatique)
- Dépasser 21 = Bust (vous perdez)

### Système de Tours

- Les joueurs jouent à tour de rôle dans l'ordre des sièges
- Timer de 30 secondes par tour
- Si le timer expire, reste automatique
- La partie se termine quand tous les joueurs ont fini

### Système de Score

- Gagnant = Main la plus élevée ≤ 21
- Les égalités sont possibles (plusieurs gagnants)
- Les joueurs qui ont fait bust marquent 0 point

## Structure du Projet

```
bust-and-chill/
├── prisma/
│   └── schema.prisma      # Schéma de base de données
├── src/
│   ├── app/               # Pages Next.js App Router
│   │   ├── api/           # Routes API
│   │   ├── dashboard/     # Page dashboard
│   │   ├── game/[uuid]/   # Page de jeu
│   │   ├── login/         # Page de connexion
│   │   ├── register/     # Page d'inscription
│   │   └── verify-email/  # Vérification email
│   ├── components/        # Composants React
│   ├── hooks/            # Hooks React personnalisés
│   ├── lib/              # Utilitaires (db, auth, email)
│   └── server/           # Socket.IO & moteur de jeu
├── server.js              # Serveur personnalisé avec Socket.IO
└── package.json
```

## Scripts Disponibles

| Commande              | Description                                         |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | Démarrer le serveur de développement avec Socket.IO |
| `npm run build`       | Construire pour la production                       |
| `npm run start`       | Démarrer le serveur en production                   |
| `npm run db:push`     | Pousser le schéma vers la base de données           |
| `npm run db:generate` | Générer le client Prisma                            |
| `npm run db:migrate`  | Exécuter les migrations de base de données          |
| `npm run db:studio`   | Ouvrir Prisma Studio                                |

## Stack Technologique

- **Frontend** : Next.js 14, React 18, TailwindCSS, daisyUI
- **Backend** : Routes API Next.js, Socket.IO
- **Base de données** : PostgreSQL, Prisma ORM
- **Authentification** : JWT (cookies httpOnly)
- **Email** : Nodemailer, templates MJML
- **Temps réel** : WebSockets Socket.IO

## Variables d'Environnement

| Variable              | Description                          | Par défaut                 |
| --------------------- | ------------------------------------ | -------------------------- |
| `DATABASE_URL`        | Chaîne de connexion PostgreSQL       | Requis                     |
| `JWT_SECRET`          | Secret pour la signature JWT         | Requis                     |
| `NEXT_PUBLIC_APP_URL` | URL de l'application pour les emails | http://localhost:3000      |
| `SMTP_HOST`           | Hôte du serveur SMTP                 | localhost                  |
| `SMTP_PORT`           | Port du serveur SMTP                 | 1025                       |
| `SMTP_USER`           | Nom d'utilisateur SMTP               | -                          |
| `SMTP_PASS`           | Mot de passe SMTP                    | -                          |
| `SMTP_FROM`           | Adresse email de l'expéditeur        | noreply@bustandchill.local |
| `SMTP_SECURE`         | Connexion SSL/TLS (true/false)       | auto (selon le port)       |

> **📧 Pour la production** : Voir [README_DEPLOY.md](./README_DEPLOY.md) pour configurer SMTP sur Railway (Gmail, SendGrid, Resend, etc.)

## 🚀 Déploiement sur Railway

Pour déployer l'application avec la validation par email fonctionnelle, suivez le guide complet :

👉 **[Guide de Déploiement Railway](./README_DEPLOY.md)**

Ce guide couvre :
- ✅ Configuration de PostgreSQL sur Railway
- ✅ Configuration SMTP pour Gmail, SendGrid, Resend, Mailgun
- ✅ Variables d'environnement nécessaires
- ✅ Résolution des problèmes courants

## Dépannage

### "Impossible de se connecter à la base de données"

- Assurez-vous que PostgreSQL est en cours d'exécution
- Vérifiez `DATABASE_URL` dans `.env`
- Exécutez `npm run db:push` pour créer les tables

### "La vérification d'email ne fonctionne pas"

- Démarrez MailHog : `docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog`
- Vérifiez les logs de la console pour l'URL de vérification
- Assurez-vous que `SMTP_HOST` et `SMTP_PORT` sont corrects

### "Socket.IO ne se connecte pas"

- Assurez-vous d'utiliser `npm run dev` (serveur personnalisé)
- Vérifiez la console du navigateur pour les erreurs de connexion
- Vérifiez que `NEXT_PUBLIC_APP_URL` correspond à l'URL de votre serveur

### "Le jeu ne se met pas à jour en temps réel"

- Vérifiez le statut de la connexion Socket.IO dans le dashboard
- Assurez-vous que les deux navigateurs sont connectés et connectés
- Vérifiez la console du serveur pour les erreurs de socket

## Déploiement en Production

Pour déployer l'application en production, consultez le guide complet :

👉 **[README_DEPLOY.md](./README_DEPLOY.md)** - Guide de déploiement sur Railway

## Licence

MIT License - N'hésitez pas à utiliser ce projet pour apprendre et vous amuser !

---

Fait avec ❤️ et 🃏
