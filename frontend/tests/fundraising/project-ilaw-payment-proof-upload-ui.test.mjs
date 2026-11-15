import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("staff payment proof starts with a button that opens the file picker", async () => {
  const source = await readSource("../../src/pages/admin/ProjectIlawOrderDetail.tsx");

  assert.match(source, /Upload Payment Proof/);
  assert.match(source, /type="button"[\s\S]*?onClick=\{openStaffEvidencePicker\}/);
  assert.match(source, /function openStaffEvidencePicker\(\)[\s\S]*?input\.click\(\)/);
  assert.match(source, /accept=\{EVIDENCE_TYPES\}/);
});

test("selected payment proof is previewed and can be changed or removed", async () => {
  const source = await readSource("../../src/pages/admin/ProjectIlawOrderDetail.tsx");

  assert.match(source, /URL\.createObjectURL\(staffEvidence\)/);
  assert.match(source, /URL\.revokeObjectURL\(previewUrl\)/);
  assert.match(source, /src=\{staffEvidencePreviewUrl\}/);
  assert.match(source, /Preview of \$\{staffEvidence\.name\}/);
  assert.match(source, /\{staffEvidence\.name\}/);
  assert.match(source, /Change file/);
  assert.match(source, /Remove file/);
});

test("the final Upload action appears only after selecting a file", async () => {
  const source = await readSource("../../src/pages/admin/ProjectIlawOrderDetail.tsx");
  const conditionalUpload = source.slice(
    source.indexOf("{staffEvidence && ("),
    source.indexOf("</div>", source.indexOf("{staffEvidence && (")),
  );

  assert.notEqual(conditionalUpload, source);
  assert.match(conditionalUpload, /type="submit"/);
  assert.match(conditionalUpload, /"Upload"/);
  assert.match(conditionalUpload, /disabled=\{Boolean\(busy\) \|\| Boolean\(staffEvidenceError\)\}/);
});

test("unsupported or oversized files show a useful error and cannot be uploaded", async () => {
  const source = await readSource("../../src/pages/admin/ProjectIlawOrderDetail.tsx");

  assert.match(source, /payment proof must be 5 MB or smaller/);
  assert.match(source, /Use a JPG, PNG, WEBP, or PDF payment proof/);
  assert.match(source, /staffEvidenceError && \(/);
});
