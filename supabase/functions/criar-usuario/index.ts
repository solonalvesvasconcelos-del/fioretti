// Edge Function: cria um usuário de Auth + o perfil correspondente.
// Roda no servidor da Supabase. A chave service_role fica só aqui (variável de ambiente
// injetada automaticamente pela plataforma) e nunca é enviada ao navegador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_ROLES = ["central", "motorista"];
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Não autenticado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente com o token de quem chamou: só enxerga o que a RLS permitir a essa pessoa.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Sessão inválida." }, 401);

  const { data: callerProfile, error: profileError } = await callerClient
    .from("perfis")
    .select("empresa_id, role, ativo")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !callerProfile || !callerProfile.ativo || callerProfile.role !== "central") {
    return json({ error: "Somente a central pode criar usuários." }, 403);
  }

  let body: { nome?: string; email?: string; senha?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400);
  }

  const nome = (body.nome ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const senha = body.senha ?? "";
  const role = body.role ?? "";

  if (nome.length < 2 || nome.length > 120) return json({ error: "Informe um nome entre 2 e 120 caracteres." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);
  if (senha.length < 8 || senha.length > 72) return json({ error: "A senha precisa ter entre 8 e 72 caracteres." }, 400);
  if (!ALLOWED_ROLES.includes(role)) return json({ error: "Papel inválido." }, 400);

  // Cliente com service_role: só age aqui dentro, nunca chega ao navegador.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    const message = /already.*registered|already.*exists/i.test(createError?.message ?? "")
      ? "Já existe um usuário com este e-mail."
      : "Não foi possível criar o usuário.";
    return json({ error: message }, 400);
  }

  const { error: perfilError } = await adminClient.from("perfis").insert({
    id: created.user.id,
    empresa_id: callerProfile.empresa_id,
    nome,
    role,
    ativo: true,
  });

  if (perfilError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: "Não foi possível concluir o cadastro. Tente novamente." }, 500);
  }

  return json({ id: created.user.id, nome, email, role });
});
