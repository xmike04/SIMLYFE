import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

function readEnv(name) {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : process.env[name];
}

const supabaseUrl = readEnv('VITE_SUPABASE_URL');
const supabaseKey = readEnv('VITE_SUPABASE_PUBLISHABLE') || readEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE in .env.local.');
  process.exit(1);
}

const messages = [{
  role: 'user',
  content: `Generate one JSON life event for a 22 year old SIMLYFE character.
Return raw JSON only with description and choices fields.`,
}];

try {
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify({ messages, max_tokens: 200, temperature: 0.9 }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Edge function returned ${response.status}: ${JSON.stringify(data)}`);
  }

  console.log('SUCCESS:');
  console.log(JSON.stringify(data, null, 2));
} catch (error) {
  console.error('ERROR:');
  console.error(error.message);
  process.exit(1);
}
