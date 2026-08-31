"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { toastError } from "./error-toast";

type State = { error?: string; ok?: string };

export function ActionForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<State | void>;
  children: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const result = await action(formData);
      return result ?? {};
    },
    {},
  );
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (state.error) toastError(state.error);
    if (state.ok) {
      toast.add({ type: "success", title: state.ok });
      onSuccessRef.current?.();
    }
  }, [state]);

  return (
    <form action={formAction} className={className} data-pending={pending}>
      {children}
    </form>
  );
}
