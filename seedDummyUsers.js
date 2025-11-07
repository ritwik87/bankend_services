import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// ✅ Load Supabase Admin client (use your service role key!)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Load dummy data JSON file
const dummyUsers = JSON.parse(
  fs.readFileSync('./complete_dummy_players.json', 'utf-8')
);

async function seedDummyUsers() {
  console.log(`Seeding ${dummyUsers.length} dummy users...`);

  for (const user of dummyUsers) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        phone: `+91${user.phone}`,
        email: user.email,
        password: user.password,
        user_metadata: {
          name: user.name,
          role: user.role,
          phone: user.phone,
        },
        email_confirm: true, // mark verified
      });

      if (error) {
        console.error(`❌ Error creating ${user.phone}:`, error.message);
      } else {
        console.log(`✅ Created ${user.phone} (${user.role})`);
      }

      // optional: wait a bit between requests to avoid rate limit
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`❌ Exception for ${user.phone}:`, err);
    }
  }

  console.log('✅ Dummy user seeding complete!');
}

seedDummyUsers();
