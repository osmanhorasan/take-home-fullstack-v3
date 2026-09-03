import { CampaignForm } from "@/components/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">New campaign</h1>
      <CampaignForm />
    </div>
  );
}
