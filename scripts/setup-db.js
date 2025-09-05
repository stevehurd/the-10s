#!/usr/bin/env node

/**
 * Database setup script for Vercel deployment
 * Run this after deploying to set up the database schema
 */

const { execSync } = require('child_process');

async function setupDatabase() {
  try {
    console.log('🚀 Setting up database schema...');
    
    // Push the Prisma schema to create tables
    execSync('npx prisma db push', { stdio: 'inherit' });
    
    console.log('✅ Database schema created successfully!');
    console.log('📊 You can now access your application');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();