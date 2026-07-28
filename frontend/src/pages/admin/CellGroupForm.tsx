import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import { useParams } from "react-router-dom";

export default function CellGroupForm() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");

  const { id } = useParams();

  const isEdit = !!id;

  useEffect(() => {
    if (!isEdit) return;

    loadCellGroup();
  }, [id]);

  async function loadCellGroup() {
    const { data, error } = await supabase
      .from("cell_groups")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setName(data.name);
    setDescription(data.description ?? "");
    setStatus(data.status);
  }

  async function saveCellGroup(e: React.FormEvent) {
    e.preventDefault();

    let error;

    if (isEdit) {
      ({ error } = await supabase
        .from("cell_groups")
        .update({
          name,
          description: description || null,
          status,
        })
        .eq("id", id));
    } else {
      ({ error } = await supabase.from("cell_groups").insert({
        name,
        description: description || null,
        status,
      }));
    }

    if (error) {
      console.log(error);
      return;
    }

    navigate("/admin/cell-groups");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>{isEdit ? "Edit Cell Group" : "Add Cell Group"}</h1>

      <form onSubmit={saveCellGroup}>
        <div>
          <label>Name</label>
          <br />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter cell group name"
          />
        </div>

        <br />

        <div>
          <label>Description</label>
          <br />
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a description"
          />
        </div>

        <br />

        <div>
          <label>Status</label>
          <br />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Active</option>
            <option>Inactive</option>
          </Select>
        </div>

        <br />

        <Button type="submit">
          <p>{isEdit ? "Update Cell Group" : "Save Cell Group"}</p>
        </Button>
      </form>
    </div>
  );
}
