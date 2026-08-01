import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Main from "./pages/Main";

import "./App.css";

const queryClient = new QueryClient();

function MobileApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <Main />
      </div>
    </QueryClientProvider>
  );
}

export default MobileApp;
