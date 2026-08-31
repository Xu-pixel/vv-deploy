import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/app/actions/auth";
import { isAdmin } from "@/lib/auth";
import { readConfig } from "@/lib/config";

export default async function LoginPage() {
  if (!readConfig().adminKeyHash) redirect("/setup");
  if (await isAdmin()) redirect("/");

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-24">
      <p className="text-sm text-[var(--mute)]">vvDeploy</p>
      <h1 className="mt-4 text-3xl tracking-tight">管理员</h1>
      <ActionForm action={loginAction} className="mt-10 flex flex-col gap-4">
        <Input
          name="key"
          type="password"
          autoComplete="current-password"
          placeholder="Admin 密钥"
          required
        />
        <Button type="submit">进入</Button>
      </ActionForm>
    </main>
  );
}
