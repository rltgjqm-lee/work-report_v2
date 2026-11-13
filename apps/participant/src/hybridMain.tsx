import { StrictMode } from "react";

import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { createRoot } from "react-dom/client";

import { checkAndApplyOtaUpdate } from "./user/utils/otaUpdate";

import MobileApp from "./MobileApp";

import "./App.css";

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark });
  SplashScreen.hide();
  checkAndApplyOtaUpdate();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
);
