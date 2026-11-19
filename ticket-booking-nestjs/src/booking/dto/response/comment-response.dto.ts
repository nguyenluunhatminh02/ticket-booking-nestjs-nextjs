export class CommentResponseDto {
  id: string;
  userId: string;
  userName: string | null;
  userAvatarUrl: string | null;
  content: string;
  rating: number | null;
  badgeType: string | null;
  badgeLabel: string | null;
  edited: boolean;
  replies: CommentResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}
