import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import routes from './routes';
import GoogleTokenHandler from './auth/GoogleTokenHandler';
import './App.css';
import './responsive-overrides.css';
import InstallPWAButton from './components/InstallPWAButton';


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
      <InstallPWAButton />
    </Router>
  );
}

export default App;
