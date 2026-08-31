import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function AdminBar() {
  return (
    <header className="flex items-center justify-between gap-6 px-6 py-5 md:px-10">
      <Link href="/" className="font-medium tracking-tight">
        vvDeploy
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Button nativeButton={false} render={<Link href="/new" />}>
          <PlusIcon data-icon="inline-start" />
          接入
        </Button>
        <Link href="/settings" className="text-[var(--mute)] hover:text-[var(--ink)]">
          设置
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="text-[var(--mute)] hover:text-[var(--ink)]">
            退出
          </button>
        </form>
      </nav>
    </header>
  );
}
