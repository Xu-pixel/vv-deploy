"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "./copy-button";

export function CopyLink({
  path,
  label,
  icon = false,
}: {
  path: string;
  label: string;
  icon?: boolean;
}) {
  const [value, setValue] = useState(path);
  useEffect(() => {
    setValue(`${window.location.origin}${path}`);
  }, [path]);
  return <CopyButton value={value} label={label} icon={icon} />;
}
