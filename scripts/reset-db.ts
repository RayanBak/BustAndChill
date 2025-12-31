import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🧹 Nettoyage complet de la base de données...\n');
  
  try {
    // Supprimer dans l'ordre des dépendances
    const gameHistory = await prisma.gameHistory.deleteMany({});
    console.log(`✅ GameHistory: ${gameHistory.count} entrées supprimées`);
    
    const gamePlayers = await prisma.gamePlayer.deleteMany({});
    console.log(`✅ GamePlayer: ${gamePlayers.count} entrées supprimées`);
    
    const games = await prisma.game.deleteMany({});
    console.log(`✅ Game: ${games.count} tables supprimées`);
    
    const users = await prisma.user.deleteMany({});
    console.log(`✅ User: ${users.count} utilisateurs supprimés`);
    
    console.log('\n✨ Base de données vidée avec succès !');
    console.log('Tu peux maintenant créer un nouveau compte.');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();

