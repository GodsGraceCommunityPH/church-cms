import { useState } from "react";
import Modal from "../../components/Modal";
import Button from "../../components/ui/Button";

interface InviteLinkModalProps {
  open: boolean;
  link: string;
  groupName: string;
  onClose: () => void;
}

export default function InviteLinkModal({
  open,
  link,
  onClose,
}: InviteLinkModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(link);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  async function handleShare() {
    if (!navigator.share) {
      handleCopy();
      return;
    }

    await navigator.share({
      title: "Church Invitation",
      text: "Join our Cell Group!",
      url: link,
    });
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <Modal open={open} title="🔗 Invite to Cell Group" onClose={onClose}>
      <div className="space-y-6">
        <div>
          <p className="text-base font-medium text-gray-800">
            Share this invitation
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Anyone with this link can register and will automatically join this
            cell group.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="
            w-full
            bg-transparent
            text-sm
            font-mono
            text-gray-700
            outline-none
          "
          />
        </div>

        <div
          style={{ padding: "20px 10px 10px 0" }}
          className="flex justify-end gap-3"
        >
          <Button type="button" onClick={onClose}>
            Close
          </Button>

          {canShare && (
            <Button type="button" onClick={handleShare}>
              Share
            </Button>
          )}

          <Button type="button" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy Link"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
