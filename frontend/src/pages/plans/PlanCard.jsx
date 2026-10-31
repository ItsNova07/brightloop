import { formatMoney } from "../../utils/format.js";

const PER = { monthly: "month", quarterly: "quarter", yearly: "year" };

// One plan: name, price, features. Used by the admin Plans page and the
// customer's Plans & payment page. `badge` and `footer` let each page add
// its own status and buttons; `highlight` marks the customer's current plan.
export function PlanCard({ plan, badge, footer, highlight = false, index = 0 }) {
  return (
    <article className={`plan-card ${highlight ? "plan-card-current" : ""} ${plan.is_public === false ? "plan-card-hidden" : ""}`} style={{ "--i": index }}>
      <header className="plan-card-head">
        <h3 className="plan-name">{plan.name}</h3>
        {badge}
      </header>
      {plan.description && <p className="plan-description">{plan.description}</p>}

      <p className="plan-price">
        <span className="plan-amount">{formatMoney(plan.price)}</span>
        <span className="plan-per">/{PER[plan.billing_cycle] ?? plan.billing_cycle}</span>
      </p>
      {plan.trial_days > 0 && <p className="plan-trial">{plan.trial_days}-day free trial</p>}

      <ul className="plan-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      {footer && <footer className="plan-card-foot">{footer}</footer>}
    </article>
  );
}

export const cycleWord = (cycle) => PER[cycle] ?? cycle;
