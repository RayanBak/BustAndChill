# 🚀 Guide de Déploiement - Bust & Chill sur Railway

Ce guide vous explique comment déployer Bust & Chill sur Railway avec la validation par email fonctionnelle.

## 📋 Prérequis

- Un compte [Railway](https://railway.app) (gratuit avec 5$ de crédit/mois)
- Un compte sur un service SMTP (Gmail, SendGrid, Resend, etc.)
- Votre projet sur GitHub

## 🎯 Étapes de Déploiement

### 1. Préparer le Projet sur GitHub

Assurez-vous que votre projet est bien sur GitHub avec toutes les migrations Prisma :

```bash
git add .
git commit -m "chore: prepare for Railway deployment"
git push origin main
```

### 2. Créer un Projet sur Railway

1. Allez sur [railway.app](https://railway.app) et connectez-vous
2. Cliquez sur **"New Project"**
3. Sélectionnez **"Deploy from GitHub repo"**
4. Choisissez votre repo `bust-and-chill`
5. Railway détecte automatiquement Next.js et commence le déploiement

### 3. Ajouter PostgreSQL

1. Dans votre projet Railway, cliquez sur **"+ New"**
2. Sélectionnez **"Database"** → **"Add PostgreSQL"**
3. Railway crée automatiquement une base PostgreSQL
4. Copiez la variable `DATABASE_URL` qui apparaît (ou cliquez sur la base → Variables → `DATABASE_URL`)

### 4. Configurer les Variables d'Environnement

Dans Railway, allez dans votre service (l'app Next.js) → **Variables** → **Raw Editor**, et ajoutez :

```env
# Base de données (ajouté automatiquement par Railway)
DATABASE_URL=postgresql://postgres:password@postgres.railway.internal:5432/railway?sslmode=require

# Secret JWT (générez un secret fort !)
JWT_SECRET=votre-secret-jwt-tres-long-et-securise-changez-moi-123456789

# URL de l'application (sera remplacé après le déploiement)
NEXT_PUBLIC_APP_URL=https://votre-app.railway.app

# ⚠️ IMPORTANT : Configuration SMTP pour les emails
# Voir les options ci-dessous
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app
SMTP_FROM=noreply@bustandchill.com
SMTP_SECURE=false

# Environnement
NODE_ENV=production
PORT=3000
```

> **💡 Note** : Après le premier déploiement, Railway vous donnera une URL du type `https://xxx.up.railway.app`. Mettez à jour `NEXT_PUBLIC_APP_URL` avec cette URL.

### 5. Configurer SMTP (Validation par Email)

Railway **ne fournit pas** de service SMTP intégré, mais vous pouvez utiliser plusieurs services gratuits :

#### Option A : Gmail (Gratuit, 500 emails/jour)

1. **Activez la validation en 2 étapes** sur votre compte Gmail
2. **Générez un mot de passe d'application** :

   - Allez sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Sélectionnez "App" : Mail, "Device" : Other
   - Entrez "Bust & Chill" et générez
   - Copiez le mot de passe (16 caractères)

3. **Configurez dans Railway** :

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app-16-caracteres
SMTP_FROM=noreply@bustandchill.com
SMTP_SECURE=false
```

#### Option B : Resend (Recommandé - Gratuit, 3000 emails/mois)

1. Créez un compte sur [resend.com](https://resend.com)
2. Vérifiez votre domaine ou utilisez le domaine de test
3. Allez dans **API Keys** et créez une clé
4. Pour Resend via SMTP, utilisez :

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=votre-api-key-resend
SMTP_FROM=noreply@votre-domaine.com
SMTP_SECURE=true
```

> **Note** : Resend propose aussi une API directe, mais notre code utilise SMTP standard.

#### Option C : SendGrid (Gratuit, 100 emails/jour)

1. Créez un compte sur [sendgrid.com](https://sendgrid.com)
2. Allez dans **Settings** → **API Keys**
3. Créez une clé API avec les permissions "Mail Send"
4. Configurez :

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=votre-api-key-sendgrid
SMTP_FROM=noreply@bustandchill.com
SMTP_SECURE=false
```

#### Option D : Mailgun (Gratuit, 100 emails/jour pendant 3 mois)

1. Créez un compte sur [mailgun.com](https://mailgun.com)
2. Vérifiez votre domaine (ou utilisez le domaine de test)
3. Récupérez les credentials SMTP dans **Sending** → **Domain settings**
4. Configurez :

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=votre-username-mailgun
SMTP_PASS=votre-password-mailgun
SMTP_FROM=noreply@votre-domaine.com
SMTP_SECURE=false
```

### 6. Configuration Railway (Build & Start)

Railway détecte automatiquement Next.js, mais vérifiez dans **Settings** → **Deploy** :

- **Build Command** : `npm install && npm run build`
- **Start Command** : `npm run start` (utilise déjà `prisma migrate deploy`)

Le script `start` dans `package.json` s'occupe automatiquement de :

1. Appliquer les migrations Prisma
2. Générer le client Prisma
3. Démarrer le serveur

### 7. Déployer

1. Railway déploie automatiquement à chaque push sur `main`
2. Ou cliquez sur **"Redeploy"** après avoir configuré les variables
3. Attendez que le build se termine (1-2 minutes)
4. Railway vous donne une URL du type `https://xxx.up.railway.app`

### 8. Finaliser la Configuration

Après le premier déploiement :

1. **Copiez l'URL Railway** (ex: `https://bust-and-chill-production.up.railway.app`)
2. **Mettez à jour `NEXT_PUBLIC_APP_URL`** dans Railway Variables :
   ```env
   NEXT_PUBLIC_APP_URL=https://bust-and-chill-production.up.railway.app
   ```
3. **Redéployez** pour que le changement prenne effet

### 9. Vérifier que Tout Fonctionne

1. **Test d'inscription** :

   - Allez sur `https://votre-app.railway.app/register`
   - Créez un compte
   - Vérifiez vos emails (y compris spam)
   - Cliquez sur le lien de vérification

2. **Test de connexion** :

   - Essayez de vous connecter sans vérifier → doit échouer
   - Vérifiez l'email → doit réussir
   - Connectez-vous → doit fonctionner

3. **Vérifier les logs Railway** :
   - Allez dans votre service → **Deployments** → cliquez sur le dernier déploiement
   - Ouvrez **Logs** et vérifiez :
     - ✅ `SMTP server connection verified` (si SMTP configuré)
     - ✅ `Email sent successfully`
     - ✅ `Prisma migrations applied`
     - ✅ `Production mode: listening on 0.0.0.0:3000`

## 🔍 Dépannage

### Les emails ne sont pas envoyés

**Symptômes** :

- Le compte est créé mais aucun email reçu
- Erreur dans les logs : `SMTP server connection failed`

**Solutions** :

1. Vérifiez que toutes les variables SMTP sont définies :

   ```bash
   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
   ```

2. Vérifiez les logs Railway :

   - Recherchez `❌ Failed to send email`
   - Vérifiez le code d'erreur SMTP

3. Pour Gmail :

   - Assurez-vous d'utiliser un **mot de passe d'application** (pas votre mot de passe Gmail)
   - Vérifiez que la validation en 2 étapes est activée

4. Pour SendGrid/Resend :

   - Vérifiez que votre API key est correcte
   - Vérifiez que le compte n'a pas dépassé la limite quotidienne

5. **Test rapide** : Connectez-vous au service Railway et vérifiez les logs en temps réel pendant l'inscription

### Erreur "Email already verified" au clic sur le lien

**Cause** : L'email a déjà été vérifié

**Solution** : C'est normal, connectez-vous simplement avec vos identifiants

### Erreur "Invalid or expired verification token"

**Causes possibles** :

- Le token a expiré (24h)
- L'URL a été modifiée

**Solution** : Réinscrivez-vous ou contactez le support

### La base de données n'est pas créée

**Symptômes** :

- Erreur : `table "users" does not exist`
- Logs : `No migration found in prisma/migrations`

**Solutions** :

1. Vérifiez que le dossier `prisma/migrations` est bien dans le repo GitHub
2. Vérifiez que `DATABASE_URL` est correct (avec `?sslmode=require` pour Railway)
3. Vérifiez les logs du script `fix-migrations.js` dans Railway

### L'application ne démarre pas

**Symptômes** :

- Railway montre "Crash Loop"
- Logs : `PrismaClientInitializationError`

**Solutions** :

1. Vérifiez `DATABASE_URL` :

   - Doit pointer vers `postgres.railway.internal:5432` (base interne Railway)
   - Doit inclure `?sslmode=require`

2. Vérifiez `JWT_SECRET` : doit être défini

3. Vérifiez `NEXT_PUBLIC_APP_URL` : doit être l'URL complète (https://...)

## 🎯 Checklist Post-Déploiement

- [ ] PostgreSQL créé et `DATABASE_URL` configuré
- [ ] Toutes les variables d'environnement ajoutées
- [ ] SMTP configuré et testé (email reçu)
- [ ] `NEXT_PUBLIC_APP_URL` mis à jour avec l'URL Railway
- [ ] Test d'inscription réussi
- [ ] Test de vérification email réussi
- [ ] Test de connexion réussi
- [ ] Test de création de partie multijoueur réussi

## 💰 Coûts

Railway offre :

- **5$ de crédit gratuit par mois** (suffisant pour un MVP)
- PostgreSQL : ~0.50$/mois
- Application : ~0.01$/heure d'utilisation

Pour un projet étudiant/MVP, c'est généralement **gratuit** ou très peu cher (< 2$/mois).

## 🔐 Sécurité

- ✅ Cookies `secure=true` en production (HTTPS automatique)
- ✅ JWT secrets stockés en variables d'environnement
- ✅ Passwords hashés avec bcrypt
- ✅ Tokens de vérification expirés après 24h
- ✅ Protection CSRF via sameSite cookies

## 📚 Ressources

- [Railway Documentation](https://docs.railway.app)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Nodemailer Documentation](https://nodemailer.com/about/)

---

**✅ Une fois déployé, votre jeu sera accessible publiquement et la validation par email fonctionnera !**
