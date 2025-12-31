# 🚀 Guide de Déploiement en Production - Bust & Chill

Ce guide vous explique étape par étape comment déployer **Bust & Chill** sur **Railway** pour un accès public en production.

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir :

- Un compte **GitHub** (pour le déploiement automatique)
- Un compte **Railway** (gratuit avec 500$ de crédit par mois)
- Un compte pour un service **SMTP** (Gmail, SendGrid, Mailgun, etc.) pour l'envoi d'emails

---

## 🎯 ÉTAPE 1 : Préparer la Base de Données PostgreSQL

### Option A : PostgreSQL Railway (Recommandé)

1. **Créer un nouveau projet sur Railway** : https://railway.app
2. Cliquez sur **"New Project"** (Nouveau Projet)
3. Sélectionnez **"Provision PostgreSQL"** (Provisionner PostgreSQL)
4. Une fois créé, allez dans l'onglet **"Variables"** du service PostgreSQL
5. Copiez la variable `DATABASE_URL` (elle sera automatiquement créée)

**Note importante** : Railway crée deux types d'URLs :

- **URL interne** (`postgres.railway.internal`) : Fonctionne uniquement entre services du même projet Railway. Utilisez cette URL si votre application est déployée sur Railway dans le même projet.
- **URL publique** : Disponible dans l'onglet **"Connect"** > **"Public Network"**. Utilisez cette URL si vous avez besoin de vous connecter depuis l'extérieur de Railway.

**Pour ce projet** : Utilisez l'URL interne (`postgres.railway.internal`) car l'application sera déployée sur Railway dans le même projet.

### Option B : PostgreSQL Externe (Neon, Supabase, etc.)

Si vous préférez utiliser un service externe :

**Neon (Recommandé - gratuit)** :

1. Créez un compte sur https://neon.tech
2. Créez un nouveau projet
3. Copiez la chaîne de connexion (format : `postgresql://user:password@host/dbname?sslmode=require`)

**Supabase** :

1. Créez un projet sur https://supabase.com
2. Allez dans Paramètres > Base de données
3. Copiez la chaîne de connexion

---

## 🚂 ÉTAPE 2 : Déployer l'Application sur Railway

### 2.1 Créer un Nouveau Service

1. Dans votre projet Railway, cliquez sur **"New Service"** (Nouveau Service)
2. Sélectionnez **"Deploy from GitHub repo"** (Déployer depuis un dépôt GitHub)
3. Autorisez Railway à accéder à votre dépôt GitHub
4. Sélectionnez le dépôt `bust-and-chill`
5. Sélectionnez la branche (généralement `main` ou `master`)

### 2.2 Configurer les Variables d'Environnement

Dans l'onglet **"Variables"** de votre service Railway (l'application, pas PostgreSQL), ajoutez toutes les variables suivantes :

**💡 Astuce** : Si votre service PostgreSQL et votre application sont dans le même projet Railway, Railway peut automatiquement partager la variable `DATABASE_URL`. Vérifiez dans l'onglet **"Variables"** de votre service application si `DATABASE_URL` apparaît déjà. Si oui, vous n'avez pas besoin de l'ajouter manuellement.

#### Variables Obligatoires

```env
# Base de données
# Exemple d'URL interne Railway :
# DATABASE_URL=postgresql://postgres:password@postgres.railway.internal:5432/railway
#
# Si vous utilisez PostgreSQL Railway dans le même projet, Railway peut partager automatiquement
# la variable DATABASE_URL. Sinon, copiez-la depuis l'onglet "Variables" du service PostgreSQL.
DATABASE_URL=postgresql://user:password@host:port/dbname

# URL de l'application (sera fournie par Railway après le déploiement)
# Format : https://votre-app.railway.app
NEXT_PUBLIC_APP_URL=https://votre-app.railway.app

# Secret JWT (générez une chaîne aléatoire sécurisée d'au moins 32 caractères)
# Vous pouvez générer un secret avec : openssl rand -base64 32
JWT_SECRET=votre-super-secret-jwt-key-change-this-in-production-min-32-chars

# Configuration SMTP pour les emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app-gmail
SMTP_FROM=noreply@bustandchill.com

# Environnement (ne pas modifier)
NODE_ENV=production
```

#### Comment obtenir les variables SMTP

**Gmail** :

1. Activez l'authentification à deux facteurs sur votre compte Gmail
2. Générez un "Mot de passe d'application" : https://myaccount.google.com/apppasswords
3. Utilisez ce mot de passe pour `SMTP_PASS` (pas votre mot de passe Gmail normal)
4. Configuration :
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=votre-email@gmail.com`
   - `SMTP_PASS=le-mot-de-passe-d-application-généré`

**SendGrid** (Recommandé pour la production) :

1. Créez un compte sur https://sendgrid.com
2. Créez une clé API dans Paramètres > Clés API
3. Configuration :
   - `SMTP_HOST=smtp.sendgrid.net`
   - `SMTP_PORT=587`
   - `SMTP_USER=apikey`
   - `SMTP_PASS=votre-clé-api-sendgrid`

**Mailgun** :

1. Créez un compte sur https://mailgun.com
2. Récupérez les identifiants SMTP dans votre tableau de bord
3. Utilisez les valeurs fournies par Mailgun

### 2.3 Configurer les Commandes de Build et Start

Dans l'onglet **"Settings"** (Paramètres) de votre service Railway :

1. **Build Command** (Commande de build) : `npm run build`
2. **Start Command** (Commande de démarrage) : `npm run start`

Railway détectera automatiquement Node.js et installera les dépendances.

---

## 🗄️ ÉTAPE 3 : Initialiser la Base de Données

### Option A : Via Railway CLI (Recommandé)

1. **Installer Railway CLI** :

   ```bash
   npm i -g @railway/cli
   ```

2. **Se connecter** :

   ```bash
   railway login
   ```

3. **Lier le projet** :

   ```bash
   railway link
   ```

4. **Exécuter les migrations** :

   ```bash
   railway run npm run db:migrate:deploy
   ```

### Option B : Via Railway Dashboard

1. Dans votre service Railway, allez dans l'onglet **"Deployments"** (Déploiements)
2. Cliquez sur le dernier déploiement
3. Ouvrez la console (terminal)
4. Exécutez :

   ```bash
   npm run db:migrate:deploy
   ```

### Option C : Via Script de Démarrage (Automatique)

Si vous préférez que les migrations s'exécutent automatiquement au démarrage, modifiez le script `start` dans `package.json` :

```json
"start": "cross-env NODE_ENV=production prisma migrate deploy && node server.js"
```

⚠️ **Note** : Cette méthode peut ralentir le démarrage. Il est préférable d'exécuter les migrations manuellement la première fois.

---

## 🔧 ÉTAPE 4 : Configurer le Domaine Personnalisé (Optionnel)

1. Dans Railway, allez dans l'onglet **"Settings"** (Paramètres) de votre service
2. Cliquez sur **"Generate Domain"** (Générer un domaine) pour obtenir un domaine Railway gratuit
3. Ou ajoutez votre propre domaine personnalisé :

   - Cliquez sur **"Custom Domain"** (Domaine personnalisé)
   - Ajoutez votre domaine
   - Suivez les instructions DNS

4. **Important** : Mettez à jour `NEXT_PUBLIC_APP_URL` avec votre nouveau domaine :

   ```env
   NEXT_PUBLIC_APP_URL=https://votre-domaine.com
   ```

5. Redéployez l'application pour que les changements prennent effet.

---

## ✅ ÉTAPE 5 : Vérifications Post-Déploiement

### 5.1 Vérifier que l'Application Démarre

1. Allez dans l'onglet **"Deployments"** (Déploiements) de Railway
2. Vérifiez que le déploiement est réussi (statut vert)
3. Ouvrez les logs pour vérifier :
   - `> Ready on http://0.0.0.0:PORT`
   - `> Socket.IO ready`
   - Pas d'erreurs de connexion à la base de données

### 5.2 Tester l'Inscription et l'Email

1. Ouvrez votre application : `https://votre-app.railway.app`
2. Créez un compte (page `/register`)
3. Vérifiez que vous recevez l'email de vérification
4. Cliquez sur le lien de vérification dans l'email
5. Connectez-vous avec vos identifiants

### 5.3 Tester le Multi-Joueurs

1. **Navigateur 1** : Connectez-vous et créez une partie
2. **Navigateur 2** (ou onglet privé) : Connectez-vous avec un autre compte
3. Rejoignez la partie avec le Game ID (identifiant de partie)
4. Vérifiez que :
   - Les deux joueurs voient la même table
   - Les actions se synchronisent en temps réel
   - Les timers fonctionnent correctement
   - Les scores sont enregistrés dans la base de données

### 5.4 Vérifier les WebSockets

1. Ouvrez la console du navigateur (F12)
2. Allez dans l'onglet **"Network"** (Réseau) > **"WS"** (WebSocket)
3. Vérifiez qu'une connexion WebSocket est établie vers `/api/socketio`
4. Vérifiez qu'il n'y a pas d'erreurs de connexion

---

## 🐛 Dépannage

### Erreur : "Cannot connect to database" (Impossible de se connecter à la base de données)

**Solutions** :

- Vérifiez que `DATABASE_URL` est correctement configurée dans Railway
- Vérifiez que PostgreSQL est accessible (pas de firewall bloquant)
- Vérifiez que les migrations ont été exécutées : `railway run npm run db:migrate:deploy`
- Vérifiez que l'URL de la base de données utilise le bon format

### Erreur : "Email verification not working" (La vérification d'email ne fonctionne pas)

**Solutions** :

- Vérifiez que toutes les variables SMTP sont correctement configurées
- Pour Gmail, utilisez un "Mot de passe d'application" (pas votre mot de passe normal)
- Vérifiez les logs Railway pour voir les erreurs SMTP
- Testez avec SendGrid ou Mailgun si Gmail ne fonctionne pas
- Vérifiez que `SMTP_FROM` correspond à un email valide

### Erreur : "Socket.IO not connecting" (Socket.IO ne se connecte pas)

**Solutions** :

- Vérifiez que `NEXT_PUBLIC_APP_URL` correspond exactement à l'URL de votre application (https://...)
- Vérifiez que le serveur démarre correctement (logs Railway)
- Vérifiez la console du navigateur pour les erreurs CORS
- Assurez-vous que Railway n'a pas mis l'application en "sleep" (plan gratuit)
- Vérifiez que l'URL utilise HTTPS (pas HTTP)

### Erreur : "Port already in use" (Port déjà utilisé)

**Solutions** :

- Railway gère automatiquement le port via la variable `PORT`
- Ne définissez pas manuellement `PORT` dans les variables d'environnement
- Vérifiez que vous n'avez pas plusieurs services qui écoutent sur le même port

### Application en "Sleep" (Veille - plan gratuit)

**Solution** :

- Railway met les applications en veille après 5 minutes d'inactivité (plan gratuit)
- Le premier accès peut prendre 30-60 secondes pour réveiller l'application
- Pour éviter cela, passez au plan payant ou utilisez un service de "ping" pour maintenir l'application active

### Erreur : "Prisma Client not generated" (Client Prisma non généré)

**Solution** :

- Le client Prisma est généré automatiquement via le script `postinstall`
- Si cela ne fonctionne pas, exécutez manuellement : `railway run npm run db:generate`

---

## 📊 Monitoring et Logs

### Voir les Logs en Temps Réel

1. Dans Railway, allez dans l'onglet **"Deployments"** (Déploiements)
2. Cliquez sur le dernier déploiement
3. Ouvrez la console pour voir les logs en temps réel

### Métriques

Railway fournit automatiquement :

- Utilisation CPU/RAM
- Trafic réseau
- Nombre de requêtes

Accédez-y via l'onglet **"Metrics"** (Métriques) de votre service.

---

## 🔒 Sécurité en Production

### Checklist de Sécurité

- ✅ `JWT_SECRET` est une chaîne aléatoire sécurisée (minimum 32 caractères)
- ✅ `DATABASE_URL` utilise SSL (`?sslmode=require` si nécessaire)
- ✅ Cookies sont sécurisés (`secure=true` en production)
- ✅ `NEXT_PUBLIC_APP_URL` utilise HTTPS
- ✅ Variables sensibles ne sont pas commitées dans Git
- ✅ SMTP utilise TLS/SSL (port 587 ou 465)

### Variables Sensibles

⚠️ **NE JAMAIS** commiter ces variables dans Git :

- `JWT_SECRET`
- `DATABASE_URL`
- `SMTP_PASS`
- Toute autre clé API ou secret

Utilisez toujours les variables d'environnement de Railway.

---

## 🚀 Scaling (Mise à l'échelle - Optionnel)

### Pour le MVP

Par défaut, Railway exécute **1 instance** de votre application. C'est suffisant pour :

- Jusqu'à 50-100 utilisateurs simultanés
- Plusieurs tables de jeu actives
- WebSockets fonctionnels

### Limitations du Scaling

⚠️ **Important** : Si vous scalez à plusieurs instances, les WebSockets ne fonctionneront pas correctement car l'état du jeu est stocké en mémoire.

Pour supporter plusieurs instances, vous devrez :

1. Utiliser Redis Adapter pour Socket.IO
2. Stocker l'état du jeu dans Redis au lieu de la mémoire
3. Configurer Redis sur Railway

**Pour le MVP, gardez 1 instance.**

---

## 📝 Commandes Utiles

```bash
# Voir les logs en temps réel
railway logs

# Exécuter une commande dans l'environnement Railway
railway run npm run db:migrate:deploy

# Ouvrir une console interactive
railway shell

# Voir les variables d'environnement
railway variables

# Redéployer manuellement
railway up
```

---

## 🎉 Félicitations !

Votre application **Bust & Chill** est maintenant déployée en production et accessible publiquement !

### Prochaines Étapes

1. ✅ Tester toutes les fonctionnalités
2. ✅ Inviter des amis à jouer
3. ✅ Monitorer les logs pour détecter les erreurs
4. ✅ Optimiser les performances si nécessaire

**Bon jeu ! 🃏🎮**

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs Railway
2. Consultez la documentation Railway : https://docs.railway.app
3. Vérifiez les issues GitHub du projet

---

## 🔄 Mises à Jour

Pour mettre à jour l'application :

1. Poussez vos changements sur GitHub
2. Railway redéploiera automatiquement
3. Si vous avez modifié le schéma Prisma :
   - Créez une migration : `npm run db:migrate`
   - Déployez la migration : `railway run npm run db:migrate:deploy`

---

**Dernière mise à jour** : 2024
