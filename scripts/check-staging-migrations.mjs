import fs from 'node:fs';
import path from 'node:path';

const productionMigrations = path.resolve('supabase/migrations');
const stagingMigrations = path.resolve('supabase-staging/migrations');
const stagingBaselineVersion = 20261120135146;
const migrationName = (file) => file.replace(/^\d{14}_/, '');

const productionFiles = fs.readdirSync(productionMigrations)
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .filter((file) => Number(file.slice(0, 14)) > stagingBaselineVersion)
  .sort();

const stagingFiles = fs.readdirSync(stagingMigrations)
  .filter((file) => /^\d{14}_.+\.sql$/.test(file));
const stagingByName = new Map(stagingFiles.map((file) => [migrationName(file), file]));

const problems = [];
for (const productionFile of productionFiles) {
  const name = migrationName(productionFile);
  const stagingFile = stagingByName.get(name);

  if (!stagingFile) {
    problems.push(`Missing staging mirror: ${name}`);
    continue;
  }

  const productionSql = fs.readFileSync(path.join(productionMigrations, productionFile), 'utf8');
  const stagingSql = fs.readFileSync(path.join(stagingMigrations, stagingFile), 'utf8');
  if (productionSql !== stagingSql) {
    problems.push(`Staging migration SQL differs from production migration: ${name}`);
  }
}

if (problems.length > 0) {
  console.error('Staging migration mirror check failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`Staging migration mirror is synchronized (${productionFiles.length} migration(s)).`);
