import React from "react";
import { Outlet } from "react-router-dom";

const VocPage: React.FC = () => {
  return (
    <main>
      <Outlet />
    </main>
  );
};

export default VocPage;
