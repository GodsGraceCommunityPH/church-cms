import { useParams } from "react-router-dom";

export default function CellGroupDetail() {
  const { id } = useParams();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Cell Group</h1>

      <p>ID: {id}</p>
    </div>
  );
}
