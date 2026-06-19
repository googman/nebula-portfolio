export default function handler(_request, response) {
  const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({
    ok: true,
    supabaseUrlConfigured: Boolean(supabaseUrl),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseUrlLooksValid: /^https:\/\/[a-z0-9-]+\.supabase\.co(\/rest\/v1\/?)?$/i.test(supabaseUrl),
  }));
}
