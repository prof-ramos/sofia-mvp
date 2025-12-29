import { getSupabaseClient } from "@/lib/supabase/client";

export default async function NotesPage() {
  const supabase = getSupabaseClient();
  const { data: notes, error } = await supabase
    .from("notes")
    .select("id, title")
    .order("id", { ascending: true });

  if (error) {
    return (
      <section className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-xl text-center space-y-3">
          <p className="text-sm uppercase tracking-widest text-red-600">Erro</p>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Não foi possível carregar as notas
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm">
            {error.message}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-3xl space-y-4">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
            Supabase
          </p>
          <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
            Notas
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Dados lidos da tabela <code className="font-mono">notes</code> no
            Supabase.
          </p>
        </header>

        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/70 shadow-sm backdrop-blur">
          {notes && notes.length > 0 ? (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {notes.map((note) => (
                <li key={note.id} className="p-4">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {note.title}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    id: {note.id}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400">
              Nenhuma nota encontrada.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
