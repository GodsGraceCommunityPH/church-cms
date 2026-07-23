interface FormSelectProps {
  label: string;
  name: string;
  options: string[];
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
      >
        <option value="">Select {label}</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export default FormSelect;
