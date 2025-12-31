# 🚀 Guide de Démarrage Rapide - Bust & Chill

## Étapes de Configuration

### 1. Installer les dépendances
```bash
npm install
```

### 2. Configurer la base de données PostgreSQL

#### Option A : Docker (Recommandé)
```bash
docker run --name bustandchill-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bustandchill -p 5432:5432 -d postgres:15
```

#### Option B : PostgreSQL local
Créez une base de données nommée `bustandchill` et mettez à jour `.env`

### 3. Configurer l'environnement
Copiez `.env.example` vers `.env` et modifiez si nécessaire :
```bash
# Windows PowerShell
Copy-Item .env.example .env
```

### 4. Initialiser la base de données
```bash
npm run db:push
npm run db:generate
```

### 5. (Optionnel) Démarrer MailHog pour les emails
```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```
Accédez à http://localhost:8025 pour voir les emails

### 6. Démarrer le serveur
```bash
npm run dev
```

L'application sera disponible sur **http://localhost:3000**

## Tester le Multiplayer

1. Ouvrez **http://localhost:3000** dans Chrome
2. Ouvrez **http://localhost:3000** dans Firefox (ou Chrome Incognito)
3. Créez deux comptes différents
4. Vérifiez les emails (MailHog ou console)
5. Connectez-vous dans les deux navigateurs
6. Créez une partie dans le premier navigateur
7. Rejoignez avec le Game ID dans le second navigateur
8. Lancez la partie et jouez !

## Commandes Utiles

```bash
# Développement
npm run dev              # Démarrer le serveur avec Socket.IO

# Base de données
npm run db:push          # Pousser le schéma vers la DB
npm run db:generate      # Générer le client Prisma
npm run db:migrate       # Créer une migration
npm run db:studio        # Ouvrir Prisma Studio

# Production
npm run build            # Construire l'application
npm run start            # Démarrer en production
```

## Dépannage

### Erreur de connexion à la base de données
- Vérifiez que PostgreSQL est démarré
- Vérifiez `DATABASE_URL` dans `.env`
- Exécutez `npm run db:push`

### Emails non reçus
- Démarrez MailHog : `docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog`
- Vérifiez les logs de la console pour l'URL de vérification
- Accédez à http://localhost:8025 pour voir les emails

### Socket.IO ne se connecte pas
- Assurez-vous d'utiliser `npm run dev` (pas `next dev`)
- Vérifiez que le serveur personnalisé démarre correctement
- Vérifiez la console du navigateur pour les erreurs

### Erreurs TypeScript
- Exécutez `npm run db:generate` après chaque modification du schéma Prisma
- Vérifiez que tous les imports sont corrects

## Structure du Projet

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

## Prochaines Étapes

Une fois le projet démarré :
1. Créez un compte
2. Vérifiez votre email
3. Connectez-vous
4. Créez une partie
5. Invitez vos amis avec le Game ID
6. Jouez !

Bon jeu ! 🃏🎮

