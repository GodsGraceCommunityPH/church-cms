import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Textarea from "../../components/ui/Textarea";
import type { MinistryStatus } from "../../features/ministries/ministry";
import {
  getMinistry,
  removeMinistryPicture,
  saveMinistry,
  uploadMinistryPicture,
} from "../../features/ministries/ministryService";

export default function MinistryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<MinistryStatus>("Active");
  const [picture, setPicture] = useState<File | null>(null);
  const [picturePath, setPicturePath] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    void getMinistry(id)
      .then((ministry) => {
        setName(ministry.name);
        setDescription(ministry.description);
        setStatus(ministry.status);
        setPicturePath(ministry.picturePath);
        setPictureUrl(ministry.pictureUrl);
      })
      .catch(() => setError("Unable to load this ministry."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const ministryId = await saveMinistry({ name, description, status }, id);
      if (picture) {
        await uploadMinistryPicture(ministryId, picture, picturePath);
      }
      navigate(`/admin/ministries/${ministryId}`, {
        state: { successMessage: id ? "Ministry updated." : "Ministry created." },
      });
    } catch {
      setError("Unable to save this ministry. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePicture() {
    if (!id || !picturePath) return;
    setSaving(true);
    setError("");
    try {
      await removeMinistryPicture(id, picturePath);
      setPicturePath("");
      setPictureUrl("");
      setPicture(null);
    } catch {
      setError("Unable to remove the ministry picture.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-12 text-center">Loading ministry...</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">
        {id ? "Edit Ministry" : "Add Ministry"}
      </h1>
      <p className="mt-2 text-slate-600">
        Maintain the ministry’s core information and picture.
      </p>
      <form
        className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6"
        onSubmit={handleSubmit}
      >
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Name</span>
          <Input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Description</span>
          <Textarea
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Status</span>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as MinistryStatus)}
          >
            <option>Active</option>
            <option>Inactive</option>
          </Select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">
            Ministry picture
          </span>
          {pictureUrl && (
            <img
              src={pictureUrl}
              alt="Current ministry"
              className="mb-3 h-36 w-36 rounded-xl object-cover"
            />
          )}
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setPicture(event.target.files?.[0] ?? null)}
          />
        </label>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            {picturePath && (
              <Button
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => void handleRemovePicture()}
              >
                Remove picture
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Ministry"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
