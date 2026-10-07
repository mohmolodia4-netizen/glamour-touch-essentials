import { addDays, addMonths, format, isValid, parseISO, startOfDay, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const DATE_PRESETS = ["today", "yesterday", "7d", "30d", "month", "custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

const PRESET_LABELS: Record<DatePreset, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  "7d": "7 jours",
  "30d": "30 jours",
  month: "Ce mois",
  custom: "Personnalisé",
};

export type DateFilterValue = {
  range?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value?: string): Date | undefined {
  if (!value || !DAY_RE.test(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function toDayParam(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/** Resolves the URL params into a half-open [start, end) interval in local time, or null for all dates. */
export function resolveDateBounds(value: DateFilterValue): { start: Date; end: Date } | null {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  switch (value.range) {
    case "today":
      return { start: today, end: tomorrow };
    case "yesterday":
      return { start: addDays(today, -1), end: today };
    case "7d":
      return { start: addDays(today, -6), end: tomorrow };
    case "30d":
      return { start: addDays(today, -29), end: tomorrow };
    case "month":
      return { start: startOfMonth(today), end: tomorrow };
    case "custom": {
      const from = parseDay(value.from);
      if (!from) return null;
      const to = parseDay(value.to) ?? from;
      const [a, b] = from <= to ? [from, to] : [to, from];
      return { start: startOfDay(a), end: addDays(startOfDay(b), 1) };
    }
    default:
      return null;
  }
}

function triggerLabel(value: DateFilterValue) {
  const range = value.range as DatePreset | undefined;
  if (!range || !DATE_PRESETS.includes(range)) return "Toutes les dates";
  if (range !== "custom") return PRESET_LABELS[range];
  const bounds = resolveDateBounds(value);
  if (!bounds) return "Toutes les dates";
  const last = addDays(bounds.end, -1);
  const fmt = (d: Date) => format(d, "d MMM yyyy", { locale: fr });
  return bounds.start.getTime() === last.getTime()
    ? fmt(bounds.start)
    : `${fmt(bounds.start)} – ${fmt(last)}`;
}

export function OrderDateFilter({
  value,
  onChange,
}: {
  value: DateFilterValue;
  onChange: (next: DateFilterValue) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const bounds = resolveDateBounds(value);
  const active = Boolean(bounds);
  const [showCalendar, setShowCalendar] = useState(value.range === "custom");

  const selected: DateRange | undefined =
    value.range === "custom" && bounds
      ? { from: bounds.start, to: addDays(bounds.end, -1) }
      : undefined;

  function pickPreset(preset: DatePreset) {
    if (preset === "custom") {
      setShowCalendar(true);
      if (value.range !== "custom") {
        const today = toDayParam(new Date());
        onChange({ range: "custom", from: today, to: today });
      }
      return;
    }
    setShowCalendar(false);
    onChange({ range: preset, from: undefined, to: undefined });
    setOpen(false);
  }

  function pickRange(next: DateRange | undefined) {
    if (!next?.from) return;
    onChange({
      range: "custom",
      from: toDayParam(next.from),
      to: toDayParam(next.to ?? next.from),
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setShowCalendar(value.range === "custom");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-11 justify-start rounded-sm text-left font-normal sm:w-auto",
              !active && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {triggerLabel(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-wrap gap-1 border-b border-border p-2 sm:w-40 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r">
              <Button
                type="button"
                variant={!active ? "secondary" : "ghost"}
                size="sm"
                className="justify-start rounded-sm"
                onClick={() => {
                  setShowCalendar(false);
                  onChange({ range: undefined, from: undefined, to: undefined });
                  setOpen(false);
                }}
              >
                Toutes les dates
              </Button>
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={value.range === preset && active ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start rounded-sm"
                  onClick={() => pickPreset(preset)}
                >
                  {PRESET_LABELS[preset]}
                </Button>
              ))}
            </div>
            {showCalendar ? (
              <Calendar
                mode="range"
                locale={fr}
                selected={selected}
                onSelect={pickRange}
                defaultMonth={addMonths(selected?.to ?? new Date(), isMobile ? 0 : -1)}
                endMonth={new Date()}
                numberOfMonths={isMobile ? 1 : 2}
                disabled={{ after: new Date() }}
                className="pointer-events-auto p-3"
              />
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      {active ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-sm"
          aria-label="Effacer le filtre de dates"
          onClick={() => onChange({ range: undefined, from: undefined, to: undefined })}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
