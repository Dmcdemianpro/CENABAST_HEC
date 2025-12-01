import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  right,
  children,
  className,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        // blanco real + borde suave + sombra que da “producto”
        "rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
