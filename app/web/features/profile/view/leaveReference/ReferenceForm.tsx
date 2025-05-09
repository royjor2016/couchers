import { Alert } from "@mui/material";
import Redirect from "components/Redirect";
import Appropriate from "features/profile/view/leaveReference/formSteps/Appropriate";
import Rating from "features/profile/view/leaveReference/formSteps/Rating";
import SubmitReference from "features/profile/view/leaveReference/formSteps/submit/SubmitReference";
import Text from "features/profile/view/leaveReference/formSteps/Text";
import { useTranslation } from "i18n";
import { GLOBAL, PROFILE } from "i18n/namespaces";
import { useState } from "react";
import { leaveReferenceBaseRoute, ReferenceStep } from "routes";

export type ReferenceContextFormData = {
  text: string;
  wasAppropriate: string;
  rating: number;
};

export type ReferenceFormInputs = {
  text: string;
  wasAppropriate: boolean;
  rating: number;
};

export interface ReferenceStepProps {
  referenceData: ReferenceContextFormData;
  setReferenceValues: (values: ReferenceContextFormData) => void;
  referenceType: string;
  hostRequestId?: number;
}

interface ReferenceRouteParams {
  referenceType: string;
  userId: number;
  hostRequestId?: number;
  step: ReferenceStep;
}

export default function ReferenceForm({
  referenceType,
  userId,
  hostRequestId,
  step,
}: ReferenceRouteParams) {
  const { t } = useTranslation([GLOBAL, PROFILE]);

  const [referenceData, setReferenceData] = useState<ReferenceContextFormData>({
    text: "",
    wasAppropriate: "",
    rating: 0.33,
  });

  const setReferenceValues = (values: ReferenceContextFormData) => {
    setReferenceData((prevData) => ({
      ...prevData,
      ...values,
    }));
  };

  const isSkippedStep =
    referenceData.wasAppropriate === "" && step !== "appropriate";
  const redirectTo =
    referenceType === "friend"
      ? `${leaveReferenceBaseRoute}/${referenceType}/${userId}`
      : `${leaveReferenceBaseRoute}/${referenceType}/${userId}/${hostRequestId}`;

  return isSkippedStep ? (
    <Redirect to={redirectTo} />
  ) : step === "appropriate" ? (
    <Appropriate
      referenceData={referenceData}
      setReferenceValues={setReferenceValues}
      referenceType={referenceType}
      hostRequestId={hostRequestId}
    />
  ) : step === "rating" ? (
    <Rating
      referenceData={referenceData}
      setReferenceValues={setReferenceValues}
      referenceType={referenceType}
      hostRequestId={hostRequestId}
    />
  ) : step === "reference" ? (
    <Text
      referenceData={referenceData}
      setReferenceValues={setReferenceValues}
      referenceType={referenceType}
      hostRequestId={hostRequestId}
    />
  ) : step === "submit" ? (
    <SubmitReference
      referenceData={referenceData}
      referenceType={referenceType}
      hostRequestId={hostRequestId}
      userId={userId}
    />
  ) : (
    <Alert severity="error">{t("profile:leave_reference.invalid_step")}</Alert>
  );
}
