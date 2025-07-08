import { messagesRoute } from "../routes";
import { Redirect } from "expo-router";

export default function Messages() {
  return <Redirect href={messagesRoute} />;
} 
