import { SettingsIntro } from "@/components/settings-intro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
export default function Loading() {
  return <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-16 px-6 pb-20 md:px-10" aria-busy="true" aria-label="正在加载设置与凭证">
    <section>
      <SettingsIntro />
      <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_8rem_auto]" aria-label="加载凭证设置">
        <Input disabled placeholder="名称，如 gitee-main" />
        <NativeSelect disabled className="w-full"><NativeSelectOption>Gitee</NativeSelectOption></NativeSelect>
        <Button disabled type="button">生成密钥</Button>
      </form>
      <ul className="mt-8 flex flex-col gap-4" aria-hidden="true">
        <li className="card p-4 motion-safe:animate-pulse">
          <div className="flex h-6 items-center justify-between gap-3"><div className="h-3 w-28 rounded bg-muted" /><div className="h-3 w-8 rounded bg-muted" /></div>
          <div className="mt-3 flex h-6 items-center"><div className="h-3 w-full rounded bg-muted" /></div>
          <div className="flex h-5 items-center"><div className="h-3 w-14 rounded bg-muted" /></div>
        </li>
      </ul>
    </section>
  </main>;
}
