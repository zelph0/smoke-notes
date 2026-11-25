import { createCn } from "cn/config";

// `border-ui` and `ring-ui` (src/app/globals.css) set width from the --border-width token. Unconfigured,
// cn reads them as colours and drops them next to `border-input` / `ring-foreground/10`, so the token
// never reached any component. Registering them as width utilities keeps them.
export const cn = createCn({
  extend: {
    classGroups: {
      "border-w": [{ border: ["ui"] }],
      "ring-w": [{ ring: ["ui"] }],
    },
  },
});
