export default function WorkforcePage() {
  const months = [42, 46, 49, 55, 61, 67];
  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Planning intelligence</p>
          <h1>Workforce plan</h1>
          <p>
            Connect headcount, hiring velocity, and budget before demand becomes
            a delivery risk.
          </p>
        </div>
        <button className="btn btn-primary">Export plan</button>
      </div>
      <div className="workforce-metrics">
        <article className="panel">
          <p>Current headcount</p>
          <strong>142</strong>
          <span className="chip chip-tier-high">+12 YTD</span>
        </article>
        <article className="panel">
          <p>Approved openings</p>
          <strong>11</strong>
          <span className="chip">8 in progress</span>
        </article>
        <article className="panel">
          <p>Annual hiring budget</p>
          <strong>RM 2.4m</strong>
          <span className="chip chip-tier-high">68% available</span>
        </article>
      </div>
      <div className="workforce-grid">
        <section className="panel employer-section workforce-chart">
          <div className="employer-section-head">
            <div>
              <h2>Headcount forecast</h2>
              <p>Actual and planned growth through Q4</p>
            </div>
            <select className="select">
              <option>All departments</option>
              <option>Engineering</option>
              <option>Product</option>
            </select>
          </div>
          <div className="forecast-chart">
            <div className="chart-y">
              <span>180</span>
              <span>160</span>
              <span>140</span>
              <span>120</span>
            </div>
            <div className="chart-area">
              {months.map((height, index) => (
                <div className="chart-column" key={index}>
                  <span
                    className="actual-bar"
                    style={{ height: `${height * 2}px` }}
                  />
                  <span
                    className="planned-bar"
                    style={{ height: `${(height + 8) * 2}px` }}
                  />
                  <small>
                    {["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][index]}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i className="actual" />
              Current trajectory
            </span>
            <span>
              <i className="planned" />
              Approved plan
            </span>
          </div>
        </section>
        <section className="panel employer-section">
          <div className="employer-section-head">
            <div>
              <h2>Demand signals</h2>
              <p>Predicted pressure by team</p>
            </div>
          </div>
          <div className="demand-list">
            <div>
              <span>
                <strong>Engineering</strong>
                <small>Platform roadmap + attrition risk</small>
              </span>
              <b className="risk-high">High</b>
            </div>
            <div>
              <span>
                <strong>Product</strong>
                <small>Two launches in Q3</small>
              </span>
              <b className="risk-medium">Medium</b>
            </div>
            <div>
              <span>
                <strong>Customer success</strong>
                <small>Growth tracks the sales plan</small>
              </span>
              <b className="risk-low">Covered</b>
            </div>
            <div>
              <span>
                <strong>People</strong>
                <small>Capacity through Q4</small>
              </span>
              <b className="risk-low">Covered</b>
            </div>
          </div>
        </section>
      </div>
      <section className="panel employer-section">
        <div className="employer-section-head">
          <div>
            <h2>Hiring plan by department</h2>
            <p>Approved roles, forecast cost, and delivery confidence</p>
          </div>
        </div>
        <div className="department-plan">
          <div>
            <strong>Engineering</strong>
            <span>6 roles</span>
            <span>RM 1.18m</span>
            <div>
              <i style={{ width: "62%" }} />
            </div>
            <b>62% staffed</b>
          </div>
          <div>
            <strong>Product & Design</strong>
            <span>3 roles</span>
            <span>RM 648k</span>
            <div>
              <i style={{ width: "78%" }} />
            </div>
            <b>78% staffed</b>
          </div>
          <div>
            <strong>Go to market</strong>
            <span>2 roles</span>
            <span>RM 412k</span>
            <div>
              <i style={{ width: "90%" }} />
            </div>
            <b>90% staffed</b>
          </div>
        </div>
      </section>
    </div>
  );
}
