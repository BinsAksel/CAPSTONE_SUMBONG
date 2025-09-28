import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import routes from './routes';
import GoogleTokenHandler from './auth/GoogleTokenHandler';
import './App.css';


function App() {
  return (
    <Router>
      <GoogleTokenHandler />
      <Routes>
        {routes.map((route, index) => (
          <Route
            key={index}
            path={route.path}
            element={route.element}
          />
        ))}
      </Routes>
    </Router>
  );
}

export default App;
