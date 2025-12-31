# 🚀 Guide de Démarrage Rapide - Bust & Chill

Ce guide vous explique étape par étape comment mettre en place et tester le projet **Bust & Chill**.

## ✅ Prérequis

Avant de commencer, assurez-vous d'avoir installé :
- **Node.js 18+** (vérifiez avec `node --version`)
- **Docker Desktop** (pour PostgreSQL et MailHog) OU **PostgreSQL** installé localement
- **Git** (pour cloner si nécessaire)

---

## 📋 Étapes de Configuration

### 1️⃣ Installer les dépendances

Si ce n'est pas déjà fait, installez les dépendances npm :

```powershell
npm install
```

### 2️⃣ Configurer la Base de Données PostgreSQL

#### Option A : Avec Docker (Recommandé - Plus Simple)

```powershell
# Démarrer PostgreSQL dans un conteneur Docker
docker run --name bustandchill-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bustandchill -p 5432:5432 -d postgres:15
```

**Note :** Si le conteneur existe déjà, utilisez :
```powershell
docker start bustandchill-db
```

#### Option B : PostgreSQL Local

1. Installez PostgreSQL sur votre machine
2. Créez une base de données nommée `bustandchill`
3. Mettez à jour le `DATABASE_URL` dans `.env` avec vos identifiants

### 3️⃣ Configurer le fichier .env

Le fichier `.env` devrait déjà exister. Vérifiez qu'il contient :

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bustandchill?schema=public"

# JWT Secret (changez cette valeur en production!)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# SMTP Configuration (MailHog)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@bustandchill.local"
```

**Si le fichier `.env` n'existe pas**, créez-le avec le contenu ci-dessus.

### 4️⃣ Initialiser la Base de Données

Ces commandes créent les tables dans PostgreSQL :

```powershell
# Générer le client Prisma
npm run db:generate

# Pousser le schéma vers la base de données
npm run db:push
```

### 5️⃣ (Optionnel) Démarrer MailHog pour tester les emails

MailHog permet de voir les emails de vérification en local :

```powershell
# Démarrer MailHog
docker run -d -p 1025:1025 -p 8025:8025 --name mailhog mailhog/mailhog
```

**Accédez à l'interface MailHog :** http://localhost:8025

**Note :** Si vous ne démarrez pas MailHog, les URLs de vérification seront affichées dans la console du serveur.

### 6️⃣ Démarrer le Serveur

```powershell
npm run dev
```

Le serveur démarre sur **http://localhost:3000**

**⚠️ IMPORTANT :** Utilisez `npm run dev` (pas `npm run dev:next`) car le projet nécessite le serveur personnalisé avec Socket.IO.

---

## 🎮 Comment Tester le Jeu Multi-Joueurs

### Méthode 1 : Deux Navigateurs Différents

1. **Navigateur 1** (ex: Chrome) : Ouvrez http://localhost:3000
2. **Navigateur 2** (ex: Firefox) : Ouvrez http://localhost:3000

### Méthode 2 : Onglet Privé / Incognito

1. **Onglet Normal** : Ouvrez http://localhost:3000
2. **Onglet Incognito** : Ouvrez http://localhost:3000 (Ctrl+Shift+N sur Chrome)

### Scénario de Test Complet

1. **Créer le premier compte** (Navigateur 1)
   - Allez sur http://localhost:3000/register
   - Remplissez le formulaire (firstname, lastname, email, username, password)
   - Cliquez sur "S'inscrire"

2. **Vérifier l'email** (Navigateur 1)
   - Si MailHog est démarré : allez sur http://localhost:8025 et cliquez sur le lien
   - Sinon : regardez la console du serveur, copiez l'URL de vérification
   - L'URL ressemble à : http://localhost:3000/verify-email?token=...

3. **Se connecter** (Navigateur 1)
   - Allez sur http://localhost:3000/login
   - Connectez-vous avec votre compte

4. **Créer le second compte** (Navigateur 2)
   - Répétez les étapes 1-3 dans le second navigateur avec des informations différentes

5. **Créer une partie** (Navigateur 1 - Dashboard)
   - Cliquez sur "Créer une partie"
   - Une Game ID (UUID) s'affiche
   - Cliquez sur "Copier" pour copier l'ID

6. **Rejoindre la partie** (Navigateur 2 - Dashboard)
   - Collez la Game ID dans le champ "Rejoindre une partie"
   - Cliquez sur "Rejoindre"

7. **Lancer la partie** (Navigateur 1 - Lobby)
   - Le créateur de la partie voit un bouton "Lancer la partie"
   - Cliquez dessus pour démarrer

8. **Jouer !**
   - Chaque joueur joue son tour à tour
   - Les actions (Hit/Stand) se synchronisent en temps réel
   - La partie se termine automatiquement quand tous les joueurs ont fini
   - Les scores sont affichés et sauvegardés dans l'historique

---

## 🔧 Commandes Utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrer le serveur de développement avec Socket.IO |
| `npm run build` | Construire l'application pour la production |
| `npm run start` | Démarrer le serveur en mode production |
| `npm run db:generate` | Générer le client Prisma |
| `npm run db:push` | Pousser le schéma vers la base de données |
| `npm run db:migrate` | Créer une migration Prisma |
| `npm run db:studio` | Ouvrir Prisma Studio (interface graphique pour la DB) |

---

## 🔍 Vérification Rapide

Pour vérifier que tout fonctionne :

1. ✅ Le serveur démarre sans erreur : `npm run dev`
2. ✅ La page d'accueil s'affiche : http://localhost:3000
3. ✅ PostgreSQL est accessible (pas d'erreur de connexion)
4. ✅ Vous pouvez créer un compte : http://localhost:3000/register
5. ✅ MailHog fonctionne (si démarré) : http://localhost:8025

---

## 🐛 Dépannage

### Erreur : "Cannot connect to database"

**Solutions :**
- Vérifiez que PostgreSQL est démarré : `docker ps` (si Docker) ou vérifiez le service PostgreSQL
- Vérifiez `DATABASE_URL` dans `.env`
- Exécutez `npm run db:push` à nouveau

### Erreur : "Email verification not working"

**Solutions :**
- Démarrez MailHog : `docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog`
- Vérifiez les logs de la console du serveur (l'URL de vérification y est affichée)
- Vérifiez `SMTP_HOST` et `SMTP_PORT` dans `.env`

### Erreur : "Socket.IO not connecting"

**Solutions :**
- ⚠️ Assurez-vous d'utiliser `npm run dev` (pas `next dev`)
- Vérifiez que le serveur démarre correctement (vous devriez voir "Socket.IO ready")
- Vérifiez la console du navigateur pour les erreurs
- Vérifiez que `NEXT_PUBLIC_APP_URL` dans `.env` correspond à votre URL

### Erreur : "Port 3000 already in use"

**Solutions :**
- Arrêtez le processus qui utilise le port 3000
- Ou changez le port dans `server.ts` et mettez à jour `NEXT_PUBLIC_APP_URL`

### Erreur : "Prisma Client not generated"

**Solution :**
```powershell
npm run db:generate
```

---

## 📁 Structure du Projet

```
bust-and-chill/
├── prisma/
│   └── schema.prisma          # Schéma de base de données
├── src/
│   ├── app/                   # Pages Next.js (App Router)
│   │   ├── api/               # Routes API
│   │   ├── dashboard/         # Page dashboard
│   │   ├── game/[uuid]/       # Page de jeu
│   │   ├── login/             # Page de connexion
│   │   └── register/          # Page d'inscription
│   ├── components/            # Composants React
│   ├── hooks/                 # Hooks React personnalisés
│   ├── lib/                   # Utilitaires (db, auth, email)
│   └── server/                # Socket.IO & moteur de jeu
├── server.ts                  # Serveur personnalisé avec Socket.IO
└── package.json
```

---

## ✨ Fonctionnalités Disponibles

- ✅ Authentification complète (inscription, connexion, validation email)
- ✅ Création de parties avec UUID partageable
- ✅ Rejoindre une partie via UUID
- ✅ Jeu Blackjack tour à tour (2-5 joueurs)
- ✅ Synchronisation en temps réel via WebSockets
- ✅ Dashboard avec présence en temps réel
- ✅ Historique des scores
- ✅ Dark mode
- ✅ Interface responsive avec daisyUI

---

## 🎯 Prochaines Étapes

Une fois le projet démarré :
1. Créez un compte
2. Vérifiez votre email
3. Connectez-vous
4. Créez une partie
5. Invitez vos amis avec le Game ID
6. Jouez !

**Bon jeu ! 🃏🎮**

