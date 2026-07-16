import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Customer,
  AdminUser,
  getCurrentCustomer,
  getCurrentAdmin,
  logoutCustomer,
  logoutAdmin,
} from '@workspace/api-client-react';

interface AuthContextType {
  customer: Customer | null;
  admin: AdminUser | null;
  setCustomer: (customer: Customer | null) => void;
  setAdmin: (admin: AdminUser | null) => void;
  isCustomerAuthLoaded: boolean;
  isAdminAuthLoaded: boolean;
  logoutCustomer: () => void;
  logoutAdmin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isCustomerAuthLoaded, setIsCustomerAuthLoaded] = useState(false);
  const [isAdminAuthLoaded, setIsAdminAuthLoaded] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadAuth = async () => {
      const [customerResult, adminResult] = await Promise.allSettled([
        getCurrentCustomer(),
        getCurrentAdmin(),
      ]);
      if (customerResult.status === 'fulfilled') setCustomer(customerResult.value);
      if (adminResult.status === 'fulfilled') setAdmin(adminResult.value);
      setIsCustomerAuthLoaded(true);
      setIsAdminAuthLoaded(true);
    };
    loadAuth();
  }, []);

  const handleLogoutCustomer = async () => {
    await logoutCustomer().catch(() => undefined);
    setCustomer(null);
    queryClient.clear(); // Clear all queries
  };

  const handleLogoutAdmin = async () => {
    await logoutAdmin().catch(() => undefined);
    setAdmin(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        customer,
        admin,
        setCustomer,
        setAdmin,
        isCustomerAuthLoaded,
        isAdminAuthLoaded,
        logoutCustomer: handleLogoutCustomer,
        logoutAdmin: handleLogoutAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
