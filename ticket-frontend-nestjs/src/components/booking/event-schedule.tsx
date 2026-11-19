"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";
import type { EventScheduleResponse } from "@/types/booking";

export default function EventSchedule({ schedules }: { schedules: EventScheduleResponse[] }) {
  if (!schedules?.length) return null;

  // Group by dayNumber
  const grouped = schedules.reduce<Record<number, EventScheduleResponse[]>>((acc, s) => {
    (acc[s.dayNumber] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Event Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(grouped)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs">
                  Day {day}
                </Badge>
                {items[0]?.title && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {items[0]?.title}
                  </span>
                )}
              </div>
              <div className="relative ml-4 border-l-2 border-primary/20 space-y-4 pl-4">
                {items.map((item) => (
                  <div key={item.id} className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.startTime}
                          {item.endTime && ` – ${item.endTime}`}
                        </span>
                      </div>
                      <p className="text-sm font-semibold mt-0.5">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                      {item.performer && (
                        <p className="text-xs text-primary mt-0.5">
                          Performer: {item.performer}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
