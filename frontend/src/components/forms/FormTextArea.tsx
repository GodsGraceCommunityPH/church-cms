interface FormTextareaProps {
  label: string;
  name: string;
  rows?: number;
  placeholder?: string;

  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}

function FormTextarea({
  label,
  name,
  rows = 4,
  placeholder = "",
  value,
  onChange,
}: FormTextareaProps) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 transition-colors focus:border-emerald-600 focus:outline-none"
      />
    </div>
  );
}

export default FormTextarea;
