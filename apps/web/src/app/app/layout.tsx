import type { ReactNode } from "react";
import { NpsWidget } from "./nps/NpsWidget";

export default function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <NpsWidget />
    </>
  );
}
