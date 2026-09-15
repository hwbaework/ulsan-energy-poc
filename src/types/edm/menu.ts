export interface MenuItem {
  id: string;
  label: string;
  path?: string;
  icon?: string;
  children?: MenuItem[];
}

export interface TabItem {
  id: string;
  label: string;
  path: string;
  closable: boolean;
}
