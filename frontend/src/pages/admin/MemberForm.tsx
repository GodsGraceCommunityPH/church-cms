import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

import PrimaryButton from "../../components/PrimaryButton";

import FormInput from "../../components/forms/FormInput";
import FormSelect from "../../components/forms/FormSelect";
import FormTextarea from "../../components/forms/FormTextArea";

function MemberForm() {
  const [member, setMember] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    nickname: "",
    gender: "",
    birthday: "",

    membershipStatus: "",
    cellGroup: "",

    mobile: "",
    email: "",
    address: "",

    remarks: "",
  });

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

  return (
    <>
      <Link
        to="/admin/members"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Back to Members
      </Link>

      <div style={{ marginTop: "24px", marginBottom: "40px" }}>
        <h1 className="text-3xl font-bold">Add Member</h1>

        <p className="text-slate-600">Create a new church member.</p>
      </div>

      <form>
        {/* Top Row */}
        <div
          className="grid gap-8 lg:grid-cols-2"
          style={{ marginBottom: "32px" }}
        >
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
              label="Middle Name"
              name="middleName"
              required
              value={member.middleName}
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
              label="Nick Name"
              name="nickName"
              required
              value={member.nickname}
              onChange={handleChange}
            />

            <FormSelect
              label="Gender"
              name="gender"
              options={["Male", "Female"]}
              value={member.gender}
              onChange={handleChange}
            />

            <FormInput
              label="Birthday"
              name="birthday"
              type="date"
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
              options={["Visitor", "Regular Attendee", "Member"]}
              value={member.membershipStatus}
              onChange={handleChange}
            />

            <FormSelect
              label="Cell Group"
              name="cellGroup"
              options={["Victory Cell", "Faith Builders", "Young Adults"]}
              value={member.cellGroup}
              onChange={handleChange}
            />
          </section>
        </div>

        {/* Contact Information */}
        <section
          className="rounded-2xl border border-slate-200 bg-white"
          style={{
            padding: "32px",
            marginBottom: "32px",
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
            marginBottom: "40px",
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
          }}
        >
          <Link
            to="/admin/members"
            className="rounded-xl border border-slate-300 px-6 py-3 hover:bg-slate-50"
          >
            Cancel
          </Link>

          <PrimaryButton type="submit">Save Member</PrimaryButton>
        </div>

        <pre
          style={{
            marginTop: "32px",
            padding: "16px",
            background: "#f8fafc",
            borderRadius: "12px",
            overflowX: "auto",
          }}
        >
          {JSON.stringify(member, null, 2)}
        </pre>
      </form>
    </>
  );
}

export default MemberForm;
