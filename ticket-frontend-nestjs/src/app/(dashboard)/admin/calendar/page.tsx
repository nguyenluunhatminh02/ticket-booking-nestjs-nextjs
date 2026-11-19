"use client";

import { useState, useMemo, useCallback } from "react";
import { useAdminEvents, useCreateEvent, type CreateEventPayload } from "@/hooks/use-admin-events";
import { useUploadImages, useUploadVideo } from "@/hooks/use-event-media";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Music,
  Trophy,
  Theater,
  Laugh,
  PartyPopper,
  GraduationCap,
  Circle,
  ImagePlus,
  Video,
  X,
  Loader2,
  Check,
} from "lucide-react";
import Link from "next/link";
import type { EventResponse, Venue } from "@/types/booking";

/* ────── Constants ────── */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CATEGORIES = [
  { value: "CONCERT", label: "Concert", icon: Music },
  { value: "SPORTS", label: "Sports", icon: Trophy },
  { value: "THEATER", label: "Theater", icon: Theater },
  { value: "COMEDY", label: "Comedy", icon: Laugh },
  { value: "FESTIVAL", label: "Festival", icon: PartyPopper },
  { value: "CONFERENCE", label: "Conference", icon: GraduationCap },
  { value: "OTHER", label: "Other", icon: Circle },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-blue-100 text-blue-700",
  ON_SALE: "bg-green-100 text-green-700",
  PRESALE: "bg-purple-100 text-purple-700",
  SOLD_OUT: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-200 text-red-800",
  COMPLETED: "bg-gray-200 text-gray-800",
};

const CATEGORY_COLORS: Record<string, string> = {
  CONCERT: "bg-pink-500",
  SPORTS: "bg-green-500",
  THEATER: "bg-purple-500",
  COMEDY: "bg-yellow-500",
  FESTIVAL: "bg-orange-500",
  CONFERENCE: "bg-blue-500",
  OTHER: "bg-gray-500",
};

/* ────── Calendar Page ────── */
export default function AdminCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { data: eventsPage, isLoading } = useAdminEvents(0, 200);

  const events = eventsPage?.content ?? [];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-based

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Days from previous month
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    // Fill remaining cells
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventResponse[]>();
    events.forEach((event) => {
      const d = new Date(event.eventDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    return map;
  }, [events]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const isSelected = (d: Date) =>
    selectedDate &&
    d.getFullYear() === selectedDate.getFullYear() &&
    d.getMonth() === selectedDate.getMonth() &&
    d.getDate() === selectedDate.getDate();

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCreateOnDate = (date: Date) => {
    setSelectedDate(date);
    setShowCreate(true);
  };

  // Events on the selected date
  const selectedDateEvents = selectedDate
    ? eventsByDate.get(
        `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`
      ) ?? []
    : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" />
            Event Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {events.length} events total
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
            </DialogHeader>
            <CreateEventForm
              initialDate={selectedDate}
              onSuccess={() => setShowCreate(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Calendar Grid */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {FULL_MONTHS[month]} {year}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToday}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_OF_WEEK.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                const dayEvents = eventsByDate.get(key) ?? [];
                const _isToday = isToday(date);
                const _isSelected = isSelected(date);

                return (
                  <button
                    key={idx}
                    onClick={() => handleDayClick(date)}
                    onDoubleClick={() => handleCreateOnDate(date)}
                    className={`
                      relative min-h-[80px] p-1.5 text-left transition-colors bg-background
                      hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-primary/50
                      ${!isCurrentMonth ? "text-muted-foreground/40" : ""}
                      ${_isSelected ? "ring-2 ring-primary bg-primary/5" : ""}
                    `}
                  >
                    <span
                      className={`
                        inline-flex items-center justify-center h-6 w-6 text-xs font-medium rounded-full
                        ${_isToday ? "bg-primary text-primary-foreground" : ""}
                      `}
                    >
                      {date.getDate()}
                    </span>

                    {/* Event dots */}
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white font-medium ${
                            CATEGORY_COLORS[ev.category] || "bg-gray-500"
                          }`}
                          title={ev.name}
                        >
                          {ev.name.length > 15
                            ? ev.name.substring(0, 15) + "…"
                            : ev.name}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground pl-1">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Selected Date Events */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {selectedDate
                  ? selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                  : "Select a date"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground mb-3">
                    No events on this day
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Create
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDateEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="block p-2.5 rounded-lg hover:bg-accent/50 transition-colors border"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-1 self-stretch rounded-full ${
                            CATEGORY_COLORS[event.category] || "bg-gray-400"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {event.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.eventDate).toLocaleTimeString(
                              "en-US",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                            {event.venue?.name && ` · ${event.venue.name}`}
                          </p>
                          <div className="flex gap-1 mt-1.5">
                            <Badge
                              className={`text-[10px] px-1.5 py-0 ${
                                STATUS_COLORS[event.status] || ""
                              }`}
                              variant="secondary"
                            >
                              {event.status}
                            </Badge>
                            {event.eventMode !== "OFFLINE" && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {event.eventMode}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {events
                  .filter((e) => new Date(e.eventDate) >= today)
                  .sort(
                    (a, b) =>
                      new Date(a.eventDate).getTime() -
                      new Date(b.eventDate).getTime()
                  )
                  .slice(0, 5)
                  .map((event) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${
                          CATEGORY_COLORS[event.category] || "bg-gray-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {event.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(event.eventDate).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ────── Create Event Form ────── */
interface CreateEventFormProps {
  initialDate: Date | null;
  onSuccess: () => void;
}

function CreateEventForm({ initialDate, onSuccess }: CreateEventFormProps) {
  const createEvent = useCreateEvent();

  // Fetch venues
  const { data: venues } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data } = await apiClient.get<Venue[]>("/venues");
      return data;
    },
  });

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [artistName, setArtistName] = useState("");
  const [category, setCategory] = useState("CONCERT");
  const [venueId, setVenueId] = useState("");
  const [eventDate, setEventDate] = useState(
    initialDate
      ? `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, "0")}-${String(initialDate.getDate()).padStart(2, "0")}T19:00`
      : ""
  );
  const [doorsOpenAt, setDoorsOpenAt] = useState("");
  const [maxTicketsPerUser, setMaxTicketsPerUser] = useState(4);
  const [queueEnabled, setQueueEnabled] = useState(false);

  // Media upload state
  const [createdEventId, setCreatedEventId] = useState<string>("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoCaption, setVideoCaption] = useState("");
  const [step, setStep] = useState<"details" | "media" | "done">("details");

  const uploadImages = useUploadImages(createdEventId);
  const uploadVideo = useUploadVideo(createdEventId);

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreateEventPayload = {
      venueId,
      name,
      category,
      eventDate: new Date(eventDate).toISOString(),
      maxTicketsPerUser,
      queueEnabled,
    };
    if (description) payload.description = description;
    if (artistName) payload.artistName = artistName;
    if (doorsOpenAt) payload.doorsOpenAt = new Date(doorsOpenAt).toISOString();

    try {
      const event = await createEvent.mutateAsync(payload);
      setCreatedEventId(event.id);
      setStep("media");
    } catch (err) {
      // error handled by mutation
    }
  };

  const handleUploadMedia = async () => {
    try {
      if (imageFiles.length > 0) {
        await uploadImages.mutateAsync(imageFiles);
      }
      if (videoFile) {
        await uploadVideo.mutateAsync({ file: videoFile, caption: videoCaption || undefined });
      }
      setStep("done");
      setTimeout(() => onSuccess(), 1500);
    } catch (err) {
      // error
    }
  };

  const handleSkipMedia = () => {
    onSuccess();
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold">Event Created!</h3>
        <p className="text-sm text-muted-foreground">
          Your event has been created successfully.
        </p>
        <Link href={`/events/${createdEventId}`}>
          <Button variant="outline">View Event</Button>
        </Link>
      </div>
    );
  }

  if (step === "media") {
    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <h3 className="font-semibold">Upload Media</h3>
          <p className="text-sm text-muted-foreground">
            Add images and videos to your event gallery (optional)
          </p>
        </div>

        {/* Image Upload */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4" />
            Images (up to 20)
          </Label>
          <div className="border-2 border-dashed rounded-lg p-4">
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setImageFiles((prev) => [...prev, ...files].slice(0, 20));
                e.target.value = "";
              }}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                file:text-sm file:font-medium file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90 cursor-pointer"
            />
          </div>
          {imageFiles.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {imageFiles.map((f, i) => (
                <div key={i} className="relative group">
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="w-full h-20 object-cover rounded-md"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {f.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Upload */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Gallery Video (optional)
          </Label>
          <div className="border-2 border-dashed rounded-lg p-4">
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setVideoFile(file);
              }}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                file:text-sm file:font-medium file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90 cursor-pointer"
            />
          </div>
          {videoFile && (
            <div className="flex items-center gap-3 p-2 bg-muted rounded-md">
              <Video className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{videoFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Video caption"
                  value={videoCaption}
                  onChange={(e) => setVideoCaption(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setVideoFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="ghost" onClick={handleSkipMedia}>
            Skip
          </Button>
          <Button
            onClick={handleUploadMedia}
            disabled={
              (imageFiles.length === 0 && !videoFile) ||
              uploadImages.isPending ||
              uploadVideo.isPending
            }
          >
            {uploadImages.isPending || uploadVideo.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Upload ({imageFiles.length + (videoFile ? 1 : 0)} files)
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitDetails} className="space-y-4">
      {/* Venue */}
      <div className="space-y-1.5">
        <Label htmlFor="venue">Venue *</Label>
        <select
          id="venue"
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select a venue...</option>
          {venues?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.city}
            </option>
          ))}
        </select>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Event Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Taylor Swift - Eras Tour"
          required
        />
      </div>

      {/* Artist */}
      <div className="space-y-1.5">
        <Label htmlFor="artist">Artist / Performer</Label>
        <Input
          id="artist"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          placeholder="e.g. Taylor Swift"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="desc">Description</Label>
        <textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your event..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>Category *</Label>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`
                flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors
                ${
                  category === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent/50"
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="eventDate">Event Date & Time *</Label>
          <Input
            id="eventDate"
            type="datetime-local"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doorsOpenAt">Doors Open At</Label>
          <Input
            id="doorsOpenAt"
            type="datetime-local"
            value={doorsOpenAt}
            onChange={(e) => setDoorsOpenAt(e.target.value)}
          />
        </div>
      </div>

      {/* Max Tickets & Queue */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="maxTickets">Max Tickets Per User</Label>
          <Input
            id="maxTickets"
            type="number"
            min={1}
            max={10}
            value={maxTicketsPerUser}
            onChange={(e) => setMaxTicketsPerUser(parseInt(e.target.value) || 4)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Queue System</Label>
          <button
            type="button"
            onClick={() => setQueueEnabled(!queueEnabled)}
            className={`
              flex items-center gap-2 h-9 w-full rounded-md border px-3 text-sm transition-colors
              ${queueEnabled ? "border-primary bg-primary/10" : "border-input"}
            `}
          >
            <div
              className={`h-4 w-4 rounded border flex items-center justify-center ${
                queueEnabled
                  ? "bg-primary border-primary"
                  : "border-muted-foreground"
              }`}
            >
              {queueEnabled && <Check className="h-3 w-3 text-white" />}
            </div>
            Enable Queue
          </button>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          type="submit"
          disabled={createEvent.isPending || !name || !venueId || !eventDate}
        >
          {createEvent.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Event → Next: Upload Media"
          )}
        </Button>
      </div>

      {createEvent.isError && (
        <p className="text-sm text-red-500">
          {(createEvent.error as any)?.response?.data?.message ||
            "Failed to create event"}
        </p>
      )}
    </form>
  );
}
