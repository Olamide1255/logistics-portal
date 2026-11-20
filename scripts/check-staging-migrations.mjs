import fs from 'node:fs';
import path from 'node:path';

const productionMigrations = path.resolve('supabase/migrations');
const stagingMigrations = path.resolve('supabase-staging/migrations');
const stagingBaselineVersion = 20261120135146;

const mirroredMigrations = fs.readdirSync(productionMigrations)
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .filter((file) => Number(file.slice(0, 14)) > stagingBaselineVersion)
  .sort();

const problems = [];
for (const file of mirroredMigrations) {
  const productionPath = path.join(productionMigrations, file);
  const stagingPath = path.join(stagingMigrations, file);

  if (!fs.existsSync(stagingPath)) {
    problems.push(`Missing staging mirror: ${file}`);
    continue;
  }

  if (fs.readFileSync(productionPath, 'utf8') !== fs.readFileSync(stagingPath, 'utf8')) {
    problems.push(`Staging migration differs from production migration: ${file}`);
  }
}

if (problems.length > 0) {
  console.error('Staging migration mirror check failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`Staging migration mirror is synchronized (${mirroredMigrations.length} migration(s)).`);
