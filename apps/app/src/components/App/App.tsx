import { useAccountSession } from "../../utils/account";
import { PortalRouter } from "../../utils/router";

export const App = ({ onPageChange }: { onPageChange?: () => void }) => {
  useAccountSession();
  return <PortalRouter onPageChange={onPageChange} />;
};
