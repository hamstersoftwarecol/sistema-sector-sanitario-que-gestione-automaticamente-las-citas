import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-bold tracking-tight text-slate-900", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
        <HeartPulse className="size-5" aria-hidden />
      </span>
      <span>
        MediCita <span className="text-brand-600">IA</span>
      </span>
    </Link>
  );
}
