import React, { createContext, useContext, useState, useEffect } from 'react';

type User = {
  id: string;
  tenant_id: string;
  role: string;
  full_name: string;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('sw_token');
      if (storedToken) {
        try {
          const res = await fetch('http://localhost:3001/api/auth/me', {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          
          if (res.ok) {
            const data = await res.json();
            setToken(storedToken);
            setUser(data.user);
          } else {
            // Token is invalid or expired
            localStorage.removeItem('sw_token');
          }
        } catch (error) {
          console.error('Failed to validate token:', error);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    // Note: httpOnly cookies are more secure for token storage, but localStorage is acceptable for this build.
    localStorage.setItem('sw_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('sw_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
