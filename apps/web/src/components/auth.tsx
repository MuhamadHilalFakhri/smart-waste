"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ApiError, type User } from "@smart-waste/api-client";
import { api } from "@/lib/api";

type Auth = {
  user: User | null;
  loading: boolean;
  error: string;
  setUser: (user: User | null) => void;
  reload: () => void;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .me()
      .then(setUser)
      .catch((e) => {
        setUser(null);
        if (!(e instanceof ApiError && e.status === 401)) setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    reload();
    const clear = () => setUser(null);
    window.addEventListener("sw:unauthorized", clear);
    return () => window.removeEventListener("sw:unauthorized", clear);
  }, [reload]);
  return (
    <Context.Provider value={{ user, loading, error, setUser, reload }}>
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider missing");
  return auth;
}
