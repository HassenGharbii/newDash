import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || './data/app.db';

console.log('🔄 Migration: Ajout du rôle SGM');
console.log('📁 Database:', dbPath);

const db = new Database(dbPath);

try {
  // Vérifier les utilisateurs existants
  const users = db.prepare('SELECT id, email, role FROM users').all();
  console.log(`📊 ${users.length} utilisateurs trouvés`);

  // Créer une nouvelle table avec la contrainte mise à jour
  console.log('🔨 Création de la nouvelle table users_new...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Admin','User','SGM')),
      name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Copier toutes les données existantes
  console.log('📋 Copie des données existantes...');
  db.exec(`
    INSERT INTO users_new (id, email, password_hash, role, name, created_at)
    SELECT id, email, password_hash, role, name, created_at FROM users;
  `);

  // Vérifier que la copie est complète
  const newCount = db.prepare('SELECT COUNT(*) as count FROM users_new').get();
  console.log(`✅ ${newCount.count} utilisateurs copiés`);

  if (newCount.count !== users.length) {
    throw new Error('❌ Erreur: nombre d\'utilisateurs différent après copie!');
  }

  // Renommer les tables
  console.log('🔄 Remplacement de l\'ancienne table...');
  db.exec(`
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
  `);

  // Recréer les index
  console.log('🔧 Recréation des index...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);

  // Vérification finale
  const finalUsers = db.prepare('SELECT id, email, role FROM users').all();
  console.log('✅ Migration terminée avec succès!');
  console.log(`📊 Utilisateurs finaux: ${finalUsers.length}`);
  
  finalUsers.forEach(u => {
    console.log(`   - ${u.email} (${u.role})`);
  });

} catch (error) {
  console.error('❌ Erreur lors de la migration:', error);
  process.exit(1);
} finally {
  db.close();
}
