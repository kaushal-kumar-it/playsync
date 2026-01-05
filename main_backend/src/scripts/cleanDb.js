import { prisma } from '../db/prisma.js';

async function cleanDatabase() {
  try {
    console.log('Cleaning database...');
    
    // Delete all rooms first (due to foreign key constraint)
    const deletedRooms = await prisma.room.deleteMany({});
    console.log(`Deleted ${deletedRooms.count} rooms`);
    
    // Delete all users
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`Deleted ${deletedUsers.count} users`);
    
    console.log('Database cleaned successfully!');
  } catch (error) {
    console.error('Error cleaning database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
