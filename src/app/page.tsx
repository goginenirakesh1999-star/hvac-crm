import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Root router: send managers to the dashboard, callers to the console,
// and anyone signed out to the login page.
export default async function Home() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (me?.role === "admin") redirect("/admin");
  if (me?.role === "closer") redirect("/appointments");
  redirect("/call");
}
