import { Bot } from "lucide-react";
import type { AppointmentStatus, BookingSource } from "@/generated/prisma/enums";
import { SOURCE_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/appointments";
import { Badge } from "./ui/feedback";

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function SourceBadge({ source }: { source: BookingSource }) {
  if (source !== "AI_ASSISTANT") return null;
  return (
    <Badge tone="sky">
      <Bot className="size-3" aria-hidden />
      {SOURCE_LABEL[source]}
    </Badge>
  );
}
