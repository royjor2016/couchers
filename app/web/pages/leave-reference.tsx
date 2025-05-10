import { appGetLayout } from "components/AppRoute";
import NotFoundPage from "features/NotFoundPage";
import { useListAvailableReferences } from "features/profile/hooks/referencesHooks";
import LeaveReferencePageComponent from "features/profile/view/leaveReference/LeaveReferencePage";
import LeaveReferenceSorter from "features/profile/view/leaveReference/LeaveReferenceSorter";
import useCurrentUser from "features/userQueries/useCurrentUser";
import { GLOBAL, NOTIFICATIONS, PROFILE } from "i18n/namespaces";
import { translationStaticProps } from "i18n/server-side-translations";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";
import { number } from "prop-types";
import {
  AvailableWriteReferencesRes,
  AvailableWriteReferenceType,
} from "proto/references_pb";
import { useEffect } from "react";
import { referenceStepStrings, referenceTypeRouteStrings } from "routes";
import { listPendingReferencesToWrite } from "service/references";

// export const getStaticPaths: GetStaticPaths = () => ({
//   paths: [],
//   fallback: "blocking",
// });

export const getStaticProps: GetStaticProps = translationStaticProps([
  GLOBAL,
  NOTIFICATIONS,
  PROFILE,
]);
export default async function LeaveReferencePage() {
  const router = useRouter();

  const { data: user } = useCurrentUser();

  const [referenceType, setReferenceType] = useState<number | undefined>(
    undefined,
  );
  const [userId, setUserId] = useState<number | undefined>(undefined);

  console.log("CURRENT USER", user);

  // const {
  //   data: availableReferences,
  //   isLoading: isAvailableReferencesLoading,
  //   error: availableReferencesError,
  // } = useListAvailableReferences(user?.userId ?? 0);

  useEffect(() => {
    const fetchPendingReferences = async () => {
      const pendingReferences = await listPendingReferencesToWrite();

      if (
        !pendingReferences ||
        pendingReferences.pendingReferencesList.length === 0
      )
        return;

      const nonExpiredPendingReferences =
        pendingReferences.pendingReferencesList.filter(
          (reference: AvailableWriteReferenceType.AsObject) =>
            new Date(reference.timeExpires) < new Date(),
        );
      console.log("PENDING REFERENCES", pendingReferences);
    };
    fetchPendingReferences();
  }, []);

  // leave-reference/:type/:userId/:hostRequestId?
  // leave-reference/friend/:userId/:step?
  // leave-reference/surfed|hosted/:userId/:hostRequestId/:step?
  const slug = router.query.slug;

  console.log("SLUG", slug);
  // if (!slug?.[0] || !slug?.[1]) return <NotFoundPage />;
  // const referenceType = slug[0];
  // const parsedReferenceType = referenceTypeRouteStrings.find(
  //   (valid) => referenceType === valid,
  // );

  // if (!parsedReferenceType) return <NotFoundPage />;
  // const parsedUserId = Number.parseInt(slug[1]);
  // if (isNaN(parsedUserId)) return <NotFoundPage />;
  // let step: string | undefined = undefined;
  // let hostRequestId = undefined;
  // if (parsedReferenceType === "friend") {
  //   console.log("IN FRIEND")
  //   step = slug?.[2];
  // } else {
  //   hostRequestId = slug?.[2];
  //   if (!hostRequestId) return <NotFoundPage />;
  //   step = slug?.[3];
  // }
  // const parsedStep = referenceStepStrings.find((s) => s === step);

  // console.log("PARSED STEP", parsedStep);
  // const parsedHostRequestId = hostRequestId
  //   ? Number.parseInt(hostRequestId)
  //   : undefined;

  return (
    // <LeaveReferencePageComponent
    //   referenceType={parsedReferenceType}
    //   userId={parsedUserId}
    //   hostRequestId={parsedHostRequestId}
    //   step={parsedStep}
    // />
    // <div>Leave Reference Page</div>
    <LeaveReferenceSorter />
  );
}

LeaveReferencePage.getLayout = appGetLayout({ isPrivate: true });
