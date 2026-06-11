import EmployerShell from "@/components/employer/EmployerShell";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return <EmployerShell>{children}</EmployerShell>;
}
