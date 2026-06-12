import { Plus, Trash2 } from "lucide-react";
import type { DepartmentPlan } from "./types";
import styles from "./WorkforcePlanner.module.css";

export default function DepartmentPlanEditor({
  departments,
  onChange,
  onAdd,
  onRemove,
}: {
  departments: DepartmentPlan[];
  onChange: (id: number, update: Partial<DepartmentPlan>) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  return (
    <section className="panel employer-section">
      <div className="employer-section-head">
        <div>
          <h2>Hiring plan by department</h2>
          <p>Edit planned roles, budget, and current staffing confidence</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={onAdd}>
          <Plus size={15} /> Add department
        </button>
      </div>

      <div className={styles.departmentHeader} aria-hidden="true">
        <span>Department</span>
        <span>Roles</span>
        <span>Budget (RM)</span>
        <span>Staffed</span>
        <span />
      </div>

      <div className={styles.departmentRows}>
        {departments.map((department) => (
          <div className={styles.departmentRow} key={department.id}>
            <input
              className="input"
              aria-label="Department name"
              value={department.department}
              onChange={(event) =>
                onChange(department.id, { department: event.target.value })
              }
            />
            <input
              className="input"
              aria-label={`${department.department} planned roles`}
              type="number"
              min="0"
              value={department.roles}
              onChange={(event) =>
                onChange(department.id, { roles: Number(event.target.value) })
              }
            />
            <input
              className="input"
              aria-label={`${department.department} budget`}
              type="number"
              min="0"
              step="1000"
              value={department.budget}
              onChange={(event) =>
                onChange(department.id, { budget: Number(event.target.value) })
              }
            />
            <div className={styles.staffedField}>
              <input
                type="range"
                min="0"
                max="100"
                value={department.staffed}
                aria-label={`${department.department} staffed percentage`}
                onChange={(event) =>
                  onChange(department.id, {
                    staffed: Number(event.target.value),
                  })
                }
              />
              <b>{department.staffed}%</b>
            </div>
            <button
              className={styles.removeButton}
              type="button"
              aria-label={`Remove ${department.department}`}
              disabled={departments.length === 1}
              onClick={() => onRemove(department.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
