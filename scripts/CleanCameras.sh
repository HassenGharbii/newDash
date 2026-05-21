#!/bin/bash
# Script pour nettoyer directement la base SQLite

DB_PATH="./backend/data/dashboard.db"

echo "Désactivation des FK et suppression des caméras..."

sqlite3 "$DB_PATH" << 'EOF'
PRAGMA foreign_keys = OFF;

-- Supprimer les données de bandwidth des caméras
DELETE FROM bandwidth_data WHERE equipment_id IN (
  SELECT id FROM equipment WHERE type = 'Camera'
);

-- Supprimer toutes les caméras
DELETE FROM equipment WHERE type = 'Camera';

PRAGMA foreign_keys = ON;

-- Vérifier le résultat
SELECT COUNT(*) as cameras_restantes FROM equipment WHERE type = 'Camera';
EOF

echo "Nettoyage terminé!"
