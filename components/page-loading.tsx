"use client";
import { SkeletonSwap } from "./interior/skeleton-swap";
export function PageLoading() {
 return <div className="mx-auto w-full max-w-7xl px-6 pt-24 md:px-10" role="status" aria-label="正在切换页面">
   <p className="mb-6 text-sm text-muted-foreground">正在加载页面…</p>
   <SkeletonSwap ready={false} delay={0} reserve={150} lines={5} label="加载项目"><span /></SkeletonSwap>
   <div className="mt-8 grid gap-8 lg:grid-cols-2">{[0,1].map(n => <SkeletonSwap key={n} ready={false} delay={0} reserve={260} lines={9} label="加载详情"><span /></SkeletonSwap>)}</div>
 </div>;
}
