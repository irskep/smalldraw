import { PortalRouter } from "../../utils/router";
import { useAccountSession } from "../../utils/account";

export const App = ({ onPageChange }: { onPageChange?: () => void }) => {
  useAccountSession();
  return <PortalRouter onPageChange={onPageChange} />;
};
