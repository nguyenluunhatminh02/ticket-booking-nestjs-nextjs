export class Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
  roles: any[];
  createdAt: Date;
}
