import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const raw = JSON.parse(
  await fs.readFile(path.join(root, 'src/data/nfl_trivia_1000.json'), 'utf8'),
);

const optionKeys = ['A', 'B', 'C', 'D'];

const rows = raw.map((question) => ({
  sport: 'nfl',
  difficulty: String(question.difficulty).toLowerCase(),
  question: question.question,
  options: optionKeys.map((key) => question.options[key]),
  correct_index: optionKeys.indexOf(question.correct_answer),
  times_used: 0,
}));

const batchSize = 200;
let inserted = 0;

for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);
  const { error } = await supabase.from('questions').insert(batch);
  if (error) {
    console.error('Failed on batch starting at row', i, error);
    process.exit(1);
  }
  inserted += batch.length;
  console.log(`Inserted ${inserted}/${rows.length}`);
}

console.log('NFL questions seeded successfully.');
