import { appGetLayout } from "components/AppRoute";
import CenteredSpinner from "components/CenteredSpinner/CenteredSpinner";
import { useListAvailableReferences } from "features/profile/hooks/referencesHooks";
import useCurrentUser from "features/userQueries/useCurrentUser";
import { GLOBAL, NOTIFICATIONS, PROFILE } from "i18n/namespaces";
import { translationStaticProps } from "i18n/server-side-translations";
import { GetStaticPaths, GetStaticProps } from "next";
import { useRouter } from "next/router";
import {
  AvailableWriteReferenceType,
  ReferenceType,
} from "proto/references_pb";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listPendingReferencesToWrite } from "service/references";
import stringOrFirstString from "utils/stringOrFirstString";

export const getStaticPaths: GetStaticPaths = () => ({
  paths: [
    {
      params: {
        slug: ["friend", "hosted", "surfed"],
      },
    },
    {
      params: {
        slug: ["friend", "hosted", "surfed", "1"],
      },
    },
    {
      params: {
        slug: ["friend", "hosted", "surfed", "2"],
      },
    },
    {
      params: {
        slug: ["friend", "hosted", "surfed", "3"],
      },
    },
    {
      params: {
        slug: ["friend", "hosted", "surfed", "4"],
      },
    },
    {
      params: {
        slug: ["friend", "hosted", "surfed", "5"],
      },
    },
  ],
  fallback: "blocking",
});

export const getStaticProps: GetStaticProps = translationStaticProps([
  GLOBAL,
  NOTIFICATIONS,
  PROFILE,
]);

// export const getServerSideProps: GetServerSideProps = async (context) => {

//   return {
//     props: {
//       ...(await serverSideTranslations(context.locale ?? "en", [
//         GLOBAL,
//         NOTIFICATIONS,
//         PROFILE,
//       ])),
//     },
//   };
// };

export const mapReferenceTypeToString = {
  [ReferenceType.REFERENCE_TYPE_FRIEND]: "friend",
  [ReferenceType.REFERENCE_TYPE_HOSTED]: "hosted",
  [ReferenceType.REFERENCE_TYPE_SURFED]: "surfed",
};

export default function LeaveReferencePage() {
  const router = useRouter();
  const slug = router.query.slug;
  const { ready } = useTranslation([GLOBAL, NOTIFICATIONS, PROFILE]);
  const parsedHostRequestId = Number.parseInt(stringOrFirstString(slug) ?? "");

  const [error, setError] = useState<string | null>(null);
  const [selectedReference, setSelectedReference] =
    useState<AvailableWriteReferenceType.AsObject | null>(null);

  const { data: user, error: userError } = useCurrentUser();

  const { data: availableReferences } = useListAvailableReferences(
    user?.userId,
  );

  console.log("AVAILABLE REFERENCES", availableReferences);

  console.log("MY ID USER", user, "HOST REQUEST ID", parsedHostRequestId);

  useEffect(() => {
    const fetchPendingReferences = async () => {
      try {
        const pendingReferences = await listPendingReferencesToWrite();

        console.log("PENDING REFERENCES", pendingReferences);

        if (
          !pendingReferences ||
          pendingReferences.pendingReferencesList.length === 0
        )
          return;

        const selectedReference = pendingReferences.pendingReferencesList.find(
          (reference: AvailableWriteReferenceType.AsObject) =>
            reference.hostRequestId === parsedHostRequestId,
        );

        console.log("selectedReference", selectedReference);

        if (!selectedReference) {
          setError("No pending reference found");
          return;
        }

        setSelectedReference(selectedReference ?? null);
      } catch (err) {
        console.error(err);
        setError("Error fetching pending references");
      }
    };
    fetchPendingReferences();
  }, [parsedHostRequestId, ready, router, user]);

  // leave-reference/:type/:userId/:hostRequestId?
  // leave-reference/friend/:userId/:step?
  // leave-reference/surfed|hosted/:userId/:hostRequestId/:step?

  // if (!slug?.[0]) return <NotFoundPage />;

  // if (!parsedUserId) return <NotFoundPage />;
  // const parsedUserId = Number.parseInt(slug[1]);
  // if (isNaN(parsedUserId)) return <NotFoundPage />;
  // let step: string | undefined = undefined;
  // let hostRequestId = undefined;
  // if (parsedReferenceType === "friend") {
  //   step = slug?.[2];
  // } else {
  //   hostRequestId = slug?.[2];
  //   if (!hostRequestId) return <NotFoundPage />;
  //   step = slug?.[3];
  // }
  // const parsedStep = referenceStepStrings.find((s) => s === step);

  // const parsedHostRequestId = hostRequestId
  //   ? Number.parseInt(hostRequestId)
  //   : undefined;

  // if (selectedReference) {
  //   const referenceType = selectedReference?.referenceType
  //     ? mapReferenceTypeToString[selectedReference?.referenceType]
  //     : undefined;

  //   if (referenceType) {
  //     router.push(
  //       `/leave-reference/${referenceType}/${user?.userId}/${selectedReference?.hostRequestId}/1`,
  //     );
  //   } else {
  //     setError("Unknown reference type");
  //   }
  // }

  useEffect(() => {
    if (selectedReference) {
      const referenceType = selectedReference?.referenceType
        ? mapReferenceTypeToString[selectedReference?.referenceType]
        : undefined;

      if (referenceType) {
        // router.push(
        //   `/leave-reference/${referenceType}/${user?.userId}/${selectedReference?.hostRequestId}/1`,
        // );
      } else {
        setError("Unknown reference type");
      }
    }
  }, [selectedReference, user, router]);
  return (
    <>
      {/* {error && <Alert severity="error">{error}</Alert>}
      {userError && <NotFoundPage />} */}
      <CenteredSpinner />
    </>
  );
}

LeaveReferencePage.getLayout = appGetLayout({ isPrivate: true });
