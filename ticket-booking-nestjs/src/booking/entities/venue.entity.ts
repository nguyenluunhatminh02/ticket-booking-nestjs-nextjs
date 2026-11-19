export class Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  capacity: number;
  seatMapConfig: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  events?: any[];
  createdAt: Date;
  updatedAt: Date;
}
