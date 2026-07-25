"use client";

import { useRef, useState } from "react";
import type { KanbanBoardProps } from "./types";
import styles from "./KanbanBoard.module.css";

export default function KanbanBoard<T>({
  columns,
  items,
  getItemId,
  getItemColumnId,
  renderCard,
  onCardClick,
  onMove,
  emptyLabel = "No cards here yet.",
  collapsible = false,
  initialCollapsed = [],
}: KanbanBoardProps<T>) {
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(initialCollapsed));
  // Ref (not state) for the dragged item id — state causes a stale closure
  // in handleDrop, since the drop handler closes over the render it was
  // created in, not the latest one.
  const draggedItemIdRef = useRef<string | null>(null);

  function handleDragStart(event: React.DragEvent, itemId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    draggedItemIdRef.current = itemId;
  }

  function handleDragOver(event: React.DragEvent, columnId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDraggedOverColumn(columnId);
  }

  function handleDragLeave() {
    setDraggedOverColumn(null);
  }

  function handleDrop(event: React.DragEvent, columnId: string) {
    event.preventDefault();
    setDraggedOverColumn(null);
    const itemId = event.dataTransfer.getData("text/plain") || draggedItemIdRef.current;
    draggedItemIdRef.current = null;
    if (!itemId) return;
    onMove(itemId, columnId);
  }

  function toggleColumn(columnId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }

  return (
    <div className={styles.scrollContainer}>
      <div className={styles.board}>
        {columns.map((column) => {
          const columnItems = items.filter(
            (item) => getItemColumnId(item) === column.id,
          );
          const isOver = draggedOverColumn === column.id;
          const isCollapsed = collapsible && collapsed.has(column.id);
          const stackId = `kanban-stack-${column.id}`;

          const head = (
            <>
              <span className={styles.columnTitle}>
                {collapsible && (
                  <span className={styles.columnChevron} aria-hidden="true">
                    ›
                  </span>
                )}
                <span
                  className={styles.columnDot}
                  style={{ "--dot-color": column.color } as React.CSSProperties}
                />
                {column.label}
              </span>
              <span className={styles.columnCount}>{columnItems.length}</span>
            </>
          );

          return (
            <div
              key={column.id}
              className={`${styles.column} ${isOver ? styles.columnOver : ""} ${
                isCollapsed ? styles.columnCollapsed : ""
              }`}
              onDragOver={(event) => handleDragOver(event, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(event) => handleDrop(event, column.id)}
            >
              {collapsible ? (
                <button
                  type="button"
                  className={`${styles.columnHead} ${styles.columnHeadButton}`}
                  aria-expanded={!isCollapsed}
                  aria-controls={stackId}
                  onClick={() => toggleColumn(column.id)}
                >
                  {head}
                </button>
              ) : (
                <div className={styles.columnHead}>{head}</div>
              )}

              {!isCollapsed && (
                <div
                  id={stackId}
                  className={styles.cardStack}
                  onDragOver={(event) => handleDragOver(event, column.id)}
                  onDrop={(event) => handleDrop(event, column.id)}
                >
                  {columnItems.length === 0 && (
                    <div className={styles.columnEmpty}>
                      {column.emptyContent ?? emptyLabel}
                    </div>
                  )}
                  {columnItems.map((item) => {
                    const itemId = getItemId(item);
                    return (
                      <div
                        key={itemId}
                        draggable
                        onDragStart={(event) => handleDragStart(event, itemId)}
                        onClick={() => onCardClick?.(item)}
                        className={styles.card}
                      >
                        {renderCard(item)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
