import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      return NextResponse.json({ error: "Não foi possível encerrar a sessão." }, { status: 500 });
    }
    return NextResponse.json({ signedOut: true });
  } catch {
    return NextResponse.json(
      { error: "A autenticação ainda não foi configurada." },
      { status: 503 },
    );
  }
}
