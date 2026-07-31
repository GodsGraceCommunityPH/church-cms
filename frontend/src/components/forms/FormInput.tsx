interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  max?: string;
  pattern?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

function FormInput({
  label,
  name,
  type = "text",
  placeholder = "",
  required = false,
  value,
  onChange,
  max,
  pattern,
  inputMode,
}: FormInputProps) {
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

      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        max={max}
        pattern={pattern}
        inputMode={inputMode}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 transition-colors focus:border-emerald-600 focus:outline-none"
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "12px 16px", font: "inherit" }}
      />
    </div>
  );
}

export default FormInput;
