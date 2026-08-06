import { BrowserRouter, Route, Routes } from "react-router-dom";

import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import StatePage from "@/pages/StatePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:stateSlug" element={<StatePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
