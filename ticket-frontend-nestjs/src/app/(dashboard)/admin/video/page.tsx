"use client";

import { Suspense, useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import * as UpChunk from "@mux/upchunk";
import {
  useVideoStatus,
  useCreateUploadUrl,
  useLinkUpload,
  useAddVideoFromUrl,
  useUpdateVideoSettings,
  useRemoveVideo,
} from "@/hooks/use-admin-video";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload, Link2, Trash2, RefreshCw, Video, CheckCircle,
  AlertCircle, Loader2, Film, Clock, Globe,
} from "lucide-react";

export default function AdminVideoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading...</div>}>
      <AdminVideoPageContent />
    </Suspense>
  );
}

function AdminVideoPageContent() {
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("eventId") || "";

  const [eventId, setEventId] = useState(eventIdParam);
  const [activeEventId, setActiveEventId] = useState(eventIdParam);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL state
  const [videoUrl, setVideoUrl] = useState("");

  // Manual settings state
  const [manualPlaybackId, setManualPlaybackId] = useState("");
  const [manualEventMode, setManualEventMode] = useState("ONLINE");

  // Hooks
  const { data: videoStatus, isLoading: statusLoading, refetch: refetchStatus } = useVideoStatus(activeEventId);
  const createUploadUrl = useCreateUploadUrl();
  const linkUpload = useLinkUpload();
  const addVideoFromUrl = useAddVideoFromUrl();
  const updateVideoSettings = useUpdateVideoSettings();
  const removeVideo = useRemoveVideo();

  const handleLoadEvent = () => {
    if (eventId.trim()) {
      setActiveEventId(eventId.trim());
    }
  };

  // ============ Direct Upload with UpChunk ============
  const handleFileSelect = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !activeEventId) return;

    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadError(null);

    try {
      // 1. Get upload URL from backend
      const { uploadUrl, uploadId: newUploadId } = await createUploadUrl.mutateAsync(activeEventId);
      setUploadId(newUploadId);

      // 2. Upload directly to Mux via UpChunk
      const upload = UpChunk.createUpload({
        endpoint: uploadUrl,
        file,
        chunkSize: 5120, // 5MB chunks
      });

      upload.on("error", (err: { detail: string }) => {
        setUploadStatus("error");
        setUploadError(err.detail || "Upload failed");
      });

      upload.on("progress", (progress: { detail: number }) => {
        setUploadProgress(Math.round(progress.detail));
      });

      upload.on("success", () => {
        setUploadStatus("success");
        setUploadProgress(100);
      });
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Failed to create upload");
    }
  }, [activeEventId, createUploadUrl]);

  // Link upload to event after success
  const handleLinkUpload = async () => {
    if (!uploadId || !activeEventId) return;

    const result = await linkUpload.mutateAsync({ eventId: activeEventId, uploadId });
    if (result.status === "linked") {
      setUploadStatus("idle");
      setUploadProgress(0);
      setUploadId(null);
    }
  };

  // ============ From URL ============
  const handleAddFromUrl = async () => {
    if (!videoUrl.trim() || !activeEventId) return;
    await addVideoFromUrl.mutateAsync({ eventId: activeEventId, videoUrl: videoUrl.trim() });
    setVideoUrl("");
  };

  // ============ Manual Settings ============
  const handleManualUpdate = async () => {
    if (!activeEventId) return;
    await updateVideoSettings.mutateAsync({
      eventId: activeEventId,
      playbackId: manualPlaybackId || undefined,
      eventMode: manualEventMode,
    });
    setManualPlaybackId("");
  };

  // ============ Remove ============
  const handleRemoveVideo = async (deleteMux: boolean) => {
    if (!activeEventId) return;
    if (!confirm(deleteMux
      ? "Xóa video khỏi sự kiện VÀ xóa asset trên Mux?"
      : "Gỡ video khỏi sự kiện (giữ lại trên Mux)?")) return;

    await removeVideo.mutateAsync({ eventId: activeEventId, deleteMuxAsset: deleteMux });
  };

  // Auto-refresh status during polling
  useEffect(() => {
    if (videoStatus?.assetStatus === "preparing") {
      const interval = setInterval(() => refetchStatus(), 5000);
      return () => clearInterval(interval);
    }
  }, [videoStatus?.assetStatus, refetchStatus]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Quản lý Video</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload video trực tiếp lên Mux hoặc thêm link video cho sự kiện
        </p>
      </div>

      {/* Event Selection */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Chọn sự kiện</CardTitle>
          <CardDescription>Nhập Event ID để quản lý video</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Event ID (UUID)"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button onClick={handleLoadEvent} disabled={!eventId.trim()}>
              Tải sự kiện
            </Button>
          </div>
        </CardContent>
      </Card>

      {!activeEventId ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Film className="mx-auto h-12 w-12 mb-3 opacity-40" />
            <p>Nhập Event ID ở trên để bắt đầu quản lý video</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current Status */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Trạng thái Video</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => refetchStatus()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : videoStatus ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-muted-foreground">Has Video</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {videoStatus.hasVideo ? (
                        <><CheckCircle className="h-4 w-4 text-green-600" /><span className="font-semibold text-green-600">Có</span></>
                      ) : (
                        <><AlertCircle className="h-4 w-4 text-gray-400" /><span className="font-semibold text-gray-400">Chưa có</span></>
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-muted-foreground">Event Mode</p>
                    <Badge variant="outline" className="mt-1">
                      <Globe className="h-3 w-3 mr-1" />
                      {videoStatus.eventMode}
                    </Badge>
                  </div>
                  {videoStatus.assetStatus && (
                    <div className="p-3 rounded-lg bg-gray-50">
                      <p className="text-xs text-muted-foreground">Asset Status</p>
                      <Badge
                        variant={videoStatus.assetStatus === "ready" ? "default" : "secondary"}
                        className="mt-1"
                      >
                        {videoStatus.assetStatus === "ready" ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {videoStatus.assetStatus}
                      </Badge>
                    </div>
                  )}
                  {videoStatus.duration && (
                    <div className="p-3 rounded-lg bg-gray-50">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-semibold mt-1">
                        {Math.round(parseFloat(videoStatus.duration))}s
                      </p>
                    </div>
                  )}
                  {videoStatus.playbackId && (
                    <div className="col-span-full p-3 rounded-lg bg-gray-50">
                      <p className="text-xs text-muted-foreground">Playback ID</p>
                      <p className="font-mono text-sm mt-1 break-all">{videoStatus.playbackId}</p>
                    </div>
                  )}
                  {videoStatus.assetId && (
                    <div className="col-span-full p-3 rounded-lg bg-gray-50">
                      <p className="text-xs text-muted-foreground">Asset ID</p>
                      <p className="font-mono text-sm mt-1 break-all">{videoStatus.assetId}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Không thể tải trạng thái video</p>
              )}
            </CardContent>
          </Card>

          {/* Direct Upload */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload trực tiếp
              </CardTitle>
              <CardDescription>
                Upload video trực tiếp từ máy tính lên Mux (sử dụng @mux/upchunk)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-center">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  disabled={uploadStatus === "uploading"}
                  className="flex-1"
                />
              </div>

              {uploadStatus === "uploading" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm font-medium">Đang upload... {uploadProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadStatus === "success" && uploadId && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-700">Upload thành công!</span>
                  </div>
                  <p className="text-sm text-green-600 mb-3">
                    Upload ID: <code className="bg-green-100 px-1 rounded">{uploadId}</code>
                  </p>
                  <Button onClick={handleLinkUpload} disabled={linkUpload.isPending}>
                    {linkUpload.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Đang liên kết...</>
                    ) : (
                      "Liên kết video với sự kiện"
                    )}
                  </Button>
                  {linkUpload.isSuccess && (
                    <p className="text-sm text-green-600 mt-2">
                      Video đã được liên kết thành công!
                    </p>
                  )}
                  {linkUpload.isError && (
                    <p className="text-sm text-red-600 mt-2">
                      Lỗi: Video có thể đang được xử lý. Thử lại sau vài giây.
                    </p>
                  )}
                </div>
              )}

              {uploadStatus === "error" && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-700">Upload thất bại</span>
                  </div>
                  {uploadError && <p className="text-sm text-red-600 mt-1">{uploadError}</p>}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => { setUploadStatus("idle"); setUploadProgress(0); }}
                  >
                    Thử lại
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* From URL */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Thêm từ URL
              </CardTitle>
              <CardDescription>
                Nhập URL video — Mux sẽ tải và xử lý video tự động
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  placeholder="https://example.com/video.mp4"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddFromUrl}
                  disabled={!videoUrl.trim() || addVideoFromUrl.isPending}
                >
                  {addVideoFromUrl.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Thêm video"
                  )}
                </Button>
              </div>
              {addVideoFromUrl.isSuccess && (
                <p className="text-sm text-green-600 mt-2">
                  Video đang được Mux xử lý. Refresh trạng thái sau vài phút.
                </p>
              )}
              {addVideoFromUrl.isError && (
                <p className="text-sm text-red-600 mt-2">
                  Lỗi khi thêm video. Kiểm tra URL và thử lại.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Manual Settings */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5" />
                Cài đặt thủ công
              </CardTitle>
              <CardDescription>
                Nhập Playback ID có sẵn hoặc thay đổi chế độ sự kiện
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Playback ID</label>
                  <Input
                    placeholder="Mux Playback ID"
                    value={manualPlaybackId}
                    onChange={(e) => setManualPlaybackId(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Event Mode</label>
                  <select
                    value={manualEventMode}
                    onChange={(e) => setManualEventMode(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="ONLINE">ONLINE</option>
                    <option value="HYBRID">HYBRID</option>
                    <option value="OFFLINE">OFFLINE</option>
                  </select>
                </div>
              </div>
              <Button
                onClick={handleManualUpdate}
                disabled={updateVideoSettings.isPending}
              >
                {updateVideoSettings.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Đang cập nhật...</>
                ) : (
                  "Cập nhật cài đặt"
                )}
              </Button>
              {updateVideoSettings.isSuccess && (
                <p className="text-sm text-green-600">Cập nhật thành công!</p>
              )}
            </CardContent>
          </Card>

          {/* Remove Video */}
          {videoStatus?.hasVideo && (
            <Card className="border-0 shadow-sm border-red-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  Xóa Video
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleRemoveVideo(false)}
                  disabled={removeVideo.isPending}
                >
                  Gỡ khỏi sự kiện
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleRemoveVideo(true)}
                  disabled={removeVideo.isPending}
                >
                  {removeVideo.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Xóa hoàn toàn (cả trên Mux)
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
