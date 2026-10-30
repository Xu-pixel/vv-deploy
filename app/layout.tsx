import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { ensureRuntimeDirs } from "@/lib/paths";
import "./globals.css";
import { cn } from "@/lib/utils";



const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "vv-deploy",
  description: "小公司持续部署",
};

ensureRuntimeDirs();

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={cn("h-full antialiased font-sans", mono.variable)}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
