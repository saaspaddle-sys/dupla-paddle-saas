"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getCurrentUserAction } from "../services/auth/get-current-user-action";
import type { CurrentUser } from "../services/auth/login";

export type AuthMeResponse = CurrentUser;

interface AuthContextType {
    user: AuthMeResponse | null;
    isLoading: boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthMeResponse | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // `apiFetch` es `server-only`: desde un Client Component solo se puede
    // llegar a `/auth/me` a través de esta Server Action.
    const fetchUser = async () => {
        try {
            const data = await getCurrentUserAction();
            setUser(data);
        } catch (error) {
            console.log('Error al obtener datos de auth/me:', error);
            setUser(null);
        } finally {
            setIsLoading(false)
        }
    };

    useEffect(() => {
        fetchUser();
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoading, refreshUser: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth debe ser usado dentro de un AuthProvider");
    }
    return context
}