"use client";

import type { ReactNode } from "react";

/** Standard 2-column form | list layout for CRUD pages */
export function FormSplitLayout({
  form,
  list,
}: {
  form: ReactNode;
  list: ReactNode;
}) {
  return (
    <div className="grid gap-4 desktop:grid-cols-[340px_1fr]">
      <div className="min-w-0">{form}</div>
      <div className="min-w-0">{list}</div>
    </div>
  );
}
