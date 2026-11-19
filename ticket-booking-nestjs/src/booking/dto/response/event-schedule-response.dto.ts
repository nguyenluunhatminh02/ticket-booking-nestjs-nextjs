export class EventScheduleResponseDto {
  id: string;
  title: string;
  description: string;
  performer: string;
  dayNumber: number;
  startTime: Date;
  endTime: Date;
  sortOrder: number;
}
