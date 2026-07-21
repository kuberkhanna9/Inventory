const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

// Read .env.local
const envPath = path.join(__dirname, '.env.local');
let dbUrl = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      dbUrl = trimmed.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '').replace(/\r/g, '');
    }
  }
}

console.log("Using DATABASE_URL:", dbUrl.replace(/:[^:@/]+@/, ':****@'));

if (!dbUrl) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

// Convert pooler to direct connection for testing both
const poolerUrl = dbUrl;
let directUrl = dbUrl;
if (dbUrl.includes(':6543')) {
  directUrl = dbUrl.replace(':6543', ':5432').replace('pgbouncer=true', 'sslmode=require');
}

async function test(name, url) {
  console.log(`Testing ${name}...`);
  const sql = postgres(url, { prepare: false });
  try {
    const res = await sql`SELECT NOW()`;
    console.log(`${name} SUCCESS:`, res[0]);
  } catch (err) {
    console.error(`${name} FAILED:`, err.message);
  } finally {
    await sql.end();
  }
}

async function main() {
  await test("Pooler URL", poolerUrl);
  await test("Direct URL", directUrl);
}

main();
