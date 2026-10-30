"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlusIcon, LayoutGridIcon, Settings2Icon, GitBranchIcon } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const items = [
  { href: "/", label: "全部项目", icon: LayoutGridIcon },
  { href: "/new", label: "接入仓库", icon: GitBranchIcon },
  { href: "/settings", label: "设置与凭证", icon: Settings2Icon },
];

export function AdminBar() {
  const pathname = usePathname();
  const links = items.map(({ href, label, icon: Icon }) => (
    <Link key={href} href={href} onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")} aria-current={pathname === href ? "page" : undefined}>
      <Icon className="size-3.5" aria-hidden="true" />{label}
    </Link>
  ));
  return (
    <>
      <header className="admin-header">
        <div className="flex items-center gap-6">
          <Link href="/" className="brand" aria-label="vvDeploy 首页">vv<span className="brand-mark">[.]</span><span className="brand-suffix">deploy</span></Link>
          <span className="header-caption">WORKSPACE</span>
          <details className="mobile-nav"><summary>导航</summary><nav className="workspace-nav" aria-label="移动导航">{links}</nav></details>
        </div>
        <nav className="flex items-center gap-4" aria-label="快捷操作">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/new" />}><PlusIcon data-icon="inline-start" />接入</Button>
          <form action={logoutAction}><Button type="submit" variant="ghost" size="sm">退出</Button></form>
        </nav>
      </header>
      <aside className="workspace-sidebar">
        <p className="sidebar-label">项目管理</p>
        <nav className="workspace-nav" aria-label="主导航">{links}</nav>
      </aside>
    </>
  );
}
