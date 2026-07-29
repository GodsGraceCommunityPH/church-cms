import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import PrimaryButton from "../../components/PrimaryButton";

import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import FormTextarea from "../../components/forms/FormTextArea";
import { defaultMember } from "../../features/members/member";
import type { Member } from "../../features/members/member";
import type { CellGroup } from "../../features/cellGroups/cellGroup";
import { supabase } from "../../lib/supabase";
import SearchableSelect from "../../components/ui/SearchableSelect";

function MemberForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [member, setMember] = useState<Member>(defaultMember);
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);

  useEffect(() => {
    loadCellGroups();

    if (isEdit) {
      loadMember();
    }
  }, [id]);

  async function loadMember() {
    const { data, error } = await supabase
      .from("members")
      .select(
        `
    *,
    cell_group:cell_groups!members_cell_group_id_fkey(
      id,
      name
    )
  `,
      )
      .eq("id", id)
      .single();

    console.log("data", data);
    console.log("error", error);

    if (error) {
      console.error(error);
      return;
    }

    setMember({
      id: data.id,
      firstName: data.first_name ?? "",
      lastName: data.last_name ?? "",
      nickname: data.nickname ?? "",
      gender: data.gender ?? "",
      birthday: data.birthday ?? "",

      membershipStatus: data.membership_status ?? "",
      cellGroupId: data.cell_group_id ?? "",
      cellGroup: data.cell_groups?.name ?? "",

      mobile: data.mobile ?? "",
      email: data.email ?? "",
      address: data.address ?? "",

      remarks: data.remarks ?? "",
    });
  }

  async function loadCellGroups() {
    const { data, error } = await supabase
      .from("cell_groups")
      .select("*")
      .eq("status", "Active")
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setCellGroups(data ?? []);
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;

    setMember((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const payload = {
      first_name: member.firstName,
      last_name: member.lastName,
      nickname: member.nickname,
      gender: member.gender,
      birthday: member.birthday || null,

      membership_status: member.membershipStatus,
      cell_group_id: member.cellGroupId || null,

      mobile: member.mobile,
      email: member.email,
      address: member.address,

      remarks: member.remarks,
    };

    let error;

    if (isEdit) {
      ({ error } = await supabase.from("members").update(payload).eq("id", id));
    } else {
      ({ error } = await supabase.from("members").insert(payload));
    }

    if (error) {
      console.error(error);
      alert("Failed to save member.");
      return;
    }

    if (isEdit) {
      navigate(`/admin/members/${id}`);
    } else {
      navigate("/admin/members");
    }
  };

  return (
    <>
      <Link
        to="/admin/members"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Back to Members
      </Link>

      <div
        style={{ marginTop: "24px", marginBottom: "40px", paddingLeft: "20px" }}
      >
        <h1 className="text-3xl font-bold">Add Member</h1>

        <p className="text-slate-600">Create a new church member.</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Top Row */}
        <div className="grid gap-8 lg:grid-cols-2" style={{ margin: "32px" }}>
          {/* Personal Information */}
          <section
            className="rounded-2xl border border-slate-200 bg-white"
            style={{ padding: "32px" }}
          >
            <h2 className="mb-6 text-xl font-semibold">Personal Information</h2>
            <FormInput
              label="First Name"
              name="firstName"
              required
              value={member.firstName}
              onChange={handleChange}
            />
            <FormInput
              label="Last Name"
              name="lastName"
              required
              value={member.lastName}
              onChange={handleChange}
            />
            <FormInput
              label="Nickname"
              name="nickname"
              value={member.nickname}
              onChange={handleChange}
            />

            <FormSelect
              label="Gender"
              name="gender"
              required
              options={[
                { label: "Male", value: "Male" },
                { label: "Female", value: "Female" },
              ]}
              value={member.gender}
              onChange={handleChange}
            />

            <FormInput
              label="Birthday"
              name="birthday"
              type="date"
              required
              value={member.birthday}
              onChange={handleChange}
            />
          </section>

          {/* Church Information */}
          <section
            className="rounded-2xl border border-slate-200 bg-white"
            style={{ padding: "32px" }}
          >
            <h2 className="mb-6 text-xl font-semibold">Church Information</h2>
            <FormSelect
              label="Membership Status"
              name="membershipStatus"
              required
              options={[
                { label: "Visitor", value: "Visitor" },
                { label: "Regular Attendee", value: "Regular Attendee" },
                { label: "Member", value: "Member" },
              ]}
              value={member.membershipStatus}
              onChange={handleChange}
            />
            <SearchableSelect
              value={member.cellGroupId}
              onChange={(value) =>
                setMember({
                  ...member,
                  cellGroupId: value,
                })
              }
              placeholder="Select Cell Group"
              options={cellGroups.map((group) => ({
                id: group.id,
                label: group.name,
              }))}
            />
          </section>
        </div>

        {/* Contact Information */}
        <section
          className="rounded-2xl border border-slate-200 bg-white"
          style={{
            padding: "32px",
            margin: "32px",
          }}
        >
          <h2 className="mb-6 text-xl font-semibold">Contact Information</h2>

          <FormInput
            label="Mobile"
            name="mobile"
            value={member.mobile}
            onChange={handleChange}
          />

          <FormInput
            label="Email"
            name="email"
            type="email"
            value={member.email}
            onChange={handleChange}
          />

          <FormTextarea
            label="Address"
            name="address"
            rows={3}
            value={member.address}
            onChange={handleChange}
          />
        </section>

        {/** Remarks **/}
        <section
          className="rounded-2xl border border-slate-200 bg-white"
          style={{
            padding: "32px",
            margin: "32px",
          }}
        >
          <h2 className="mb-6 text-xl font-semibold">Remarks</h2>

          <FormTextarea
            label="Remarks"
            name="remarks"
            rows={5}
            value={member.remarks}
            onChange={handleChange}
          />
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "16px",
            margin: "0 5px 20px 5px",
            marginBottom: "20px",
          }}
        >
          <Link
            to="/admin/members"
            className="rounded-xl border border-slate-300 px-6 py-3 hover:bg-slate-50"
          >
            <p
              style={{
                padding: "15px 10px 10px 10px ",
              }}
            >
              Cancel
            </p>
          </Link>

          <PrimaryButton type="submit">
            <p
              style={{
                padding: "10px 10px 10px 10px",
              }}
            >
              Save Member
            </p>
          </PrimaryButton>
        </div>
      </form>
    </>
  );
}

export default MemberForm;
