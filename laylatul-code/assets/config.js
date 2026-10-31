// Settings for project tracking and the assistant. Fill these in after creating the Supabase project
// (Supabase > Project Settings > API). Both values are public by design and safe in website code.
// Never put the service_role key or the Gemini key here: the Gemini key lives in Supabase as a secret.
window.LC_CONFIG = {
  supabaseUrl: '',   // e.g. 'https://abcdefgh.supabase.co'
  supabaseKey: '',   // the 'anon' / 'publishable' key
  assistant: true    // show the "Ask us" chat bubble once the assistant function is deployed
};
