import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const supabaseReady = Boolean(supabaseUrl && supabaseKey);

export const supabase = supabaseReady
  ? createClient(supabaseUrl, supabaseKey)
  : null;
