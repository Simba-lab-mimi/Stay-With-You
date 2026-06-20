require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log("SUPABASE_URL =", JSON.stringify(process.env.SUPABASE_URL));
console.log("SUPABASE_SECRET_KEY exists =", !!process.env.SUPABASE_SECRET_KEY);

if (!process.env.SUPABASE_URL) {
  console.log("SUPABASE_URL is undefined");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

module.exports = supabase;
