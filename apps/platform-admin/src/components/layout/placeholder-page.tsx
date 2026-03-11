interface PlaceholderPageProps {
  title: string;
  description: string;
  epicReference?: string;
}

export function PlaceholderPage({ title, description, epicReference }: PlaceholderPageProps) {
  return (
    <div className="animate-fade-in-up p-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
        {epicReference && <p className="mt-4 text-sm text-muted-foreground/60">{epicReference}</p>}
      </div>
    </div>
  );
}
