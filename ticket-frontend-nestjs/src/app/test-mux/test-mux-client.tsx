"use client";

import { useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Test page for Mux video player integration
 * Access at: http://localhost:3000/test-mux
 *
 * This page tests:
 * 1. MuxPlayer component rendering
 * 2. Signed playback with tokens from backend
 * 3. Direct playback with playback ID (unsigned)
 */

const PLAYBACK_ID = "S84CVC01D52WJWkYhwiHsdOE8QQF1ubf7YJ014JcHJoAo";

export default function TestMuxClient() {
  const { user, isLoading } = useAuthStore();
  const [mode, setMode] = useState<"unsigned" | "signed">("unsigned");
  const [tokens, setTokens] = useState<{
    playback: string;
    thumbnail: string;
    storyboard: string;
  } | null>(null);
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = async () => {
    if (!eventId) {
      setError("Vui lòng nhập Event ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(`/livestream/${eventId}/token`);
      setTokens({
        playback: data.playbackToken,
        thumbnail: data.thumbnailToken,
        storyboard: data.storyboardToken,
      });
      setMode("signed");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-gray-950 text-white p-8">Loading...</div>;
  }
  if (!user?.roles?.includes("ROLE_ADMIN")) {
    return <div className="min-h-screen bg-gray-950 text-white p-8">Admin access required.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">🎬 Test Mux Video Player</h1>
        <p className="text-gray-400">
          Playback ID: <code className="bg-gray-800 px-2 py-1 rounded text-green-400">{PLAYBACK_ID}</code>
        </p>

        {/* Mode Toggle */}
        <div className="flex gap-4">
          <button
            onClick={() => { setMode("unsigned"); setError(null); }}
            className={`px-4 py-2 rounded font-medium transition ${
              mode === "unsigned"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Unsigned (Public)
          </button>
          <button
            onClick={() => setMode("signed")}
            className={`px-4 py-2 rounded font-medium transition ${
              mode === "signed"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Signed (Ticket-gated)
          </button>
        </div>

        {/* Signed mode - fetch tokens */}
        {mode === "signed" && !tokens && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Lấy token từ backend</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nhập Event ID (UUID)"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              />
              <button
                onClick={fetchTokens}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium disabled:opacity-50"
              >
                {loading ? "Đang tải..." : "Lấy Token"}
              </button>
            </div>
            {error && <p className="text-red-400 text-sm">❌ {error}</p>}
            <p className="text-gray-500 text-xs">
              Yêu cầu: Đã đăng nhập + có vé hợp lệ cho sự kiện này
            </p>
          </div>
        )}

        {/* Token info */}
        {tokens && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-green-400">✅ Tokens đã lấy thành công</h3>
            <p className="text-xs text-gray-400 break-all">
              Playback: {tokens.playback.substring(0, 50)}...
            </p>
            <button
              onClick={() => { setTokens(null); setMode("unsigned"); }}
              className="text-sm text-gray-500 hover:text-white underline"
            >
              Reset
            </button>
          </div>
        )}

        {/* Player */}
        <div className="rounded-xl overflow-hidden border border-gray-800 bg-black">
          {mode === "unsigned" ? (
            <MuxPlayer
              playbackId={PLAYBACK_ID}
              metadata={{
                video_title: "Test Mux - Unsigned Playback",
                viewer_user_id: "test-user",
              }}
              accentColor="#6366f1"
              style={{ width: "100%", aspectRatio: "16/9" }}
            />
          ) : tokens ? (
            <MuxPlayer
              playbackId={PLAYBACK_ID}
              tokens={{
                playback: tokens.playback,
                thumbnail: tokens.thumbnail,
                storyboard: tokens.storyboard,
              }}
              metadata={{
                video_title: "Test Mux - Signed Playback",
                viewer_user_id: "test-user",
              }}
              accentColor="#6366f1"
              style={{ width: "100%", aspectRatio: "16/9" }}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Nhập Event ID và lấy token để xem video với signed playback
            </div>
          )}
        </div>

        {/* Status info */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2 text-sm">
          <h3 className="font-semibold">📋 Trạng thái</h3>
          <ul className="space-y-1 text-gray-400">
            <li>• Mode: <span className="text-white">{mode}</span></li>
            <li>• MuxPlayer component: <span className="text-green-400">Loaded ✓</span></li>
            <li>• Playback ID: <span className="text-white">{PLAYBACK_ID}</span></li>
            <li>• Tokens: <span className={tokens ? "text-green-400" : "text-yellow-400"}>
              {tokens ? "Available ✓" : "Not fetched"}
            </span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
