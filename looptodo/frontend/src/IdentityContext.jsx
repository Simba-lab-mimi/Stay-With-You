import React, { createContext, useContext, useState, useCallback } from 'react';
import { userId, setUserName, getDisplayName } from './userId.js';

const IdentityCtx = createContext(null);

export function IdentityProvider({ children }) {
  const [displayName, setDisplay] = useState(getDisplayName);
  const isNew = displayName === null;

  const commitName = useCallback((name) => {
    setUserName(name);
    setDisplay(getDisplayName());
  }, []);

  return (
    <IdentityCtx.Provider value={{ userId, displayName, isNew, commitName }}>
      {children}
    </IdentityCtx.Provider>
  );
}

export function useIdentity() {
  return useContext(IdentityCtx);
}
