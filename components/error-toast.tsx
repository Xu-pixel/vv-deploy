"use client";

import { useEffect } from "react";
import { toast } from "@/components/ui/toast";

const toasted = new Map<string, string>();

export function toastError(message: string): void {
  const lines = message.split("\n").map((line) => line.trimEnd()).filter((line) => line.trim());
  const title = lines[0]?.slice(0, 80) || "出错了";
  toast.add({
    type: "error",
    title,
    description: message.trim() || title,
  });
}

export function toastProjectError(id: string, message: string): void {
  if (toasted.get(id) === message) return;
  toasted.set(id, message);
  toastError(message);
}

export function ErrorToast({
  id,
  message,
}: {
  id?: string;
  message?: string | null;
}) {
  useEffect(() => {
    if (!message) {
      if (id) toasted.delete(id);
      return;
    }
    if (id) toastProjectError(id, message);
    else toastError(message);
  }, [id, message]);
  return null;
}
