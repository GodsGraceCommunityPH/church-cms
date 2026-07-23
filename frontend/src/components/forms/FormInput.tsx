interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}

function FormInput({
  label,
  name,
  type = "text",
  placeholder = "",
  required = false,
  value,
  onChange,
}: FormInputProps) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium text-slate-700"
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
        className="w-full rounded-xl border border-slate-300 px-4 py-3 transition-colors focus:border-emerald-600 focus:outline-none"
      />
    </div>
  );
}

export default FormInput;
