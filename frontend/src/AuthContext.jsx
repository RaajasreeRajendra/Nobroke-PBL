import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('nobroke_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('nobroke_user')) || null);

  const login = (jwt, userData) => {
    localStorage.setItem('nobroke_token', jwt);
    localStorage.setItem('nobroke_user', JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('nobroke_token');
    localStorage.removeItem('nobroke_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
