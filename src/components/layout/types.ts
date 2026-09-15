import type { ReactNode } from 'react';
import type { SidebarItem } from './Sidebar';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface HeaderProps {
  className?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export interface SidebarProps {
  items: SidebarItem[];
  className?: string;
}
