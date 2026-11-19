"use client";

import { useState } from "react";
import { useComments, useCreateComment, useDeleteComment, useAverageRating, useCommentEligibility } from "@/hooks/use-comments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Star, Send, Trash2, Lock, Info } from "lucide-react";
import type { CommentResponse } from "@/types/booking";

const BADGE_COLORS: Record<string, string> = {
  VVIP: "bg-purple-100 text-purple-800 border-purple-300",
  VIP: "bg-amber-100 text-amber-800 border-amber-300",
  ATTENDEE: "bg-green-100 text-green-800 border-green-300",
  NONE: "bg-gray-100 text-gray-500 border-gray-300",
};

function StarRating({ rating, onRate }: { rating: number; onRate?: (r: number) => void }) {
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) =>
        onRate ? (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === rating}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => onRate(star)}
            className="p-0.5"
          >
            <Star
              className={`h-4 w-4 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
            />
          </button>
        ) : (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
          />
        )
      )}
    </div>
  );
}

function CommentItem({ comment, eventId, currentUserId }: {
  comment: CommentResponse;
  eventId: string;
  currentUserId?: string;
}) {
  const deleteMutation = useDeleteComment(eventId);

  return (
    <div className="py-3 border-b last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
          {comment.userName?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{comment.userName}</span>
            {comment.badgeType && comment.badgeType !== "NONE" && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full border ${BADGE_COLORS[comment.badgeType] || BADGE_COLORS.NONE}`}>
                {comment.badgeLabel}
              </span>
            )}
            {comment.edited && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
          </div>
          {comment.rating && <StarRating rating={comment.rating} />}
          <p className="text-sm mt-1">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
            {currentUserId === comment.userId && (
              <button
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5"
                onClick={() => deleteMutation.mutate(comment.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>

          {/* Replies */}
          {comment.replies?.length > 0 && (
            <div className="ml-4 mt-2 border-l-2 pl-3 space-y-2">
              {comment.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} eventId={eventId} currentUserId={currentUserId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommentSection({ eventId, currentUserId, eventStatus }: { eventId: string; currentUserId?: string; eventStatus?: string }) {
  const { data, isLoading } = useComments(eventId);
  const { data: avgRating } = useAverageRating(eventId);
  const { data: canComment } = useCommentEligibility(eventId, currentUserId);
  const createMutation = useCreateComment(eventId);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await createMutation.mutateAsync({
      content: content.trim(),
      rating: rating > 0 ? rating : undefined,
    });
    setContent("");
    setRating(0);
  };

  const comments = data?.content ?? [];
  const isCompleted = eventStatus === "COMPLETED";

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments {data?.totalElements ? `(${data.totalElements})` : ""}
          </CardTitle>
          {avgRating !== undefined && avgRating > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-bold">{avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Restriction message */}
        {!isCompleted && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Lock className="h-4 w-4 flex-shrink-0" />
            <span>Comments will be available after the event ends. Only ticket holders can leave reviews.</span>
          </div>
        )}

        {isCompleted && currentUserId && !canComment && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>Only ticket holders can comment on this event.</span>
          </div>
        )}

        {/* Comment form - only show if eligible */}
        {currentUserId && canComment && (
          <div className="space-y-2 pb-4 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Your rating:</span>
              <StarRating rating={rating} onRate={setRating} />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Share your experience..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createMutation.isPending || !content.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Comments list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} eventId={eventId} currentUserId={currentUserId} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
