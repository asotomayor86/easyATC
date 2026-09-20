import Link from "next/link";

export function Nav({
  code,
  current,
}: {
  code: string;
  current: "vista" | "setup" | "guion" | "tablero" | "formacion";
}) {
  const item = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={`rounded-[2px] px-3 py-1.5 text-sm font-medium ${
        current === key ? "border border-gold text-gold" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {item(`/s/${code}`, "Controlador", "vista")}
      {item(`/s/${code}/setup`, "Variables", "setup")}
      {item(`/s/${code}/guion`, "Guion", "guion")}
      {item(`/s/${code}/tablero`, "Tablero", "tablero")}
      {item(`/s/${code}/formacion`, "Formación", "formacion")}
    </nav>
  );
}
