import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../firebase";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed:", err);
      throw err;
    }
  };

  const signUpWithEmail = async (email, password, displayName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, {
        displayName: displayName,
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`
      });
      // Force local user state update
      setUser({
        ...userCredential.user,
        displayName
      });
    } catch (err) {
      console.error("Email sign up failed:", err);
      throw err;
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("Email sign in failed:", err);
      throw err;
    }
  };

  const loginAsDemo = () => {
    const demoUser = {
      uid: "demo-user-123",
      displayName: "Demo Advocate",
      email: "demo@civicai.org",
      photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=Demo",
    };
    setUser(demoUser);
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const value = {
    user,
    loginWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    loginAsDemo,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
