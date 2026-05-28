export type WalletConnectionState = "disconnected" | "loading" | "ready";

export type UserProfile = {
  id: string;
  displayName: string;
  email?: string;
  walletAddress?: string;
  role: "member" | "delegate" | "admin" | "viewer";
};

export type UserSettings = {
  theme: "system" | "light" | "dark";
  notificationsEnabled: boolean;
};
