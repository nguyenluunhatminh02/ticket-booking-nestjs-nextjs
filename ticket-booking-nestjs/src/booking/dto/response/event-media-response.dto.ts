export class EventMediaResponseDto {
  id: string;
  eventId: string;
  mediaType: string;
  filePath: string;
  fileName: string | null;
  fileSize: number | null;
  contentType: string | null;
  caption: string | null;
  sortOrder: number;
  url: string;
  createdAt: Date;
}
