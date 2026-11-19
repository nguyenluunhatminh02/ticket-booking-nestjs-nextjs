"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useEventMedia, type EventMediaResponse } from "@/hooks/use-event-media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ImageIcon,
  Video,
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Maximize2,
} from "lucide-react";

interface EventMediaGalleryProps {
  eventId: string;
  className?: string;
}

export default function EventMediaGallery({ eventId, className }: EventMediaGalleryProps) {
  const { data: media, isLoading } = useEventMedia(eventId);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "images" | "videos">("all");

  const filteredMedia = media?.filter((m) => {
    if (activeTab === "images") return m.mediaType === "IMAGE";
    if (activeTab === "videos") return m.mediaType === "VIDEO";
    return true;
  });

  const imageCount = media?.filter((m) => m.mediaType === "IMAGE").length ?? 0;
  const videoCount = media?.filter((m) => m.mediaType === "VIDEO").length ?? 0;

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goNext = useCallback(() => {
    if (filteredMedia && lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % filteredMedia.length);
    }
  }, [filteredMedia, lightboxIndex]);

  const goPrev = useCallback(() => {
    if (filteredMedia && lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + filteredMedia.length) % filteredMedia.length);
    }
  }, [filteredMedia, lightboxIndex]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!media || media.length === 0) return null;

  return (
    <>
      <Card className={`border-0 shadow-sm ${className || ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Media Gallery
            </CardTitle>
            <div className="flex gap-1.5">
              <Badge
                variant={activeTab === "all" ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setActiveTab("all")}
              >
                Tất cả ({media.length})
              </Badge>
              {imageCount > 0 && (
                <Badge
                  variant={activeTab === "images" ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => setActiveTab("images")}
                >
                  <ImageIcon className="h-3 w-3 mr-1" />
                  {imageCount}
                </Badge>
              )}
              {videoCount > 0 && (
                <Badge
                  variant={activeTab === "videos" ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => setActiveTab("videos")}
                >
                  <Video className="h-3 w-3 mr-1" />
                  {videoCount}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredMedia?.map((item, index) => (
              <MediaThumbnail
                key={item.id}
                media={item}
                onClick={() => openLightbox(index)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox Dialog */}
      {lightboxIndex !== null && filteredMedia && (
        <Dialog open={lightboxIndex !== null} onOpenChange={closeLightbox}>
          <DialogContent className="max-w-5xl w-full p-0 bg-black/95 border-none">
            <DialogTitle className="sr-only">Media viewer</DialogTitle>
            <div className="relative flex items-center justify-center min-h-[60vh]">
              {/* Close */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 z-50 text-white hover:bg-white/20"
                onClick={closeLightbox}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Navigation */}
              {filteredMedia.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-3 z-50 text-white hover:bg-white/20 h-12 w-12"
                    onClick={goPrev}
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 z-50 text-white hover:bg-white/20 h-12 w-12"
                    onClick={goNext}
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </>
              )}

              {/* Content */}
              <div className="w-full flex items-center justify-center p-8">
                <LightboxContent media={filteredMedia[lightboxIndex]} />
              </div>

              {/* Caption + Counter */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                {filteredMedia[lightboxIndex].caption && (
                  <p className="text-white text-sm mb-2">
                    {filteredMedia[lightboxIndex].caption}
                  </p>
                )}
                <p className="text-white/60 text-xs">
                  {lightboxIndex + 1} / {filteredMedia.length}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/* ────── Sub-components ────── */
function MediaThumbnail({
  media,
  onClick,
}: {
  media: EventMediaResponse;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-video rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {media.mediaType === "IMAGE" ? (
        <Image
          src={media.url}
          alt={media.caption || media.fileName}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <video
            src={media.url}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="h-6 w-6 text-gray-900 ml-0.5" />
            </div>
          </div>
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <Maximize2 className="h-6 w-6 text-white drop-shadow-lg" />
      </div>

      {/* Type badge */}
      <Badge
        variant="secondary"
        className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 bg-black/60 text-white border-0"
      >
        {media.mediaType === "IMAGE" ? (
          <ImageIcon className="h-3 w-3" />
        ) : (
          <Video className="h-3 w-3" />
        )}
      </Badge>

      {/* Caption */}
      {media.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
          <p className="text-white text-xs truncate">{media.caption}</p>
        </div>
      )}
    </button>
  );
}

function LightboxContent({ media }: { media: EventMediaResponse }) {
  if (media.mediaType === "IMAGE") {
    return (
      <Image
        src={media.url}
        alt={media.caption || media.fileName}
        width={1200}
        height={800}
        className="max-h-[80vh] w-auto object-contain rounded"
        unoptimized
      />
    );
  }

  return (
    <video
      src={media.url}
      controls
      autoPlay
      className="max-h-[80vh] max-w-full rounded"
      style={{ aspectRatio: "16/9" }}
    />
  );
}
