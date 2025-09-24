import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for auth operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Main function to insert users
async function insertUsersToSupabase() {
  try {
    // Read JSON file
    const jsonFilePath = path.join(__dirname, 'complete_dummy_players.json');
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    const users = JSON.parse(jsonData);

    console.log(`Found ${users.length} users to insert`);

    // Process users in batches to avoid rate limits
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          users.length / batchSize
        )}`
      );

      // Insert batch using Supabase Admin API (matching your existing code)
      for (const dummyUser of batch) {
        try {
          const { data, error } = await supabase.auth.admin.createUser({
            phone: dummyUser.phone,
            email: dummyUser.email,
            password: dummyUser.password,
            user_metadata: {
              phone: dummyUser.phone,
              role: dummyUser.role,
              name: dummyUser.name,
              email: dummyUser.email,
              password: dummyUser.password,
            },
            email_confirm: true, // Auto-confirm for dummy users
          });

          if (error) {
            console.error(
              `Error creating user ${dummyUser.email}:`,
              error.message
            );
          } else {
            console.log(`✅ Successfully created user: ${dummyUser.email}`);
            results.push({
              success: true,
              email: dummyUser.email,
              id: data.user.id,
            });
          }
        } catch (err) {
          console.error(
            `Exception creating user ${dummyUser.email}:`,
            err.message
          );
          results.push({
            success: false,
            email: dummyUser.email,
            error: err.message,
          });
        }
      }

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < users.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log('\n=== SUMMARY ===');
    console.log(`Total users processed: ${results.length}`);
    console.log(`Successfully created: ${successful}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed users:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`- ${r.email}: ${r.error}`);
        });
    }
  } catch (error) {
    console.error('Error reading JSON file or processing users:', error);
  }
}

// Alternative method: Direct database insert (if you have direct database access)
async function insertUsersDirectly() {
  try {
    const jsonFilePath = path.join(__dirname, 'complete_dummy_players.json');
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    const users = JSON.parse(jsonData);

    // Process users one by one using your existing code structure
    for (const dummyUser of users) {
      try {
        const { data, error } = await supabase.auth.admin.createUser({
          phone: `+91${dummyUser.phone.split('+91')?.[1]}`,
          email: dummyUser.email,
          password: dummyUser.password,
          user_metadata: {
            phone: dummyUser.phone,
            role: dummyUser.role,
            name: dummyUser.name,
            email: dummyUser.email,
            password: dummyUser.password,
          },
          email_confirm: true, // Auto-confirm for dummy users
        });

        if (error) {
          console.error(
            `Error creating user ${dummyUser.email}:`,
            error.message
          );
        } else {
          console.log(`✅ Successfully created user: ${dummyUser.email}`);
        }
      } catch (err) {
        console.error(
          `Exception creating user ${dummyUser.email}:`,
          err.message
        );
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
console.log('Starting user insertion process...');
console.log('Make sure to:');
console.log('1. Replace YOUR_SUPABASE_URL with your actual Supabase URL');
console.log(
  '2. Replace YOUR_SUPABASE_SERVICE_ROLE_KEY with your service role key'
);
console.log('3. Ensure complete_dummy_players.json is in the same directory');
console.log('');

// Use the admin API method (recommended)
insertUsersToSupabase()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

// Uncomment below line and comment above if you want to try direct database insert
// insertUsersDirectly();
