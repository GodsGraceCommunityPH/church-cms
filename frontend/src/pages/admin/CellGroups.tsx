import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { CellGroup } from "../../features/cellGroups/cellGroup";
import { mapCellGroup } from "../../features/cellGroups/cellGroupMapper";
import PrimaryButton from "../../components/PrimaryButton";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";

export default function CellGroups() {
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);

  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    loadCellGroups();
  }, []);

  async function loadCellGroups() {
    const { data, error } = await supabase
      .from("cell_groups")
      .select("*")
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setCellGroups(data.map(mapCellGroup));
  }

  return (
    <>
      {" "}
      <div
        style={{ padding: "10px 20px 0 20px" }}
        className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Cell Groups</h1>
          <p className="text-slate-600">Manage church cell groups.</p>
        </div>

        <PrimaryButton to="/admin/cell-groups/new">
          <p style={{ padding: "5px 10px" }}>Add Cell Group</p>
        </PrimaryButton>
      </div>
      <div style={{ padding: "10px 20px 0 20px " }}>
        <Input
          placeholder="Search cell groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div style={{ padding: "10px 20px 0 20px" }}>
        {cellGroups.length === 0 ? (
          <p>No cell groups yet.</p>
        ) : (
          cellGroups
            .filter((group) =>
              group.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((group) => (
              <div style={{ paddingTop: "20px" }}>
                <Card
                  key={group.id}
                  onClick={() => navigate(`/admin/cell-groups/${group.id}`)}
                  className="mb-4"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                          {group.name}
                        </h2>

                        <p className="mt-2 text-sm text-slate-600">
                          {group.description || "No description"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          group.status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {group.status}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            ))
        )}
      </div>
    </>
  );
}
