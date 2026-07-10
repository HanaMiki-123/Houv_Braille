import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "../styles/public/App.css";
import json from '../hooks/components/compo_route.json';

import Home from '../page/home/pages/Home';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={json.home_page.p1} element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
