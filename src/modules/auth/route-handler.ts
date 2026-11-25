import { auth } from "./server";

// Proxies /api/auth/* to the branch's Neon Auth endpoint and manages session cookies.
export const { GET, POST, PUT, PATCH, DELETE } = auth.handler();
