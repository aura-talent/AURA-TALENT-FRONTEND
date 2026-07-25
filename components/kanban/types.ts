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
  /** Let each column collapse to its header. Dropping onto a collapsed
   * header still moves the card, so collapsing never costs functionality. */
  collapsible?: boolean;
  /** Column ids that start collapsed (only meaningful with `collapsible`). */
  initialCollapsed?: string[];
};
