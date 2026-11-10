import { ORDER_FORM_FIELDS } from "../../features/fundraising/projectIlaw";

function FieldControl({
  field,
}: {
  field: (typeof ORDER_FORM_FIELDS)[number];
}) {
  const controlId = `order-preview-${field.id}`;

  const control =
    field.control === "select" ? (
      <select id={controlId} disabled defaultValue="">
        <option value="">{field.placeholder ?? "Select an option"}</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : field.control === "textarea" ? (
      <textarea id={controlId} disabled rows={3} placeholder={field.placeholder} />
    ) : (
      <input
        id={controlId}
        type={field.control}
        disabled
        placeholder={field.placeholder}
        min={field.control === "number" ? 1 : undefined}
      />
    );

  return (
    <div className={`order-field${field.wide ? " order-field-wide" : ""}`}>
      <label htmlFor={controlId}>{field.label}</label>
      {control}
      {field.note && <small>{field.note}</small>}
    </div>
  );
}

export default function OrderFormPreview() {
  return (
    <fieldset
      className="order-form-preview"
      aria-describedby="order-form-preview-note"
      disabled
    >
      <legend className="order-form-legend">Order form preview</legend>
      {ORDER_FORM_FIELDS.map((field) => (
        <FieldControl field={field} key={field.id} />
      ))}
      <div className="order-form-footer">
        <button className="order-preview-button" type="button" disabled>
          Ordering not yet open
        </button>
      </div>
    </fieldset>
  );
}
