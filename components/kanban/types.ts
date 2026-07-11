import type { ReactNode } from "react";

export type KanbanColumn = {
  id: string;
  label: string;
  color?: string;
  emptyContent?: ReactNode;
};

export type KanbanBoardProps<T> = {
  columns: KanbanColumn[];
  items: T[];
  getItemId: (item: T) => string;
  getItemColumnId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onCardClick?: (item: T) => void;
  onMove: (itemId: string, toColumnId: string) => void;
  emptyLabel?: string;
};
