export class Comment {
  id: string;
  user?: any;
  userId: string;
  event?: any;
  eventId: string;
  content: string;
  rating: number;
  badgeType: string;
  badgeLabel: string;
  parent?: any;
  parentId: string;
  replies?: any[];
  edited: boolean;
  createdAt: Date;
  updatedAt: Date;
}
