import LeaveReferencePage from "features/profile/view/leaveReference/LeaveReferencePage";
import { useRouter } from "next/router";

export default function LeaveReferenceStepPage() {
  const router = useRouter();
  const { hostRequestId, referenceType, step, userId } = router.query;

  const parsedUserId = Number.parseInt(userId as string);
  const parsedHostRequestId = Number.parseInt(hostRequestId as string);
  const parsedReferenceType = referenceType as string;
  const parsedStep = Number.parseInt(step as string);

  return (
    <LeaveReferencePage
      hostRequestId={parsedHostRequestId}
      referenceType={parsedReferenceType}
      step={parsedStep}
      userId={parsedUserId}
    />
  );
}
