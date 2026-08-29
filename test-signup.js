import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "placeholder-anon-key";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Attempting to sign up testadmin@ibbulabs.app...");
  const { data, error } = await supabase.auth.signUp({
    email: 'testadmin.ibbu@gmail.com',
    password: process.env.TEST_PASSWORD || '000000',
  });
  
  if (error) {
    console.error("SignUp Error:", error);
    return;
  }
  
  console.log("User signed up:", data.user?.id);
  
  // Try to insert an admin role
  if (data.user) {
    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: data.user.id,
      role: 'admin'
    });
    console.log("Role Insert Result:", roleError ? roleError.message : "Success");
  }
}

main();
