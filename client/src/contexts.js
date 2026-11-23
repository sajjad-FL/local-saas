// Kept out of App.jsx on purpose: when App.jsx changes, hot reload re-runs it, and a
// context created there would be a new object that already-loaded pages don't see
// (they'd get null). Contexts that live here stay the same object.
import { createContext, useContext } from 'react';

export const BizContext = createContext(null);
export const useBiz = () => useContext(BizContext);

export const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);
