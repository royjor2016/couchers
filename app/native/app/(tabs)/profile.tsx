import { profileBaseRoute } from "../routes";
import { Redirect } from "expo-router";

export default function Profile() {
  return <Redirect href={profileBaseRoute} />;
} 
