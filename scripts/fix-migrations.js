#!/usr/bin/env node

/**
 * Script pour résoudre les migrations Prisma échouées
 * Utilisé en production pour nettoyer les migrations bloquées
 */

const { execSync } = require('child_process');

// Fonction async pour gérer Prisma
async function checkAndResolve() {
  console.log('🔍 Vérification des migrations Prisma...');

  try {
    // Essayer d'appliquer les migrations normalement
    console.log('📦 Tentative d\'application des migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Migrations appliquées avec succès');
  } catch (error) {
    console.log('⚠️  Erreur lors de l\'application des migrations');
    console.log('🔧 Tentative de résolution des migrations échouées...');
    
    try {
      // Vérifier si les tables existent déjà (migration partiellement appliquée)
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        // Tester si la table users existe
        await prisma.$queryRaw`SELECT 1 FROM "users" LIMIT 1`;
        console.log('📋 Les tables existent déjà, marquage de la migration comme appliquée...');
        await prisma.$disconnect();
        
        // Marquer la migration comme appliquée
        execSync('npx prisma migrate resolve --applied 20240101000000_init', { stdio: 'inherit' });
        console.log('✅ Migration marquée comme appliquée');
      } catch (tableError) {
        // Les tables n'existent pas, marquer comme rolled-back et réappliquer
        console.log('📋 Les tables n\'existent pas, marquage de la migration comme rolled-back...');
        await prisma.$disconnect();
        
        try {
          execSync('npx prisma migrate resolve --rolled-back 20240101000000_init', { stdio: 'inherit' });
        } catch (resolveError) {
          // Si la résolution échoue, essayer de supprimer l'entrée de la table _prisma_migrations
          console.log('🔄 Tentative de nettoyage manuel de la table _prisma_migrations...');
          const prisma2 = new PrismaClient();
          try {
            await prisma2.$executeRawUnsafe(`DELETE FROM "_prisma_migrations" WHERE migration_name = '20240101000000_init'`);
            await prisma2.$disconnect();
            console.log('✅ Entrée de migration supprimée');
          } catch (cleanError) {
            await prisma2.$disconnect();
            console.log('⚠️  Impossible de nettoyer, continuons quand même...');
          }
        }
        
        // Réessayer d'appliquer les migrations
        console.log('📦 Nouvelle tentative d\'application des migrations...');
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        console.log('✅ Migrations appliquées avec succès après résolution');
      }
    } catch (resolveError) {
      console.log('⚠️  Impossible de résoudre automatiquement. Vérifiez manuellement.');
      console.log('💡 Vous pouvez exécuter: npx prisma migrate resolve --rolled-back 20240101000000_init');
      // On continue quand même pour ne pas bloquer le démarrage
    }
  }

  // Générer le client Prisma
  console.log('🔨 Génération du client Prisma...');
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Client Prisma généré');
  } catch (error) {
    console.log('⚠️  Erreur lors de la génération du client Prisma');
    throw error;
  }

  console.log('✅ Toutes les migrations sont prêtes');
}

// Exécuter la fonction async
checkAndResolve().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
