import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FullPageStateProps = {
  icon: ReactNode;
  eyebrow?: string;
  eyebrowTone?: "accent" | "danger";
  title: string;
  description: string;
  children: ReactNode;
};

export function FullPageState({
  icon,
  eyebrow,
  eyebrowTone = "accent",
  title,
  description,
  children,
}: FullPageStateProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#08080f] px-5 text-white">
      <div className="max-w-md text-center">
        {icon}
        {eyebrow ? (
          <p
            className={cn(
              "mt-5 text-xs font-bold tracking-[0.18em] uppercase",
              eyebrowTone === "danger" ? "text-red-200" : "text-violet-300",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-3xl font-black">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">{description}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {children}
        </div>
      </div>
    </main>
  );
}
