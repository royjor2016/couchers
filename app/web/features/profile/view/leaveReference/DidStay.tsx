import { styled } from "@mui/material";
import TextBody from "components/TextBody";
import { useProfileUser } from "features/profile/hooks/useProfileUser";
import { Trans, useTranslation } from "i18n";
import { GLOBAL, PROFILE } from "i18n/namespaces";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { leaveReferenceBaseRoute, referenceStepStrings } from "routes";

import ReferenceStepHeader from "./formSteps/ReferenceStepHeader";
import { ReferenceContextFormData, ReferenceStepProps } from "./ReferenceForm";
import Button from "components/Button";
import { theme } from "theme";
import { indicateDidntMeetup } from "service/references";
import { useState } from "react";

const StyledForm = styled("form")(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const StyledTextBody = styled(TextBody)(({ theme }) => ({
  "& > .MuiInputBase-root": {
    width: "100%",
  },
  marginTop: theme.spacing(1),
  [theme.breakpoints.up("md")]: {
    "& > .MuiInputBase-root": {
      width: 400,
    },
  },
}));

const StyledButtonContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  paddingTop: theme.spacing(1),
}));

const DidStay = ({
  referenceData,
  setReferenceValues,
  referenceType,
  hostRequestId,
}: ReferenceStepProps) => {
  const { t } = useTranslation([GLOBAL, PROFILE]);
  const user = useProfileUser();
  const router = useRouter();

  const [didStay, setDidStay] = useState<boolean | undefined>(undefined);
  const [reasonDidntMeetup, setReasonDidntMeetup] = useState("");

  console.log("DID STAY USE STATE", didStay);
  console.log("REASON DIDNT STAY", reasonDidntMeetup);

  console.log("IN DID STAY", referenceData);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ReferenceContextFormData>({});

  const onSubmit = handleSubmit((values) => {
    console.log("DID STAY SUBMIT", values);

    setReferenceValues(values);

    // router.push(
    //   `${leaveReferenceBaseRoute}/${referenceType}/${user.userId}/${hostRequestId}/${referenceStepStrings[1]}`,
    // );
  });

  const markDidNotStay = async () => {
    if (hostRequestId) {
      await indicateDidntMeetup({ hostRequestId, reasonDidntMeetup });
    }
  };
  return (
    <>
      <ReferenceStepHeader
        name={user.name}
        referenceType={referenceType}
        isDidStayStep
      />
      <StyledTextBody>
        <Trans
          i18nKey="profile:leave_reference.did_stay_explanation"
          components={{ bold: <strong /> }}
        />
      </StyledTextBody>
      <StyledButtonContainer>
        <Button
          variant="outlined"
          type="submit"
          size="large"
          sx={{ marginTop: 2, marginRight: 2 }}
          onClick={() => {
            setDidStay(false);
          }}
        >
          {t("global:no")}
        </Button>
        <Button
          variant="contained"
          type="submit"
          size="large"
          sx={{ marginTop: 2 }}
          onClick={() => {
            setDidStay(true);
          }}
        >
          {t("global:yes")}
        </Button>
      </StyledButtonContainer>
      {didStay === false && <StyledTextBody onChange={(event) => setReasonDidntMeetup((event.target as HTMLInputElement).value)}></StyledTextBody>}
    </>
  );
};

export default DidStay;
