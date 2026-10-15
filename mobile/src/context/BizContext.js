import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, STORAGE_KEYS } from '../api/api';
import { useAuth } from './AuthContext';

const BizContext = createContext(null);

export function BizProvider({ children }) {
  const { token, userId } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [currentBiz, setCurrentBiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBusinesses = useCallback(async () => {
    if (!token) {
      setBusinesses([]);
      setCurrentBiz(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api('/businesses');
      const list = Array.isArray(data) ? data : [];
      setBusinesses(list);

      const savedBizId = await AsyncStorage.getItem(STORAGE_KEYS.BIZ_ID);
      const found = list.find((b) => b._id === savedBizId) || list[0] || null;
      setCurrentBiz(found);
      if (found?._id) {
        await AsyncStorage.setItem(STORAGE_KEYS.BIZ_ID, found._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load workspaces');
      console.warn('Error fetching businesses:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const switchBiz = async (bizId) => {
    const found = businesses.find((b) => b._id === bizId);
    if (found) {
      setCurrentBiz(found);
      await AsyncStorage.setItem(STORAGE_KEYS.BIZ_ID, found._id);
    }
  };

  const createBusiness = async ({ name, type, upiId }) => {
    const newBiz = await api('/businesses', {
      method: 'POST',
      body: { name, type, upiId },
    });
    await fetchBusinesses();
    if (newBiz?._id) {
      await switchBiz(newBiz._id);
    }
    return newBiz;
  };

  const updateBusiness = async (bizId, updates) => {
    const updated = await api(`/businesses/${bizId}`, {
      method: 'PATCH',
      body: updates,
    });
    setBusinesses((prev) => prev.map((b) => (b._id === bizId ? { ...b, ...updated } : b)));
    if (currentBiz?._id === bizId) {
      setCurrentBiz((prev) => ({ ...prev, ...updated }));
    }
    return updated;
  };

  const isOwner = Boolean(currentBiz && userId && String(currentBiz.ownerId) === String(userId));

  return (
    <BizContext.Provider
      value={{
        businesses,
        biz: currentBiz,
        currentBizId: currentBiz?._id,
        loading,
        error,
        isOwner,
        refetch: fetchBusinesses,
        switchBiz,
        createBusiness,
        updateBusiness,
      }}>
      {children}
    </BizContext.Provider>
  );
}

export function useBiz() {
  const ctx = useContext(BizContext);
  if (!ctx) throw new Error('useBiz must be used within BizProvider');
  return ctx;
}

