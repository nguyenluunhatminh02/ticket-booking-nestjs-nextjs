import { MediaType } from './enums';

export class EventMedia {
  id: string;
  event?: any;
  eventId: string;
  mediaType: MediaType;
  filePath: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  caption: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
