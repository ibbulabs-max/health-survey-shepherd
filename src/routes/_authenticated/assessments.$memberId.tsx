import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MemberAssessmentForm } from "@/components/screening/MemberAssessmentForm";
import { useAuth } from "@/hooks/useAuth";
import { useDataset } from "@/hooks/useDataset";

export const Route = createFileRoute("/_authenticated/assessments/$memberId")({
  component: AssessmentPage,
});

function AssessmentPage() {
  const { memberId } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useDataset();
  const { role } = useAuth();
  
  // Existing assessment mode wrapper
  const member = data?.members.find((m) => m.id === memberId);

  if (!member) {
    return <div className="p-12 text-center text-destructive font-semibold">Member record not found.</div>;
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <MemberAssessmentForm
        memberId={memberId}
        houseUuid={member.houseUuid ?? ""}
        onComplete={() => navigate({ to: "/dashboard" })}
        onCancel={() => navigate({ to: "/houses/$houseId", params: { houseId: member.houseUuid ?? "" } })}
      />
    </div>
  );
}
