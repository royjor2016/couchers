import { useTranslation } from "@/i18n";
import { GLOBAL, PROFILE } from "@/i18n/namespaces";
import { useProfileUser } from "../hooks/useProfileUser";
import { View, Image } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Ionicons } from "@expo/vector-icons";
import { HostingStatus, MeetupStatus } from "@/proto/api_pb";
import { MaterialIcons } from "@expo/vector-icons";
import { hostingStatusLabels, meetupStatusLabels } from "../constants";
import { Badges } from "./Badges";
import { theme } from "@/theme";

type UserOverviewProps = {
  showHostAndMeetAvailability: boolean;
  actions?: React.ReactNode;
};

export default function UserOverview({
  showHostAndMeetAvailability,
  actions,
}: UserOverviewProps) {
  const { t } = useTranslation([GLOBAL, PROFILE]);
  const user = useProfileUser();

  const hostingStatus =
    user.hostingStatus ?? HostingStatus.HOSTING_STATUS_UNSPECIFIED;
  const meetupStatus =
    user.meetupStatus ?? MeetupStatus.MEETUP_STATUS_UNSPECIFIED;

  const isActiveHosting = [
    HostingStatus.HOSTING_STATUS_CAN_HOST,
    HostingStatus.HOSTING_STATUS_MAYBE,
  ].includes(hostingStatus);
  const isActiveMeetup = [
    MeetupStatus.MEETUP_STATUS_WANTS_TO_MEETUP,
    MeetupStatus.MEETUP_STATUS_OPEN_TO_MEETUP,
  ].includes(meetupStatus);

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
      }}
    >
      <View>
        {user.avatarUrl && (
          <Image
            source={{ uri: user.avatarUrl }}
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
            }}
          />
        )}
        {showHostAndMeetAvailability && (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <MaterialIcons
                name="hotel"
                size={24}
                style={{
                  marginRight: 8,
                  color: isActiveHosting ? undefined : "gray",
                }}
              />
              <ThemedText
                style={{
                  color: isActiveHosting ? undefined : "gray",
                }}
              >
                {hostingStatusLabels(t)[hostingStatus]}
              </ThemedText>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Ionicons
                name="location-outline"
                size={24}
                style={{
                  marginRight: 8,
                  color: isActiveMeetup ? undefined : "gray",
                }}
              />
              <ThemedText
                style={{
                  color: isActiveMeetup ? undefined : "gray",
                }}
              >
                {meetupStatusLabels(t)[meetupStatus]}
              </ThemedText>
            </View>
          </>
        )}
      </View>
      <View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <ThemedText type="title" style={{ fontSize: 24 }}>
            {user.name}
          </ThemedText>
          {user.hasStrongVerification ? (
            <MaterialIcons
              name="verified-user"
              size={24}
              style={{
                paddingLeft: 8,
                paddingRight: 8,
                color: theme.palette.primary.main,
              }}
            />
          ) : null}
        </View>
        <ThemedText style={{ fontSize: 15, marginBottom: 8 }}>
          {user.city}
        </ThemedText>
        <Badges user={user} />

        {actions && (
          <View style={{ width: 100, paddingLeft: 16, marginTop: 16 }}>
            {actions}
          </View>
        )}
      </View>
    </View>
  );
}
