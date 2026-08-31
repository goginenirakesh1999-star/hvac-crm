import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin-only: issue a temporary password for a team member who is locked out.
// Sign-in emails here are synthetic, so no reset link can be mailed — the
// admin hands over the temporary password and the member changes it at
// /account. Nothing is stored; the password is shown once in the response.
function tempPassword(): string {
  const words = ["anvil", "boulder", "cedar", "dozer", "ember", "forge", "granite", "harvest",
                 "ingot", "jasper", "kiln", "lumber", "mesa", "nickel", "outpost", "quarry"];
  const bytes = new Uint32Array(3);
  crypto.getRandomValues(bytes);
  const pick = (i: number) => words[bytes[i] % words.length];
  return `${pick(0)}-${pick(1)}-${(bytes[2] % 9000) + 1000}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }

  const { userId } = await req.json();
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "Pick a team member." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (!target) return NextResponse.json({ error: "No such team member." }, { status: 404 });

  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ name: target.full_name, password });
}
