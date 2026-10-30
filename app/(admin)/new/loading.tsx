import { NewProjectIntro } from "@/components/new-intro";
import { NewProjectForm } from "@/components/new-project-form";
export default function Loading() {
  return <main className="mx-auto w-full max-w-xl px-6 pb-20 md:px-10" aria-busy="true" aria-label="正在加载接入仓库">
    <NewProjectIntro />
    <NewProjectForm credentials={[]} loading />
  </main>;
}
