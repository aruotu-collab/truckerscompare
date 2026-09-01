import { isAdminEmail } from "@/lib/admin";
import { requireSignedInUser } from "@/lib/marketplace-server";

export async function requireAdmin() {
  const { user, supabase } = await requireSignedInUser();
  if (!user) return { user: null, supabase, allowed: false as const };
  return { user, supabase, allowed: isAdminEmail(user.email) };
}
