interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectProps {
  label: string;
  name: string;
  options: SelectOption[];
  required?: boolean;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
}

function FormSelect({
  label,
  name,
  options,
  required = false,
  value,
  onChange,
}: FormSelectProps) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium text-slate-700"
        style={{ display: "block", marginBottom: "8px", color: "#334155", fontSize: "14px", fontWeight: 500 }}
      >
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <select
        id={name}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 transition-colors focus:border-emerald-600 focus:outline-none"
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "12px", background: "white", padding: "12px 16px", font: "inherit" }}
      >
        <option value="">Select {label}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default FormSelect;
