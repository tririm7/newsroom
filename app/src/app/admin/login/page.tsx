import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function loginAction(formData: FormData) {
  "use server";
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/admin",
    });
  } catch (err) {
    // NextAuth throws NEXT_REDIRECT on success — let it bubble.
    // Real auth failures throw CredentialsSignin we redirect with ?err=1.
    if ((err as Error)?.message === "NEXT_REDIRECT") throw err;
    redirect("/admin/login?err=1");
  }
}

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ err?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/admin");
  const { err } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form action={loginAction} className="w-full max-w-sm border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
        <h1 className="text-xl font-semibold mb-1">Newsroom admin</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to manage sources, articles, and settings.</p>

        <label className="block text-sm font-medium mb-1" htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
        />

        <label className="block text-sm font-medium mb-1" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
        />

        {err && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            Invalid username or password.
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-black text-white rounded px-3 py-2 text-sm font-semibold hover:bg-gray-800"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
