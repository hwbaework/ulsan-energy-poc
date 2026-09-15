export interface CodeGroup {
  id: number;
  code: string;
  name: string;
  description?: string;
}

export interface Code {
  id: number;
  groupCode: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}
