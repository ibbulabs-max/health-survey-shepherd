import { useState, useEffect } from "react";
import { registerPushSubscriptionFn } from "@/services/notificationService";
import { useAuth } from "./useAuth";

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const { user } = useAuth();

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Register service worker if not already registered
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  const subscribe = async () => {
    if (!isSupported || !user) return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      
      const vapidPublicKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"];
      if (!vapidPublicKey) {
        console.warn("VITE_VAPID_PUBLIC_KEY not set.");
        return false;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await registerPushSubscriptionFn({
        data: {
          userId: user.id,
          subscription: subscription.toJSON(),
        }
      });

      return true;
    } catch (error) {
      console.error("Failed to subscribe to push notifications", error);
      return false;
    }
  };

  return { isSupported, permission, subscribe };
}
