/**
 * The ONLY seam between features and auth: features call `requireViewer()` and scope every
 * query by `viewer.id`. They never import from src/modules/auth. Auth integration point.
 */
export { getViewer, requireViewer, type Viewer } from "@/modules/auth/viewer"; // @auth-module
// @no-auth: export { getViewer, requireViewer, type Viewer } from "@/lib/single-owner";
