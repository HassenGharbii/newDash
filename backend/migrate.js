import Database from 'better-sqlite3';

const db = new Database('./data/app.db');

try {
  // Vérifier si la colonne existe déjà
  const tableInfo = db.pragma('table_info(equipment)');
  const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at');
  
  if (hasUpdatedAt) {
    console.log('✓ La colonne updated_at existe déjà');
  } else {
    // Ajouter la colonne sans valeur par défaut (SQLite limitation)
    db.exec(`ALTER TABLE equipment ADD COLUMN updated_at TEXT;`);
    // Mettre à jour avec la date actuelle pour les lignes existantes
    db.exec(`UPDATE equipment SET updated_at = datetime('now') WHERE updated_at IS NULL;`);
    console.log('✓ Colonne updated_at ajoutée avec succès');
  }
  
  // Afficher le nombre d'équipements
  const count = db.prepare('SELECT COUNT(*) as total FROM equipment').get();
  console.log(`✓ Nombre d'équipements: ${count.total}`);
  
} catch (error) {
  console.error('✗ Erreur de migration:', error.message);
  process.exit(1);
} finally {
  db.close();
}
