import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

import MobileApp from "./MobileApp";
import { checkAndApplyOtaUpdate } from "./utils/otaUpdate";

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
